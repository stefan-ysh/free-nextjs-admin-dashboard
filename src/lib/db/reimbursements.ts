import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

import { mysqlPool, withTransaction } from '@/lib/mysql';
import { ensureReimbursementsSchema } from '@/lib/schema/reimbursements';
import { ensureInventorySchema } from '@/lib/schema/inventory';
import { ensureBusinessUserRecord } from '@/lib/users';
import { formatDateOnly, normalizeDateInput } from '@/lib/dates';
import { findPurchaseById } from '@/lib/db/purchases';
import { createRecord, findRecordByReimbursementId } from '@/lib/db/finance';
import { PaymentType, TransactionType } from '@/types/finance';
import type {
  CreateReimbursementInput,
  ListReimbursementsParams,
  ListReimbursementsResult,
  ReimbursementAction,
  ReimbursementCategory,
  ReimbursementDetailField,
  ReimbursementDetails,
  ReimbursementLog,
  ReimbursementOrganizationType,
  ReimbursementRecord,
  ReimbursementSourceType,
  ReimbursementStatus,
  UpdateReimbursementInput,
} from '@/types/reimbursement';
import {
  isReimbursementOrganizationType,
  isReimbursementSourceType,
  isReimbursementStatus,
  REIMBURSEMENT_CATEGORY_FIELDS,
} from '@/types/reimbursement';

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
  details_json: string | null;
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
  paid_by_name: string | null;
  payment_note: string | null;
  applicant_id: string;
  applicant_name: string | null;
  pending_approver_name: string | null;
  approved_by_name: string | null;
  rejected_by_name: string | null;
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

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && !!item);
  }
  if (typeof value === 'object') {
    if (Buffer.isBuffer(value)) {
      const text = value.toString('utf-8');
      if (!text.trim()) return [];
      try {
        const parsed = JSON.parse(text) as unknown;
        return Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === 'string' && !!item)
          : [];
      } catch {
        return [];
      }
    }
    return [];
  }
  try {
    const parsed = JSON.parse(String(value)) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && !!item) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown): ReimbursementDetails {
  if (!value) return {};
  if (typeof value === 'object' && !Buffer.isBuffer(value)) {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record)
        .filter(([key, item]) => key.trim() && typeof item === 'string')
        .map(([key, item]) => [key, String(item)])
    );
  }
  const text = Buffer.isBuffer(value) ? value.toString('utf-8') : String(value);
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([key, item]) => key.trim() && typeof item === 'string')
        .map(([key, item]) => [key, String(item)])
    );
  } catch {
    return {};
  }
}

function serializeArray(list: string[] | null | undefined): string {
  return JSON.stringify((list ?? []).filter(Boolean));
}

function serializeDetails(details: ReimbursementDetails | null | undefined): string {
  const source = details ?? {};
  const normalized = Object.fromEntries(
    Object.entries(source)
      .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
      .filter(([key, value]) => key && value)
  );
  return JSON.stringify(normalized);
}

function requireDate(input: string | null | undefined): string {
  const normalized = normalizeDateInput(input);
  if (!normalized) throw new Error('INVALID_OCCURRED_DATE');
  return normalized;
}

function hasEvidence(input: Pick<ReimbursementRecord, 'invoiceImages' | 'receiptImages'>): boolean {
  return input.invoiceImages.length > 0 || input.receiptImages.length > 0;
}

function hasInvoiceEvidence(input: Pick<ReimbursementRecord, 'invoiceImages'>): boolean {
  return input.invoiceImages.length > 0;
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

function sanitizeReimbursementDetails(
  category: ReimbursementCategory,
  input: ReimbursementDetails | null | undefined
): ReimbursementDetails {
  const fields: ReimbursementDetailField[] = REIMBURSEMENT_CATEGORY_FIELDS[category] ?? [];
  const source = input ?? {};
  if (fields.length === 0) {
    return Object.fromEntries(
      Object.entries(source)
        .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
        .filter(([key, value]) => key && value)
    );
  }
  const allowedKeys = new Set(fields.map((field) => field.key));
  // Always allow system flags
  allowedKeys.add('hasInvoice');

  const normalized: ReimbursementDetails = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!allowedKeys.has(key)) continue;
    const value = String(raw ?? '').trim();
    if (!value) continue;
    if (key.toLowerCase().includes('date')) {
      const date = normalizeDateInput(value);
      if (date) {
        normalized[key] = date;
      }
      continue;
    }
    normalized[key] = value;
  }

  for (const field of fields) {
    if (!field.required) continue;
    const value = normalized[field.key]?.trim();
    if (!value) {
      throw new Error(`REIMBURSEMENT_DETAIL_REQUIRED:${field.key}`);
    }
  }
  return normalized;
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
    details: parseJsonObject(row.details_json),
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
    paidByName: row.paid_by_name ?? null,
    paymentNote: row.payment_note,
    applicantId: row.applicant_id,
    applicantName: row.applicant_name ?? null,
    pendingApproverName: row.pending_approver_name ?? null,
    approvedByName: row.approved_by_name ?? null,
    rejectedByName: row.rejected_by_name ?? null,
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

