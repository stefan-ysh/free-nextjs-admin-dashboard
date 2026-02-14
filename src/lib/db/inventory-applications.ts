import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '@/lib/mysql';
import { ensureInventorySchema } from '@/lib/schema/inventory';
import {
  InventoryApplication,
  InventoryApplicationItem,
  InventoryApplicationStatus,
} from '@/types/inventory';



import {
  getInventoryItem,
  INVENTORY_ERRORS,
} from '@/lib/db/inventory';

function toIsoString(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;
  return typeof date === 'string' ? date : date.toISOString();
}

const pool = mysqlPool();

type ApplicationRow = RowDataPacket & {
  id: string;
  number: string;
  applicant_id: string;
  applicant_name: string;
  department: string | null;
  status: InventoryApplicationStatus;
  type: 'use' | 'transfer';
  reason: string | null;
  warehouse_id: string;
  warehouse_name: string;
  approver_id: string | null;
  approver_name: string | null;
  approved_at: Date | string | null;
  rejected_at: Date | string | null;
  rejection_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ApplicationItemRow = RowDataPacket & {
  id: string;
  application_id: string;
  item_id: string;
  item_name: string;
  item_sku: string | null;
  quantity: number;
  unit: string;
};

function mapApplication(row: ApplicationRow, items: InventoryApplicationItem[]): InventoryApplication {
  return {
    id: row.id,
    number: row.number,
    applicantId: row.applicant_id,
    applicantName: row.applicant_name,
    department: row.department ?? undefined,
    status: row.status,
    type: row.type,
    reason: row.reason ?? undefined,
    items,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_name,
    approverId: row.approver_id ?? undefined,
    approverName: row.approver_name ?? undefined,
    approvedAt: row.approved_at ? toIsoString(row.approved_at) : undefined,
    rejectedAt: row.rejected_at ? toIsoString(row.rejected_at) : undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: toIsoString(row.created_at) || new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) || new Date().toISOString(),
  };
}

function mapApplicationItem(row: ApplicationItemRow): InventoryApplicationItem {
  return {
    id: row.id,
    applicationId: row.application_id,
    itemId: row.item_id,
    itemName: row.item_name,
    itemSku: row.item_sku ?? '',
    quantity: Number(row.quantity),
    unit: row.unit,
  };
}

async function generateApplicationNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const prefix = `APP-${year}${month}${day}-`;
  
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM inventory_applications WHERE number LIKE ?',
    [`${prefix}%`]
  );
  
  const count = rows[0]?.count ?? 0;
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export type CreateApplicationPayload = {
  applicantId: string;
  applicantName: string;
  department?: string;
  type: 'use' | 'transfer';
  reason?: string;
  warehouseId: string;
  warehouseName: string;
  items: Array<{
    itemId: string;
    quantity: number;
  }>;
};

