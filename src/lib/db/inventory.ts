import { randomUUID } from 'crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';
import { ensureInventorySchema } from '@/lib/schema/inventory';
import { specFieldsToDefaultRecord } from '@/lib/inventory/spec';
import type {
  InventoryInboundPayload,
  InventoryItem,
  InventoryItemPayload,
  InventoryMovement,
  InventoryOutboundPayload,
  InventorySpecField,
  InventoryStats,
  InventoryTransferDetail,
  InventoryTransferMovement,
  InventoryTransferOrder,
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
  unit_price: number;
  sale_price: number;
  category: string;
  safety_stock: number;
  barcode: string | null;
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

type TransferOrderRow = RowDataPacket & {
  transfer_id: string;
  item_id: string;
  item_name: string | null;
  item_sku: string | null;
  quantity: number;
  unit_cost: number | null;
  amount: number | null;
  source_warehouse_id: string | null;
  source_warehouse_name: string | null;
  target_warehouse_id: string | null;
  target_warehouse_name: string | null;
  operator_id: string | null;
  occurred_at: Date | string;
  notes: string | null;
};

type TransferMovementRow = RowDataPacket & {
  id: string;
  direction: InventoryMovement['direction'];
  item_id: string;
  item_name: string | null;
  item_sku: string | null;
  warehouse_id: string;
  warehouse_name: string | null;
  quantity: number;
  unit_cost: number | null;
  amount: number | null;
  operator_id: string | null;
  occurred_at: Date | string;
  notes: string | null;
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
    unitPrice: Number(row.unit_price ?? 0),
    salePrice: Number(row.sale_price ?? 0),
    category: row.category,
    safetyStock: Number(row.safety_stock ?? 0),
    barcode: row.barcode ?? undefined,
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
    occurredAt: toIsoString(row.occurred_at),
    attachments: parseJsonColumn(row.attachments_json),
    attributes: parseJsonColumn(row.attributes_json),
    notes: row.notes ?? undefined,
    createdAt: toIsoString(row.created_at),
  };
}

function mapTransferOrder(row: TransferOrderRow): InventoryTransferOrder {
  return {
    transferId: row.transfer_id,
    itemId: row.item_id,
    itemName: row.item_name ?? null,
    itemSku: row.item_sku ?? null,
    quantity: Number(row.quantity ?? 0),
    unitCost: row.unit_cost ?? null,
    amount: row.amount ?? null,
    sourceWarehouseId: row.source_warehouse_id ?? null,
    sourceWarehouseName: row.source_warehouse_name ?? null,
    targetWarehouseId: row.target_warehouse_id ?? null,
    targetWarehouseName: row.target_warehouse_name ?? null,
    operatorId: row.operator_id ?? null,
    occurredAt: toIsoString(row.occurred_at),
    notes: row.notes ?? null,
  };
}

function mapTransferMovement(row: TransferMovementRow): InventoryTransferMovement {
  return {
    id: row.id,
    direction: row.direction,
    itemId: row.item_id,
    itemName: row.item_name ?? null,
    itemSku: row.item_sku ?? null,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_name ?? null,
    quantity: Number(row.quantity ?? 0),
    unitCost: row.unit_cost ?? null,
    amount: row.amount ?? null,
    operatorId: row.operator_id ?? null,
    occurredAt: toIsoString(row.occurred_at),
    notes: row.notes ?? null,
  };
}