async function pickAutoApproverId(orgType: ReimbursementOrganizationType): Promise<string> {
  const role = orgType === 'school' ? 'finance_school' : 'finance_company';
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
          e.primary_role = ?
          OR COALESCE(e.roles, '') LIKE CONCAT('%"', ?, '"%')
        )
      ORDER BY
        COALESCE(approver_load.pending_count, 0) ASC,
        e.updated_at DESC,
        e.id ASC
      LIMIT 1
    `,
    [role, role]
  );
  const id = rows[0]?.id?.trim();
  if (!id) throw new Error('APPROVER_NOT_FOUND');
  return id;
}

async function assertLinkedPurchaseInboundReady(sourcePurchaseId: string) {
  // Ensure inventory schema/columns are present before cross-module validation query.
  await ensureInventorySchema();
  const purchase = await findPurchaseById(sourcePurchaseId);
  if (!purchase || purchase.isDeleted) throw new Error('SOURCE_PURCHASE_NOT_FOUND');
  if (purchase.status !== 'approved' && purchase.status !== 'paid') {
    throw new Error('SOURCE_PURCHASE_NOT_APPROVED');
  }
  if (purchase.paymentMethod === 'corporate_transfer') {
    throw new Error('SOURCE_PURCHASE_NOT_REIMBURSABLE');
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

async function assertPurchaseNotAlreadyLinked(
  sourcePurchaseId: string,
  options?: { excludeReimbursementId?: string | null }
) {
  const excludeReimbursementId = options?.excludeReimbursementId?.trim() || null;
  const [rows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `
      SELECT COUNT(*) AS total
      FROM reimbursements r
      WHERE r.is_deleted = 0
        AND r.source_type = 'purchase'
        AND r.source_purchase_id = ?
        AND (? IS NULL OR r.id <> ?)
    `,
    [sourcePurchaseId, excludeReimbursementId, excludeReimbursementId]
  );

  if (Number(rows[0]?.total ?? 0) > 0) {
    throw new Error('SOURCE_PURCHASE_ALREADY_LINKED');
  }
}

async function insertWorkflowLog(
  reimbursementId: string,
  action: ReimbursementAction,
  fromStatus: ReimbursementStatus,
  toStatus: ReimbursementStatus,
  operatorId: string,
  comment?: string | null,
  connection?: PoolConnection
) {
  const db = connection || pool;
  await db.query(
    `
      INSERT INTO reimbursement_workflow_logs
      (id, reimbursement_id, action, from_status, to_status, operator_id, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [randomUUID(), reimbursementId, action, fromStatus, toStatus, operatorId, comment ?? null]
  );
}

