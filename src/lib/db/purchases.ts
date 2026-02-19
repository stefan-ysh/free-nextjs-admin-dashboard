import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

import { mysqlPool, mysqlQuery, withTransaction } from '@/lib/mysql';
import { ensurePurchasesSchema } from '@/lib/schema/purchases';
import {
  PurchaseRecord,
  PurchaseDetail,
  CreatePurchaseInput,
  UpdatePurchaseInput,
  ListPurchasesParams,
  ListPurchasesResult,
  PurchaseStatus,
  PurchaseChannel,
  PaymentMethod,
  PaymentType,
  InvoiceType,
  InvoiceStatus,
  ReimbursementLog,
  ReimbursementAction,
  ReimbursementStatus,
  PurchaseStats,
  PurchaseMonitorData,
  PurchaseMonitorStatusSummary,
  PurchaseMonitorApproverLoad,
  PurchaseMonitorStuckRecord,
  PurchaseAuditLogItem,
  isPurchaseChannel,
  isPurchaseOrganization,
  isPaymentMethod,
  isPaymentType,
  isInvoiceType,
  isInvoiceStatus,
  isPurchaseStatus,
  isReimbursementAction,
  isReimbursementStatus,
  hasInvoiceEvidence,
} from '@/types/purchase';
import { findUserById, ensureBusinessUserRecord } from '@/lib/users';
import { normalizeDateInput, formatDateOnly } from '@/lib/dates';
import { InvoiceType as FinanceInvoiceType } from '@/types/finance';

function safeIsoString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function safeDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
     return formatDateOnly(value);
  }
  return String(value);
}

function sanitizeId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function ensureUserExists(userId: string, errorCode: string): Promise<void> {
  try {
    await ensureBusinessUserRecord(userId);
  } catch {
    throw new Error(errorCode);
  }
}

const pool = mysqlPool();

const PURCHASE_SELECT_FIELDS = `
  p.*,
  p.inventory_item_id,
  (
    SELECT COALESCE(u.display_name, u.email)
    FROM hr_employees u
    WHERE u.id = p.purchaser_id
    LIMIT 1
  ) AS purchaser_display_name,
  (
    SELECT COALESCE(u.display_name, u.email)
    FROM hr_employees u
    WHERE u.id = p.approved_by
    LIMIT 1
  ) AS approved_by_name,
  (
    SELECT COALESCE(u.display_name, u.email)
    FROM hr_employees u
    WHERE u.id = p.rejected_by
    LIMIT 1
  ) AS rejected_by_name,
  (
    SELECT COALESCE(u.display_name, u.email)
    FROM hr_employees u
    WHERE u.id = p.pending_approver_id
    LIMIT 1
  ) AS pending_approver_name,
  (
    SELECT COALESCE(u.display_name, u.email)
    FROM hr_employees u
    WHERE u.id = p.paid_by
    LIMIT 1
  ) AS paid_by_name,
  COALESCE((
    SELECT SUM(im.quantity)
    FROM inventory_movements im
    WHERE im.direction = 'inbound'
      AND im.related_purchase_id = p.id
  ), 0) AS inbound_quantity,
  EXISTS (
    SELECT 1
    FROM inventory_movements im
    WHERE im.direction = 'inbound'
      AND im.related_purchase_id = p.id
    LIMIT 1
  ) AS has_inbound_record
`;

const PURCHASE_FROM_CLAUSE = `
  FROM purchases p
`;

const hasOwn = <T extends object>(obj: T, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

type RawPurchaseRow = RowDataPacket & {
  id: string;
  purchase_number: string;
  purchase_date: string;
  organization_type: string;
  item_name: string;
  inventory_item_id: string | null;
  specification: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  fee_amount: number;
  purchase_channel: string;
  purchase_location: string | null;
  purchase_link: string | null;
  purpose: string;
  payment_method: string;
  payment_type: string;
  payment_channel: string | null;
  payer_name: string | null;
  purchaser_display_name: string | null;
  approved_by_name: string | null;
  rejected_by_name: string | null;
  pending_approver_name: string | null;
  paid_by_name: string | null;
  transaction_no: string | null;
  purchaser_id: string;
  invoice_type: string;
  invoice_status: string;
  reimbursement_status: string;
  reimbursement_submitted_at: string | null;
  reimbursement_submitted_by: string | null;
  reimbursement_rejected_at: string | null;
  reimbursement_rejected_by: string | null;
  reimbursement_rejected_reason: string | null;
  inbound_quantity: number | null;
  has_inbound_record: number | null;
  invoice_number: string | null;
  invoice_issue_date: string | null;
  invoice_images: string | null;
  receipt_images: string | null;
  status: string;
  submitted_at: string | null;
  pending_approver_id: string | null;

  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  payment_issue_open: number | null;
  payment_issue_reason: string | null;
  payment_issue_at: string | null;
  payment_issue_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  attachments: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  is_deleted: number;
  deleted_at: string | null;
};

type RawLogRow = RowDataPacket & {
  id: string;
  purchase_id: string;
  action: string;
  from_status: string;
  to_status: string;
  operator_id: string;
  comment: string | null;
  created_at: string;
};

type RawPurchaseAuditRow = RowDataPacket & {
  id: string;
  purchase_id: string;
  purchase_number: string;
  item_name: string;
  action: string;
  from_status: string;
  to_status: string;
  operator_id: string;
  operator_name: string | null;
  comment: string | null;
  created_at: string;
};

type RawMonitorStatusRow = RowDataPacket & {
  status: string;
  count: number | null;
  amount: number | null;
};

type RawMonitorPendingStatsRow = RowDataPacket & {
  pending_count: number | null;
  avg_pending_hours: number | null;
  overdue_count: number | null;
};

type RawMonitorAgingRow = RowDataPacket & {
  lt_24: number | null;
  h24_48: number | null;
  h48_72: number | null;
  gte_72: number | null;
};

type RawMonitorApproverRow = RowDataPacket & {
  approver_id: string | null;
  approver_name: string | null;
  pending_count: number | null;
  total_pending_amount: number | null;
  avg_pending_hours: number | null;
  max_pending_hours: number | null;
};

type RawMonitorStuckRow = RowDataPacket & {
  id: string;
  purchase_number: string;
  item_name: string;
  purchaser_id: string;
  purchaser_name: string | null;
  pending_approver_id: string | null;
  pending_approver_name: string | null;
  submitted_at: string | null;
  pending_hours: number | null;
  due_amount: number | null;
};

type RawAutoApproverRow = RowDataPacket & {
  id: string;
};

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch (error) {
      console.warn('Failed to parse JSON array column', error);
    }
  }
  return [];
}



function serializeArray(value?: string[] | null): string {
  return JSON.stringify(value ?? []);
}

function normalizePurchaseChannel(value: string): PurchaseChannel {
  return isPurchaseChannel(value) ? value : 'online';
}

function normalizePaymentMethod(value: string): PaymentMethod {
  return isPaymentMethod(value) ? value : 'cash';
}

function normalizeInvoiceType(value: string): InvoiceType {
  return isInvoiceType(value) ? value : FinanceInvoiceType.NONE;
}

function normalizePaymentType(value: string): PaymentType {
  return isPaymentType(value) ? value : PaymentType.FULL_PAYMENT;
}

function normalizeInvoiceStatus(value: string): InvoiceStatus {
  return isInvoiceStatus(value) ? value : InvoiceStatus.NOT_REQUIRED;
}

