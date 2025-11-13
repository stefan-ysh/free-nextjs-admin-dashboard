import { randomUUID } from 'crypto';
import { pool, sql } from '@/lib/postgres';
import { ensurePurchasesSchema } from '@/lib/schema/purchases';
import {
  PurchaseRecord,
  CreatePurchaseInput,
  UpdatePurchaseInput,
  ListPurchasesParams,
  ListPurchasesResult,
  PurchaseStatus,
  ReimbursementLog,
  ReimbursementAction,
} from '@/types/purchase';

type RawPurchaseRow = {
  id: string;
  purchase_number: string;
  purchase_date: string;
  item_name: string;
  specification: string | null;
  quantity: string;
  unit_price: string;
  total_amount: string;
  purchase_channel: string;
  purchase_location: string | null;
  purchase_link: string | null;
  purpose: string;
  payment_method: string;
  purchaser_id: string;
  invoice_type: string;
  invoice_images: string[];
  receipt_images: string[];
  has_project: boolean;
  project_id: string | null;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  attachments: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
  is_deleted: boolean;
  deleted_at: string | null;
};

type RawLogRow = {
  id: string;
  purchase_id: string;
  action: string;
  from_status: string;
  to_status: string;
  operator_id: string;
  comment: string | null;
  created_at: string;
};

function mapPurchase(row: RawPurchaseRow | undefined): PurchaseRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    purchaseNumber: row.purchase_number,
    purchaseDate: row.purchase_date,
    itemName: row.item_name,
    specification: row.specification,
    quantity: parseFloat(row.quantity),
    unitPrice: parseFloat(row.unit_price),
    totalAmount: parseFloat(row.total_amount),
    purchaseChannel: row.purchase_channel as any,
    purchaseLocation: row.purchase_location,
    purchaseLink: row.purchase_link,
    purpose: row.purpose,
    paymentMethod: row.payment_method as any,
    purchaserId: row.purchaser_id,
    invoiceType: row.invoice_type as any,
    invoiceImages: row.invoice_images ?? [],
    receiptImages: row.receipt_images ?? [],
    hasProject: !!row.has_project,
    projectId: row.project_id,
    status: row.status as PurchaseStatus,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    rejectionReason: row.rejection_reason,
    paidAt: row.paid_at,
    paidBy: row.paid_by,
    notes: row.notes,
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

