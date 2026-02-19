import { randomUUID } from 'crypto';

import type { Pool, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '@/lib/mysql';
import { ensureColumn, safeCreateIndex } from '@/lib/schema/mysql-utils';
import { buildInventoryItemsFromTemplates } from '@/constants/inventory-products';
import { specFieldsToDefaultRecord } from '@/lib/inventory/spec';

let initialized = false;

function formatDateTimeForMySQL(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

const defaultWarehouses = [
  {
    id: 'wh-gz-main',
    name: '广州总部仓',
    code: 'GZ-MAIN',
    type: 'main',
    address: '广州科学城 88 号',
    capacity: 1200,
    manager: '综合调度组',
  },
  {
    id: 'wh-sh-spare',
    name: '上海备件仓',
    code: 'SH-SPARE',
    type: 'store',
    address: '上海张江 66 号',
    capacity: 600,
    manager: '华东运维组',
  },
];

async function seedDefaultItems(pool: Pool) {
  const items = buildInventoryItemsFromTemplates();
  const insertSql = `INSERT INTO inventory_items (
    id, sku, name, unit, unit_price, category, safety_stock,
    barcode, spec_fields_json, default_attributes_json, attributes_json,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  for (const item of items) {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM inventory_items WHERE id = ? OR sku = ? LIMIT 1',
      [item.id, item.sku]
    );
    if (existing.length) {
      continue;
    }

    const defaultRecord = specFieldsToDefaultRecord(item.specFields);
    await pool.query(insertSql, [
      item.id,
      item.sku,
      item.name,
      item.unit,
      item.unitPrice,
      item.category,
      item.safetyStock,
      null,
      item.specFields ? JSON.stringify(item.specFields) : null,
      defaultRecord ? JSON.stringify(defaultRecord) : null,
      null,
      formatDateTimeForMySQL(item.createdAt),
      formatDateTimeForMySQL(item.updatedAt),
    ]);
  }
}

// async function seedDefaultWarehouses(pool: Pool) {
//   await Promise.all(
//     defaultWarehouses.map((warehouse) =>
//       pool.query(
//         `INSERT IGNORE INTO inventory_warehouses (
//           id, name, code, type, address, capacity, manager
//         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
//         [
//           warehouse.id,
//           warehouse.name,
//           warehouse.code,
//           warehouse.type,
//           warehouse.address,
//           warehouse.capacity,
//           warehouse.manager,
//         ]
//       )
//     )
//   );
// }

async function seedInitialSnapshotsAndMovements(pool: Pool) {
  const [[snapshotCountRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM inventory_stock_snapshots'
  );
  const [[movementCountRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM inventory_movements'
  );

  if (Number(snapshotCountRow?.total ?? 0) > 0 || Number(movementCountRow?.total ?? 0) > 0) {
    return;
  }

  const [warehouseRows] = await pool.query<Array<RowDataPacket & { id: string }>>(
    'SELECT id FROM inventory_warehouses ORDER BY created_at ASC'
  );
  if (warehouseRows.length === 0) {
    return;
  }

  const mainWarehouseId =
    warehouseRows.find((row) => row.id === defaultWarehouses[0].id)?.id ?? warehouseRows[0].id;
  const secondaryWarehouseId =
    warehouseRows.find((row) => row.id === defaultWarehouses[1].id)?.id ??
    warehouseRows.find((row) => row.id !== mainWarehouseId)?.id ??
    null;

  const items = buildInventoryItemsFromTemplates();
  const now = Date.now();

  for (const [index, item] of items.entries()) {
    const baseQuantity = Math.max(Math.round(item.safetyStock * 1.4), item.safetyStock + 30);
    const plannedTransfer = secondaryWarehouseId
      ? Math.max(Math.round(baseQuantity * 0.25), Math.min(15, baseQuantity))
      : 0;
    const plannedOutbound = Math.min(
      Math.max(Math.round(baseQuantity * 0.2), 5),
      Math.max(baseQuantity - plannedTransfer, 0)
    );

    const defaultRecord = specFieldsToDefaultRecord(item.specFields);
    const attributesJson = defaultRecord ? JSON.stringify(defaultRecord) : null;
    const unitCost = item.unitPrice;
    const inboundTime = new Date(now - (index + 2) * 24 * 60 * 60 * 1000);
    const transferTime = new Date(inboundTime.getTime() + 2 * 60 * 60 * 1000);
    const outboundTime = new Date(inboundTime.getTime() + 6 * 60 * 60 * 1000);

    // 查找数据库中实际的 item_id (防止因旧数据 ID 不一致导致 FK 错误)
    const [itemRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM inventory_items WHERE sku = ? LIMIT 1',
      [item.sku]
    );
    const itemId = itemRows[0]?.id ?? item.id;

    // 初始化采购入库（主仓）
    await pool.query(
      `INSERT INTO inventory_movements (
        id, direction, type, item_id, warehouse_id, related_order_id,
        quantity, unit_cost, amount, operator_id, occurred_at, attributes_json, notes, created_at
      ) VALUES (?, 'inbound', 'purchase', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        randomUUID(),
        itemId,
        mainWarehouseId,
        `PO-SEED-${String(index + 1).padStart(3, '0')}`,
        baseQuantity,
        unitCost,
        unitCost * baseQuantity,
        'system-seed',
        inboundTime,
        attributesJson,
        '初始化采购入库',
      ]
    );

    if (plannedTransfer > 0 && secondaryWarehouseId) {
      const transferOrderId = `TR-SEED-${String(index + 1).padStart(3, '0')}`;
      // 主仓调拨出库
      await pool.query(
        `INSERT INTO inventory_movements (
          id, direction, type, item_id, warehouse_id, related_order_id,
          quantity, unit_cost, amount, operator_id, occurred_at, attributes_json, notes, created_at
        ) VALUES (?, 'outbound', 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          randomUUID(),
          itemId,
          mainWarehouseId,
          transferOrderId,
          plannedTransfer,
          unitCost,
          unitCost * plannedTransfer,
          'system-seed',
          transferTime,
          attributesJson,
          '初始化调拨出库',
        ]
      );

      // 备仓调拨入库
      await pool.query(
        `INSERT INTO inventory_movements (
          id, direction, type, item_id, warehouse_id, related_order_id,
          quantity, unit_cost, amount, operator_id, occurred_at, attributes_json, notes, created_at
        ) VALUES (?, 'inbound', 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          randomUUID(),
          itemId,
          secondaryWarehouseId,
          transferOrderId,
          plannedTransfer,
          unitCost,
          unitCost * plannedTransfer,
          'system-seed',
          new Date(transferTime.getTime() + 60 * 60 * 1000),
          attributesJson,
          '初始化调拨入库',
        ]
      );
    }

    if (plannedOutbound > 0) {
      await pool.query(
        `INSERT INTO inventory_movements (
          id, direction, type, item_id, warehouse_id, related_order_id,
          quantity, unit_cost, amount, operator_id, occurred_at, attributes_json, notes, created_at
        ) VALUES (?, 'outbound', 'use', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          randomUUID(),
          itemId,
          mainWarehouseId,
          `SO-SEED-${String(index + 1).padStart(3, '0')}`,
          plannedOutbound,
          unitCost * 1.12,
          unitCost * 1.12 * plannedOutbound,
          'system-seed',
          outboundTime,
          attributesJson,
          '初始化领用出库',
        ]
      );
    }

    const mainQuantity = Math.max(baseQuantity - plannedTransfer - plannedOutbound, 0);
    await pool.query(
      `INSERT INTO inventory_stock_snapshots (item_id, warehouse_id, quantity, reserved, updated_at)
       VALUES (?, ?, ?, 0, NOW())
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), reserved = VALUES(reserved), updated_at = NOW()`,
      [itemId, mainWarehouseId, mainQuantity]
    );

    if (secondaryWarehouseId && plannedTransfer > 0) {
      await pool.query(
        `INSERT INTO inventory_stock_snapshots (item_id, warehouse_id, quantity, reserved, updated_at)
         VALUES (?, ?, ?, 0, NOW())
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), reserved = VALUES(reserved), updated_at = NOW()`,
        [itemId, secondaryWarehouseId, plannedTransfer]
      );
    }
  }
}


export async function ensureInventorySchema() {
  if (initialized) return;

  const pool = mysqlPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      sku VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(32) NOT NULL,
      unit_price DECIMAL(16,2) NOT NULL DEFAULT 0,
      category VARCHAR(120) NOT NULL,
      safety_stock INT NOT NULL DEFAULT 0,
      barcode VARCHAR(120) NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME NULL,
      spec_fields_json TEXT NULL,
      default_attributes_json TEXT NULL,
      attributes_json TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_warehouses (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(64) NOT NULL UNIQUE,
      type ENUM('main','store','virtual') NOT NULL DEFAULT 'main',
      address VARCHAR(255) NULL,
      capacity INT NULL,
      manager VARCHAR(120) NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_stock_snapshots (
      item_id VARCHAR(64) NOT NULL,
      warehouse_id VARCHAR(64) NOT NULL,
      quantity DECIMAL(16,3) NOT NULL DEFAULT 0,
      reserved DECIMAL(16,3) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (item_id, warehouse_id),
      CONSTRAINT fk_snapshot_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_snapshot_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      direction ENUM('inbound','outbound') NOT NULL,
      type ENUM('purchase','transfer','adjust','return','use') NOT NULL,
      item_id VARCHAR(64) NOT NULL,
      warehouse_id VARCHAR(64) NOT NULL,
      related_order_id VARCHAR(120) NULL,
      quantity DECIMAL(16,3) NOT NULL,
      unit_cost DECIMAL(16,2) NULL,
      amount DECIMAL(16,2) NULL,
      operator_id VARCHAR(64) NULL,
      occurred_at DATETIME NOT NULL,
      attachments_json TEXT NULL,
      attributes_json TEXT NULL,
      notes TEXT NULL,
      client_id VARCHAR(64) NULL,
      client_type ENUM('personal','company') NULL,
      client_name VARCHAR(255) NULL,
      client_contact VARCHAR(120) NULL,
      client_phone VARCHAR(64) NULL,
      client_address VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      CONSTRAINT fk_movement_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_movement_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_applications (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      number VARCHAR(64) NOT NULL UNIQUE,
      applicant_id VARCHAR(64) NOT NULL,
      applicant_name VARCHAR(120) NOT NULL,
      department VARCHAR(120) NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      type ENUM('use','transfer') NOT NULL DEFAULT 'use',
      reason TEXT NULL,
      warehouse_id VARCHAR(64) NOT NULL,
      warehouse_name VARCHAR(120) NOT NULL,
      approver_id VARCHAR(64) NULL,
      approver_name VARCHAR(120) NULL,
      approved_at DATETIME NULL,
      rejected_at DATETIME NULL,
      rejection_reason TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      CONSTRAINT fk_application_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_application_items (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      application_id VARCHAR(64) NOT NULL,
      item_id VARCHAR(64) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      item_sku VARCHAR(64) NULL,
      quantity DECIMAL(16,3) NOT NULL,
      unit VARCHAR(32) NOT NULL,
      CONSTRAINT fk_app_item_app FOREIGN KEY (application_id) REFERENCES inventory_applications(id) ON DELETE CASCADE,
      CONSTRAINT fk_app_item_main FOREIGN KEY (item_id) REFERENCES inventory_items(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_alerts (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      item_id VARCHAR(64) NOT NULL,
      warehouse_id VARCHAR(64) NULL,
      level ENUM('warning','critical') NOT NULL,
      message VARCHAR(255) NOT NULL,
      resolved TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      resolved_at DATETIME NULL,
      CONSTRAINT fk_alert_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_alert_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('inventory_movements', 'client_id', 'VARCHAR(64) NULL');
  await ensureColumn('inventory_movements', 'client_type', "ENUM('personal','company') NULL");
  await ensureColumn('inventory_movements', 'client_name', 'VARCHAR(255) NULL');
  await ensureColumn('inventory_movements', 'client_contact', 'VARCHAR(120) NULL');
  await ensureColumn('inventory_movements', 'client_phone', 'VARCHAR(64) NULL');
  await ensureColumn('inventory_movements', 'client_address', 'VARCHAR(255) NULL');
  await ensureColumn('inventory_movements', 'related_purchase_id', 'CHAR(36) NULL');
  await ensureColumn('inventory_items', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('inventory_items', 'deleted_at', 'DATETIME NULL');
  await ensureColumn('inventory_warehouses', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('inventory_warehouses', 'deleted_at', 'DATETIME NULL');
  await ensureColumn('inventory_items', 'image_url', 'VARCHAR(512) NULL');

  await safeCreateIndex(
    'CREATE INDEX idx_inventory_movements_item ON inventory_movements(item_id, occurred_at DESC)'
  );
  await safeCreateIndex(
    'CREATE INDEX idx_inventory_movements_direction ON inventory_movements(direction, occurred_at DESC)'
  );
  await safeCreateIndex(
    'CREATE INDEX idx_inventory_movements_related_purchase ON inventory_movements(related_purchase_id, direction, occurred_at DESC)'
  );
  await safeCreateIndex(
    'CREATE INDEX idx_inventory_alerts_resolved ON inventory_alerts(resolved, level)'
  );



  await seedDefaultItems(pool);
  // await seedDefaultWarehouses(pool);
  await seedInitialSnapshotsAndMovements(pool);

  initialized = true;
}