function normalizePurchaseStatus(value: string): PurchaseStatus {
  return isPurchaseStatus(value) ? value : 'draft';
}

function normalizeReimbursementStatus(value: string): ReimbursementStatus {
  return isReimbursementStatus(value) ? value : 'none';
}

function normalizeReimbursementAction(value: string): ReimbursementAction {
  return isReimbursementAction(value) ? value : 'submit';
}

function requirePurchaseDate(value: string | null | undefined): string {
  const normalized = normalizeDateInput(value, { errorCode: 'INVALID_PURCHASE_DATE' });
  if (!normalized) {
    throw new Error('PURCHASE_DATE_REQUIRED');
  }
  return normalized;
}

function mapPurchase(row: RawPurchaseRow | undefined): PurchaseRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    purchaseNumber: row.purchase_number,
    purchaseDate: safeDateString(row.purchase_date) ?? '',
    organizationType: isPurchaseOrganization(row.organization_type) ? row.organization_type : 'company',
    itemName: row.item_name,
    inventoryItemId: row.inventory_item_id ?? null,
    specification: row.specification,
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    feeAmount: Number(row.fee_amount ?? 0),
    purchaseChannel: normalizePurchaseChannel(row.purchase_channel),
    purchaseLocation: row.purchase_location,
    purchaseLink: row.purchase_link,
    purpose: row.purpose,
    paymentMethod: normalizePaymentMethod(row.payment_method),
    paymentType: normalizePaymentType(row.payment_type),
    paymentChannel: row.payment_channel,
    payerName: row.payer_name,
    transactionNo: row.transaction_no,
    purchaserId: row.purchaser_id,
    purchaserName: row.purchaser_display_name ?? null,
    invoiceType: normalizeInvoiceType(row.invoice_type),
    invoiceStatus: normalizeInvoiceStatus(row.invoice_status),
    reimbursementStatus: normalizeReimbursementStatus(row.reimbursement_status),
    reimbursementSubmittedAt: safeIsoString(row.reimbursement_submitted_at),
    reimbursementSubmittedBy: row.reimbursement_submitted_by ?? null,
    reimbursementRejectedAt: safeIsoString(row.reimbursement_rejected_at),
    reimbursementRejectedBy: row.reimbursement_rejected_by ?? null,
    reimbursementRejectedReason: row.reimbursement_rejected_reason ?? null,
    inboundQuantity: Number(row.inbound_quantity ?? 0),
    hasInboundRecord: Boolean(row.has_inbound_record),
    invoiceNumber: row.invoice_number,
    invoiceIssueDate: safeDateString(row.invoice_issue_date),
    invoiceImages: parseJsonArray(row.invoice_images),
    receiptImages: parseJsonArray(row.receipt_images),
    status: normalizePurchaseStatus(row.status),
    pendingApproverId: row.pending_approver_id ?? null,
    pendingApproverName: row.pending_approver_name ?? null,

    paymentIssueOpen: Boolean(row.payment_issue_open),
    paymentIssueReason: row.payment_issue_reason ?? null,
    paymentIssueAt: safeIsoString(row.payment_issue_at),
    paymentIssueBy: row.payment_issue_by ?? null,
    submittedAt: safeIsoString(row.submitted_at),
    approvedAt: safeIsoString(row.approved_at),
    approvedBy: row.approved_by,
    approvedByName: row.approved_by_name ?? null,
    rejectedAt: safeIsoString(row.rejected_at),
    rejectedBy: row.rejected_by,
    rejectedByName: row.rejected_by_name ?? null,
    rejectionReason: row.rejection_reason,
    paidAt: safeIsoString(row.paid_at),
    paidBy: row.paid_by,
    paidByName: row.paid_by_name ?? null,
    notes: row.notes,
    attachments: parseJsonArray(row.attachments),
    createdAt: safeIsoString(row.created_at) ?? '',
    updatedAt: safeIsoString(row.updated_at) ?? '',
    createdBy: row.created_by,
    isDeleted: row.is_deleted === 1,
    deletedAt: safeIsoString(row.deleted_at),
  };
}

