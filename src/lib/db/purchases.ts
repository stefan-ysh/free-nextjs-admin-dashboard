import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';
import { ensurePurchasesSchema } from '@/lib/schema/purchases';
import { getSupplierById } from '@/lib/db/suppliers';
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
  PurchaseStats,
  isPurchaseChannel,
  isPaymentMethod,
  isPaymentType,
  isInvoiceType,
  isInvoiceStatus,
  isPurchaseStatus,
  isReimbursementAction,
  hasInvoiceEvidence,
} from '@/types/purchase';
import { findUserById, ensureBusinessUserRecord } from '@/lib/users';
import { findProjectById } from '@/lib/db/projects';
import { normalizeDateInput } from '@/lib/dates';
import { InvoiceType as FinanceInvoiceType } from '@/types/finance';
import type { SupplierStatus } from '@/types/supplier';
import { createPurchaseExpense } from '@/lib/services/finance-automation';
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
  s.name AS supplier_name,
  s.short_name AS supplier_short_name,
  s.status AS supplier_status
`;

const PURCHASE_FROM_CLAUSE = `
  FROM purchases p
  LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.is_deleted = 0
`;

const hasOwn = <T extends object>(obj: T, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

async function resolveSupplierId(rawId?: string | null): Promise<string | null> {
  const sanitized = sanitizeId(rawId);
  if (!sanitized) {
    return null;
  }
  const result = await mysqlQuery<RowDataPacket & { id: string }>`
    SELECT id FROM suppliers WHERE id = ${sanitized} AND is_deleted = 0 LIMIT 1
  `;
  if (!result.rows.length) {
    throw new Error('SUPPLIER_NOT_FOUND');
  }
  return sanitized;
}

type RawPurchaseRow = RowDataPacket & {
  id: string;
  purchase_number: string;
  purchase_date: string;
  item_name: string;
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
  transaction_no: string | null;
  purchaser_id: string;
  supplier_id: string | null;
  invoice_type: string;
  invoice_status: string;
  invoice_number: string | null;
  invoice_issue_date: string | null;
  invoice_images: string | null;
  receipt_images: string | null;
  has_project: number;
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
  attachments: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  is_deleted: number;
  deleted_at: string | null;
  supplier_name?: string | null;
  supplier_short_name?: string | null;
  supplier_status?: SupplierStatus | null;
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
    purchaseDate: row.purchase_date,
    itemName: row.item_name,
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
    supplierId: row.supplier_id ?? null,
    supplierName: row.supplier_name ?? undefined,
    supplierShortName: row.supplier_short_name ?? undefined,
    supplierStatus: row.supplier_status ?? undefined,
    invoiceType: normalizeInvoiceType(row.invoice_type),
    invoiceStatus: normalizeInvoiceStatus(row.invoice_status),
    invoiceNumber: row.invoice_number,
    invoiceIssueDate: row.invoice_issue_date,
    invoiceImages: parseJsonArray(row.invoice_images),
    receiptImages: parseJsonArray(row.receipt_images),
    hasProject: row.has_project === 1,
    projectId: row.project_id,
    status: normalizePurchaseStatus(row.status),
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    rejectionReason: row.rejection_reason,
    paidAt: row.paid_at,
    paidBy: row.paid_by,
    notes: row.notes,
    attachments: parseJsonArray(row.attachments),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
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

  if (params.purchaserId) {
    conditions.push(`${column('purchaser_id')} = ?`);
    values.push(params.purchaserId);
  }

  if (params.projectId) {
    conditions.push(`${column('project_id')} = ?`);
    values.push(params.projectId);
  }

  if (params.supplierId) {
    conditions.push(`${column('supplier_id')} = ?`);
    values.push(params.supplierId);
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

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

function buildPurchaserProfile(user: Awaited<ReturnType<typeof findUserById>> | null, fallbackId: string): PurchaserProfile {
  return {
    id: user?.id ?? fallbackId,
    displayName: user?.displayName ?? '—',
    avatarUrl: user?.avatarUrl ?? null,
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
    INSERT INTO reimbursement_logs (id, purchase_id, action, from_status, to_status, operator_id, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [id, purchaseId, action, fromStatus, toStatus, operatorId, comment ?? null];
  if (connection) {
    await connection.query(sql, params);
    return;
  }
  await mysqlQuery`
    INSERT INTO reimbursement_logs (id, purchase_id, action, from_status, to_status, operator_id, comment)
    VALUES (${id}, ${purchaseId}, ${action}, ${fromStatus}, ${toStatus}, ${operatorId}, ${comment ?? null})
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

  const feeAmount = Number(input.feeAmount ?? 0);
  if (!Number.isFinite(feeAmount) || feeAmount < 0) {
    throw new Error('INVALID_FEE_AMOUNT');
  }

  if (!isPaymentType(input.paymentType)) {
    throw new Error('INVALID_PAYMENT_TYPE');
  }

  const hasProject = Boolean(input.hasProject);
  const trimmedProjectId = input.projectId?.trim();
  if (hasProject && !trimmedProjectId) {
    throw new Error('PROJECT_REQUIRED');
  }
  if (!hasProject && trimmedProjectId) {
    throw new Error('PROJECT_NOT_ALLOWED');
  }

  let resolvedProjectId: string | null = null;
  if (hasProject && trimmedProjectId) {
    const project = await findProjectById(trimmedProjectId);
    if (!project || project.isDeleted) {
      throw new Error('PROJECT_NOT_FOUND');
    }
    resolvedProjectId = project.id;
  }

  const id = randomUUID();
  const purchaseNumber = await generatePurchaseNumber();
  const totalAmount = +(input.quantity * input.unitPrice).toFixed(2);
  const purchaseDate = requirePurchaseDate(input.purchaseDate);
  const purchaserId = sanitizeId(input.purchaserId) ?? creatorId;
  if (!purchaserId) {
    throw new Error('PURCHASER_REQUIRED');
  }

  const paymentChannel = input.paymentChannel?.trim() || null;
  const payerName = input.payerName?.trim() || null;
  const transactionNo = input.transactionNo?.trim() || null;
  const supplierId = await resolveSupplierId(input.supplierId);

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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const columns = [
      'id',
      'purchase_number',
      'purchase_date',
      'item_name',
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
      'supplier_id',
      'invoice_type',
      'invoice_status',
      'invoice_number',
      'invoice_issue_date',
      'invoice_images',
      'receipt_images',
      'has_project',
      'project_id',
      'notes',
      'attachments',
      'created_by',
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
      input.itemName,
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
      supplierId,
      input.invoiceType,
      invoiceStatus,
      invoiceNumber,
      invoiceIssueDate,
      serializeArray(invoiceImages),
      serializeArray(input.receiptImages),
      hasProject ? 1 : 0,
      resolvedProjectId,
      input.notes ?? null,
      serializeArray(input.attachments),
      creatorId,
    ];

    await connection.query(insertSql, values);

    await insertLog(id, 'submit' as ReimbursementAction, 'draft', 'draft', creatorId, '创建采购记录', connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const purchase = (await findPurchaseById(id))!;
  return purchase;
}

