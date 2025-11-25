import { randomUUID } from 'crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '@/lib/mysql';
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
  Warehouse,
  WarehousePayload,
} from '@/types/inventory';

const pool = mysqlPool();

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

export const INVENTORY_ERRORS = {
  ITEM_NOT_FOUND: 'INVENTORY_ITEM_NOT_FOUND',
  WAREHOUSE_NOT_FOUND: 'INVENTORY_WAREHOUSE_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INVENTORY_INSUFFICIENT_STOCK',
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
  const [rows] = await queryable.query<InventoryItemRow[]>('SELECT * FROM inventory_items WHERE id = ? LIMIT 1', [
    id,
  ]);
  return rows[0] ?? null;
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  await ensureInventorySchema();
  const row = await fetchItem(pool, id);
  return row ? mapInventoryItem(row) : null;
}

async function fetchWarehouse(queryable: Queryable, id: string): Promise<WarehouseRow | null> {
  const [rows] = await queryable.query<WarehouseRow[]>(
    'SELECT * FROM inventory_warehouses WHERE id = ? LIMIT 1',
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
    'SELECT * FROM inventory_items ORDER BY name ASC'
  );
  return rows.map(mapInventoryItem);
}

export async function listWarehouses(): Promise<Warehouse[]> {
  await ensureInventorySchema();
  const [rows] = await pool.query<WarehouseRow[]>(
    'SELECT * FROM inventory_warehouses ORDER BY name ASC'
  );
  const [usageRows] = await pool.query<WarehouseUsageRow[]>(
    `SELECT warehouse_id, SUM(quantity) AS totalQuantity, SUM(reserved) AS totalReserved
     FROM inventory_stock_snapshots
     GROUP BY warehouse_id`
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

export async function createInventoryItem(payload: InventoryItemPayload): Promise<InventoryItem> {
  await ensureInventorySchema();
  const id = randomUUID();
  const defaultRecord = specFieldsToDefaultRecord(payload.specFields);

  await pool.query(
    `INSERT INTO inventory_items (
      id, sku, name, unit, unit_price, sale_price, category, safety_stock, barcode,
      spec_fields_json, default_attributes_json, attributes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  await pool.query(`UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);
  return getInventoryItem(id);
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  await ensureInventorySchema();
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM inventory_items WHERE id = ?',
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

  await pool.query(`UPDATE inventory_warehouses SET ${updates.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
  return getWarehouse(id);
}

export async function deleteWarehouse(id: string): Promise<boolean> {
  await ensureInventorySchema();
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM inventory_warehouses WHERE id = ?',
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

export async function getInventoryStats(): Promise<InventoryStats> {
  await ensureInventorySchema();

  const [[itemCountRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS totalItems FROM inventory_items'
  );
  const [[warehouseCountRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS totalWarehouses FROM inventory_warehouses'
  );
  const [[quantityRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COALESCE(SUM(quantity - reserved), 0) AS totalQuantity FROM inventory_stock_snapshots'
  );

  const [lowStockRows] = await pool.query<RowDataPacket[]>(
    `SELECT i.id AS itemId, i.name, i.safety_stock AS safetyStock,
            COALESCE(SUM(s.quantity - s.reserved), 0) AS available
     FROM inventory_items i
     LEFT JOIN inventory_stock_snapshots s ON s.item_id = i.id
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

    await connection.query(
      `UPDATE inventory_items SET unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [unitCost || 0, payload.itemId]
    );

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
    const unitCost = resolveSaleUnitCost(
      payload.type,
      Number(itemRow.sale_price ?? 0),
      Number(itemRow.unit_price ?? 0)
    );
    const amount = calculateAmount(unitCost, payload.quantity);

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
        payload.relatedOrderId ?? null,
        payload.quantity,
        unitCost,
        amount,
        operatorId,
        payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
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