export async function createApplication(payload: CreateApplicationPayload): Promise<InventoryApplication> {
  await ensureInventorySchema();

  if (!payload.items.length) {
    throw new Error('NO_ITEMS');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const id = randomUUID();
    const number = await generateApplicationNumber(); // Note: inside txn this might be safer if locked, but simplistic for now
    
    // 1. Insert Application
    await connection.query(
      `INSERT INTO inventory_applications (
        id, number, applicant_id, applicant_name, department,
        status, type, reason, warehouse_id, warehouse_name
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        id,
        number,
        payload.applicantId,
        payload.applicantName,
        payload.department ?? null,
        payload.type,
        payload.reason ?? null,
        payload.warehouseId,
        payload.warehouseName,
      ]
    );

    // 2. Insert Items
    const resultItems: InventoryApplicationItem[] = [];
    for (const itemPayload of payload.items) {
      const itemData = await getInventoryItem(itemPayload.itemId);
      if (!itemData) throw new Error(INVENTORY_ERRORS.ITEM_NOT_FOUND);

      const itemId = randomUUID();
      await connection.query(
        `INSERT INTO inventory_application_items (
          id, application_id, item_id, item_name, item_sku, quantity, unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          id,
          itemPayload.itemId,
          itemData.name,
          itemData.sku,
          itemPayload.quantity,
          itemData.unit,
        ]
      );

      resultItems.push({
        id: itemId,
        applicationId: id,
        itemId: itemPayload.itemId,
        itemName: itemData.name,
        itemSku: itemData.sku,
        quantity: itemPayload.quantity,
        unit: itemData.unit,
      });
    }

    await connection.commit();

    return {
      id,
      number,
      applicantId: payload.applicantId,
      applicantName: payload.applicantName,
      department: payload.department,
      status: 'pending',
      type: payload.type,
      reason: payload.reason,
      items: resultItems,
      warehouseId: payload.warehouseId,
      warehouseName: payload.warehouseName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getApplication(id: string): Promise<InventoryApplication | null> {
  await ensureInventorySchema();
  
  const [appRows] = await pool.query<ApplicationRow[]>(
    'SELECT * FROM inventory_applications WHERE id = ? LIMIT 1',
    [id]
  );
  const appRow = appRows[0];
  if (!appRow) return null;

  const [itemRows] = await pool.query<ApplicationItemRow[]>(
    'SELECT * FROM inventory_application_items WHERE application_id = ?',
    [id]
  );
  
  const items = itemRows.map(mapApplicationItem);
  return mapApplication(appRow, items);
}

export async function listApplications(
  params: {
    applicantId?: string;
    approverId?: string; // pending for this approver (if we assign) or just 'pending' status?
    status?: InventoryApplicationStatus;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ items: InventoryApplication[]; total: number }> {
  await ensureInventorySchema();
  
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const values: any[] = [];

  if (params.applicantId) {
    conditions.push('applicant_id = ?');
    values.push(params.applicantId);
  }
  if (params.status) {
    conditions.push('status = ?');
    values.push(params.status);
  }
  // If we had logic for "assigned to approver", we'd add it here. 
  // currently we just show all pending to admins.

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM inventory_applications ${whereClause}`,
    values
  );
  const total = countRows[0]?.total ?? 0;

  const [appRows] = await pool.query<ApplicationRow[]>(
    `SELECT * FROM inventory_applications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  if (!appRows.length) {
    return { items: [], total: Number(total) };
  }

  // Fetch items for all visible applications
  // Optimization: simplify to just fetch items for these IDs
  const appIds = appRows.map(r => r.id);
  const [itemRows] = await pool.query<ApplicationItemRow[]>(
    `SELECT * FROM inventory_application_items WHERE application_id IN (${appIds.map(() => '?').join(',')})`,
    appIds
  );

  const itemsByAppId = new Map<string, InventoryApplicationItem[]>();
  itemRows.forEach(row => {
    const list = itemsByAppId.get(row.application_id) ?? [];
    list.push(mapApplicationItem(row));
    itemsByAppId.set(row.application_id, list);
  });

  const results = appRows.map(row => mapApplication(row, itemsByAppId.get(row.id) ?? []));

  return { items: results, total: Number(total) };
}

export async function approveApplication(
  id: string,
  operatorId: string,
  operatorName: string
): Promise<InventoryApplication> {
  const app = await getApplication(id);
  if (!app) throw new Error('APPLICATION_NOT_FOUND');
  if (app.status !== 'pending') throw new Error('APPLICATION_NOT_PENDING');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update Application Status
    await connection.query(
      `UPDATE inventory_applications 
       SET status = 'approved', approved_at = NOW(), approver_id = ?, approver_name = ?, updated_at = NOW() 
       WHERE id = ?`,
      [operatorId, operatorName, id]
    );

    // 2. Create Outbound Records for each item
    // Since InventoryMovement logic handles stock deduction, we call createOutboundRecord for each item.
    // However, createOutboundRecord manages its own transaction. 
    // We should ideally refactor to pass connection, or accept that they are separate transactions.
    // For safety in this "Service" style function, we'll try to do it transactionally if possible,
    // but `createOutboundRecord` is self-contained. 
    // To avoid refactoring the entire inventory.ts right now, we will:
    //    Committing the Application update first? No, that risks inconsistency.
    //    Actually `createOutboundRecord` is exported. We can't easily inject a connection.
    //    Risk: App approved, but stock deduction fails. 
    //    Mitigation: Only mark approved if stock deduction works.
    
    // Correct approach without refactoring deeply:
    // We can't hold `connection` transaction open while calling `createOutboundRecord` if it also starts a transaction (MySQL doesn't support nested trx savepoints easily via simple `beginTransaction` calls in this driver wrapper usually, or it behaves unexpectedly).
    // Let's modify logic: We perform stock check and deduction MANUALLY here in THIS transaction, OR we recognize we need to refactor `createOutboundRecord` to accept a connection.
    // Given the constraints, let's try to simply iterate and call `createOutboundRecord`. If one fails, we have to revert previous ones?
    // Better: We check stock availability for ALL items first inside our transaction.
    
    // Let's implement stock deduction here to ensure atomicity with status update.
    // Actually, duplicating the logic of `createOutboundRecord` is bad (DRY).
    // But `createOutboundRecord` does `withTransaction`.
    
    // Compromise Plan:
    // 1. Commit the "Approved" status.
    // 2. Loop items and call `createOutboundRecord`.
    // 3. If any fail, we catch error, revert the application status (or mark as partial error? no, revert).
    //    But we can't easily revert committed DB transactions.
    
    // Better Compromise:
    // We will assume `createOutboundRecord` works if we pre-check stock.
    // But race conditions exists.
    
    // To do this properly, we should rely on `createOutboundRecord` to be the source of truth.
    // But we have multiple items.
    
    // Let's accept a small technical debt: We will process items sequentially.
    // If one fails, we stop. The application ended up in 'approved' state but maybe only partially fulfilled?
    // No, we haven't set it to 'approved' yet because we are in a transaction... wait, we can't easily mix.
    
    // DECISION: To ensure reliability, we WILL use a standard pattern:
    // process all inventory movements.
    // If all succeed, update status.
    // If any fail, rollback movements? (Hard if they are committed).
    
    // Given the complexity, I will implement a check loop, then execute loop.
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // Re-thinking: Since I cannot easily wrap `createOutboundRecord` (which uses `withTransaction`),
  // The safest way is to NOT use the transaction around everything, but handle the flow safely.
  // OR, simplify and just copy the `UPDATE inventory_stock_snapshots` logic here.
  // Let's copy the logic. It's simple enough: `UPDATE ... quantity = quantity - ? ...`
  
  // Re-connecting...
  const txn = await pool.getConnection();
  try {
    await txn.beginTransaction();
    
    // Check and Deduct Stock for ALL items
    for (const item of app.items) {
       const [rows] = await txn.query<RowDataPacket[]>(
         'SELECT quantity, reserved FROM inventory_stock_snapshots WHERE item_id = ? AND warehouse_id = ? FOR UPDATE',
         [item.itemId, app.warehouseId]
       );
       const snapshot = rows[0];
       const available = snapshot ? Number(snapshot.quantity) - Number(snapshot.reserved) : 0;
       
       if (available < item.quantity) {
          throw new Error(`Stock insufficient for ${item.itemName} (Requested: ${item.quantity}, Available: ${available})`);
       }

       await txn.query(
         `UPDATE inventory_stock_snapshots 
          SET quantity = quantity - ?, updated_at = NOW()
          WHERE item_id = ? AND warehouse_id = ?`,
         [item.quantity, item.itemId, app.warehouseId]
       );

       // Create Movement Record inside this transaction
       await txn.query(
        `INSERT INTO inventory_movements (
          id, direction, type, item_id, warehouse_id, related_order_id,
          quantity, unit_cost, amount, operator_id, occurred_at, notes
        ) VALUES (?, 'outbound', ?, ?, ?, ?, ?, 0, 0, ?, NOW(), ?)`,
        [
          randomUUID(),
          'use', // or app.type
          item.itemId,
          app.warehouseId,
          app.number,
          item.quantity,
          operatorId,
          `申请单批准：${app.number}`
        ]
       );
    }
    
    await txn.query(
      `UPDATE inventory_applications 
       SET status = 'approved', approved_at = NOW(), approver_id = ?, approver_name = ?, updated_at = NOW() 
       WHERE id = ?`,
      [operatorId, operatorName, id]
    );

    await txn.commit();
  } catch (e) {
    await txn.rollback();
    throw e;
  } finally {
    txn.release();
  }

  return (await getApplication(id))!;
}

export async function rejectApplication(
  id: string,
  operatorId: string,
  operatorName: string,
  reason?: string
): Promise<InventoryApplication> {
  const app = await getApplication(id);
  if (!app) throw new Error('APPLICATION_NOT_FOUND');
  if (app.status !== 'pending') throw new Error('APPLICATION_NOT_PENDING');

  await pool.query(
    `UPDATE inventory_applications 
     SET status = 'rejected', rejected_at = NOW(), approver_id = ?, approver_name = ?, rejection_reason = ?, updated_at = NOW() 
     WHERE id = ?`,
    [operatorId, operatorName, reason ?? null, id]
  );

  return (await getApplication(id))!;
}