function mapLog(row: RawLogRow | undefined): ReimbursementLog | null {
  if (!row) return null;
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    action: normalizeReimbursementAction(row.action),
    fromStatus: normalizePurchaseStatus(row.from_status),
    toStatus: normalizePurchaseStatus(row.to_status),
    operatorId: row.operator_id,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

type PurchaserProfile = PurchaseDetail['purchaser'];
type BasicUserProfile = PurchaseDetail['approver'];

type PurchaseFilterClause = {
  whereClause: string;
  values: unknown[];
};

function buildPurchaseFilterClause(params: ListPurchasesParams = {}, tableAlias = ''): PurchaseFilterClause {
  const column = (name: string) => (tableAlias ? `${tableAlias}.${name}` : name);
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (!params.includeDeleted) {
    conditions.push(`${column('is_deleted')} = 0`);
  }

  if (params.search) {
    const search = `%${params.search.trim().toLowerCase()}%`;
    conditions.push('(' +
      `LOWER(${column('purchase_number')}) LIKE ? OR ` +
      `LOWER(${column('item_name')}) LIKE ? OR ` +
      `LOWER(${column('purpose')}) LIKE ?` +
      ')');
    values.push(search, search, search);
  }

  if (params.status && params.status !== 'all') {
    conditions.push(`${column('status')} = ?`);
    values.push(params.status);
  }

  if (params.statusList && params.statusList.length > 0) {
    const placeholders = params.statusList.map(() => '?').join(', ');
    conditions.push(`${column('status')} IN (${placeholders})`);
    values.push(...params.statusList);
  }

  if (params.purchaserId) {
    conditions.push(`${column('purchaser_id')} = ?`);
    values.push(params.purchaserId);
  }

  if (params.relatedUserId) {
    conditions.push(
      `(${column('created_by')} = ? OR ${column('purchaser_id')} = ? OR ${column('approved_by')} = ? OR ${column('rejected_by')} = ?)`
    );
    values.push(params.relatedUserId, params.relatedUserId, params.relatedUserId, params.relatedUserId);
  }

  if (params.hideOthersDrafts && params.currentUserId) {
    conditions.push(`(${column('status')} <> 'draft' OR ${column('created_by')} = ? OR ${column('purchaser_id')} = ?)`);
    values.push(params.currentUserId, params.currentUserId);
  }

  if (params.organizationType) {
    conditions.push(`${column('organization_type')} = ?`);
    values.push(params.organizationType);
  }

  if (params.pendingApproverId) {
    if (params.includeUnassignedApprovals) {
      if (params.financeOrgType) {
        // For finance roles: see assigned tasks OR (unassigned tasks AND match org type)
        // Note: financeOrgType 'school' should match 'school' org type, 'company' matches 'company'
        conditions.push(`(${column('pending_approver_id')} = ? OR (${column('pending_approver_id')} IS NULL AND ${column('organization_type')} = ?))`);
        values.push(params.pendingApproverId, params.financeOrgType);
      } else {
        // Standard behavior
        conditions.push(`(${column('pending_approver_id')} = ? OR ${column('pending_approver_id')} IS NULL)`);
        values.push(params.pendingApproverId);
      }
    } else {
      conditions.push(`${column('pending_approver_id')} = ?`);
      values.push(params.pendingApproverId);
    }
  }

  if (params.purchaseChannel) {
    conditions.push(`${column('purchase_channel')} = ?`);
    values.push(params.purchaseChannel);
  }

  if (params.paymentMethod) {
    conditions.push(`${column('payment_method')} = ?`);
    values.push(params.paymentMethod);
  }

  if (params.startDate) {
    conditions.push(`${column('purchase_date')} >= ?`);
    values.push(params.startDate);
  }

  if (params.endDate) {
    conditions.push(`${column('purchase_date')} <= ?`);
    values.push(params.endDate);
  }

  if (params.minAmount != null) {
    conditions.push(`${column('total_amount')} >= ?`);
    values.push(params.minAmount);
  }

  if (params.maxAmount != null) {
    conditions.push(`${column('total_amount')} <= ?`);
    values.push(params.maxAmount);
  }

  if (params.paymentStatus === 'paid') {
    conditions.push(`${column('paid_at')} IS NOT NULL`);
  } else if (params.paymentStatus === 'unpaid') {
    conditions.push(`${column('paid_at')} IS NULL`);
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

function appendWhereClause(baseWhereClause: string, extraCondition: string): string {
  if (!baseWhereClause) {
    return `WHERE ${extraCondition}`;
  }
  return `${baseWhereClause} AND ${extraCondition}`;
}

function buildPurchaserProfile(user: Awaited<ReturnType<typeof findUserById>> | null, fallbackId: string): PurchaserProfile {
  return {
    id: user?.id ?? fallbackId,
    displayName: user?.displayName ?? '—',
    employeeCode: user?.employeeCode ?? null,
    department: user?.department ?? null,
  };
}

function buildBasicUserProfile(user: Awaited<ReturnType<typeof findUserById>> | null): BasicUserProfile {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
  };
}

async function generatePurchaseNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PC${year}${month}`;
  const result = await mysqlQuery<RowDataPacket & { count: number }>`
    SELECT COUNT(*) AS count FROM purchases WHERE purchase_number LIKE ${prefix + '%'}
  `;
  const seq = (result.rows[0]?.count || 0) + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function pickAutoApproverId(): Promise<string> {
  const [rows] = await pool.query<RawAutoApproverRow[]>(
    `
      SELECT e.id
      FROM hr_employees e
      LEFT JOIN (
        SELECT pending_approver_id, COUNT(*) AS pending_count
        FROM purchases
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

  const approverId = rows[0]?.id?.trim();
  if (!approverId) throw new Error('APPROVER_NOT_FOUND');
  return approverId;
}

async function insertLog(
  purchaseId: string,
  action: ReimbursementAction,
  fromStatus: PurchaseStatus,
  toStatus: PurchaseStatus,
  operatorId: string,
  comment?: string | null,
  connection?: PoolConnection | null
) {
  await ensurePurchasesSchema();
  const id = randomUUID();
  const sql = `
    INSERT INTO reimbursement_logs (id, purchase_id, action, from_status, to_status, operator_id, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  const params = [id, purchaseId, action, fromStatus, toStatus, operatorId, comment ?? null];
  if (connection) {
    await connection.query(sql, params);
    return;
  }
  await mysqlQuery`
    INSERT INTO reimbursement_logs (id, purchase_id, action, from_status, to_status, operator_id, comment, created_at)
    VALUES (${id}, ${purchaseId}, ${action}, ${fromStatus}, ${toStatus}, ${operatorId}, ${comment ?? null}, NOW())
  `;
}

export async function createPurchase(
  input: CreatePurchaseInput,
  createdBy: string
): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();

  const creatorId = sanitizeId(createdBy);
  if (!creatorId) {
    throw new Error('CREATED_BY_REQUIRED');
  }

  // validations
  if (input.purchaseChannel === 'online' && (!input.purchaseLink || input.purchaseLink.trim() === '')) {
    throw new Error('PURCHASE_LINK_REQUIRED');
  }
  if (input.purchaseChannel === 'offline' && (!input.purchaseLocation || input.purchaseLocation.trim() === '')) {
    throw new Error('PURCHASE_LOCATION_REQUIRED');
  }
  if (input.quantity <= 0) throw new Error('INVALID_QUANTITY');
  if (input.unitPrice < 0) throw new Error('INVALID_UNIT_PRICE');
  if (!isPurchaseOrganization(input.organizationType)) {
    throw new Error('INVALID_ORGANIZATION_TYPE');
  }

  const feeAmount = Number(input.feeAmount ?? 0);
  if (!Number.isFinite(feeAmount) || feeAmount < 0) {
    throw new Error('INVALID_FEE_AMOUNT');
  }

  if (!isPaymentType(input.paymentType)) {
    throw new Error('INVALID_PAYMENT_TYPE');
  }

  const id = randomUUID();
  const purchaseNumber = await generatePurchaseNumber(); // This uses mysqlQuery(pool), which is fine for sequence generation as long as it's separate or we don't mind gaps. Ideally should be in transaction too but generatePurchaseNumber uses separate query. For now keep it outside or move inside? Move inside creates a cleaner transaction block but generatePurchaseNumber implementation uses mysqlQuery which uses pool. Let's keep it outside or inside?
  // generatePurchaseNumber is `SELECT COUNT(*) ...`. It doesn't lock.
  // If we want strict serial, we might need to lock proper table or accept gap.
  // For now, let's keep it simple and just focus on the INSERT transaction.
  
  const totalAmount = +(input.quantity * input.unitPrice).toFixed(2);
  const purchaseDate = requirePurchaseDate(input.purchaseDate);
  const purchaserId = sanitizeId(input.purchaserId) ?? creatorId;
  if (!purchaserId) {
    throw new Error('PURCHASER_REQUIRED');
  }

  const paymentChannel = input.paymentChannel?.trim() || null;
  const payerName = input.payerName?.trim() || null;
  const transactionNo = input.transactionNo?.trim() || null;

  const invoiceType = input.invoiceType;
  if (input.invoiceStatus !== undefined && !isInvoiceStatus(input.invoiceStatus)) {
    throw new Error('INVALID_INVOICE_STATUS');
  }
  const rawInvoiceStatus = input.invoiceStatus ?? (invoiceType === FinanceInvoiceType.NONE ? InvoiceStatus.NOT_REQUIRED : InvoiceStatus.PENDING);
  const invoiceStatus = invoiceType === FinanceInvoiceType.NONE ? InvoiceStatus.NOT_REQUIRED : normalizeInvoiceStatus(rawInvoiceStatus);
  let invoiceNumber: string | null = null;
  let invoiceIssueDate: string | null = null;
  if (invoiceStatus === InvoiceStatus.ISSUED) {
    invoiceNumber = input.invoiceNumber?.trim() || null;
    invoiceIssueDate = input.invoiceIssueDate ? requirePurchaseDate(input.invoiceIssueDate) : null;
  }
  const invoiceImages = invoiceType === FinanceInvoiceType.NONE ? [] : input.invoiceImages;

  await ensureUserExists(creatorId, 'CREATED_BY_NOT_FOUND');
  if (purchaserId !== creatorId) {
    await ensureUserExists(purchaserId, 'PURCHASER_NOT_FOUND');
  }

  return withTransaction(async (connection) => {
    const columns = [
      'id',
      'purchase_number',
      'purchase_date',
      'organization_type',
      'item_name',
      'inventory_item_id',
      'specification',
      'quantity',
      'unit_price',
      'total_amount',
      'fee_amount',
      'purchase_channel',
      'purchase_location',
      'purchase_link',
      'purpose',
      'payment_method',
      'payment_type',
      'payment_channel',
      'payer_name',
      'transaction_no',
      'purchaser_id',
      'invoice_type',
      'invoice_status',
      'invoice_number',
      'invoice_issue_date',
      'invoice_images',
      'receipt_images',
      'notes',
      'attachments',
      'created_by',
      'created_at',
      'updated_at'
    ];

    const insertSql = `
      INSERT INTO purchases (
        ${columns.join(',\n        ')}
      ) VALUES (${columns.map(() => '?').join(', ')})
    `;

    const values = [
      id,
      purchaseNumber,
      purchaseDate,
      input.organizationType,
      input.itemName,
      input.inventoryItemId ?? null,
      input.specification ?? null,
      input.quantity,
      input.unitPrice,
      totalAmount,
      feeAmount,
      input.purchaseChannel,
      input.purchaseLocation ?? null,
      input.purchaseLink ?? null,
      input.purpose,
      input.paymentMethod,
      input.paymentType,
      paymentChannel,
      payerName,
      transactionNo,
      purchaserId,
      input.invoiceType,
      invoiceStatus,
      invoiceNumber,
      invoiceIssueDate,
      serializeArray(invoiceImages),
      serializeArray(input.receiptImages),
      input.notes ?? null,
      serializeArray(input.attachments),
      creatorId,
      new Date(),
      new Date(),
    ];

    await connection.query(insertSql, values);

    await insertLog(id, 'submit' as ReimbursementAction, 'draft', 'draft', creatorId, '创建采购记录', connection);

    return (await findPurchaseById(id, connection))!;
  });
}

export async function findPurchaseById(id: string, connection?: PoolConnection): Promise<PurchaseRecord | null> {
  await ensurePurchasesSchema();
  const db = connection || pool;
  const [rows] = await db.query<RawPurchaseRow[]>(
    `
      SELECT ${PURCHASE_SELECT_FIELDS}
      ${PURCHASE_FROM_CLAUSE}
      WHERE p.id = ?
      LIMIT 1
    `,
    [id]
  );
  return mapPurchase(rows[0]);
}

export async function getPurchaseDetail(id: string): Promise<PurchaseDetail | null> {
  await ensurePurchasesSchema();
  const purchase = await findPurchaseById(id);
  if (!purchase) return null;

  const purchaserPromise = findUserById(purchase.purchaserId);
  const approverPromise = purchase.approvedBy ? findUserById(purchase.approvedBy) : Promise.resolve(null);
  const pendingApproverPromise = purchase.pendingApproverId ? findUserById(purchase.pendingApproverId) : Promise.resolve(null);
  const rejecterPromise = purchase.rejectedBy ? findUserById(purchase.rejectedBy) : Promise.resolve(null);
  const payerPromise = purchase.paidBy ? findUserById(purchase.paidBy) : Promise.resolve(null);
  const logsPromise = getPurchaseLogs(purchase.id);
  const [purchaserUser, approverUser, pendingApproverUser, rejecterUser, payerUser, logs] = await Promise.all([
    purchaserPromise,
    approverPromise,
    pendingApproverPromise,
    rejecterPromise,
    payerPromise,
    logsPromise,
  ]);

  const dueAmount = Number(purchase.totalAmount ?? 0) + Number(purchase.feeAmount ?? 0);
  const paidAmount = purchase.paidAt ? dueAmount : 0;
  const remainingAmount = Math.max(0, Number((dueAmount - paidAmount).toFixed(2)));

  return {
    ...purchase,
    purchaser: buildPurchaserProfile(purchaserUser, purchase.purchaserId),
    approver: buildBasicUserProfile(approverUser),
    pendingApprover: buildBasicUserProfile(pendingApproverUser),
    rejecter: buildBasicUserProfile(rejecterUser),
    payer: buildBasicUserProfile(payerUser),
    payments: [],
    paidAmount,
    remainingAmount,
    dueAmount,
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
    createdAt: 'p.created_at',
    updatedAt: 'p.updated_at',
    purchaseDate: 'p.purchase_date',
    totalAmount: 'p.total_amount',
    status: 'p.status',
    submittedAt: 'p.submitted_at',
  };
  const sortColumn = sortMap[sortBy] || 'p.updated_at';

  const { whereClause, values } = buildPurchaseFilterClause(params, 'p');
  const orderClause = `ORDER BY ${sortColumn} ${sortOrder}, p.id ASC`;

  const baseSelect = `
    SELECT ${PURCHASE_SELECT_FIELDS}
    ${PURCHASE_FROM_CLAUSE}
  `;

  const dataParams = [...values, pageSize, (page - 1) * pageSize];
  const [dataResult, countResult] = await Promise.all([
    pool.query<RawPurchaseRow[]>(
      `${baseSelect} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      dataParams
    ),
    pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM purchases p ${whereClause}`,
      values
    ),
  ]);

  const dataRows = dataResult[0] ?? [];
  const total = countResult[0]?.[0]?.total ?? 0;

  return {
    items: dataRows.map((row) => mapPurchase(row)!).filter(Boolean),
    total: Number(total),
    page,
    pageSize,
  };
}

type PaymentQueueStatus = 'all' | 'pending' | 'processing' | 'paid' | 'issue';
type PurchasePaymentQueueItem = PurchaseRecord & {
  paidAmount: number;
  remainingAmount: number;
  purchaserName?: string | null;
  purchaserEmployeeCode?: string | null;
};

type PaymentQueueFilters = {
  search?: string;
  status?: PaymentQueueStatus;
  ids?: string[];
  organizationType?: 'school' | 'company';
  page?: number;
  pageSize?: number;
};

function mapPaymentQueueItem(row: RawPurchaseRow): PurchasePaymentQueueItem {
  const base = mapPurchase(row)!;
  const dueAmount = Number(base.totalAmount ?? 0) + Number(base.feeAmount ?? 0);
  const paidAmount = base.paidAt ? dueAmount : 0;
  const remainingAmount = Math.max(0, Number((dueAmount - paidAmount).toFixed(2)));
  return {
    ...base,
    paidAmount,
    remainingAmount,
    purchaserName: row.purchaser_display_name ?? null,
    purchaserEmployeeCode: null,
  };
}

function buildPaymentQueueFilterClause(params: PaymentQueueFilters = {}) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  conditions.push('p.is_deleted = 0');
  conditions.push("p.status IN ('pending_inbound','approved','paid')");

  if (params.ids?.length) {
    const placeholders = params.ids.map(() => '?').join(',');
    conditions.push(`p.id IN (${placeholders})`);
    values.push(...params.ids);
  }

  if (params.search) {
    const search = `%${params.search.trim().toLowerCase()}%`;
    conditions.push('(LOWER(p.purchase_number) LIKE ? OR LOWER(p.item_name) LIKE ? OR LOWER(p.purpose) LIKE ?)');
    values.push(search, search, search);
  }

  if (params.organizationType) {
    conditions.push('p.organization_type = ?');
    values.push(params.organizationType);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  let statusClause = '';
  switch (params.status) {
    case 'pending':
      statusClause = "AND p.paid_at IS NULL";
      break;
    case 'processing':
      statusClause = "AND 1 = 0";
      break;
    case 'paid':
      statusClause = "AND p.paid_at IS NOT NULL";
      break;
    case 'issue':
      statusClause = 'AND p.payment_issue_open = 1';
      break;
    default:
      statusClause = '';
  }

  return { whereClause, statusClause, values };
}

export async function listPaymentQueue(filters: PaymentQueueFilters = {}) {
  await ensurePurchasesSchema();
  const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.min(filters.pageSize, 200) : 50;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const offset = (page - 1) * pageSize;
  const { whereClause, statusClause, values } = buildPaymentQueueFilterClause(filters);

  const [rows] = await pool.query<RawPurchaseRow[]>(
    `
      SELECT ${PURCHASE_SELECT_FIELDS}
      ${PURCHASE_FROM_CLAUSE}
      ${whereClause}
      ${statusClause}
      ORDER BY p.updated_at DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...values, pageSize, offset]
  );

  const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total ${PURCHASE_FROM_CLAUSE} ${whereClause} ${statusClause}`,
    values
  );

  return {
    items: rows.map((row) => mapPaymentQueueItem(row)),
    total: Number(countRows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function listPendingApprovals(params: ListPurchasesParams = {}) {
  return listPurchases({
    ...params,
    status: 'pending_approval',
    sortBy: 'submittedAt',
    sortOrder: 'asc',
  });
}

export async function getPurchaseStats(params: ListPurchasesParams = {}): Promise<PurchaseStats> {
  await ensurePurchasesSchema();
  const { whereClause, values } = buildPurchaseFilterClause(params, 'p');

  const [rows] = await pool.query<Array<RowDataPacket & {
    total_purchases: number | null;
    total_amount: number | null;
    pending_count: number | null;
    pending_amount: number | null;
    approved_count: number | null;
    approved_amount: number | null;
    paid_count: number | null;
    paid_amount: number | null;
  }>>(
    `SELECT
      COUNT(*) AS total_purchases,
      COALESCE(SUM(p.total_amount), 0) AS total_amount,
      SUM(CASE WHEN p.status = 'pending_approval' THEN 1 ELSE 0 END) AS pending_count,
      COALESCE(SUM(CASE WHEN p.status = 'pending_approval' THEN p.total_amount ELSE 0 END), 0) AS pending_amount,
      SUM(CASE WHEN p.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
      COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.total_amount ELSE 0 END), 0) AS approved_amount,
      SUM(CASE WHEN p.status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
      COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.total_amount ELSE 0 END), 0) AS paid_amount
    FROM purchases p ${whereClause}`,
    values
  );

  const row = rows[0] ?? {
    total_purchases: 0,
    total_amount: 0,
    pending_count: 0,
    pending_amount: 0,
    approved_count: 0,
    approved_amount: 0,
    paid_count: 0,
    paid_amount: 0,
  };

  return {
    totalPurchases: Number(row.total_purchases ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
    pendingAmount: Number(row.pending_amount ?? 0),
    approvedCount: Number(row.approved_count ?? 0),
    approvedAmount: Number(row.approved_amount ?? 0),
    paidCount: Number(row.paid_count ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
  };
}

export async function getPurchaseMonitorData(
  params: ListPurchasesParams = {},
  overdueHours = 48
): Promise<PurchaseMonitorData> {
  await ensurePurchasesSchema();
  const normalizedOverdueHours = Number.isFinite(overdueHours) ? Math.max(1, Math.floor(overdueHours)) : 48;
  const { whereClause, values } = buildPurchaseFilterClause(params, 'p');

  const pendingWhereClause = appendWhereClause(whereClause, "p.status = 'pending_approval' AND p.submitted_at IS NOT NULL");

  const [statusResult, pendingStatsResult, agingResult, approverLoadResult, stuckResult] = await Promise.all([
    pool.query<RawMonitorStatusRow[]>(
      `SELECT
        p.status AS status,
        COUNT(*) AS count,
        COALESCE(SUM(p.total_amount + COALESCE(p.fee_amount, 0)), 0) AS amount
      FROM purchases p
      ${whereClause}
      GROUP BY p.status`,
      values
    ),
    pool.query<RawMonitorPendingStatsRow[]>(
      `SELECT
        COUNT(*) AS pending_count,
        COALESCE(AVG(TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP())), 0) AS avg_pending_hours,
        SUM(CASE WHEN TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP()) >= ? THEN 1 ELSE 0 END) AS overdue_count
      FROM purchases p
      ${pendingWhereClause}`,
      [normalizedOverdueHours, ...values]
    ),
    pool.query<RawMonitorAgingRow[]>(
      `SELECT
        SUM(CASE WHEN TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP()) < 24 THEN 1 ELSE 0 END) AS lt_24,
        SUM(CASE WHEN TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP()) >= 24 AND TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP()) < 48 THEN 1 ELSE 0 END) AS h24_48,
        SUM(CASE WHEN TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP()) >= 48 AND TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP()) < 72 THEN 1 ELSE 0 END) AS h48_72,
        SUM(CASE WHEN TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP()) >= 72 THEN 1 ELSE 0 END) AS gte_72
      FROM purchases p
      ${pendingWhereClause}`,
      values
    ),
    pool.query<RawMonitorApproverRow[]>(
      `SELECT
        p.pending_approver_id AS approver_id,
        COALESCE(approver.display_name, approver.email, '未分配') AS approver_name,
        COUNT(*) AS pending_count,
        COALESCE(SUM(p.total_amount + COALESCE(p.fee_amount, 0)), 0) AS total_pending_amount,
        COALESCE(AVG(TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP())), 0) AS avg_pending_hours,
        COALESCE(MAX(TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP())), 0) AS max_pending_hours
      FROM purchases p
      LEFT JOIN hr_employees approver ON approver.id = p.pending_approver_id
      ${pendingWhereClause}
      GROUP BY p.pending_approver_id, approver_name
      ORDER BY pending_count DESC, max_pending_hours DESC
      LIMIT 10`,
      values
    ),
    pool.query<RawMonitorStuckRow[]>(
      `SELECT
        p.id AS id,
        p.purchase_number AS purchase_number,
        p.item_name AS item_name,
        p.purchaser_id AS purchaser_id,
        COALESCE(purchaser.display_name, purchaser.email) AS purchaser_name,
        p.pending_approver_id AS pending_approver_id,
        COALESCE(pending_approver.display_name, pending_approver.email, '未分配') AS pending_approver_name,
        p.submitted_at AS submitted_at,
        COALESCE(TIMESTAMPDIFF(HOUR, p.submitted_at, UTC_TIMESTAMP()), 0) AS pending_hours,
        COALESCE(p.total_amount + COALESCE(p.fee_amount, 0), 0) AS due_amount
      FROM purchases p
      LEFT JOIN hr_employees purchaser ON purchaser.id = p.purchaser_id
      LEFT JOIN hr_employees pending_approver ON pending_approver.id = p.pending_approver_id
      ${pendingWhereClause}
      ORDER BY pending_hours DESC, p.submitted_at ASC
      LIMIT 15`,
      values
    ),
  ]);

  const statusRows = statusResult[0] ?? [];
  const pendingStatsRow = pendingStatsResult[0]?.[0];
  const agingRow = agingResult[0]?.[0];
  const approverRows = approverLoadResult[0] ?? [];
  const stuckRows = stuckResult[0] ?? [];

  const statusSummary: PurchaseMonitorStatusSummary[] = statusRows
    .map((row) => {
      const status = row.status;
      if (!isPurchaseStatus(status)) return null;
      return {
        status,
        count: Number(row.count ?? 0),
        amount: Number(row.amount ?? 0),
      } satisfies PurchaseMonitorStatusSummary;
    })
    .filter((row): row is PurchaseMonitorStatusSummary => row !== null);

  const statusCount = (status: string) =>
    statusSummary.find((item) => item.status === status)?.count ?? 0;

  const approverLoad: PurchaseMonitorApproverLoad[] = approverRows.map((row) => ({
    approverId: row.approver_id ?? null,
    approverName: row.approver_name?.trim() || '未分配',
    pendingCount: Number(row.pending_count ?? 0),
    totalPendingAmount: Number(row.total_pending_amount ?? 0),
    avgPendingHours: Number(row.avg_pending_hours ?? 0),
    maxPendingHours: Number(row.max_pending_hours ?? 0),
  }));

  const stuckRecords: PurchaseMonitorStuckRecord[] = stuckRows.map((row) => ({
    id: row.id,
    purchaseNumber: row.purchase_number,
    itemName: row.item_name,
    purchaserId: row.purchaser_id,
    purchaserName: row.purchaser_name?.trim() || '未知用户',
    pendingApproverId: row.pending_approver_id ?? null,
    pendingApproverName: row.pending_approver_name?.trim() || '未分配',
    submittedAt: row.submitted_at ?? null,
    pendingHours: Number(row.pending_hours ?? 0),
    dueAmount: Number(row.due_amount ?? 0),
  }));

  return {
    generatedAt: new Date().toISOString(),
    overdueHours: normalizedOverdueHours,
    activeCount: statusCount('pending_approval') + statusCount('pending_inbound') + statusCount('approved'),
    pendingApprovalCount: Number(pendingStatsRow?.pending_count ?? 0),
    pendingPaymentCount: statusCount('approved'),
    overdueApprovalCount: Number(pendingStatsRow?.overdue_count ?? 0),
    avgPendingHours: Number(pendingStatsRow?.avg_pending_hours ?? 0),
    statusSummary,
    agingBuckets: [
      { label: '<24h', minHours: 0, maxHours: 24, count: Number(agingRow?.lt_24 ?? 0) },
      { label: '24-48h', minHours: 24, maxHours: 48, count: Number(agingRow?.h24_48 ?? 0) },
      { label: '48-72h', minHours: 48, maxHours: 72, count: Number(agingRow?.h48_72 ?? 0) },
      { label: '>=72h', minHours: 72, maxHours: null, count: Number(agingRow?.gte_72 ?? 0) },
    ],
    approverLoad,
    stuckRecords,
  };
}

export async function updatePurchase(id: string, input: UpdatePurchaseInput): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(id);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  const editableInCurrentStatus =
    existing.status === 'draft' ||
    existing.status === 'rejected';
  if (!editableInCurrentStatus) throw new Error('NOT_EDITABLE');

  const updates: string[] = [];
  const values: unknown[] = [];

  const push = (field: string, value: unknown) => {
    updates.push(`${field} = ?`);
    values.push(value);
  };

  if (input.purchaseDate !== undefined) push('purchase_date', requirePurchaseDate(input.purchaseDate));
  if (input.organizationType !== undefined) {
    if (!isPurchaseOrganization(input.organizationType)) throw new Error('INVALID_ORGANIZATION_TYPE');
    push('organization_type', input.organizationType);
  }
  if (input.itemName !== undefined) push('item_name', input.itemName);
  if (input.inventoryItemId !== undefined) push('inventory_item_id', input.inventoryItemId);
  if (input.specification !== undefined) push('specification', input.specification);
  if (input.quantity !== undefined) {
    if (input.quantity <= 0) throw new Error('INVALID_QUANTITY');
    push('quantity', input.quantity);
  }
  if (input.unitPrice !== undefined) {
    if (input.unitPrice < 0) throw new Error('INVALID_UNIT_PRICE');
    push('unit_price', input.unitPrice);
  }
  if (input.quantity !== undefined || input.unitPrice !== undefined) {
    const q = input.quantity ?? existing.quantity;
    const u = input.unitPrice ?? existing.unitPrice;
    push('total_amount', +(q * u).toFixed(2));
  }
  if (input.feeAmount !== undefined) {
    const nextFee = Number(input.feeAmount);
    if (!Number.isFinite(nextFee) || nextFee < 0) throw new Error('INVALID_FEE_AMOUNT');
    push('fee_amount', nextFee);
  }
  if (input.purchaseChannel !== undefined) push('purchase_channel', input.purchaseChannel);
  if (input.purchaseLocation !== undefined) push('purchase_location', input.purchaseLocation);
  if (input.purchaseLink !== undefined) push('purchase_link', input.purchaseLink);
  if (input.purpose !== undefined) push('purpose', input.purpose);
  if (input.paymentMethod !== undefined) {
    push('payment_method', input.paymentMethod);
  }
  if (input.paymentType !== undefined) {
    if (!isPaymentType(input.paymentType)) throw new Error('INVALID_PAYMENT_TYPE');
    push('payment_type', input.paymentType);
  }
  if (input.paymentChannel !== undefined) push('payment_channel', input.paymentChannel?.trim() || null);
  if (input.payerName !== undefined) push('payer_name', input.payerName?.trim() || null);
  if (input.transactionNo !== undefined) push('transaction_no', input.transactionNo?.trim() || null);
  if (input.purchaserId !== undefined) {
    const nextPurchaserId = sanitizeId(input.purchaserId);
    if (!nextPurchaserId) {
      throw new Error('PURCHASER_REQUIRED');
    }
    await ensureUserExists(nextPurchaserId, 'PURCHASER_NOT_FOUND');
    push('purchaser_id', nextPurchaserId);
  }
  if (input.invoiceStatus !== undefined && !isInvoiceStatus(input.invoiceStatus)) {
    throw new Error('INVALID_INVOICE_STATUS');
  }

  const nextInvoiceType = input.invoiceType ?? existing.invoiceType;
  let nextInvoiceStatus = existing.invoiceStatus;
  if (nextInvoiceType === FinanceInvoiceType.NONE) {
    nextInvoiceStatus = InvoiceStatus.NOT_REQUIRED;
  } else if (input.invoiceStatus !== undefined) {
    nextInvoiceStatus = normalizeInvoiceStatus(input.invoiceStatus);
  }

  let nextInvoiceNumber = existing.invoiceNumber;
  let nextInvoiceIssueDate = existing.invoiceIssueDate;

  const wantsInvoiceNumberUpdate = hasOwn(input, 'invoiceNumber');
  const wantsInvoiceIssueDateUpdate = hasOwn(input, 'invoiceIssueDate');

  if (nextInvoiceType === FinanceInvoiceType.NONE || nextInvoiceStatus !== InvoiceStatus.ISSUED) {
    nextInvoiceNumber = null;
    nextInvoiceIssueDate = null;
  } else {
    if (wantsInvoiceNumberUpdate) {
      const rawNumber = input.invoiceNumber ?? null;
      nextInvoiceNumber = rawNumber ? rawNumber.trim() || null : null;
    }
    if (wantsInvoiceIssueDateUpdate) {
      nextInvoiceIssueDate = input.invoiceIssueDate ? requirePurchaseDate(input.invoiceIssueDate) : null;
    }
  }

  if (nextInvoiceType !== existing.invoiceType) {
    push('invoice_type', nextInvoiceType);
  }
  if (nextInvoiceStatus !== existing.invoiceStatus || input.invoiceStatus !== undefined || input.invoiceType !== undefined) {
    push('invoice_status', nextInvoiceStatus);
  }
  if (nextInvoiceNumber !== existing.invoiceNumber || wantsInvoiceNumberUpdate) {
    push('invoice_number', nextInvoiceNumber);
  }
  if (nextInvoiceIssueDate !== existing.invoiceIssueDate || wantsInvoiceIssueDateUpdate) {
    push('invoice_issue_date', nextInvoiceIssueDate);
  }

  let nextInvoiceImages: string[] | undefined = input.invoiceImages !== undefined ? input.invoiceImages ?? [] : undefined;
  if (nextInvoiceType === FinanceInvoiceType.NONE) {
    nextInvoiceImages = [];
  }
  if (nextInvoiceImages !== undefined) {
    const sanitized = nextInvoiceImages.filter(Boolean);
    push('invoice_images', serializeArray(sanitized));
  }
  if (input.receiptImages !== undefined) push('receipt_images', serializeArray(input.receiptImages));
  if (input.notes !== undefined) push('notes', input.notes);
  if (input.attachments !== undefined) push('attachments', serializeArray(input.attachments));

  if (!updates.length) {
    return existing;
  }

  updates.push('updated_at = NOW()');
  values.push(id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE purchases SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) throw new Error('PURCHASE_NOT_FOUND');
  return (await findPurchaseById(id))!;
}

// submit purchase (draft/rejected -> pending_approval)
export async function submitPurchase(purchaseId: string, operatorId: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  
  return withTransaction(async (connection) => {
    const existing = await findPurchaseById(purchaseId, connection);
    if (!existing) throw new Error('PURCHASE_NOT_FOUND');
    if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('NOT_SUBMITTABLE');

    const approverId = await pickAutoApproverId(); // Uses pool, but fine for now (reading employees/load)
    
    await connection.query(
      `UPDATE purchases
       SET status = 'pending_approval',
           submitted_at = NOW(),
           approved_at = NULL,
           approved_by = NULL,
           rejected_at = NULL,
           rejected_by = NULL,
           rejection_reason = NULL,
           pending_approver_id = ?,
           workflow_step_index = NULL,
           workflow_nodes = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [approverId, purchaseId]
    );
    await insertLog(purchaseId, 'submit', existing.status, 'pending_approval', operatorId, '提交进入审批流程', connection);
    return (await findPurchaseById(purchaseId, connection))!;
  });
}

