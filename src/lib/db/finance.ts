import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';
import { ensureFinanceSchema } from '@/lib/schema/finance';
import { normalizeDateInput } from '@/lib/dates';
import {
  FinanceRecord,
  TransactionType,
  FinanceStats,
  CategoryStat,
  PaymentType,
  InvoiceInfo,
  InvoiceType,
  FinanceSourceType,
  FinanceRecordStatus,
} from '@/types/finance';
import { deleteStoredFile, isBase64DataUri, saveBase64File } from '@/lib/storage/local';

const pool = mysqlPool();

type FinanceRecordFilters = {
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  category?: string;
  paymentType?: PaymentType;
  minAmount?: number;
  maxAmount?: number;
  keyword?: string;
};

type FinanceRecordQueryOptions = FinanceRecordFilters & {
  limit?: number;
  offset?: number;
};

type FinanceRecordRow = RowDataPacket & {
  id: string;
  name: string;
  type: TransactionType;
  category: string;
  date_value: Date | string;
  contract_amount: number;
  fee: number;
  total_amount: number;
  payment_type: PaymentType;
  quantity: number;
  payment_channel: string | null;
  payer: string | null;
  transaction_no: string | null;
  invoice_json: string | null;
  description: string | null;
  tags_json: string | null;
  created_by: string | null;
  source_type: FinanceSourceType;
  status: FinanceRecordStatus;
  purchase_id: string | null;
  project_id: string | null;
  inventory_movement_id: string | null;
  project_payment_id: string | null;
  metadata_json: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type SummaryRow = RowDataPacket & {
  totalIncome: number | null;
  totalExpense: number | null;
  recordCount: number;
};

type CategoryRow = RowDataPacket & {
  category: string;
  type: TransactionType;
  amount: number;
  count: number;
};

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function parseJsonColumn<T>(value: string | Buffer | T | null): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && !(value instanceof Buffer)) {
    return value as T;
  }
  try {
    const text = value instanceof Buffer ? value.toString('utf-8') : String(value);
    if (!text.trim()) return undefined;
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn('Failed to parse JSON column', error);
    return undefined;
  }
}

function mapFinanceRecord(row: FinanceRecordRow): FinanceRecord {
  const invoice = parseJsonColumn<InvoiceInfo>(row.invoice_json);
  const tags = parseJsonColumn<string[]>(row.tags_json);
  const metadata = parseJsonColumn<FinanceRecord['metadata']>(row.metadata_json);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    date: toIsoString(row.date_value),
    status: row.status ?? 'draft',
    contractAmount: Number(row.contract_amount),
    fee: Number(row.fee),
    totalAmount: Number(row.total_amount),
    paymentType: row.payment_type,
    quantity: Number(row.quantity ?? 1),
    paymentChannel: row.payment_channel ?? undefined,
    payer: row.payer ?? undefined,
    transactionNo: row.transaction_no ?? undefined,
    invoice,
    description: row.description ?? undefined,
    tags,
    createdBy: row.created_by ?? undefined,
    sourceType: row.source_type ?? 'manual',
    purchaseId: row.purchase_id ?? undefined,
    projectId: row.project_id ?? undefined,
    inventoryMovementId: row.inventory_movement_id ?? undefined,
    projectPaymentId: row.project_payment_id ?? undefined,
    metadata,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function formatDateForDb(value: string): string {
  const normalized = normalizeDateInput(value, { errorCode: 'INVALID_DATE' });
  if (!normalized) {
    throw new Error('INVALID_DATE');
  }
  return normalized;
}

function normalizeDateRange(startDate?: string, endDate?: string): [string, string] {
  const fallbackStart = new Date('1970-01-01T00:00:00.000Z');
  const fallbackEnd = new Date('2100-12-31T00:00:00.000Z');

  const start = startDate ? new Date(startDate) : fallbackStart;
  const end = endDate ? new Date(endDate) : fallbackEnd;

  const safeStart = Number.isNaN(start.getTime()) ? fallbackStart : start;
  const safeEnd = Number.isNaN(end.getTime()) ? fallbackEnd : end;

  const min = safeStart <= safeEnd ? safeStart : safeEnd;
  const max = safeStart <= safeEnd ? safeEnd : safeStart;

  return [min.toISOString().slice(0, 10), max.toISOString().slice(0, 10)];
}

function buildFinanceFilters(filters: FinanceRecordFilters = {}) {
  const [start, end] = normalizeDateRange(filters.startDate, filters.endDate);
  const conditions: string[] = ['date_value BETWEEN ? AND ?'];
  const params: Array<string | number> = [start, end];

  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }

  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }

  if (filters.paymentType) {
    conditions.push('payment_type = ?');
    params.push(filters.paymentType);
  }

  if (typeof filters.minAmount === 'number' && Number.isFinite(filters.minAmount)) {
    conditions.push('total_amount >= ?');
    params.push(filters.minAmount);
  }

  if (typeof filters.maxAmount === 'number' && Number.isFinite(filters.maxAmount)) {
    conditions.push('total_amount <= ?');
    params.push(filters.maxAmount);
  }

  if (filters.keyword) {
    const like = `%${filters.keyword}%`;
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(like, like);
  }

  return {
    whereClause: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
}