function mapLog(row: RawLogRow | undefined): ReimbursementLog | null {
  if (!row) return null;
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    action: row.action as ReimbursementAction,
    fromStatus: row.from_status as PurchaseStatus,
    toStatus: row.to_status as PurchaseStatus,
    operatorId: row.operator_id,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

async function generatePurchaseNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PC${year}${month}`;
  const result = await sql<{ count: number }>`
    SELECT COUNT(*)::int AS count FROM purchases WHERE purchase_number LIKE ${prefix + '%'}
  `;
  const seq = (result.rows[0]?.count || 0) + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function insertLog(purchaseId: string, action: ReimbursementAction, fromStatus: PurchaseStatus, toStatus: PurchaseStatus, operatorId: string, comment?: string | null) {
  await ensurePurchasesSchema();
  const id = randomUUID();
  await sql`
    INSERT INTO reimbursement_logs (id, purchase_id, action, from_status, to_status, operator_id, comment)
    VALUES (${id}, ${purchaseId}, ${action}, ${fromStatus}, ${toStatus}, ${operatorId}, ${comment ?? null})
  `;
}

export async function createPurchase(input: CreatePurchaseInput, createdBy: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();

  // validations
  if (input.purchaseChannel === 'online' && (!input.purchaseLink || input.purchaseLink.trim() === '')) {
    throw new Error('PURCHASE_LINK_REQUIRED');
  }
  if (input.purchaseChannel === 'offline' && (!input.purchaseLocation || input.purchaseLocation.trim() === '')) {
    throw new Error('PURCHASE_LOCATION_REQUIRED');
  }
  if (input.quantity <= 0) throw new Error('INVALID_QUANTITY');
  if (input.unitPrice < 0) throw new Error('INVALID_UNIT_PRICE');

  const id = randomUUID();
  const purchaseNumber = await generatePurchaseNumber();
  const totalAmount = +(input.quantity * input.unitPrice).toFixed(2);

  const result = await sql<RawPurchaseRow>`
    INSERT INTO purchases (
      id, purchase_number, purchase_date, item_name, specification, quantity, unit_price, total_amount,
      purchase_channel, purchase_location, purchase_link, purpose,
      payment_method, purchaser_id,
      invoice_type, invoice_images, receipt_images,
      has_project, project_id,
      notes, attachments,
      created_by
    ) VALUES (
      ${id}, ${purchaseNumber}, ${input.purchaseDate}, ${input.itemName}, ${input.specification ?? null}, ${input.quantity}, ${input.unitPrice}, ${totalAmount},
      ${input.purchaseChannel}, ${input.purchaseLocation ?? null}, ${input.purchaseLink ?? null}, ${input.purpose},
      ${input.paymentMethod}, ${input.purchaserId ?? createdBy},
      ${input.invoiceType}, ${input.invoiceImages ?? []}, ${input.receiptImages ?? []},
      ${input.hasProject ?? false}, ${input.projectId ?? null},
      ${input.notes ?? null}, ${input.attachments ?? []},
      ${createdBy}
    )
    RETURNING *
  `;

  const purchase = mapPurchase(result.rows[0])!;
  // initial log: created (from draft to draft not necessary)
  await insertLog(purchase.id, 'submit' as ReimbursementAction, 'draft', 'draft', createdBy, '创建采购记录');
  return purchase;
}

export async function findPurchaseById(id: string): Promise<PurchaseRecord | null> {
  await ensurePurchasesSchema();
  const result = await sql<RawPurchaseRow>`SELECT * FROM purchases WHERE id = ${id} LIMIT 1`;
  return mapPurchase(result.rows[0]);
}

// Get purchase with detailed info (purchaser, project, approver, logs)
export async function getPurchaseDetail(id: string) {
  await ensurePurchasesSchema();
  
  const purchase = await findPurchaseById(id);
  if (!purchase) return null;

  // Fetch related user info
  const userIds = [
    purchase.purchaserId,
    purchase.createdBy,
    purchase.approvedBy,
    purchase.rejectedBy,
    purchase.paidBy,
  ].filter(Boolean);

  const usersResult = userIds.length > 0
    ? await sql<{ id: string; display_name: string; avatar_url: string | null; employee_code: string | null; department: string | null }>`
        SELECT id, display_name, avatar_url, employee_code, department 
        FROM users 
        WHERE id = ANY(${userIds})
      `
    : { rows: [] };

  const usersMap = new Map(usersResult.rows.map(u => [u.id, {
    id: u.id,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    employeeCode: u.employee_code,
    department: u.department,
  }]));

  // Fetch project info if exists
  let project = null;
  if (purchase.projectId) {
    const projectResult = await sql<{ id: string; project_code: string; project_name: string }>`
      SELECT id, project_code, project_name 
      FROM projects 
      WHERE id = ${purchase.projectId} 
      LIMIT 1
    `;
    if (projectResult.rows.length > 0) {
      const p = projectResult.rows[0];
      project = {
        id: p.id,
        projectCode: p.project_code,
        projectName: p.project_name,
      };
    }
  }

  // Fetch logs
  const logs = await getPurchaseLogs(id);

  return {
    ...purchase,
    purchaser: usersMap.get(purchase.purchaserId) || null,
    creator: usersMap.get(purchase.createdBy) || null,
    approver: purchase.approvedBy ? usersMap.get(purchase.approvedBy) || null : null,
    rejecter: purchase.rejectedBy ? usersMap.get(purchase.rejectedBy) || null : null,
    payer: purchase.paidBy ? usersMap.get(purchase.paidBy) || null : null,
    project,
    logs,
  };
}

export async function listPurchases(params: ListPurchasesParams = {}): Promise<ListPurchasesResult> {
  await ensurePurchasesSchema();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 200);
  const sortBy = params.sortBy ?? 'updatedAt';
  const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const sortMap: Record<string, string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    purchaseDate: 'purchase_date',
    totalAmount: 'total_amount',
    status: 'status',
  };
  const sortColumn = sortMap[sortBy] || 'updated_at';

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (!params.includeDeleted) {
    conditions.push('is_deleted = false');
  }

  if (params.search) {
    values.push(`%${params.search.trim()}%`);
    const idx = values.length;
    conditions.push(`(purchase_number ILIKE $${idx} OR item_name ILIKE $${idx} OR purpose ILIKE $${idx})`);
  }

  if (params.status && params.status !== 'all') {
    values.push(params.status);
    conditions.push(`status = $${values.length}`);
  }

  if (params.purchaserId) {
    values.push(params.purchaserId);
    conditions.push(`purchaser_id = $${values.length}`);
  }

  if (params.projectId) {
    values.push(params.projectId);
    conditions.push(`project_id = $${values.length}`);
  }

  if (params.purchaseChannel) {
    values.push(params.purchaseChannel);
    conditions.push(`purchase_channel = $${values.length}`);
  }

  if (params.paymentMethod) {
    values.push(params.paymentMethod);
    conditions.push(`payment_method = $${values.length}`);
  }

  if (params.startDate) {
    values.push(params.startDate);
    conditions.push(`purchase_date >= $${values.length}`);
  }
  if (params.endDate) {
    values.push(params.endDate);
    conditions.push(`purchase_date <= $${values.length}`);
  }

  if (params.minAmount !== undefined) {
    values.push(params.minAmount);
    conditions.push(`total_amount >= $${values.length}`);
  }
  if (params.maxAmount !== undefined) {
    values.push(params.maxAmount);
    conditions.push(`total_amount <= $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = `ORDER BY ${sortColumn} ${sortOrder}, id ASC`;
  const limit = `LIMIT $${values.length + 1}`;
  const offset = `OFFSET $${values.length + 2}`;

  const dataValues = [...values, pageSize, (page - 1) * pageSize];

  const dataQuery = `SELECT * FROM purchases ${where} ${order} ${limit} ${offset}`;
  const countQuery = `SELECT COUNT(*)::int AS total FROM purchases ${where}`;

  const [dataResult, countResult] = await Promise.all([
    pool.query<RawPurchaseRow>(dataQuery, dataValues),
    pool.query<{ total: number }>(countQuery, values),
  ]);

  return {
    items: dataResult.rows.map(r => mapPurchase(r)!),
    total: countResult.rows[0]?.total ?? 0,
    page,
    pageSize,
  };
}