// approve purchase
export async function approvePurchase(
  purchaseId: string,
  operatorId: string,
  comment?: string | null
): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();

  return withTransaction(async (connection) => {
    const existing = await findPurchaseById(purchaseId, connection);
    if (!existing) throw new Error('PURCHASE_NOT_FOUND');
    if (existing.status !== 'pending_approval') throw new Error('NOT_APPROVABLE');

    const approvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const dueAmount = Number(existing.totalAmount ?? 0) + Number(existing.feeAmount ?? 0);
    const nextReimbursementStatus = existing.paymentMethod === 'corporate_transfer' ? 'none' : 'invoice_pending';

    // Single-step payment policy: approval implies payment is complete,
    // but workflow status enters pending_inbound until applicant finishes inbound.

    await connection.query(
      `UPDATE purchases
       SET status = 'pending_inbound',
           reimbursement_status = ?,
           reimbursement_submitted_at = NULL,
           reimbursement_submitted_by = NULL,
           reimbursement_rejected_at = NULL,
           reimbursement_rejected_by = NULL,
           reimbursement_rejected_reason = NULL,
           approved_by = ?,
           approved_at = ?,
           paid_by = ?,
           paid_at = ?,
           pending_approver_id = NULL,
           workflow_step_index = NULL,
           workflow_nodes = NULL,
           updated_at = NOW(3)
       WHERE id = ?`,
      [nextReimbursementStatus, operatorId, approvedAt, operatorId, approvedAt, purchaseId]
    );

    const approveComment =
      comment?.trim() || `审批通过，进入待入库（已默认完成付款）：${dueAmount.toFixed(2)} 元`;
    await insertLog(purchaseId, 'approve', existing.status, 'pending_inbound', operatorId, approveComment, connection);

    return (await findPurchaseById(purchaseId, connection))!;
  });
}