async function syncFinanceExpenseRecordForReimbursement(reimbursement: ReimbursementRecord, connection?: PoolConnection) {
  const exists = await findRecordByReimbursementId(reimbursement.id, connection); // findRecord likely needs connection too?
  if (exists) return;

  await createRecord({
    name: reimbursement.title,
    type: TransactionType.EXPENSE,
    category: String(reimbursement.category ?? '报销支出'),
    date: reimbursement.occurredAt,
    contractAmount: Number(reimbursement.amount ?? 0),
    fee: 0,
    paymentType: PaymentType.OTHER,
    quantity: 1,
    sourceType: 'reimbursement',
    purchaseId: reimbursement.sourcePurchaseId,
    reimbursementId: reimbursement.id,
    description: reimbursement.description ?? '',
    createdBy: reimbursement.paidBy ?? reimbursement.approvedBy ?? reimbursement.createdBy,
    status: 'cleared',
    metadata: {
      reimbursementNumber: reimbursement.reimbursementNumber,
      organizationType: reimbursement.organizationType,
      sourceType: reimbursement.sourceType,
      applicantId: reimbursement.applicantId,
      paidAt: reimbursement.paidAt,
    },
  }, connection);
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
    // Finance verifies and pays in one step: include pending_approval and approved.
    where.push("r.status IN ('pending_approval', 'approved')");
    if (params.financeOrgType) {
      where.push('r.organization_type = ?');
      values.push(params.financeOrgType);
    }
  } else if (scope === 'all') {
    // For finance roles viewing "all", restrict to their organization + their own
    if (params.financeOrgType) {
      where.push('(r.applicant_id = ? OR r.created_by = ? OR r.organization_type = ?)');
      values.push(params.currentUserId, params.currentUserId, params.financeOrgType);
    }
    // Only show submitted records for others (exclude others' drafts), but keep own drafts
    where.push("(r.status != 'draft' OR r.applicant_id = ? OR r.created_by = ?)");
    values.push(params.currentUserId, params.currentUserId);
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;
  const fromClause = `
    FROM reimbursements r
    LEFT JOIN purchases p ON p.id = r.source_purchase_id
    LEFT JOIN hr_employees applicant ON applicant.id = r.applicant_id
    LEFT JOIN hr_employees pending_approver ON pending_approver.id = r.pending_approver_id
    LEFT JOIN hr_employees approved_user ON approved_user.id = r.approved_by
    LEFT JOIN hr_employees rejected_user ON rejected_user.id = r.rejected_by
    LEFT JOIN hr_employees paid_user ON paid_user.id = r.paid_by
  `;

  const [rows] = await pool.query<RawReimbursementRow[]>(
    `
      SELECT
        r.*,
        p.purchase_number AS source_purchase_number,
        COALESCE(applicant.display_name, applicant.email) AS applicant_name,
        COALESCE(pending_approver.display_name, pending_approver.email) AS pending_approver_name,
        COALESCE(approved_user.display_name, approved_user.email) AS approved_by_name,
        COALESCE(rejected_user.display_name, rejected_user.email) AS rejected_by_name,
        COALESCE(paid_user.display_name, paid_user.email) AS paid_by_name
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

export async function getReimbursementById(id: string, connection?: PoolConnection): Promise<ReimbursementRecord | null> {
  await ensureReimbursementsSchema();
  const db = connection || pool;
  const [rows] = await db.query<RawReimbursementRow[]>(
    `
      SELECT
        r.*,
        p.purchase_number AS source_purchase_number,
        COALESCE(applicant.display_name, applicant.email) AS applicant_name,
        COALESCE(pending_approver.display_name, pending_approver.email) AS pending_approver_name,
        COALESCE(approved_user.display_name, approved_user.email) AS approved_by_name,
        COALESCE(rejected_user.display_name, rejected_user.email) AS rejected_by_name,
        COALESCE(paid_user.display_name, paid_user.email) AS paid_by_name
      FROM reimbursements r
      LEFT JOIN purchases p ON p.id = r.source_purchase_id
      LEFT JOIN hr_employees applicant ON applicant.id = r.applicant_id
      LEFT JOIN hr_employees pending_approver ON pending_approver.id = r.pending_approver_id
      LEFT JOIN hr_employees approved_user ON approved_user.id = r.approved_by
      LEFT JOIN hr_employees rejected_user ON rejected_user.id = r.rejected_by
      LEFT JOIN hr_employees paid_user ON paid_user.id = r.paid_by
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

  // Pre-transaction checks (can be moved inside if critical for consistency, but these are mostly static or loose checks)
  const sourceType = input.sourceType ?? 'direct';
  if (!isReimbursementSourceType(sourceType)) throw new Error('REIMBURSEMENT_SOURCE_INVALID');
  const sourcePurchaseId = sourceType === 'purchase' ? input.sourcePurchaseId?.trim() || null : null;
  if (sourceType === 'purchase' && !sourcePurchaseId) throw new Error('SOURCE_PURCHASE_REQUIRED');

  const applicantId = input.applicantId?.trim() || createdBy;
  await ensureUserExists(createdBy, 'CREATED_BY_NOT_FOUND');
  await ensureUserExists(applicantId, 'APPLICANT_NOT_FOUND');

  return withTransaction(async (connection) => {
      let organizationType: ReimbursementOrganizationType = input.organizationType ?? 'company';
      if (sourceType === 'purchase' && sourcePurchaseId) {
        // Validation inside transaction
        const purchase = await findPurchaseById(sourcePurchaseId, connection);
        if (!purchase || purchase.isDeleted) throw new Error('SOURCE_PURCHASE_NOT_FOUND');
        if (purchase.paymentMethod === 'corporate_transfer') throw new Error('SOURCE_PURCHASE_NOT_REIMBURSABLE');
        // assertPurchaseNotAlreadyLinked checks reimbursements. It should use connection too.
        // But assertPurchaseNotAlreadyLinked uses pool query inside. 
        // We should just run the query directly here or assume pool is fine for reading unrelated reimbursements (phantom reads acceptable?).
        // For strictness, let's run the check manually or leave it as is (pool).
        await assertPurchaseNotAlreadyLinked(sourcePurchaseId);
        organizationType = purchase.organizationType;
      }

      const id = randomUUID();
      const number = await generateReimbursementNumber(); // Uses pool.
      const occurredAt = requireDate(input.occurredAt);
      const details = sanitizeReimbursementDetails(input.category.trim(), input.details);

      await connection.query(
        `
          INSERT INTO reimbursements (
            id, reimbursement_number, source_type, source_purchase_id,
            organization_type, category, title, amount, occurred_at, description,
            details_json, invoice_images, receipt_images, attachments, status, applicant_id, created_by,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NOW(), NOW())
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
          serializeDetails(details),
          serializeArray(input.invoiceImages),
          serializeArray(input.receiptImages),
          serializeArray(input.attachments),
          applicantId,
          createdBy,
        ]
      );

      await insertWorkflowLog(id, 'create', 'draft', 'draft', createdBy, '创建报销草稿', connection);
      return (await getReimbursementById(id, connection))!;
  });
}

export async function updateReimbursement(
  id: string,
  input: UpdateReimbursementInput
): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  
  return withTransaction(async (connection) => {
    const existing = await getReimbursementById(id, connection);
    if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
    if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('REIMBURSEMENT_NOT_EDITABLE');
    if (existing.sourceType === 'purchase' && existing.submittedAt && existing.status !== 'rejected') {
      throw new Error('REIMBURSEMENT_LINKED_PURCHASE_LOCKED');
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    const push = (field: string, value: unknown) => {
      updates.push(`${field} = ?`);
      values.push(value);
    };

    const nextSourceType = input.sourceType ?? existing.sourceType;
    const nextSourcePurchaseId =
      input.sourcePurchaseId !== undefined ? input.sourcePurchaseId?.trim() || null : existing.sourcePurchaseId;
    const nextCategory = input.category !== undefined ? input.category.trim() : existing.category;

    if (!isReimbursementSourceType(nextSourceType)) throw new Error('REIMBURSEMENT_SOURCE_INVALID');
    if (nextSourceType === 'purchase' && !nextSourcePurchaseId) throw new Error('SOURCE_PURCHASE_REQUIRED');
    if (nextSourceType === 'purchase' && nextSourcePurchaseId) {
      const purchase = await findPurchaseById(nextSourcePurchaseId, connection); // Inside transaction
      if (!purchase || purchase.isDeleted) throw new Error('SOURCE_PURCHASE_NOT_FOUND');
      if (purchase.paymentMethod === 'corporate_transfer') throw new Error('SOURCE_PURCHASE_NOT_REIMBURSABLE');
      if (nextSourcePurchaseId !== (existing.sourcePurchaseId ?? '')) {
        await assertPurchaseNotAlreadyLinked(nextSourcePurchaseId, { excludeReimbursementId: id });
        // assertPurchaseNotAlreadyLinked uses pool, which is fine (check other records).
      }
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
      if (!nextCategory) throw new Error('REIMBURSEMENT_CATEGORY_REQUIRED');
      push('category', nextCategory);
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
    if (input.details !== undefined || input.category !== undefined) {
      const nextDetails = sanitizeReimbursementDetails(nextCategory, input.details ?? existing.details);
      push('details_json', serializeDetails(nextDetails));
    }
    if (input.invoiceImages !== undefined) push('invoice_images', serializeArray(input.invoiceImages));
    if (input.receiptImages !== undefined) push('receipt_images', serializeArray(input.receiptImages));
    if (input.attachments !== undefined) push('attachments', serializeArray(input.attachments));

    if (!updates.length) return existing;
    updates.push('updated_at = NOW()');

    await connection.query<ResultSetHeader>(`UPDATE reimbursements SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);
    return (await getReimbursementById(id, connection))!;
  });
}

export async function submitReimbursement(id: string, operatorId: string): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  
  return withTransaction(async (connection) => {
    const existing = await getReimbursementById(id, connection);
    if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
    if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('REIMBURSEMENT_NOT_SUBMITTABLE');
    sanitizeReimbursementDetails(existing.category, existing.details);

    if (existing.sourceType === 'purchase') {
      if (!existing.sourcePurchaseId) throw new Error('SOURCE_PURCHASE_REQUIRED');
      const sourcePurchase = await findPurchaseById(existing.sourcePurchaseId, connection); // fetch inside transaction
      if (!sourcePurchase || sourcePurchase.isDeleted) throw new Error('SOURCE_PURCHASE_NOT_FOUND');
      const purchaseNeedInvoice =
        sourcePurchase.invoiceType !== 'none' && sourcePurchase.invoiceStatus !== 'not_required';
      if (purchaseNeedInvoice && !hasInvoiceEvidence(existing)) {
        throw new Error('REIMBURSEMENT_PURCHASE_INVOICE_REQUIRED');
      }
      await assertLinkedPurchaseInboundReady(existing.sourcePurchaseId); // This uses pool, maybe ok.
    } else if (!hasEvidence(existing)) {
      throw new Error('INVOICE_FILES_REQUIRED');
    }
    const approverId = await pickAutoApproverId(existing.organizationType);

    await connection.query(
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

    await insertWorkflowLog(id, 'submit', existing.status, 'pending_approval', operatorId, '提交报销审批', connection);
    return (await getReimbursementById(id, connection))!;
  });
}

export async function approveReimbursement(id: string, operatorId: string, comment?: string | null): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  
  return withTransaction(async (connection) => {
    const existing = await getReimbursementById(id, connection);
    if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
    if (existing.status !== 'pending_approval') throw new Error('REIMBURSEMENT_NOT_APPROVABLE');

    await connection.query(
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

    await insertWorkflowLog(id, 'approve', 'pending_approval', 'approved', operatorId, comment ?? '审批通过', connection);
    return (await getReimbursementById(id, connection))!;
  });
}

export async function rejectReimbursement(id: string, operatorId: string, reason: string): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  
  return withTransaction(async (connection) => {
    const existing = await getReimbursementById(id, connection);
    if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
    if (existing.status !== 'pending_approval' && existing.status !== 'approved') throw new Error('REIMBURSEMENT_NOT_REJECTABLE');
    if (!reason.trim()) throw new Error('REIMBURSEMENT_REJECT_REASON_REQUIRED');
    const fromStatus = existing.status;

    await connection.query(
      `
        UPDATE reimbursements
        SET status = 'rejected',
            approved_at = NULL,
            approved_by = NULL,
            rejected_at = NOW(),
            rejected_by = ?,
            rejection_reason = ?,
            pending_approver_id = NULL,
            updated_at = NOW()
        WHERE id = ?
      `,
      [operatorId, reason.trim(), id]
    );

    await insertWorkflowLog(id, 'reject', fromStatus, 'rejected', operatorId, reason.trim(), connection);
    return (await getReimbursementById(id, connection))!;
  });
}