export async function updatePurchase(id: string, input: UpdatePurchaseInput): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(id);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('NOT_EDITABLE');

  const updates: string[] = [];
  const values: unknown[] = [id];
  let idx = 2;

  function push(field: string, value: unknown) {
    updates.push(`${field} = $${idx++}`);
    values.push(value);
  }

  if (input.purchaseDate !== undefined) push('purchase_date', input.purchaseDate);
  if (input.itemName !== undefined) push('item_name', input.itemName);
  if (input.specification !== undefined) push('specification', input.specification);
  if (input.quantity !== undefined) push('quantity', input.quantity);
  if (input.unitPrice !== undefined) push('unit_price', input.unitPrice);
  if (input.quantity !== undefined || input.unitPrice !== undefined) {
    // recalc total if either changed
    const q = input.quantity ?? existing.quantity;
    const u = input.unitPrice ?? existing.unitPrice;
    push('total_amount', +(q * u).toFixed(2));
  }
  if (input.purchaseChannel !== undefined) push('purchase_channel', input.purchaseChannel);
  if (input.purchaseLocation !== undefined) push('purchase_location', input.purchaseLocation);
  if (input.purchaseLink !== undefined) push('purchase_link', input.purchaseLink);
  if (input.purpose !== undefined) push('purpose', input.purpose);
  if (input.paymentMethod !== undefined) push('payment_method', input.paymentMethod);
  if (input.purchaserId !== undefined) push('purchaser_id', input.purchaserId);
  if (input.invoiceType !== undefined) push('invoice_type', input.invoiceType);
  if (input.invoiceImages !== undefined) push('invoice_images', input.invoiceImages);
  if (input.receiptImages !== undefined) push('receipt_images', input.receiptImages);
  if (input.hasProject !== undefined) push('has_project', input.hasProject);
  if (input.projectId !== undefined) push('project_id', input.projectId);
  if (input.notes !== undefined) push('notes', input.notes);
  if (input.attachments !== undefined) push('attachments', input.attachments);

  if (updates.length === 0) return existing;

  updates.push('updated_at = NOW()');

  const query = `UPDATE purchases SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await pool.query<RawPurchaseRow>(query, values);
  if (result.rows.length === 0) throw new Error('PURCHASE_NOT_FOUND');
  return mapPurchase(result.rows[0])!;
}

// submit purchase (draft/rejected -> pending_approval)
export async function submitPurchase(purchaseId: string, operatorId: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('NOT_SUBMITTABLE');

  await sql`
    UPDATE purchases
    SET status = 'pending_approval', submitted_at = NOW(), updated_at = NOW()
    WHERE id = ${purchaseId}
  `;
  await insertLog(purchaseId, 'submit', existing.status, 'pending_approval', operatorId, null);
  return (await findPurchaseById(purchaseId))!;
}

// approve purchase
export async function approvePurchase(purchaseId: string, operatorId: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (existing.status !== 'pending_approval') throw new Error('NOT_APPROVABLE');

  await sql`
    UPDATE purchases
    SET status = 'approved', approved_at = NOW(), approved_by = ${operatorId}, updated_at = NOW()
    WHERE id = ${purchaseId}
  `;
  await insertLog(purchaseId, 'approve', 'pending_approval', 'approved', operatorId, null);
  return (await findPurchaseById(purchaseId))!;
}

// reject purchase
export async function rejectPurchase(purchaseId: string, operatorId: string, reason: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (existing.status !== 'pending_approval') throw new Error('NOT_REJECTABLE');

  await sql`
    UPDATE purchases
    SET status = 'rejected', rejected_at = NOW(), rejected_by = ${operatorId}, rejection_reason = ${reason}, updated_at = NOW()
    WHERE id = ${purchaseId}
  `;
  await insertLog(purchaseId, 'reject', 'pending_approval', 'rejected', operatorId, reason);
  return (await findPurchaseById(purchaseId))!;
}

// mark as paid
export async function markAsPaid(purchaseId: string, operatorId: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (existing.status !== 'approved') throw new Error('NOT_PAYABLE');

  await sql`
    UPDATE purchases
    SET status = 'paid', paid_at = NOW(), paid_by = ${operatorId}, updated_at = NOW()
    WHERE id = ${purchaseId}
  `;
  await insertLog(purchaseId, 'pay', 'approved', 'paid', operatorId, null);
  return (await findPurchaseById(purchaseId))!;
}

// withdraw (pending_approval -> cancelled)
export async function withdrawPurchase(purchaseId: string, operatorId: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (existing.status !== 'pending_approval') throw new Error('NOT_WITHDRAWABLE');

  await sql`
    UPDATE purchases
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${purchaseId}
  `;
  await insertLog(purchaseId, 'withdraw', 'pending_approval', 'cancelled', operatorId, null);
  return (await findPurchaseById(purchaseId))!;
}

// soft delete (only draft or rejected and owner or admin handled in business layer)
export async function deletePurchase(purchaseId: string, operatorId: string): Promise<void> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('NOT_DELETABLE');

  await sql`
    UPDATE purchases
    SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${purchaseId}
  `;
  await insertLog(purchaseId, 'cancel', existing.status, 'cancelled', operatorId, '删除/取消采购记录');
}

export async function getPurchaseLogs(purchaseId: string): Promise<ReimbursementLog[]> {
  await ensurePurchasesSchema();
  const result = await sql<RawLogRow>`SELECT * FROM reimbursement_logs WHERE purchase_id = ${purchaseId} ORDER BY created_at ASC`;
  return result.rows.map(r => mapLog(r)!) as ReimbursementLog[];
}