// transfer purchase approval
export async function transferPurchaseApprover(
  purchaseId: string,
  operatorId: string,
  targetApproverId: string,
  comment: string
): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  
  return withTransaction(async (connection) => {
    const existing = await findPurchaseById(purchaseId, connection);
    if (!existing) throw new Error('PURCHASE_NOT_FOUND');
    if (existing.status !== 'pending_approval') throw new Error('NOT_APPROVABLE');
    if (!targetApproverId) throw new Error('APPROVER_REQUIRED');

    await connection.query(
      'UPDATE purchases SET pending_approver_id = ?, updated_at = NOW() WHERE id = ?',
      [targetApproverId, purchaseId]
    );
    await insertLog(purchaseId, 'transfer', 'pending_approval', 'pending_approval', operatorId, comment, connection);
    return (await findPurchaseById(purchaseId, connection))!;
  });
}

// reject purchase
export async function rejectPurchase(purchaseId: string, operatorId: string, reason: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();

  return withTransaction(async (connection) => {
    const existing = await findPurchaseById(purchaseId, connection);
    if (!existing) throw new Error('PURCHASE_NOT_FOUND');
    if (existing.status !== 'pending_approval') throw new Error('NOT_REJECTABLE');

    await connection.query(
      `UPDATE purchases
       SET status = 'rejected', rejected_at = NOW(), rejected_by = ?, rejection_reason = ?, pending_approver_id = NULL, workflow_step_index = NULL, updated_at = NOW()
       WHERE id = ?`,
      [operatorId, reason, purchaseId]
    );
    await insertLog(purchaseId, 'reject', 'pending_approval', 'rejected', operatorId, reason, connection);
    return (await findPurchaseById(purchaseId, connection))!;
  });
}