async function persistAttachments(
  attachments: string[],
  existing: string[]
): Promise<{ files: string[]; removed: string[] }> {
  if (!attachments.length && !existing.length) {
    return { files: [], removed: [] };
  }

  const remaining = new Set(existing);
  const stored: string[] = [];

  for (const file of attachments) {
    if (!file) continue;
    if (isBase64DataUri(file)) {
      const path = await saveBase64File(file, 'finance/attachments', 'invoice');
      stored.push(path);
    } else {
      stored.push(file);
      remaining.delete(file);
    }
  }

  return {
    files: stored,
    removed: Array.from(remaining),
  };
}

async function removeAttachments(paths?: string[]) {
  if (!paths?.length) return;
  await Promise.all(
    paths
      .filter((pathValue) => pathValue && !pathValue.startsWith('http'))
      .map((pathValue) => deleteStoredFile(pathValue))
  );
}

async function processInvoicePayload(
  invoiceInput?: InvoiceInfo,
  existing?: InvoiceInfo
): Promise<{ invoice?: InvoiceInfo; removed: string[] }> {
  if (!invoiceInput) {
    return { invoice: existing, removed: [] };
  }

  if (invoiceInput.type === InvoiceType.NONE) {
    return { invoice: undefined, removed: existing?.attachments ?? [] };
  }

  const merged: InvoiceInfo = {
    ...existing,
    ...invoiceInput,
  };

  if (invoiceInput.issueDate) {
    merged.issueDate = new Date(invoiceInput.issueDate).toISOString();
  }

  if (invoiceInput.attachments === undefined) {
    merged.attachments = existing?.attachments;
    return { invoice: merged, removed: [] };
  }

  const { files, removed } = await persistAttachments(
    invoiceInput.attachments,
    existing?.attachments ?? []
  );
  merged.attachments = files.length ? files : undefined;
  return { invoice: merged, removed };
}

function serializeTags(tags?: string[]): string | null {
  if (!tags || tags.length === 0) return null;
  return JSON.stringify(tags);
}

