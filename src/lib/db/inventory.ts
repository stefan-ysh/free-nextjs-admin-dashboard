import { randomUUID } from 'crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { mysqlPool, mysqlQuery, withTransaction } from '@/lib/mysql';
import { ensureInventorySchema } from '@/lib/schema/inventory';
import { ensurePurchasesSchema } from '@/lib/schema/purchases';
import { specFieldsToDefaultRecord } from '@/lib/inventory/spec';
import { normalizeInventoryCategory } from '@/lib/inventory/catalog';
import type {
  InventoryInboundPayload,
  InventoryItem,
  InventoryItemPayload,
  InventoryMovement,
  InventoryOutboundPayload,
  InventorySpecField,
  InventoryStats,
  Warehouse,
  WarehousePayload,
} from '@/types/inventory';

const pool = mysqlPool();
const OPERATIONAL_WAREHOUSE_CODES = ['SCHOOL', 'COMPANY'] as const;
const OPERATIONAL_WAREHOUSE_CONFIG: ReadonlyArray<{
  code: (typeof OPERATIONAL_WAREHOUSE_CODES)[number];
  name: string;
  type: Warehouse['type'];
}> = [
  { code: 'SCHOOL', name: '学校', type: 'main' },
  { code: 'COMPANY', name: '单位', type: 'store' },
];

