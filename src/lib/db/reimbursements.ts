import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';
import { ensureReimbursementsSchema } from '@/lib/schema/reimbursements';
import { ensureBusinessUserRecord, findUserById } from '@/lib/users';
import { formatDateOnly, normalizeDateInput } from '@/lib/dates';
import { findPurchaseById } from '@/lib/db/purchases';
import type {
  CreateReimbursementInput,
  ListReimbursementsParams,
  ListReimbursementsResult,
  ReimbursementAction,
  ReimbursementLog,
  ReimbursementOrganizationType,
  ReimbursementRecord,
  ReimbursementSourceType,
  ReimbursementStatus,
  UpdateReimbursementInput,
} from '@/types/reimbursement';
import { isReimbursementOrganizationType, isReimbursementSourceType, isReimbursementStatus } from '@/types/reimbursement';

const pool = mysqlPool();

type RawReimbursementRow = RowDataPacket & {
  id: string;
  reimbursement_number: string;
  source_type: string;
  source_purchase_id: string | null;
  source_purchase_number: string | null;
  organization_type: string;
  category: string;
  title: string;
  amount: number;
  occurred_at: string;
  description: string | null;
  invoice_images: string | null;
  receipt_images: string | null;
  attachments: string | null;
  status: string;
  pending_approver_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_note: string | null;
  applicant_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

type RawReimbursementLogRow = RowDataPacket & {
  id: string;
  reimbursement_id: string;
  action: string;
  from_status: string;
  to_status: string;
  operator_id: string;
  comment: string | null;
  created_at: string;
};

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && !!item) : [];
  } catch {
    return [];
  }
}

function serializeArray(list: string[] | null | undefined): string {
  return JSON.stringify((list ?? []).filter(Boolean));
}

function requireDate(input: string | null | undefined): string {
  const normalized = normalizeDateInput(input);
  if (!normalized) throw new Error('INVALID_OCCURRED_DATE');
  return normalized;
}

function hasEvidence(input: Pick<ReimbursementRecord, 'invoiceImages' | 'receiptImages'>): boolean {
  return input.invoiceImages.length > 0 || input.receiptImages.length > 0;
}

function normalizeStatus(value: string): ReimbursementStatus {
  return isReimbursementStatus(value) ? value : 'draft';
}

function normalizeSourceType(value: string): ReimbursementSourceType {
  return isReimbursementSourceType(value) ? value : 'direct';
}

function normalizeOrgType(value: string): ReimbursementOrganizationType {
  return isReimbursementOrganizationType(value) ? value : 'company';
}