export async function createRecord(
  record: Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>
): Promise<FinanceRecord> {
  await ensureFinanceSchema();
  const id = randomUUID();
  const totalAmount = record.contractAmount + record.fee;
  const dateValue = formatDateForDb(record.date);
  const sourceType: FinanceSourceType = record.sourceType ?? 'manual';
  const status: FinanceRecordStatus = record.status ?? 'draft';
  const projectId = record.projectId ?? null;
  const purchaseId = record.purchaseId ?? null;
  const inventoryMovementId = record.inventoryMovementId ?? null;
  const projectPaymentId = record.projectPaymentId ?? null;
  const quantity = record.quantity ?? 1;
  const paymentChannel = record.paymentChannel ?? null;
  const payer = record.payer ?? null;
  const transactionNo = record.transactionNo ?? null;
  const metadataJson = record.metadata ? JSON.stringify(record.metadata) : null;

  const invoiceSource = record.invoice?.type === InvoiceType.NONE ? undefined : record.invoice;
  const { invoice } = await processInvoicePayload(invoiceSource);

  await pool.query(
    `INSERT INTO finance_records (
      id, name, type, category, date_value,
      contract_amount, fee, total_amount, payment_type,
      quantity, payment_channel, payer, transaction_no,
      invoice_json, description, tags_json, created_by,
      source_type, status, purchase_id, project_id,
      inventory_movement_id, project_payment_id, metadata_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      record.name,
      record.type,
      record.category,
      dateValue,
      record.contractAmount,
      record.fee,
      totalAmount,
      record.paymentType,
      quantity,
      paymentChannel,
      payer,
      transactionNo,
      invoice ? JSON.stringify(invoice) : null,
      record.description ?? null,
      serializeTags(record.tags),
      record.createdBy ?? null,
      sourceType,
      status,
      purchaseId,
      projectId,
      inventoryMovementId,
      projectPaymentId,
      metadataJson,
    ]
  );

  const saved = await getRecord(id);
  if (!saved) {
    throw new Error('FAILED_TO_CREATE_FINANCE_RECORD');
  }
  return saved;
}

export async function getRecord(id: string): Promise<FinanceRecord | null> {
  await ensureFinanceSchema();
  const [rows] = await pool.query<FinanceRecordRow[]>(
    'SELECT * FROM finance_records WHERE id = ? LIMIT 1',
    [id]
  );
  if (!rows.length) {
    return null;
  }
  return mapFinanceRecord(rows[0]);
}

export async function findRecordByPurchaseId(purchaseId: string): Promise<FinanceRecord | null> {
  await ensureFinanceSchema();
  if (!purchaseId) {
    return null;
  }
  const [rows] = await pool.query<FinanceRecordRow[]>(
    'SELECT * FROM finance_records WHERE purchase_id = ? LIMIT 1',
    [purchaseId]
  );
  if (!rows.length) {
    return null;
  }
  return mapFinanceRecord(rows[0]);
}

export async function findRecordByInventoryMovementId(
  movementId: string
): Promise<FinanceRecord | null> {
  await ensureFinanceSchema();
  if (!movementId) {
    return null;
  }
  const [rows] = await pool.query<FinanceRecordRow[]>(
    'SELECT * FROM finance_records WHERE inventory_movement_id = ? LIMIT 1',
    [movementId]
  );
  if (!rows.length) {
    return null;
  }
  return mapFinanceRecord(rows[0]);
}

export async function findRecordByProjectPaymentId(
  paymentId: string
): Promise<FinanceRecord | null> {
  await ensureFinanceSchema();
  if (!paymentId) {
    return null;
  }
  const [rows] = await pool.query<FinanceRecordRow[]>(
    'SELECT * FROM finance_records WHERE project_payment_id = ? LIMIT 1',
    [paymentId]
  );
  if (!rows.length) {
    return null;
  }
  return mapFinanceRecord(rows[0]);
}

export async function updateRecord(
  id: string,
  updates: Partial<Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>>
): Promise<FinanceRecord | null> {
  await ensureFinanceSchema();
  const existing = await getRecord(id);
  if (!existing) return null;

  const merged: FinanceRecord = {
    ...existing,
    ...updates,
    name: updates.name ?? existing.name,
    type: updates.type ?? existing.type,
    category: updates.category ?? existing.category,
    paymentType: updates.paymentType ?? existing.paymentType,
    contractAmount: updates.contractAmount ?? existing.contractAmount,
    fee: updates.fee ?? existing.fee,
    quantity: updates.quantity ?? existing.quantity ?? 1,
    paymentChannel: updates.paymentChannel ?? existing.paymentChannel,
    payer: updates.payer ?? existing.payer,
    transactionNo: updates.transactionNo ?? existing.transactionNo,
    date: updates.date ? new Date(updates.date).toISOString() : existing.date,
    description: updates.description ?? existing.description,
    tags: updates.tags ?? existing.tags,
  };
  merged.totalAmount = merged.contractAmount + merged.fee;

  let invoicePayload = existing.invoice;
  if (updates.invoice !== undefined) {
    const invoiceSource =
      updates.invoice?.type === InvoiceType.NONE ? undefined : updates.invoice;
    const { invoice, removed } = await processInvoicePayload(invoiceSource, existing.invoice);
    invoicePayload = invoice;
    await removeAttachments(removed);
  }
  merged.sourceType = updates.sourceType ?? existing.sourceType;
  merged.purchaseId = updates.purchaseId ?? existing.purchaseId;
  merged.projectId = updates.projectId ?? existing.projectId;
  merged.inventoryMovementId = updates.inventoryMovementId ?? existing.inventoryMovementId;
  merged.projectPaymentId = updates.projectPaymentId ?? existing.projectPaymentId;
  merged.status = updates.status ?? existing.status ?? 'draft';
  merged.metadata = updates.metadata ?? existing.metadata;

  const metadataJson = merged.metadata ? JSON.stringify(merged.metadata) : null;

  await pool.query(
    `UPDATE finance_records SET
      name = ?,
      type = ?,
      category = ?,
      date_value = ?,
      contract_amount = ?,
      fee = ?,
      total_amount = ?,
      payment_type = ?,
      quantity = ?,
      payment_channel = ?,
      payer = ?,
      transaction_no = ?,
      invoice_json = ?,
      description = ?,
      tags_json = ?,
      metadata_json = ?,
      status = ?,
      source_type = ?,
      purchase_id = ?,
      project_id = ?,
      inventory_movement_id = ?,
      project_payment_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [
      merged.name,
      merged.type,
      merged.category,
      formatDateForDb(merged.date),
      merged.contractAmount,
      merged.fee,
      merged.totalAmount,
      merged.paymentType,
      merged.quantity ?? 1,
      merged.paymentChannel ?? null,
      merged.payer ?? null,
      merged.transactionNo ?? null,
      invoicePayload ? JSON.stringify(invoicePayload) : null,
      merged.description ?? null,
      serializeTags(merged.tags),
      metadataJson,
      merged.status ?? 'draft',
      merged.sourceType ?? 'manual',
      merged.purchaseId ?? null,
      merged.projectId ?? null,
      merged.inventoryMovementId ?? null,
      merged.projectPaymentId ?? null,
      id,
    ]
  );

  return getRecord(id);
}