type InventoryItemRow = RowDataPacket & {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  safety_stock: number;
  image_url: string | null;
  specFields: InventorySpecField[];
  spec_fields_json: string | null;
  default_attributes_json: string | null;
  attributes_json: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type WarehouseRow = RowDataPacket & {
  id: string;
  name: string;
  code: string;
  type: Warehouse['type'];
  is_deleted: number;
  deleted_at: Date | string | null;
  address: string | null;
  capacity: number | null;
  manager: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type MovementRow = RowDataPacket & {
  id: string;
  direction: InventoryMovement['direction'];
  type: InventoryMovement['type'];
  item_id: string;
  warehouse_id: string;
  related_order_id: string | null;
  related_purchase_id: string | null;
  client_id: string | null;
  client_type: InventoryMovement['clientType'] | null;
  client_name: string | null;
  client_contact: string | null;
  client_phone: string | null;
  client_address: string | null;
  quantity: number;
  unit_cost: number | null;
  amount: number | null;
  operator_id: string | null;
  operator_name: string | null;
  occurred_at: Date | string;
  attachments_json: string | null;
  attributes_json: string | null;
  notes: string | null;
  created_at: Date | string;
};

type SnapshotRow = RowDataPacket & {
  item_id: string;
  warehouse_id: string;
  quantity: number;
  reserved: number;
};

type WarehouseUsageRow = RowDataPacket & {
  warehouse_id: string;
  totalQuantity: number | null;
  totalReserved: number | null;
};

type PurchaseInboundProgressRow = RowDataPacket & {
  id: string;
  status: string;
  quantity: number;
  inbound_quantity: number | null;
  inventory_item_id: string | null;
};

export const INVENTORY_ERRORS = {
  ITEM_NOT_FOUND: 'INVENTORY_ITEM_NOT_FOUND',
  WAREHOUSE_NOT_FOUND: 'INVENTORY_WAREHOUSE_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INVENTORY_INSUFFICIENT_STOCK',
  TRANSFER_TARGET_REQUIRED: 'INVENTORY_TRANSFER_TARGET_REQUIRED',
  TRANSFER_TARGET_NOT_FOUND: 'INVENTORY_TRANSFER_TARGET_NOT_FOUND',
  TRANSFER_SAME_WAREHOUSE: 'INVENTORY_TRANSFER_SAME_WAREHOUSE',
  RESERVE_INSUFFICIENT: 'INVENTORY_RESERVE_INSUFFICIENT',
  RESERVE_EXCEEDS: 'INVENTORY_RESERVE_EXCEEDS',
  ITEM_IN_USE: 'INVENTORY_ITEM_IN_USE',
  WAREHOUSE_IN_USE: 'INVENTORY_WAREHOUSE_IN_USE',
  PURCHASE_NOT_FOUND: 'INVENTORY_PURCHASE_NOT_FOUND',
  PURCHASE_STATUS_INVALID: 'INVENTORY_PURCHASE_STATUS_INVALID',
  PURCHASE_ITEM_MISMATCH: 'INVENTORY_PURCHASE_ITEM_MISMATCH',
  PURCHASE_INBOUND_EXCEEDS: 'INVENTORY_PURCHASE_INBOUND_EXCEEDS',
} as const;

type Queryable = PoolConnection | ReturnType<typeof mysqlPool>;

function parseJsonColumn<T>(value: unknown): T | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'object' && !Buffer.isBuffer(value)) {
    return value as T;
  }
  try {
    const text = value instanceof Buffer ? value.toString('utf-8') : String(value);
    if (!text.trim()) {
      return undefined;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn('[inventory] failed to parse JSON column', error);
    return undefined;
  }
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function readLegacyDefaults(row: InventoryItemRow): Record<string, string> | undefined {
  return (
    parseJsonColumn<Record<string, string>>(row.default_attributes_json) ??
    parseJsonColumn<Record<string, string>>(row.attributes_json)
  );
}

function hydrateSpecFields(row: InventoryItemRow): InventorySpecField[] | undefined {
  const specFields = parseJsonColumn<InventorySpecField[]>(row.spec_fields_json);
  if (!specFields || !specFields.length) {
    return specFields ?? undefined;
  }

  const legacyDefaults = readLegacyDefaults(row);
  if (!legacyDefaults) {
    return specFields;
  }

  let mutated = false;
  const hydrated = specFields.map((field) => {
    if (field.defaultValue || !legacyDefaults[field.key]) {
      return field;
    }
    mutated = true;
    return { ...field, defaultValue: legacyDefaults[field.key] };
  });

  return mutated ? hydrated : specFields;
}

function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  const specFields = hydrateSpecFields(row);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    category: normalizeInventoryCategory(row.category),
    safetyStock: Number(row.safety_stock ?? 0),
    imageUrl: row.image_url ?? undefined,
    specFields,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapWarehouse(row: WarehouseRow): Warehouse {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type,
    address: row.address ?? undefined,
    capacity: row.capacity ?? undefined,
    manager: row.manager ?? undefined,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapMovement(row: MovementRow): InventoryMovement {
  return {
    id: row.id,
    direction: row.direction,
    type: row.type,
    itemId: row.item_id,
    warehouseId: row.warehouse_id,
    relatedOrderId: row.related_order_id ?? undefined,
    relatedPurchaseId: row.related_purchase_id ?? undefined,
    clientId: row.client_id ?? undefined,
    clientType: row.client_type ?? undefined,
    clientName: row.client_name ?? undefined,
    clientContact: row.client_contact ?? undefined,
    clientPhone: row.client_phone ?? undefined,
    clientAddress: row.client_address ?? undefined,
    quantity: Number(row.quantity),
    unitCost: row.unit_cost ?? undefined,
    amount: row.amount ?? undefined,
    operatorId: row.operator_id ?? undefined,
    operatorName: row.operator_name ?? undefined,
    occurredAt: toIsoString(row.occurred_at),
    attachments: parseJsonColumn(row.attachments_json),
    attributes: parseJsonColumn(row.attributes_json),
    notes: row.notes ?? undefined,
    createdAt: toIsoString(row.created_at),
  };
}



async function fetchItem(queryable: Queryable, id: string, lock = false): Promise<InventoryItemRow | null> {
  const sql = lock
    ? 'SELECT * FROM inventory_items WHERE id = ? AND is_deleted = 0 LIMIT 1 FOR UPDATE'
    : 'SELECT * FROM inventory_items WHERE id = ? AND is_deleted = 0 LIMIT 1';
  const [rows] = await queryable.query<InventoryItemRow[]>(sql, [id]);
  return rows[0] ?? null;
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  await ensureInventorySchema();
  const row = await fetchItem(pool, id);
  if (!row) return null;

  const item = mapInventoryItem(row);

  const [stockRows] = await pool.query<(RowDataPacket & { total: number })[]>(
    `SELECT SUM(quantity) as total 
     FROM inventory_stock_snapshots 
     WHERE item_id = ?`,
    [id]
  );
  item.stockQuantity = Number(stockRows[0]?.total ?? 0);

  return item;
}

async function fetchWarehouse(queryable: Queryable, id: string): Promise<WarehouseRow | null> {
  const [rows] = await queryable.query<WarehouseRow[]>(
    'SELECT * FROM inventory_warehouses WHERE id = ? AND is_deleted = 0 LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

export async function getWarehouse(id: string): Promise<Warehouse | null> {
  await ensureInventorySchema();
  const row = await fetchWarehouse(pool, id);
  return row ? mapWarehouse(row) : null;
}

async function fetchSnapshot(
  queryable: Queryable,
  itemId: string,
  warehouseId: string
): Promise<SnapshotRow | null> {
  const [rows] = await queryable.query<SnapshotRow[]>(
    'SELECT * FROM inventory_stock_snapshots WHERE item_id = ? AND warehouse_id = ? LIMIT 1',
    [itemId, warehouseId]
  );
  return rows[0] ?? null;
}

async function fetchMovement(queryable: Queryable, id: string): Promise<InventoryMovement | null> {
  const [rows] = await queryable.query<MovementRow[]>(
    'SELECT * FROM inventory_movements WHERE id = ? LIMIT 1',
    [id]
  );
  const row = rows[0];
  return row ? mapMovement(row) : null;
}

export async function listInventoryItems(): Promise<InventoryItem[]> {
  await ensureInventorySchema();
  const [rows] = await pool.query<InventoryItemRow[]>(
    'SELECT * FROM inventory_items WHERE is_deleted = 0 ORDER BY name ASC'
  );

  const [stockRows] = await pool.query<(RowDataPacket & { item_id: string; total: number })[]>(
    `SELECT item_id, SUM(quantity) as total 
     FROM inventory_stock_snapshots 
     GROUP BY item_id`
  );
  
  const stockMap = new Map<string, number>(stockRows.map((r) => [r.item_id, Number(r.total)]));

  return rows.map((row) => {
    const item = mapInventoryItem(row);
    item.stockQuantity = stockMap.get(item.id) ?? 0;
    return item;
  });
}

export async function listWarehouses(): Promise<Warehouse[]> {
  await ensureInventorySchema();
  const [rows] = await pool.query<WarehouseRow[]>(
    'SELECT * FROM inventory_warehouses WHERE is_deleted = 0 ORDER BY name ASC'
  );
  const [usageRows] = await pool.query<WarehouseUsageRow[]>(
    `SELECT s.warehouse_id, SUM(s.quantity) AS totalQuantity, SUM(s.reserved) AS totalReserved
     FROM inventory_stock_snapshots s
     JOIN inventory_warehouses w ON w.id = s.warehouse_id AND w.is_deleted = 0
     GROUP BY s.warehouse_id`
  );
  const usageMap = new Map<string, WarehouseUsageRow>(usageRows.map((row) => [row.warehouse_id, row]));
  return rows.map((row) => {
    const warehouse = mapWarehouse(row);
    const usage = usageMap.get(warehouse.id);
    return {
      ...warehouse,
      stockQuantity: Number(usage?.totalQuantity ?? 0),
      stockReserved: Number(usage?.totalReserved ?? 0),
    } as Warehouse;
  });
}

export async function ensureOperationalWarehouses(): Promise<void> {
  await ensureInventorySchema();

  for (const warehouse of OPERATIONAL_WAREHOUSE_CONFIG) {
    const [rows] = await pool.query<WarehouseRow[]>(
      'SELECT * FROM inventory_warehouses WHERE code = ? LIMIT 1',
      [warehouse.code]
    );
    const existing = rows[0];
    if (!existing) {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO inventory_warehouses (
          id, name, code, type, address, capacity, manager
        ) VALUES (?, ?, ?, ?, NULL, NULL, NULL)`,
        [id, warehouse.name, warehouse.code, warehouse.type]
      );
      continue;
    }

    if (existing.is_deleted || existing.name !== warehouse.name || existing.type !== warehouse.type) {
      await pool.query(
        `UPDATE inventory_warehouses
         SET name = ?, type = ?, is_deleted = 0, deleted_at = NULL
         WHERE code = ?`,
        [warehouse.name, warehouse.type, warehouse.code]
      );
    }
  }
}

export async function listOperationalWarehouses(): Promise<Warehouse[]> {
  await ensureOperationalWarehouses();
  const warehouses = await listWarehouses();
  const ordered = new Map<string, number>([
    ['SCHOOL', 0],
    ['COMPANY', 1],
  ]);
  return warehouses
    .filter((warehouse) =>
      OPERATIONAL_WAREHOUSE_CODES.includes(warehouse.code as (typeof OPERATIONAL_WAREHOUSE_CODES)[number])
    )
    .sort((a, b) => (ordered.get(a.code) ?? 99) - (ordered.get(b.code) ?? 99));
}

export async function createInventoryItem(payload: InventoryItemPayload): Promise<InventoryItem> {
  await ensureInventorySchema();
  const id = randomUUID();
  const defaultRecord = specFieldsToDefaultRecord(payload.specFields);

  await pool.query(
    `INSERT INTO inventory_items (
      id, sku, name, unit, category, safety_stock, image_url,
      spec_fields_json, default_attributes_json, attributes_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.sku,
      payload.name,
      payload.unit,
      normalizeInventoryCategory(payload.category),
      payload.safetyStock,
      payload.imageUrl ?? null,
      payload.specFields ? JSON.stringify(payload.specFields) : null,
      defaultRecord ? JSON.stringify(defaultRecord) : null,
      null,
      new Date(),
      new Date(),
    ]
  );

  const created = await getInventoryItem(id);
  if (!created) {
    throw new Error('INVENTORY_ITEM_CREATE_FAILED');
  }
  return created;
}

export async function updateInventoryItem(
  id: string,
  payload: Partial<InventoryItemPayload>
): Promise<InventoryItem | null> {
  await ensureInventorySchema();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (payload.sku !== undefined) {
    updates.push('sku = ?');
    values.push(payload.sku);
  }
  if (payload.name !== undefined) {
    updates.push('name = ?');
    values.push(payload.name);
  }
  if (payload.unit !== undefined) {
    updates.push('unit = ?');
    values.push(payload.unit);
  }
  if (payload.category !== undefined) {
    updates.push('category = ?');
    values.push(normalizeInventoryCategory(payload.category));
  }
  if (payload.safetyStock !== undefined) {
    updates.push('safety_stock = ?');
    values.push(payload.safetyStock);
  }
  if (payload.imageUrl !== undefined) {
    updates.push('image_url = ?');
    values.push(payload.imageUrl ?? null);
  }
  if (payload.specFields !== undefined) {
    updates.push('spec_fields_json = ?');
    values.push(payload.specFields ? JSON.stringify(payload.specFields) : null);
    const defaultRecord =
      payload.specFields && specFieldsToDefaultRecord(payload.specFields);
    updates.push('default_attributes_json = ?');
    values.push(defaultRecord ? JSON.stringify(defaultRecord) : null);
    updates.push('attributes_json = NULL');
  }

  if (!updates.length) {
    return getInventoryItem(id);
  }

  await pool.query(`UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ? AND is_deleted = 0`, [
    ...values,
    id,
  ]);
  return getInventoryItem(id);
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  await ensureInventorySchema();
  return withTransaction(async (connection) => {
    // Lock the item first
    const item = await fetchItem(connection, id, true);
    if (!item) return false;

    const [[usageRow]] = await connection.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(quantity), 0) AS quantity,
         COALESCE(SUM(reserved), 0) AS reserved
       FROM inventory_stock_snapshots
       WHERE item_id = ?`,
      [id]
    );
    if (Number(usageRow?.quantity ?? 0) > 0 || Number(usageRow?.reserved ?? 0) > 0) {
      throw new Error(INVENTORY_ERRORS.ITEM_IN_USE);
    }
    const [[movementRow]] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM inventory_movements WHERE item_id = ?',
      [id]
    );
    if (Number(movementRow?.total ?? 0) > 0) {
      throw new Error(INVENTORY_ERRORS.ITEM_IN_USE);
    }
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE inventory_items SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0',
      [id]
    );
    return result.affectedRows > 0;
  });
}

export async function createWarehouse(payload: WarehousePayload): Promise<Warehouse> {
  await ensureInventorySchema();
  const id = randomUUID();

  await pool.query(
    `INSERT INTO inventory_warehouses (
      id, name, code, type, address, capacity, manager, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.name,
      payload.code,
      payload.type,
      payload.address ?? null,
      payload.capacity ?? null,
      payload.manager ?? null,
      new Date(),
      new Date(),
    ]
  );

  const warehouse = await getWarehouse(id);
  if (!warehouse) {
    throw new Error('INVENTORY_WAREHOUSE_CREATE_FAILED');
  }
  return warehouse;
}

export async function updateWarehouse(
  id: string,
  payload: Partial<WarehousePayload>
): Promise<Warehouse | null> {
  await ensureInventorySchema();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (payload.name !== undefined) {
    updates.push('name = ?');
    values.push(payload.name);
  }
  if (payload.code !== undefined) {
    updates.push('code = ?');
    values.push(payload.code);
  }
  if (payload.type !== undefined) {
    updates.push('type = ?');
    values.push(payload.type);
  }
  if (payload.address !== undefined) {
    updates.push('address = ?');
    values.push(payload.address ?? null);
  }
  if (payload.capacity !== undefined) {
    updates.push('capacity = ?');
    values.push(payload.capacity ?? null);
  }
  if (payload.manager !== undefined) {
    updates.push('manager = ?');
    values.push(payload.manager ?? null);
  }

  if (!updates.length) {
    return getWarehouse(id);
  }

  await pool.query(`UPDATE inventory_warehouses SET ${updates.join(', ')} WHERE id = ? AND is_deleted = 0`, [
    ...values,
    id,
  ]);
  return getWarehouse(id);
}

export async function deleteWarehouse(id: string): Promise<boolean> {
  await ensureInventorySchema();
  const [[usageRow]] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(quantity), 0) AS quantity,
       COALESCE(SUM(reserved), 0) AS reserved
     FROM inventory_stock_snapshots
     WHERE warehouse_id = ?`,
    [id]
  );
  if (Number(usageRow?.quantity ?? 0) > 0 || Number(usageRow?.reserved ?? 0) > 0) {
    throw new Error(INVENTORY_ERRORS.WAREHOUSE_IN_USE);
  }
  const [[movementRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM inventory_movements WHERE warehouse_id = ?',
    [id]
  );
  if (Number(movementRow?.total ?? 0) > 0) {
    throw new Error(INVENTORY_ERRORS.WAREHOUSE_IN_USE);
  }
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE inventory_warehouses SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0',
    [id]
  );
  return result.affectedRows > 0;
}

export async function listMovements(limit = 50): Promise<InventoryMovement[]> {
  await ensureInventorySchema();
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const [rows] = await pool.query<MovementRow[]>(
    `
      SELECT
        m.*,
        COALESCE(op.display_name, op.email) AS operator_name
      FROM inventory_movements m
      LEFT JOIN hr_employees op ON op.id = m.operator_id
      ORDER BY m.occurred_at DESC, m.created_at DESC
      LIMIT ?
    `,
    [safeLimit]
  );
  return rows.map(mapMovement);
}

export async function reserveStock(
  payload: { itemId: string; warehouseId: string; quantity: number }
): Promise<void> {
  await ensureInventorySchema();
  if (!payload.itemId || !payload.warehouseId || payload.quantity <= 0) {
    throw new Error(INVENTORY_ERRORS.RESERVE_INSUFFICIENT);
  }

  await withTransaction(async (connection) => {
    const itemRow = await fetchItem(connection, payload.itemId);
    if (!itemRow) throw new Error(INVENTORY_ERRORS.ITEM_NOT_FOUND);
    const warehouseRow = await fetchWarehouse(connection, payload.warehouseId);
    if (!warehouseRow) throw new Error(INVENTORY_ERRORS.WAREHOUSE_NOT_FOUND);

    const snapshot = await fetchSnapshot(connection, payload.itemId, payload.warehouseId);
    const available = snapshot ? Number(snapshot.quantity ?? 0) - Number(snapshot.reserved ?? 0) : 0;
    if (available < payload.quantity) {
      throw new Error(INVENTORY_ERRORS.RESERVE_INSUFFICIENT);
    }

    await connection.query(
      `UPDATE inventory_stock_snapshots
         SET reserved = reserved + ?, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = ? AND warehouse_id = ?`,
      [payload.quantity, payload.itemId, payload.warehouseId]
    );
  });
}

export async function releaseReservedStock(
  payload: { itemId: string; warehouseId: string; quantity: number }
): Promise<void> {
  await ensureInventorySchema();
  if (!payload.itemId || !payload.warehouseId || payload.quantity <= 0) {
    throw new Error(INVENTORY_ERRORS.RESERVE_EXCEEDS);
  }

  await withTransaction(async (connection) => {
    const itemRow = await fetchItem(connection, payload.itemId);
    if (!itemRow) throw new Error(INVENTORY_ERRORS.ITEM_NOT_FOUND);
    const warehouseRow = await fetchWarehouse(connection, payload.warehouseId);
    if (!warehouseRow) throw new Error(INVENTORY_ERRORS.WAREHOUSE_NOT_FOUND);

    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE inventory_stock_snapshots
         SET reserved = reserved - ?, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = ? AND warehouse_id = ? AND reserved >= ?`,
      [payload.quantity, payload.itemId, payload.warehouseId, payload.quantity]
    );
    if (result.affectedRows === 0) {
      throw new Error(INVENTORY_ERRORS.RESERVE_EXCEEDS);
    }
  });
}

export async function getInventoryStats(): Promise<InventoryStats> {
  await ensureInventorySchema();

  const [[itemCountRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS totalItems FROM inventory_items WHERE is_deleted = 0'
  );
  const [[warehouseCountRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS totalWarehouses FROM inventory_warehouses WHERE is_deleted = 0'
  );
  const [[quantityRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(s.quantity - s.reserved), 0) AS totalQuantity
     FROM inventory_stock_snapshots s
     JOIN inventory_warehouses w ON w.id = s.warehouse_id AND w.is_deleted = 0`
  );

  const [lowStockRows] = await pool.query<RowDataPacket[]>(
    `SELECT i.id AS itemId, i.name, i.safety_stock AS safetyStock,
            COALESCE(SUM(s.quantity - s.reserved), 0) AS available
     FROM inventory_items i
     LEFT JOIN inventory_stock_snapshots s ON s.item_id = i.id
     LEFT JOIN inventory_warehouses w ON w.id = s.warehouse_id AND w.is_deleted = 0
     WHERE i.is_deleted = 0
     GROUP BY i.id
     HAVING available < i.safety_stock
     ORDER BY available ASC
     LIMIT 20`
  );

  const [[todayRow]] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'inbound' AND DATE(occurred_at) = CURDATE() THEN quantity ELSE 0 END), 0) AS todaysInbound,
       COALESCE(SUM(CASE WHEN direction = 'outbound' AND DATE(occurred_at) = CURDATE() THEN quantity ELSE 0 END), 0) AS todaysOutbound
     FROM inventory_movements`
  );

  return {
    totalItems: Number(itemCountRow?.totalItems ?? 0),
    totalWarehouses: Number(warehouseCountRow?.totalWarehouses ?? 0),
    totalQuantity: Number(quantityRow?.totalQuantity ?? 0),
    lowStockItems: lowStockRows.map((row) => ({
      itemId: String(row.itemId),
      name: String(row.name),
      available: Number(row.available ?? 0),
      safetyStock: Number(row.safetyStock ?? 0),
    })),
    todaysInbound: Number(todayRow?.todaysInbound ?? 0),
    todaysOutbound: Number(todayRow?.todaysOutbound ?? 0),
  };
}

export async function createInboundRecord(
  payload: InventoryInboundPayload,
  operatorId = 'system'
): Promise<InventoryMovement> {
  await ensureInventorySchema();
  await ensurePurchasesSchema();

  return withTransaction(async (connection) => {
    const itemRow = await fetchItem(connection, payload.itemId, true);
    if (!itemRow) {
      throw new Error(INVENTORY_ERRORS.ITEM_NOT_FOUND);
    }
    const warehouseRow = await fetchWarehouse(connection, payload.warehouseId);
    if (!warehouseRow) {
      throw new Error(INVENTORY_ERRORS.WAREHOUSE_NOT_FOUND);
    }
    const specFields = hydrateSpecFields(itemRow);
    const attributes =
      payload.attributes ??
      specFieldsToDefaultRecord(specFields) ??
      readLegacyDefaults(itemRow);
    const unitCost = payload.unitCost ?? Number(itemRow.unit_price ?? 0);
    let purchaseProgress: PurchaseInboundProgressRow | null = null;

    if (payload.type === 'purchase') {
      const relatedPurchaseId = payload.relatedPurchaseId?.trim();
      if (!relatedPurchaseId) {
        throw new Error(INVENTORY_ERRORS.PURCHASE_NOT_FOUND);
      }
      const [purchaseRows] = await connection.query<PurchaseInboundProgressRow[]>(
        `SELECT id, status, quantity, inbound_quantity, inventory_item_id
         FROM purchases
         WHERE id = ?
         FOR UPDATE`,
        [relatedPurchaseId]
      );
      purchaseProgress = purchaseRows[0] ?? null;
      if (!purchaseProgress) {
        throw new Error(INVENTORY_ERRORS.PURCHASE_NOT_FOUND);
      }
      if (!['pending_inbound', 'approved', 'paid'].includes(String(purchaseProgress.status))) {
        throw new Error(INVENTORY_ERRORS.PURCHASE_STATUS_INVALID);
      }
      if (purchaseProgress.inventory_item_id && purchaseProgress.inventory_item_id !== payload.itemId) {
        throw new Error(INVENTORY_ERRORS.PURCHASE_ITEM_MISMATCH);
      }
      const purchaseQuantity = Number(purchaseProgress.quantity ?? 0);
      const inboundQuantity = Number(purchaseProgress.inbound_quantity ?? 0);
      const remainingQuantity = Number((purchaseQuantity - inboundQuantity).toFixed(2));
      if (payload.quantity > remainingQuantity) {
        throw new Error(INVENTORY_ERRORS.PURCHASE_INBOUND_EXCEEDS);
      }
    }
    const movementId = randomUUID();

    await connection.query(
      `INSERT INTO inventory_movements (
        id, direction, type, item_id, warehouse_id, related_order_id, related_purchase_id,
        quantity, unit_cost, amount, operator_id, occurred_at,
        attributes_json, notes, created_at
      ) VALUES (?, 'inbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        movementId,
        payload.type,
        payload.itemId,
        payload.warehouseId,
        null,
        payload.relatedPurchaseId ?? null,
        payload.quantity,
        unitCost || null,
        unitCost ? unitCost * payload.quantity : null,
        operatorId,
        payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
        attributes ? JSON.stringify(attributes) : null,
        payload.notes ?? null,
      ]
    );

    await connection.query(
      `INSERT INTO inventory_stock_snapshots (item_id, warehouse_id, quantity, reserved, updated_at)
       VALUES (?, ?, ?, 0, NOW())
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()`,
      [payload.itemId, payload.warehouseId, payload.quantity]
    );

    if (payload.type === 'purchase') {
      await connection.query(
        `UPDATE inventory_items SET unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [unitCost || 0, payload.itemId]
      );

      if (purchaseProgress && payload.relatedPurchaseId?.trim()) {
        const purchaseQuantity = Number(purchaseProgress.quantity ?? 0);
        const inboundQuantity = Number(purchaseProgress.inbound_quantity ?? 0);
        const nextInboundQuantity = Number((inboundQuantity + Number(payload.quantity)).toFixed(2));
        const reachedFullInbound = nextInboundQuantity + 0.000001 >= purchaseQuantity;
        await connection.query(
          `UPDATE purchases
             SET inbound_quantity = ?,
                 status = CASE
                   WHEN status = 'pending_inbound' AND ? = 1 THEN 'approved'
                   ELSE status
                 END,
                 updated_at = NOW(3)
           WHERE id = ?`,
          [nextInboundQuantity, reachedFullInbound ? 1 : 0, payload.relatedPurchaseId.trim()]
        );
      }
    }

    const movement = await fetchMovement(connection, movementId);
    if (!movement) {
      throw new Error('INVENTORY_MOVEMENT_NOT_PERSISTED');
    }
    return movement;
  });
}


function calculateAmount(unitCost: number | null, quantity: number): number | null {
  if (!unitCost || unitCost <= 0) {
    return null;
  }
  return Number((unitCost * quantity).toFixed(2));
}

export async function createOutboundRecord(
  payload: InventoryOutboundPayload,
  operatorId = 'system'
): Promise<InventoryMovement> {
  await ensureInventorySchema();

  return withTransaction(async (connection) => {
    const itemRow = await fetchItem(connection, payload.itemId, true);
    if (!itemRow) {
      throw new Error(INVENTORY_ERRORS.ITEM_NOT_FOUND);
    }
    const warehouseRow = await fetchWarehouse(connection, payload.warehouseId);
    if (!warehouseRow) {
      throw new Error(INVENTORY_ERRORS.WAREHOUSE_NOT_FOUND);
    }

    const snapshot = await fetchSnapshot(connection, payload.itemId, payload.warehouseId);
    const available = snapshot ? Number(snapshot.quantity ?? 0) - Number(snapshot.reserved ?? 0) : 0;
    if (available < payload.quantity) {
      throw new Error(INVENTORY_ERRORS.INSUFFICIENT_STOCK);
    }

    const [updateResult] = await connection.query<ResultSetHeader>(
      `UPDATE inventory_stock_snapshots
         SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = ? AND warehouse_id = ? AND quantity >= ?`,
      [payload.quantity, payload.itemId, payload.warehouseId, payload.quantity]
    );
    if (updateResult.affectedRows === 0) {
      throw new Error(INVENTORY_ERRORS.INSUFFICIENT_STOCK);
    }

    const movementId = randomUUID();
    const specFields = hydrateSpecFields(itemRow);
    const attributes =
      payload.attributes ??
      specFieldsToDefaultRecord(specFields) ??
      readLegacyDefaults(itemRow);
    const unitCost = Number(itemRow.unit_price ?? 0) || null;
    const amount = calculateAmount(unitCost, payload.quantity);
    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    const transferId = payload.type === 'transfer' ? payload.relatedOrderId ?? randomUUID() : null;

    await connection.query(
      `INSERT INTO inventory_movements (
        id, direction, type, item_id, warehouse_id, related_order_id,
        quantity, unit_cost, amount, operator_id, occurred_at, attributes_json,
        notes, created_at
      ) VALUES (?, 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        movementId,
        payload.type,
        payload.itemId,
        payload.warehouseId,
        payload.type === 'transfer' ? transferId : payload.relatedOrderId ?? null,
        payload.quantity,
        unitCost,
        amount,
        operatorId,
        occurredAt,
        attributes ? JSON.stringify(attributes) : null,
        payload.notes ?? null,
      ]
    );

    if (payload.type === 'transfer' && payload.targetWarehouseId) {
      const inboundId = randomUUID();
      await connection.query(
        `INSERT INTO inventory_movements (
          id, direction, type, item_id, warehouse_id, related_order_id,
          quantity, unit_cost, amount, operator_id, occurred_at, attributes_json,
          notes, created_at
        ) VALUES (?, 'inbound', 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          inboundId,
          payload.itemId,
          payload.targetWarehouseId,
          transferId,
          payload.quantity,
          unitCost,
          amount,
          operatorId,
          occurredAt,
          attributes ? JSON.stringify(attributes) : null,
          payload.notes ?? null,
        ]
      );
      await connection.query(
        `INSERT INTO inventory_stock_snapshots (item_id, warehouse_id, quantity, reserved, updated_at)
         VALUES (?, ?, ?, 0, NOW())
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()`,
        [payload.itemId, payload.targetWarehouseId, payload.quantity]
      );
    }

    const movement = await fetchMovement(connection, movementId);
    if (!movement) {
      throw new Error('INVENTORY_MOVEMENT_NOT_PERSISTED');
    }
    return movement;
  });
}




const STOCK_PLACEHOLDER = 0;

export async function getWarehouseByCode(code: string): Promise<Warehouse | null> {
  const rows = await mysqlQuery<WarehouseRow>`
    SELECT * FROM inventory_warehouses WHERE code = ${code} AND is_deleted = 0 LIMIT 1
  `;
  const row = rows.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type,
    address: row.address ?? undefined,
    capacity: row.capacity ?? undefined,
    manager: row.manager ?? undefined,
    stockQuantity: STOCK_PLACEHOLDER,
    stockReserved: STOCK_PLACEHOLDER,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}