export async function submitReimbursement(
  purchaseId: string,
  operatorId: string
): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();

  return withTransaction(async (connection) => {
    const existing = await findPurchaseById(purchaseId, connection);
    if (!existing) throw new Error('PURCHASE_NOT_FOUND');
    if (existing.status !== 'approved') throw new Error('NOT_REIMBURSEMENT_SUBMITTABLE');
    if (
      !(
        existing.reimbursementStatus === 'invoice_pending' ||
        existing.reimbursementStatus === 'reimbursement_rejected'
      )
    ) {
      throw new Error('NOT_REIMBURSEMENT_SUBMITTABLE');
    }
    if (!hasInvoiceEvidence(existing)) throw new Error('INVOICE_FILES_REQUIRED');
    // NOTE(ysh): 当前业务明确“报销提交不强依赖入库记录”。
    
    await connection.query(
      `UPDATE purchases
       SET reimbursement_status = 'reimbursement_pending',
           reimbursement_submitted_at = NOW(),
           reimbursement_submitted_by = ?,
           reimbursement_rejected_at = NULL,
           reimbursement_rejected_by = NULL,
           reimbursement_rejected_reason = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [operatorId, purchaseId]
    );
    await insertLog(
      purchaseId,
      'submit',
      'approved',
      'approved',
      operatorId,
      '提交报销申请，等待财务确认',
      connection
    );
    return (await findPurchaseById(purchaseId, connection))!;
  });
}

// mark as paid
// withdraw (pending_approval -> cancelled)
export async function withdrawPurchase(
  purchaseId: string,
  operatorId: string,
  reason?: string | null
): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();

  return withTransaction(async (connection) => {
    const existing = await findPurchaseById(purchaseId, connection);
    if (!existing) throw new Error('PURCHASE_NOT_FOUND');
    if (existing.status !== 'pending_approval') throw new Error('NOT_WITHDRAWABLE');

    await connection.query(
      `UPDATE purchases
       SET status = 'cancelled', pending_approver_id = NULL, workflow_step_index = NULL, updated_at = NOW()
       WHERE id = ?`,
      [purchaseId]
    );
    await insertLog(purchaseId, 'withdraw', 'pending_approval', 'cancelled', operatorId, reason ?? null, connection);
    return (await findPurchaseById(purchaseId, connection))!;
  });
}

// duplicate purchase (create a new draft based on an existing record)
export async function duplicatePurchase(
  purchaseId: string,
  operatorId: string
): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');

  const payload: CreatePurchaseInput = {
    purchaseDate: existing.purchaseDate,
    organizationType: existing.organizationType,
    itemName: existing.itemName,
    specification: existing.specification ?? undefined,
    quantity: existing.quantity,
    unitPrice: existing.unitPrice,
    feeAmount: Number(existing.feeAmount ?? 0),
    purchaseChannel: existing.purchaseChannel,
    purchaseLocation: existing.purchaseLocation ?? undefined,
    purchaseLink: existing.purchaseLink ?? undefined,
    purpose: existing.purpose,
    paymentMethod: existing.paymentMethod,
    paymentType: existing.paymentType,
    paymentChannel: existing.paymentChannel ?? undefined,
    payerName: existing.payerName ?? undefined,
    transactionNo: undefined,
    purchaserId: existing.purchaserId,
    hasInvoice: existing.invoiceType !== FinanceInvoiceType.NONE,
    invoiceType: existing.invoiceType,
    invoiceStatus: existing.invoiceStatus,
    invoiceNumber: existing.invoiceNumber ?? undefined,
    invoiceIssueDate: existing.invoiceIssueDate ?? undefined,
    invoiceImages: existing.invoiceImages,
    receiptImages: existing.receiptImages,
    notes: existing.notes ?? undefined,
    attachments: existing.attachments,
  };

  return createPurchase(payload, operatorId);
}

// soft delete (only draft or rejected and owner or admin handled in business layer)
export async function deletePurchase(purchaseId: string, operatorId: string): Promise<void> {
  await ensurePurchasesSchema();

  await withTransaction(async (connection) => {
    const existing = await findPurchaseById(purchaseId, connection);
    if (!existing) throw new Error('PURCHASE_NOT_FOUND');
    if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('NOT_DELETABLE');

    await connection.query(
      'UPDATE purchases SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
      [purchaseId]
    );
    await insertLog(purchaseId, 'cancel', existing.status, 'cancelled', operatorId, '删除/取消采购记录', connection);
  });
}

export async function listPurchaseAuditLogs(params: {
  search?: string;
  action?: ReimbursementAction | 'all';
  startDate?: string;
  endDate?: string;
  operatorId?: string;
  page?: number;
  pageSize?: number;
  purchaseIds?: string[];
} = {}): Promise<{ items: PurchaseAuditLogItem[]; total: number; page: number; pageSize: number }> {
  await ensurePurchasesSchema();
  const conditions: string[] = ['p.is_deleted = 0'];
  const values: unknown[] = [];

  if (params.search?.trim()) {
    const like = `%${params.search.trim().toLowerCase()}%`;
    conditions.push('(LOWER(p.purchase_number) LIKE ? OR LOWER(p.item_name) LIKE ?)');
    values.push(like, like);
  }

  if (params.action && params.action !== 'all') {
    conditions.push('rl.action = ?');
    values.push(params.action);
  }

  if (params.startDate) {
    conditions.push('DATE(rl.created_at) >= ?');
    values.push(params.startDate);
  }

  if (params.endDate) {
    conditions.push('DATE(rl.created_at) <= ?');
    values.push(params.endDate);
  }

  if (params.operatorId) {
    conditions.push('rl.operator_id = ?');
    values.push(params.operatorId);
  }

  if (params.purchaseIds && params.purchaseIds.length > 0) {
    const placeholders = params.purchaseIds.map(() => '?').join(', ');
    conditions.push(`rl.purchase_id IN (${placeholders})`);
    values.push(...params.purchaseIds);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 30), 200);
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    pool.query<RawPurchaseAuditRow[]>(
      `SELECT
         rl.id,
         rl.purchase_id,
         p.purchase_number,
         p.item_name,
         rl.action,
         rl.from_status,
         rl.to_status,
         rl.operator_id,
         COALESCE(op.display_name, op.email) AS operator_name,
         rl.comment,
         rl.created_at
       FROM reimbursement_logs rl
       INNER JOIN purchases p ON p.id = rl.purchase_id
       LEFT JOIN hr_employees op ON op.id = rl.operator_id
       ${whereClause}
       ORDER BY rl.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset]
    ),
    pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM reimbursement_logs rl
       INNER JOIN purchases p ON p.id = rl.purchase_id
       ${whereClause}`,
      values
    ),
  ]);

  const items: PurchaseAuditLogItem[] = (rows[0] ?? []).map((row) => ({
    id: row.id,
    purchaseId: row.purchase_id,
    purchaseNumber: row.purchase_number,
    itemName: row.item_name,
    action: normalizeReimbursementAction(row.action),
    fromStatus: normalizePurchaseStatus(row.from_status),
    toStatus: normalizePurchaseStatus(row.to_status),
    operatorId: row.operator_id,
    operatorName: row.operator_name?.trim() || '未知用户',
    comment: row.comment ?? null,
    createdAt: row.created_at,
  }));

  return {
    items,
    total: Number(countRows[0]?.[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getPurchaseLogs(purchaseId: string): Promise<ReimbursementLog[]> {
  await ensurePurchasesSchema();
  // Join hr_employees to get operator name
  const result = await mysqlQuery<RawLogRow & { operator_name: string | null }>`
    SELECT rl.*, COALESCE(op.display_name, op.email) as operator_name
    FROM reimbursement_logs rl
    LEFT JOIN hr_employees op ON op.id = rl.operator_id
    WHERE rl.purchase_id = ${purchaseId}
    ORDER BY rl.created_at ASC
  `;
  return result.rows.map((r) => ({
    ...mapLog(r)!,
    operatorName: r.operator_name || null,
  })).filter(Boolean) as ReimbursementLog[];
}
export async function payPurchase(
  id: string,
  operatorId: string,
  note?: string | null
): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const purchase = await findPurchaseById(id);
  if (!purchase) {
    throw new Error('PURCHASE_NOT_FOUND');
  }

  // Only approved or pending_inbound purchases can be paid
  if (purchase.status !== 'approved' && purchase.status !== 'pending_inbound') {
    throw new Error('PURCHASE_NOT_READY_FOR_PAYMENT');
  }

  if (purchase.paidAt) {
    throw new Error('PURCHASE_ALREADY_PAID');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE purchases
       SET status = 'paid',
           paid_at = NOW(),
           paid_by = ?,
           notes = COALESCE(?, notes),
           updated_at = NOW()
       WHERE id = ?`,
      [operatorId, note || null, id]
    );

    // If it was pending inbound, it might still need inbound, but payment is done.
    // If it was approved, it is now paid.
    // The status 'paid' implies the financial transaction is complete.

    await insertLog(
      id,
      'pay',
      purchase.status,
      'paid',
      operatorId,
      note || '财务打款',
      connection
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return (await findPurchaseById(id))!;
}