export async function deleteRecord(id: string): Promise<boolean> {
  await ensureFinanceSchema();
  const existing = await getRecord(id);
  if (!existing) return false;

  await removeAttachments(existing.invoice?.attachments);
  await pool.query('DELETE FROM finance_records WHERE id = ?', [id]);
  return true;
}

export async function getRecords(options: FinanceRecordQueryOptions = {}): Promise<FinanceRecord[]> {
  await ensureFinanceSchema();
  const { limit = 50, offset = 0, ...filters } = options;
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const safeOffset = Math.max(0, offset);
  const { whereClause, params } = buildFinanceFilters(filters);

  const [rows] = await pool.query<FinanceRecordRow[]>(
    `SELECT * FROM finance_records
     ${whereClause}
     ORDER BY date_value DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset]
  );

  return rows.map(mapFinanceRecord);
}

export async function getRecordsCount(filters: FinanceRecordFilters = {}): Promise<number> {
  await ensureFinanceSchema();
  const { whereClause, params } = buildFinanceFilters(filters);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM finance_records ${whereClause}`,
    params
  );
  const total = rows[0]?.total;
  return typeof total === 'number' ? total : Number(total ?? 0);
}

export async function getStats(filters: FinanceRecordFilters = {}): Promise<FinanceStats> {
  await ensureFinanceSchema();
  const { whereClause, params } = buildFinanceFilters(filters);

  const [summaryRows] = await pool.query<SummaryRow[]>(
    `SELECT
      SUM(CASE WHEN type = 'income' THEN total_amount ELSE 0 END) AS totalIncome,
      SUM(CASE WHEN type = 'expense' THEN total_amount ELSE 0 END) AS totalExpense,
      COUNT(*) AS recordCount
    FROM finance_records
    ${whereClause}`,
    params
  );

  const summary = summaryRows[0] ?? { totalIncome: 0, totalExpense: 0, recordCount: 0 };
  const totalIncome = Number(summary.totalIncome ?? 0);
  const totalExpense = Number(summary.totalExpense ?? 0);

  const [categoryRows] = await pool.query<CategoryRow[]>(
    `SELECT category, type, SUM(total_amount) AS amount, COUNT(*) AS count
     FROM finance_records
     ${whereClause}
     GROUP BY category, type
     ORDER BY amount DESC`,
    params
  );

  const categoryStats: CategoryStat[] = categoryRows.map((row) => {
    const amount = Number(row.amount ?? 0);
    const count = Number(row.count ?? 0);
    const totalForType = row.type === TransactionType.INCOME ? totalIncome : totalExpense;
    return {
      category: row.category,
      amount,
      count,
      percentage: totalForType > 0 ? (amount / totalForType) * 100 : 0,
    };
  });

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    recordCount: Number(summary.recordCount ?? 0),
    categoryStats,
  };
}

export async function getCategories(type: TransactionType): Promise<string[]> {
  await ensureFinanceSchema();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT name FROM finance_categories WHERE type = ? ORDER BY is_default DESC, name ASC',
    [type]
  );

  return rows.map((row) => row.name as string);
}

export async function addCategory(type: TransactionType, category: string): Promise<void> {
  await ensureFinanceSchema();
  const name = category.trim();
  if (!name) return;

  await pool.query(
    'INSERT IGNORE INTO finance_categories (type, name, is_default) VALUES (?, ?, 0)',
    [type, name]
  );
}