function mapReimbursement(row: RawReimbursementRow): ReimbursementRecord {
  return {
    id: row.id,
    reimbursementNumber: row.reimbursement_number,
    sourceType: normalizeSourceType(row.source_type),
    sourcePurchaseId: row.source_purchase_id ?? null,
    sourcePurchaseNumber: row.source_purchase_number ?? null,
    organizationType: normalizeOrgType(row.organization_type),
    category: row.category,
    title: row.title,
    amount: Number(row.amount ?? 0),
    occurredAt: formatDateOnly(row.occurred_at) ?? String(row.occurred_at),
    description: row.description ?? null,
    invoiceImages: parseJsonArray(row.invoice_images),
    receiptImages: parseJsonArray(row.receipt_images),
    attachments: parseJsonArray(row.attachments),
    status: normalizeStatus(row.status),
    pendingApproverId: row.pending_approver_id ?? null,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    rejectionReason: row.rejection_reason,
    paidAt: row.paid_at,
    paidBy: row.paid_by,
    paymentNote: row.payment_note,
    applicantId: row.applicant_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReimbursementLog(row: RawReimbursementLogRow): ReimbursementLog {
  const action = (['create', 'submit', 'approve', 'reject', 'withdraw', 'pay'] as const).includes(
    row.action as ReimbursementAction
  )
    ? (row.action as ReimbursementAction)
    : 'submit';
  return {
    id: row.id,
    reimbursementId: row.reimbursement_id,
    action,
    fromStatus: normalizeStatus(row.from_status),
    toStatus: normalizeStatus(row.to_status),
    operatorId: row.operator_id,
    comment: row.comment ?? null,
    createdAt: row.created_at,
  };
}

async function ensureUserExists(userId: string, code: string) {
  try {
    await ensureBusinessUserRecord(userId);
  } catch {
    throw new Error(code);
  }
}

async function generateReimbursementNumber(): Promise<string> {
  const now = new Date();
  const prefix = `RB${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [rows] = await pool.query<Array<RowDataPacket & { count: number }>>(
    'SELECT COUNT(*) AS count FROM reimbursements WHERE reimbursement_number LIKE ?',
    [`${prefix}%`]
  );
  const seq = Number(rows[0]?.count ?? 0) + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function pickAutoApproverId(): Promise<string> {
  const [rows] = await pool.query<Array<RowDataPacket & { id: string }>>(
    `
      SELECT e.id
      FROM hr_employees e
      LEFT JOIN (
        SELECT pending_approver_id, COUNT(*) AS pending_count
        FROM reimbursements
        WHERE is_deleted = 0
          AND status = 'pending_approval'
          AND pending_approver_id IS NOT NULL
        GROUP BY pending_approver_id
      ) approver_load ON approver_load.pending_approver_id = e.id
      WHERE e.is_active = 1
        AND (
          e.primary_role = 'finance'
          OR JSON_CONTAINS(COALESCE(e.roles, JSON_ARRAY()), JSON_QUOTE('finance'), '$')
        )
      ORDER BY
        COALESCE(approver_load.pending_count, 0) ASC,
        e.updated_at DESC,
        e.id ASC
      LIMIT 1
    `
  );
  const id = rows[0]?.id?.trim();
  if (!id) throw new Error('APPROVER_NOT_FOUND');
  return id;
}

async function assertLinkedPurchaseInboundReady(sourcePurchaseId: string) {
  const purchase = await findPurchaseById(sourcePurchaseId);
  if (!purchase || purchase.isDeleted) throw new Error('SOURCE_PURCHASE_NOT_FOUND');
  if (purchase.status !== 'approved' && purchase.status !== 'paid') {
    throw new Error('SOURCE_PURCHASE_NOT_APPROVED');
  }

  const [rows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `
      SELECT COUNT(*) AS total
      FROM inventory_movements m
      WHERE m.direction = 'inbound'
        AND (
          m.related_purchase_id = ?
          OR (m.related_order_id IS NOT NULL AND m.related_order_id = ?)
        )
    `,
    [sourcePurchaseId, purchase.purchaseNumber]
  );
  if (Number(rows[0]?.total ?? 0) <= 0) {
    throw new Error('SOURCE_PURCHASE_INBOUND_REQUIRED');
  }
}

async function insertWorkflowLog(
  reimbursementId: string,
  action: ReimbursementAction,
  fromStatus: ReimbursementStatus,
  toStatus: ReimbursementStatus,
  operatorId: string,
  comment?: string | null
) {
  await pool.query(
    `
      INSERT INTO reimbursement_workflow_logs
      (id, reimbursement_id, action, from_status, to_status, operator_id, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [randomUUID(), reimbursementId, action, fromStatus, toStatus, operatorId, comment ?? null]
  );
}

export async function listReimbursements(params: ListReimbursementsParams): Promise<ListReimbursementsResult> {
  await ensureReimbursementsSchema();

  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? 20)));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  const where: string[] = ['r.is_deleted = 0'];

  if (params.search?.trim()) {
    const keyword = `%${params.search.trim()}%`;
    where.push('(r.reimbursement_number LIKE ? OR r.title LIKE ? OR r.category LIKE ?)');
    values.push(keyword, keyword, keyword);
  }
  if (params.status) {
    where.push('r.status = ?');
    values.push(params.status);
  }
  if (params.sourceType) {
    where.push('r.source_type = ?');
    values.push(params.sourceType);
  }
  if (params.organizationType) {
    where.push('r.organization_type = ?');
    values.push(params.organizationType);
  }
  if (params.category?.trim()) {
    where.push('r.category = ?');
    values.push(params.category.trim());
  }

  const scope = params.scope ?? 'mine';
  if (scope === 'mine') {
    where.push('(r.applicant_id = ? OR r.created_by = ?)');
    values.push(params.currentUserId, params.currentUserId);
  } else if (scope === 'approval') {
    where.push("r.status = 'pending_approval' AND r.pending_approver_id = ?");
    values.push(params.currentUserId);
  } else if (scope === 'pay') {
    where.push("r.status = 'approved'");
    if (params.financeOrgType) {
      where.push('r.organization_type = ?');
      values.push(params.financeOrgType);
    }
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;
  const fromClause = `
    FROM reimbursements r
    LEFT JOIN purchases p ON p.id = r.source_purchase_id
  `;

  const [rows] = await pool.query<RawReimbursementRow[]>(
    `
      SELECT
        r.*,
        p.purchase_number AS source_purchase_number
      ${fromClause}
      ${whereClause}
      ORDER BY r.updated_at DESC, r.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...values, pageSize, offset]
  );

  const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total ${fromClause} ${whereClause}`,
    values
  );

  return {
    items: rows.map(mapReimbursement),
    total: Number(countRows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getReimbursementById(id: string): Promise<ReimbursementRecord | null> {
  await ensureReimbursementsSchema();
  const [rows] = await pool.query<RawReimbursementRow[]>(
    `
      SELECT r.*, p.purchase_number AS source_purchase_number
      FROM reimbursements r
      LEFT JOIN purchases p ON p.id = r.source_purchase_id
      WHERE r.id = ? AND r.is_deleted = 0
      LIMIT 1
    `,
    [id]
  );
  return rows[0] ? mapReimbursement(rows[0]) : null;
}

export async function getReimbursementLogs(id: string): Promise<ReimbursementLog[]> {
  await ensureReimbursementsSchema();
  const [rows] = await pool.query<RawReimbursementLogRow[]>(
    `
      SELECT *
      FROM reimbursement_workflow_logs
      WHERE reimbursement_id = ?
      ORDER BY created_at ASC
    `,
    [id]
  );
  return rows.map(mapReimbursementLog);
}

export async function createReimbursement(
  input: CreateReimbursementInput,
  createdBy: string
): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();

  if (!input.title?.trim()) throw new Error('REIMBURSEMENT_TITLE_REQUIRED');
  if (!input.category?.trim()) throw new Error('REIMBURSEMENT_CATEGORY_REQUIRED');
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('REIMBURSEMENT_AMOUNT_INVALID');

  const sourceType = input.sourceType ?? 'direct';
  if (!isReimbursementSourceType(sourceType)) throw new Error('REIMBURSEMENT_SOURCE_INVALID');
  const sourcePurchaseId = sourceType === 'purchase' ? input.sourcePurchaseId?.trim() || null : null;
  if (sourceType === 'purchase' && !sourcePurchaseId) throw new Error('SOURCE_PURCHASE_REQUIRED');

  const applicantId = input.applicantId?.trim() || createdBy;
  await ensureUserExists(createdBy, 'CREATED_BY_NOT_FOUND');
  await ensureUserExists(applicantId, 'APPLICANT_NOT_FOUND');

  let organizationType: ReimbursementOrganizationType = input.organizationType ?? 'company';
  if (sourceType === 'purchase' && sourcePurchaseId) {
    const purchase = await findPurchaseById(sourcePurchaseId);
    if (!purchase || purchase.isDeleted) throw new Error('SOURCE_PURCHASE_NOT_FOUND');
    organizationType = purchase.organizationType;
  }

  const id = randomUUID();
  const number = await generateReimbursementNumber();
  const occurredAt = requireDate(input.occurredAt);

  await pool.query(
    `
      INSERT INTO reimbursements (
        id, reimbursement_number, source_type, source_purchase_id,
        organization_type, category, title, amount, occurred_at, description,
        invoice_images, receipt_images, attachments, status, applicant_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `,
    [
      id,
      number,
      sourceType,
      sourcePurchaseId,
      organizationType,
      input.category.trim(),
      input.title.trim(),
      Number(input.amount),
      occurredAt,
      input.description?.trim() || null,
      serializeArray(input.invoiceImages),
      serializeArray(input.receiptImages),
      serializeArray(input.attachments),
      applicantId,
      createdBy,
    ]
  );

  await insertWorkflowLog(id, 'create', 'draft', 'draft', createdBy, '创建报销草稿');
  return (await getReimbursementById(id))!;
}

export async function updateReimbursement(
  id: string,
  input: UpdateReimbursementInput
): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  const existing = await getReimbursementById(id);
  if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
  if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('REIMBURSEMENT_NOT_EDITABLE');

  const updates: string[] = [];
  const values: unknown[] = [];

  const push = (field: string, value: unknown) => {
    updates.push(`${field} = ?`);
    values.push(value);
  };

  const nextSourceType = input.sourceType ?? existing.sourceType;
  const nextSourcePurchaseId =
    input.sourcePurchaseId !== undefined ? input.sourcePurchaseId?.trim() || null : existing.sourcePurchaseId;

  if (!isReimbursementSourceType(nextSourceType)) throw new Error('REIMBURSEMENT_SOURCE_INVALID');
  if (nextSourceType === 'purchase' && !nextSourcePurchaseId) throw new Error('SOURCE_PURCHASE_REQUIRED');
  if (nextSourceType === 'purchase' && nextSourcePurchaseId) {
    const purchase = await findPurchaseById(nextSourcePurchaseId);
    if (!purchase || purchase.isDeleted) throw new Error('SOURCE_PURCHASE_NOT_FOUND');
    if (input.organizationType === undefined) {
      push('organization_type', purchase.organizationType);
    }
  }
  if (input.sourceType !== undefined) push('source_type', nextSourceType);
  if (input.sourcePurchaseId !== undefined) push('source_purchase_id', nextSourcePurchaseId);
  if (input.organizationType !== undefined) {
    if (!isReimbursementOrganizationType(input.organizationType)) throw new Error('REIMBURSEMENT_ORG_INVALID');
    push('organization_type', input.organizationType);
  }
  if (input.category !== undefined) {
    if (!input.category.trim()) throw new Error('REIMBURSEMENT_CATEGORY_REQUIRED');
    push('category', input.category.trim());
  }
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new Error('REIMBURSEMENT_TITLE_REQUIRED');
    push('title', input.title.trim());
  }
  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('REIMBURSEMENT_AMOUNT_INVALID');
    push('amount', Number(input.amount));
  }
  if (input.occurredAt !== undefined) {
    push('occurred_at', requireDate(input.occurredAt));
  }
  if (input.description !== undefined) push('description', input.description?.trim() || null);
  if (input.invoiceImages !== undefined) push('invoice_images', serializeArray(input.invoiceImages));
  if (input.receiptImages !== undefined) push('receipt_images', serializeArray(input.receiptImages));
  if (input.attachments !== undefined) push('attachments', serializeArray(input.attachments));

  if (!updates.length) return existing;
  updates.push('updated_at = NOW()');

  await pool.query<ResultSetHeader>(`UPDATE reimbursements SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);
  return (await getReimbursementById(id))!;
}

export async function submitReimbursement(id: string, operatorId: string): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  const existing = await getReimbursementById(id);
  if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
  if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('REIMBURSEMENT_NOT_SUBMITTABLE');
  if (!hasEvidence(existing)) throw new Error('INVOICE_FILES_REQUIRED');
  if (existing.sourceType === 'purchase') {
    if (!existing.sourcePurchaseId) throw new Error('SOURCE_PURCHASE_REQUIRED');
    await assertLinkedPurchaseInboundReady(existing.sourcePurchaseId);
  }
  const approverId = await pickAutoApproverId();

  await pool.query(
    `
      UPDATE reimbursements
      SET status = 'pending_approval',
          pending_approver_id = ?,
          submitted_at = NOW(),
          approved_at = NULL,
          approved_by = NULL,
          rejected_at = NULL,
          rejected_by = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
      WHERE id = ?
    `,
    [approverId, id]
  );

  await insertWorkflowLog(id, 'submit', existing.status, 'pending_approval', operatorId, '提交报销审批');
  return (await getReimbursementById(id))!;
}

export async function approveReimbursement(id: string, operatorId: string, comment?: string | null): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  const existing = await getReimbursementById(id);
  if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
  if (existing.status !== 'pending_approval') throw new Error('REIMBURSEMENT_NOT_APPROVABLE');

  await pool.query(
    `
      UPDATE reimbursements
      SET status = 'approved',
          approved_at = NOW(),
          approved_by = ?,
          pending_approver_id = NULL,
          updated_at = NOW()
      WHERE id = ?
    `,
    [operatorId, id]
  );

  await insertWorkflowLog(id, 'approve', 'pending_approval', 'approved', operatorId, comment ?? '审批通过');
  return (await getReimbursementById(id))!;
}

export async function rejectReimbursement(id: string, operatorId: string, reason: string): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  const existing = await getReimbursementById(id);
  if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
  if (existing.status !== 'pending_approval') throw new Error('REIMBURSEMENT_NOT_REJECTABLE');
  if (!reason.trim()) throw new Error('REIMBURSEMENT_REJECT_REASON_REQUIRED');

  await pool.query(
    `
      UPDATE reimbursements
      SET status = 'rejected',
          rejected_at = NOW(),
          rejected_by = ?,
          rejection_reason = ?,
          pending_approver_id = NULL,
          updated_at = NOW()
      WHERE id = ?
    `,
    [operatorId, reason.trim(), id]
  );

  await insertWorkflowLog(id, 'reject', 'pending_approval', 'rejected', operatorId, reason.trim());
  return (await getReimbursementById(id))!;
}

export async function withdrawReimbursement(id: string, operatorId: string, reason: string): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  const existing = await getReimbursementById(id);
  if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
  if (existing.status !== 'pending_approval') throw new Error('REIMBURSEMENT_NOT_WITHDRAWABLE');

  await pool.query(
    `
      UPDATE reimbursements
      SET status = 'draft',
          pending_approver_id = NULL,
          updated_at = NOW()
      WHERE id = ?
    `,
    [id]
  );
  await insertWorkflowLog(id, 'withdraw', 'pending_approval', 'draft', operatorId, reason?.trim() || null);
  return (await getReimbursementById(id))!;
}

export async function payReimbursement(id: string, operatorId: string, note?: string | null): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  const existing = await getReimbursementById(id);
  if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
  if (existing.status !== 'approved') throw new Error('REIMBURSEMENT_NOT_PAYABLE');

  await pool.query(
    `
      UPDATE reimbursements
      SET status = 'paid',
          paid_at = NOW(),
          paid_by = ?,
          payment_note = ?,
          updated_at = NOW()
      WHERE id = ?
    `,
    [operatorId, note?.trim() || null, id]
  );
  await insertWorkflowLog(id, 'pay', 'approved', 'paid', operatorId, note?.trim() || '财务打款');
  return (await getReimbursementById(id))!;
}

export async function deleteReimbursement(id: string): Promise<void> {
  await ensureReimbursementsSchema();
  await pool.query(
    'UPDATE reimbursements SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
    [id]
  );
}

export async function checkPurchaseEligibilityForReimbursement(purchaseId: string): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  await ensureReimbursementsSchema();
  const purchase = await findPurchaseById(purchaseId);
  if (!purchase || purchase.isDeleted) {
    return { eligible: false, reason: '采购单不存在或已删除' };
  }
  if (purchase.status !== 'approved' && purchase.status !== 'paid') {
    return { eligible: false, reason: '仅已审批采购单可关联报销' };
  }

  try {
    await assertLinkedPurchaseInboundReady(purchaseId);
    return { eligible: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'SOURCE_PURCHASE_INBOUND_REQUIRED') {
      return { eligible: false, reason: '该采购单尚未入库，暂不可关联报销' };
    }
    return { eligible: false, reason: '采购关联校验失败' };
  }
}