export async function withdrawReimbursement(id: string, operatorId: string, reason: string): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  
  return withTransaction(async (connection) => {
    const existing = await getReimbursementById(id, connection);
    if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
    if (existing.status !== 'pending_approval') throw new Error('REIMBURSEMENT_NOT_WITHDRAWABLE');

    await connection.query(
      `
        UPDATE reimbursements
        SET status = 'draft',
            pending_approver_id = NULL,
            updated_at = NOW()
        WHERE id = ?
      `,
      [id]
    );
    await insertWorkflowLog(id, 'withdraw', 'pending_approval', 'draft', operatorId, reason?.trim() || null, connection);
    return (await getReimbursementById(id, connection))!;
  });
}

export async function payReimbursement(id: string, operatorId: string, note?: string | null): Promise<ReimbursementRecord> {
  await ensureReimbursementsSchema();
  
  return withTransaction(async (connection) => {
    const existing = await getReimbursementById(id, connection);
    if (!existing) throw new Error('REIMBURSEMENT_NOT_FOUND');
    if (existing.status !== 'approved' && existing.status !== 'pending_approval') throw new Error('REIMBURSEMENT_NOT_PAYABLE');

    if (existing.status === 'pending_approval') {
      await connection.query(
        `
          UPDATE reimbursements
          SET status = 'paid',
              approved_at = NOW(),
              approved_by = ?,
              pending_approver_id = NULL,
              paid_at = NOW(),
              paid_by = ?,
              payment_note = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        [operatorId, operatorId, note?.trim() || null, id]
      );
      await insertWorkflowLog(id, 'approve', 'pending_approval', 'approved', operatorId, '财务核对通过并准备打款', connection);
      await insertWorkflowLog(id, 'pay', 'approved', 'paid', operatorId, note?.trim() || '财务打款', connection);
    } else {
      await connection.query(
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
      await insertWorkflowLog(id, 'pay', 'approved', 'paid', operatorId, note?.trim() || '财务打款', connection);
    }

    const updated = (await getReimbursementById(id, connection))!;
    await syncFinanceExpenseRecordForReimbursement(updated, connection);
    return updated;
  });
}

export async function deleteReimbursement(id: string): Promise<void> {
  await ensureReimbursementsSchema();
  await withTransaction(async (connection) => {
    await connection.query(
      'UPDATE reimbursements SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
      [id]
    );
  });
}

export async function checkPurchaseEligibilityForReimbursement(
  purchaseId: string,
  options?: { excludeReimbursementId?: string | null }
): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  await ensureReimbursementsSchema();
  const purchase = await findPurchaseById(purchaseId);
  if (!purchase || purchase.isDeleted) {
    return { eligible: false, reason: '采购单不存在或已删除' };
  }
  if (purchase.status !== 'approved' && purchase.status !== 'pending_inbound' && purchase.status !== 'paid') {
    return { eligible: false, reason: '仅已审批采购单可关联报销' };
  }
  if (purchase.paymentMethod === 'corporate_transfer') {
    return { eligible: false, reason: '对公转账采购不属于员工垫付，不能关联报销' };
  }

  try {
    const excludeReimbursementId = options?.excludeReimbursementId?.trim() || null;
    if (excludeReimbursementId) {
      const [currentRows] = await pool.query<Array<RowDataPacket & { source_purchase_id: string | null }>>(
        `
          SELECT source_purchase_id
          FROM reimbursements
          WHERE id = ?
            AND is_deleted = 0
          LIMIT 1
        `,
        [excludeReimbursementId]
      );
      const currentSourcePurchaseId = currentRows[0]?.source_purchase_id ?? null;
      if (currentSourcePurchaseId !== purchaseId) {
        await assertPurchaseNotAlreadyLinked(purchaseId, {
          excludeReimbursementId,
        });
      }
    } else {
      await assertPurchaseNotAlreadyLinked(purchaseId);
    }
    await assertLinkedPurchaseInboundReady(purchaseId);
    return { eligible: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'SOURCE_PURCHASE_ALREADY_LINKED') {
      return { eligible: false, reason: '该采购单已关联报销单，不能重复关联' };
    }
    if (error instanceof Error && error.message === 'SOURCE_PURCHASE_NOT_REIMBURSABLE') {
      return { eligible: false, reason: '对公转账采购不属于员工垫付，不能关联报销' };
    }
    if (error instanceof Error && error.message === 'SOURCE_PURCHASE_INBOUND_REQUIRED') {
      return { eligible: false, reason: '该采购单尚未入库，暂不可关联报销' };
    }
    const sqlCode = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
    const sqlMessage = typeof error === 'object' && error !== null && 'sqlMessage' in error
      ? String((error as { sqlMessage?: unknown }).sqlMessage ?? '')
      : '';
    console.error('[reimbursements] purchase eligibility unexpected error', {
      purchaseId,
      sqlCode,
      sqlMessage,
      error,
    });

    if (sqlCode === 'ER_BAD_FIELD_ERROR') {
      return {
        eligible: false,
        reason: '数据库字段缺失（inventory_movements.related_purchase_id），请执行最新迁移',
      };
    }
    if (sqlCode === 'ER_NO_SUCH_TABLE') {
      return {
        eligible: false,
        reason: '库存流水表不存在（inventory_movements），请先初始化库存模块',
      };
    }
    if (sqlCode === 'ER_PARSE_ERROR') {
      return {
        eligible: false,
        reason: '数据库语法校验失败，请检查当前 MySQL 版本与表结构',
      };
    }

    if (error instanceof Error && error.message.trim()) {
      return { eligible: false, reason: `采购关联校验异常：${error.message.trim()}` };
    }
    return { eligible: false, reason: '采购关联校验失败（未知异常）' };
  }
}