async function withTransaction<T>(handler: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function fetchItem(queryable: Queryable, id: string): Promise<InventoryItemRow | null> {
  const [rows] = await queryable.query<InventoryItemRow[]>(
    'SELECT * FROM inventory_items WHERE id = ? AND is_deleted = 0 LIMIT 1',
    [id]
  );
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
      id, sku, name, unit, unit_price, sale_price, category, safety_stock, barcode, image_url,
      spec_fields_json, default_attributes_json, attributes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.sku,
      payload.name,
      payload.unit,
      payload.unitPrice,
      payload.salePrice,
      payload.category,
      payload.safetyStock,
      payload.barcode ?? null,
      payload.imageUrl ?? null,
      payload.specFields ? JSON.stringify(payload.specFields) : null,
      defaultRecord ? JSON.stringify(defaultRecord) : null,
      null,
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
  if (payload.unitPrice !== undefined) {
    updates.push('unit_price = ?');
    values.push(payload.unitPrice);
  }
  if (payload.salePrice !== undefined) {
    updates.push('sale_price = ?');
    values.push(payload.salePrice);
  }
  if (payload.category !== undefined) {
    updates.push('category = ?');
    values.push(payload.category);
  }
  if (payload.safetyStock !== undefined) {
    updates.push('safety_stock = ?');
    values.push(payload.safetyStock);
  }
  if (payload.barcode !== undefined) {
    updates.push('barcode = ?');
    values.push(payload.barcode ?? null);
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
  const [[usageRow]] = await pool.query<RowDataPacket[]>(
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
  const [[movementRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM inventory_movements WHERE item_id = ?',
    [id]
  );
  if (Number(movementRow?.total ?? 0) > 0) {
    throw new Error(INVENTORY_ERRORS.ITEM_IN_USE);
  }
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE inventory_items SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0',
    [id]
  );
  return result.affectedRows > 0;
}

export async function createWarehouse(payload: WarehousePayload): Promise<Warehouse> {
  await ensureInventorySchema();
  const id = randomUUID();

  await pool.query(
    `INSERT INTO inventory_warehouses (
      id, name, code, type, address, capacity, manager
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.name,
      payload.code,
      payload.type,
      payload.address ?? null,
      payload.capacity ?? null,
      payload.manager ?? null,
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
    'SELECT * FROM inventory_movements ORDER BY occurred_at DESC, created_at DESC LIMIT ?',
    [safeLimit]
  );
  return rows.map(mapMovement);
}

export async function listTransferOrders(limit = 50): Promise<InventoryTransferOrder[]> {
  await ensureInventorySchema();
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const [rows] = await pool.query<TransferOrderRow[]>(
    `SELECT
      m.related_order_id AS transfer_id,
      MAX(m.item_id) AS item_id,
      MAX(i.name) AS item_name,
      MAX(i.sku) AS item_sku,
      MAX(m.quantity) AS quantity,
      MAX(m.unit_cost) AS unit_cost,
      MAX(m.amount) AS amount,
      MAX(CASE WHEN m.direction = 'outbound' THEN m.warehouse_id END) AS source_warehouse_id,
      MAX(CASE WHEN m.direction = 'outbound' THEN sw.name END) AS source_warehouse_name,
      MAX(CASE WHEN m.direction = 'inbound' THEN m.warehouse_id END) AS target_warehouse_id,
      MAX(CASE WHEN m.direction = 'inbound' THEN tw.name END) AS target_warehouse_name,
      MAX(m.operator_id) AS operator_id,
      MIN(m.occurred_at) AS occurred_at,
      MAX(m.notes) AS notes
     FROM inventory_movements m
     LEFT JOIN inventory_items i ON i.id = m.item_id
     LEFT JOIN inventory_warehouses sw ON sw.id = m.warehouse_id AND m.direction = 'outbound'
     LEFT JOIN inventory_warehouses tw ON tw.id = m.warehouse_id AND m.direction = 'inbound'
     WHERE m.type = 'transfer' AND m.related_order_id IS NOT NULL
     GROUP BY m.related_order_id
     ORDER BY occurred_at DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows.map(mapTransferOrder);
}

export async function getTransferOrderDetail(transferId: string): Promise<InventoryTransferDetail | null> {
  await ensureInventorySchema();
  if (!transferId) return null;

  const [rows] = await pool.query<TransferMovementRow[]>(
    `SELECT
      m.id,
      m.direction,
      m.item_id,
      i.name AS item_name,
      i.sku AS item_sku,
      m.warehouse_id,
      w.name AS warehouse_name,
      m.quantity,
      m.unit_cost,
      m.amount,
      m.operator_id,
      m.occurred_at,
      m.notes
     FROM inventory_movements m
     LEFT JOIN inventory_items i ON i.id = m.item_id
     LEFT JOIN inventory_warehouses w ON w.id = m.warehouse_id
     WHERE m.type = 'transfer' AND m.related_order_id = ?
     ORDER BY m.occurred_at ASC, m.direction DESC`,
    [transferId]
  );

  if (!rows.length) return null;

  const movements = rows.map(mapTransferMovement);
  const outbound = movements.find((m) => m.direction === 'outbound') ?? movements[0];
  const inbound = movements.find((m) => m.direction === 'inbound') ?? movements[movements.length - 1];
  const header: InventoryTransferOrder = {
    transferId,
    itemId: outbound.itemId,
    itemName: outbound.itemName,
    itemSku: outbound.itemSku,
    quantity: outbound.quantity,
    unitCost: outbound.unitCost,
    amount: outbound.amount,
    sourceWarehouseId: outbound.warehouseId,
    sourceWarehouseName: outbound.warehouseName,
    targetWarehouseId: inbound.warehouseId,
    targetWarehouseName: inbound.warehouseName,
    operatorId: outbound.operatorId ?? inbound.operatorId ?? null,
    occurredAt: outbound.occurredAt,
    notes: outbound.notes ?? inbound.notes ?? null,
  };

  return { ...header, movements };
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

  return withTransaction(async (connection) => {
    const itemRow = await fetchItem(connection, payload.itemId);
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
    const movementId = randomUUID();

    await connection.query(
      `INSERT INTO inventory_movements (
        id, direction, type, item_id, warehouse_id, related_order_id,
        quantity, unit_cost, amount, operator_id, occurred_at,
        attributes_json, notes
      ) VALUES (?, 'inbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movementId,
        payload.type,
        payload.itemId,
        payload.warehouseId,
        null,
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
      `INSERT INTO inventory_stock_snapshots (item_id, warehouse_id, quantity, reserved)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
      [payload.itemId, payload.warehouseId, payload.quantity]
    );

    if (payload.type === 'purchase') {
      await connection.query(
        `UPDATE inventory_items SET unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [unitCost || 0, payload.itemId]
      );
    }

    const movement = await fetchMovement(connection, movementId);
    if (!movement) {
      throw new Error('INVENTORY_MOVEMENT_NOT_PERSISTED');
    }
    return movement;
  });
}

function resolveSaleUnitCost(
  type: InventoryMovement['type'],
  salePrice: number,
  unitPrice: number
): number | null {
  if (type !== 'sale') {
    return null;
  }
  const candidate = salePrice || unitPrice;
  return candidate > 0 ? candidate : null;
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
    const itemRow = await fetchItem(connection, payload.itemId);
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
    const unitCost =
      payload.type === 'transfer'
        ? Number(itemRow.unit_price ?? 0)
        : resolveSaleUnitCost(payload.type, Number(itemRow.sale_price ?? 0), Number(itemRow.unit_price ?? 0));
    const amount = calculateAmount(unitCost, payload.quantity);
    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    const transferId = payload.type === 'transfer' ? payload.relatedOrderId ?? randomUUID() : null;

    await connection.query(
      `INSERT INTO inventory_movements (
        id, direction, type, item_id, warehouse_id, related_order_id,
        quantity, unit_cost, amount, operator_id, occurred_at, attributes_json,
        notes, client_id, client_type, client_name, client_contact, client_phone,
        client_address
      ) VALUES (?, 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        payload.clientId ?? null,
        payload.clientType ?? null,
        payload.clientName ?? null,
        payload.clientContact ?? null,
        payload.clientPhone ?? null,
        payload.clientAddress ?? null,
      ]
    );

    if (payload.type === 'transfer' && payload.targetWarehouseId) {
      const inboundId = randomUUID();
      await connection.query(
        `INSERT INTO inventory_movements (
          id, direction, type, item_id, warehouse_id, related_order_id,
          quantity, unit_cost, amount, operator_id, occurred_at, attributes_json,
          notes
        ) VALUES (?, 'inbound', 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        `INSERT INTO inventory_stock_snapshots (item_id, warehouse_id, quantity, reserved)
         VALUES (?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
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

export async function revertOutboundMovement(
  movement: Pick<InventoryMovement, 'id' | 'itemId' | 'warehouseId' | 'quantity'>
): Promise<void> {
  await ensureInventorySchema();

  await withTransaction(async (connection) => {
    await connection.query(
      `INSERT INTO inventory_stock_snapshots (item_id, warehouse_id, quantity, reserved)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
      [movement.itemId, movement.warehouseId, movement.quantity]
    );

    await connection.query('DELETE FROM inventory_movements WHERE id = ?', [movement.id]);
  });
}

const STOCK_PLACEHOLDER = 0;

export async function getWarehouseByCode(code: string): Promise<Warehouse | null> {
  const rows = await mysqlQuery<WarehouseRow>`
    SELECT * FROM warehouses WHERE code = ${code} AND is_deleted = 0 LIMIT 1
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