export async function findPurchaseById(id: string): Promise<PurchaseRecord | null> {
  await ensurePurchasesSchema();
  const [rows] = await pool.query<RawPurchaseRow[]>(
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
  const projectPromise = purchase.projectId ? findProjectById(purchase.projectId) : Promise.resolve(null);
  const approverPromise = purchase.approvedBy ? findUserById(purchase.approvedBy) : Promise.resolve(null);
  const rejecterPromise = purchase.rejectedBy ? findUserById(purchase.rejectedBy) : Promise.resolve(null);
  const payerPromise = purchase.paidBy ? findUserById(purchase.paidBy) : Promise.resolve(null);
  const logsPromise = getPurchaseLogs(purchase.id);
  const supplierPromise = purchase.supplierId
    ? getSupplierById(purchase.supplierId).catch(() => null)
    : Promise.resolve(null);

  const [purchaserUser, project, approverUser, rejecterUser, payerUser, logs, supplier] = await Promise.all([
    purchaserPromise,
    projectPromise,
    approverPromise,
    rejecterPromise,
    payerPromise,
    logsPromise,
    supplierPromise,
  ]);

  return {
    ...purchase,
    purchaser: buildPurchaserProfile(purchaserUser, purchase.purchaserId),
    project: project
      ? {
          id: project.id,
          projectCode: project.projectCode,
          projectName: project.projectName,
        }
      : null,
    approver: buildBasicUserProfile(approverUser),
    rejecter: buildBasicUserProfile(rejecterUser),
    payer: buildBasicUserProfile(payerUser),
    logs,
    supplier: supplier ?? null,
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

export async function listPendingApprovals(params: Pick<ListPurchasesParams, 'search' | 'page' | 'pageSize'> = {}) {
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

export async function updatePurchase(id: string, input: UpdatePurchaseInput): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(id);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('NOT_EDITABLE');

  const updates: string[] = [];
  const values: unknown[] = [];

  const push = (field: string, value: unknown) => {
    updates.push(`${field} = ?`);
    values.push(value);
  };

  if (input.purchaseDate !== undefined) push('purchase_date', requirePurchaseDate(input.purchaseDate));
  if (input.itemName !== undefined) push('item_name', input.itemName);
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
  let nextPaymentMethod = existing.paymentMethod;
  if (input.paymentMethod !== undefined) {
    nextPaymentMethod = input.paymentMethod;
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
  if (input.supplierId !== undefined) {
    const nextSupplierId = await resolveSupplierId(input.supplierId);
    push('supplier_id', nextSupplierId);
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
  if (input.hasProject !== undefined || input.projectId !== undefined) {
    const nextHasProject = input.hasProject !== undefined ? input.hasProject : existing.hasProject;
    const pendingProjectId =
      input.projectId !== undefined ? input.projectId : existing.projectId ?? null;
    const trimmedProjectId = pendingProjectId ? pendingProjectId.trim() : null;

    if (nextHasProject && !trimmedProjectId) {
      throw new Error('PROJECT_REQUIRED');
    }
    if (!nextHasProject && trimmedProjectId) {
      throw new Error('PROJECT_NOT_ALLOWED');
    }

    let resolvedProjectId: string | null = trimmedProjectId ?? null;
    if (nextHasProject && trimmedProjectId) {
      const project = await findProjectById(trimmedProjectId);
      if (!project || project.isDeleted) {
        throw new Error('PROJECT_NOT_FOUND');
      }
      resolvedProjectId = project.id;
    }

    push('has_project', nextHasProject ? 1 : 0);
    push('project_id', nextHasProject ? resolvedProjectId : null);
  }
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
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (!(existing.status === 'draft' || existing.status === 'rejected')) throw new Error('NOT_SUBMITTABLE');
  if (!hasInvoiceEvidence(existing)) throw new Error('INVOICE_FILES_REQUIRED');

  await mysqlQuery`
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

  await mysqlQuery`
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

  await mysqlQuery`
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

  const paidAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await mysqlQuery`
    UPDATE purchases
    SET status = 'paid', paid_at = ${paidAt}, paid_by = ${operatorId}, updated_at = NOW()
    WHERE id = ${purchaseId}
  `;
  const updated = (await findPurchaseById(purchaseId))!;

  try {
    await createPurchaseExpense(updated, operatorId);
  } catch (error) {
    await mysqlQuery`
      UPDATE purchases
      SET status = 'approved', paid_at = NULL, paid_by = NULL, updated_at = NOW()
      WHERE id = ${purchaseId}
    `;
    throw error;
  }

  await insertLog(purchaseId, 'pay', 'approved', 'paid', operatorId, null);
  return (await findPurchaseById(purchaseId))!;
}

// withdraw (pending_approval -> cancelled)
export async function withdrawPurchase(purchaseId: string, operatorId: string): Promise<PurchaseRecord> {
  await ensurePurchasesSchema();
  const existing = await findPurchaseById(purchaseId);
  if (!existing) throw new Error('PURCHASE_NOT_FOUND');
  if (existing.status !== 'pending_approval') throw new Error('NOT_WITHDRAWABLE');

  await mysqlQuery`
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

  await mysqlQuery`
    UPDATE purchases
    SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${purchaseId}
  `;
  await insertLog(purchaseId, 'cancel', existing.status, 'cancelled', operatorId, '删除/取消采购记录');
}

export async function getPurchaseLogs(purchaseId: string): Promise<ReimbursementLog[]> {
  await ensurePurchasesSchema();
  const result = await mysqlQuery<RawLogRow>`
    SELECT * FROM reimbursement_logs
    WHERE purchase_id = ${purchaseId}
    ORDER BY created_at ASC
  `;
  return result.rows.map((r) => mapLog(r)!).filter(Boolean) as ReimbursementLog[];
}
