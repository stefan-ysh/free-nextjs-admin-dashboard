import { randomUUID } from 'crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '@/lib/mysql';
import { ensureSuppliersSchema } from '@/lib/schema/suppliers';
import type {
  Supplier,
  SupplierBankAccount,
  SupplierBankAccountInput,
  SupplierContact,
  SupplierContactInput,
  SupplierListParams,
  SupplierListResult,
  SupplierPayload,
  SupplierStatus,
} from '@/types/supplier';

const pool = mysqlPool();

type SupplierRow = RowDataPacket & {
  id: string;
  name: string;
  short_name: string | null;
  category: string | null;
  rating: number | null;
  tax_number: string | null;
  invoice_title: string | null;
  registered_address: string | null;
  office_address: string | null;
  website: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  payment_term: string | null;
  credit_limit: number;
  outstanding_amount: number;
  tags: string | null;
  status: SupplierStatus;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  is_deleted: number;
};

type SupplierContactRow = RowDataPacket & {
  id: string;
  supplier_id: string;
  name: string;
  role: string | null;
  mobile: string | null;
  email: string | null;
  note: string | null;
  is_primary: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type SupplierBankAccountRow = RowDataPacket & {
  id: string;
  supplier_id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string | null;
  country: string | null;
  currency: string | null;
  swift_code: string | null;
  note: string | null;
  is_primary: number;
  created_at: Date | string;
  updated_at: Date | string;
};

function parseJson<T>(value: unknown): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && !Buffer.isBuffer(value)) {
    return value as T;
  }
  try {
    const text = value instanceof Buffer ? value.toString('utf-8') : String(value);
    if (!text.trim()) return undefined;
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn('[suppliers] failed to parse JSON column', error);
    return undefined;
  }
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapSupplierRow(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name ?? undefined,
    category: row.category ?? undefined,
    rating: row.rating ?? undefined,
    taxNumber: row.tax_number ?? undefined,
    invoiceTitle: row.invoice_title ?? undefined,
    registeredAddress: row.registered_address ?? undefined,
    officeAddress: row.office_address ?? undefined,
    website: row.website ?? undefined,
    phone: row.phone ?? undefined,
    mobile: row.mobile ?? undefined,
    email: row.email ?? undefined,
    paymentTerm: row.payment_term ?? undefined,
    creditLimit: Number(row.credit_limit ?? 0),
    outstandingAmount: Number(row.outstanding_amount ?? 0),
    tags: parseJson<string[]>(row.tags) ?? [],
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapContactRow(row: SupplierContactRow): SupplierContact {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    name: row.name,
    role: row.role ?? undefined,
    mobile: row.mobile ?? undefined,
    email: row.email ?? undefined,
    note: row.note ?? undefined,
    isPrimary: row.is_primary === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapBankRow(row: SupplierBankAccountRow): SupplierBankAccount {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    branch: row.branch ?? undefined,
    country: row.country ?? undefined,
    currency: row.currency ?? undefined,
    swiftCode: row.swift_code ?? undefined,
    note: row.note ?? undefined,
    isPrimary: row.is_primary === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function sanitizePayload(payload: SupplierPayload): SupplierPayload {
  return {
    ...payload,
    name: payload.name.trim(),
    shortName: payload.shortName?.trim(),
    category: payload.category?.trim(),
    taxNumber: payload.taxNumber?.trim(),
    invoiceTitle: payload.invoiceTitle?.trim(),
    registeredAddress: payload.registeredAddress?.trim(),
    officeAddress: payload.officeAddress?.trim(),
    website: payload.website?.trim(),
    phone: payload.phone?.trim(),
    mobile: payload.mobile?.trim(),
    email: payload.email?.trim(),
    paymentTerm: payload.paymentTerm?.trim(),
    notes: payload.notes?.trim(),
  };
}

function sanitizeContacts(contacts?: SupplierContactInput[]): SupplierContactInput[] {
  if (!contacts?.length) return [];
  return contacts
    .map((contact, index) => ({
      name: contact.name?.trim() ?? '',
      role: contact.role?.trim() || undefined,
      mobile: contact.mobile?.trim() || undefined,
      email: contact.email?.trim() || undefined,
      note: contact.note?.trim() || undefined,
      isPrimary: contact.isPrimary ?? index === 0,
    }))
    .filter((contact) => contact.name || contact.mobile || contact.email);
}

function sanitizeBankAccounts(accounts?: SupplierBankAccountInput[]): SupplierBankAccountInput[] {
  if (!accounts?.length) return [];
  return accounts
    .map((account, index) => ({
      bankName: account.bankName?.trim() ?? '',
      accountName: account.accountName?.trim() ?? '',
      accountNumber: account.accountNumber?.trim() ?? '',
      branch: account.branch?.trim() || undefined,
      country: account.country?.trim() || undefined,
      currency: account.currency?.trim() || undefined,
      swiftCode: account.swiftCode?.trim() || undefined,
      note: account.note?.trim() || undefined,
      isPrimary: account.isPrimary ?? index === 0,
    }))
    .filter((account) => account.bankName && account.accountNumber && account.accountName);
}

function buildListQuery(params: SupplierListParams = {}) {
  const conditions: string[] = ['is_deleted = 0'];
  const values: unknown[] = [];

  if (params.search) {
    const keyword = `%${params.search.trim()}%`;
    conditions.push(
      '(' + ['name', 'short_name', 'tax_number', 'mobile', 'phone'].map((col) => `${col} LIKE ?`).join(' OR ') + ')'
    );
    values.push(keyword, keyword, keyword, keyword, keyword);
  }

  if (params.status && params.status !== 'all') {
    conditions.push('status = ?');
    values.push(params.status);
  }

  if (params.category) {
    conditions.push('category = ?');
    values.push(params.category.trim());
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values };
}

async function fetchContacts(connection: PoolConnection, supplierId: string): Promise<SupplierContact[]> {
  const [rows] = await connection.query<SupplierContactRow[]>(
    'SELECT * FROM supplier_contacts WHERE supplier_id = ? ORDER BY is_primary DESC, created_at ASC',
    [supplierId]
  );
  return rows.map(mapContactRow);
}

async function fetchBankAccounts(connection: PoolConnection, supplierId: string): Promise<SupplierBankAccount[]> {
  const [rows] = await connection.query<SupplierBankAccountRow[]>(
    'SELECT * FROM supplier_bank_accounts WHERE supplier_id = ? ORDER BY is_primary DESC, created_at ASC',
    [supplierId]
  );
  return rows.map(mapBankRow);
}

async function replaceContacts(
  connection: PoolConnection,
  supplierId: string,
  contacts?: SupplierContactInput[]
) {
  await connection.query('DELETE FROM supplier_contacts WHERE supplier_id = ?', [supplierId]);
  const list = sanitizeContacts(contacts);
  if (!list.length) return;

  const values: unknown[][] = list.map((contact) => [
    randomUUID(),
    supplierId,
    contact.name,
    contact.role ?? null,
    contact.mobile ?? null,
    contact.email ?? null,
    contact.note ?? null,
    contact.isPrimary ? 1 : 0,
  ]);

  await connection.query<ResultSetHeader>(
    `INSERT INTO supplier_contacts (id, supplier_id, name, role, mobile, email, note, is_primary)
     VALUES ${values.map(() => '(?,?,?,?,?,?,?,?)').join(',')}`,
    values.flat()
  );
}

async function replaceBankAccounts(
  connection: PoolConnection,
  supplierId: string,
  accounts?: SupplierBankAccountInput[]
) {
  await connection.query('DELETE FROM supplier_bank_accounts WHERE supplier_id = ?', [supplierId]);
  const list = sanitizeBankAccounts(accounts);
  if (!list.length) return;

  const values: unknown[][] = list.map((account) => [
    randomUUID(),
    supplierId,
    account.bankName,
    account.accountName,
    account.accountNumber,
    account.branch ?? null,
    account.country ?? null,
    account.currency ?? null,
    account.swiftCode ?? null,
    account.note ?? null,
    account.isPrimary ? 1 : 0,
  ]);

  await connection.query<ResultSetHeader>(
    `INSERT INTO supplier_bank_accounts (id, supplier_id, bank_name, account_name, account_number, branch, country, currency, swift_code, note, is_primary)
     VALUES ${values.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',')}`,
    values.flat()
  );
}

export async function listSuppliers(params: SupplierListParams = {}): Promise<SupplierListResult> {
  await ensureSuppliersSchema();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const { whereClause, values } = buildListQuery(params);
  const [rows] = await pool.query<SupplierRow[]>(
    `SELECT * FROM suppliers ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM suppliers ${whereClause}`,
    values
  );
  const total = Number(countRows[0]?.total ?? 0);

  return {
    items: rows.map(mapSupplierRow),
    total,
    page,
    pageSize,
  };
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  await ensureSuppliersSchema();
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query<SupplierRow[]>(
      'SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0 LIMIT 1',
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    const supplier = mapSupplierRow(row);
    supplier.contacts = await fetchContacts(connection, id);
    supplier.bankAccounts = await fetchBankAccounts(connection, id);
    return supplier;
  } finally {
    connection.release();
  }
}

export async function createSupplier(payload: SupplierPayload, userId: string): Promise<Supplier> {
  await ensureSuppliersSchema();
  const sanitized = sanitizePayload(payload);
  if (!sanitized.name) {
    throw new Error('SUPPLIER_NAME_REQUIRED');
  }
  const supplierId = randomUUID();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query<ResultSetHeader>(
      `INSERT INTO suppliers (
        id, name, short_name, category, rating, tax_number, invoice_title, registered_address, office_address,
        website, phone, mobile, email, payment_term, credit_limit, tags, status, notes, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        supplierId,
        sanitized.name,
        sanitized.shortName ?? null,
        sanitized.category ?? null,
        sanitized.rating ?? null,
        sanitized.taxNumber ?? null,
        sanitized.invoiceTitle ?? null,
        sanitized.registeredAddress ?? null,
        sanitized.officeAddress ?? null,
        sanitized.website ?? null,
        sanitized.phone ?? null,
        sanitized.mobile ?? null,
        sanitized.email ?? null,
        sanitized.paymentTerm ?? null,
        Number.isFinite(sanitized.creditLimit) ? sanitized.creditLimit : 0,
        JSON.stringify(sanitized.tags ?? []),
        sanitized.status ?? 'active',
        sanitized.notes ?? null,
        userId,
      ]
    );
    await replaceContacts(connection, supplierId, sanitized.contacts);
    await replaceBankAccounts(connection, supplierId, sanitized.bankAccounts);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const supplier = await getSupplierById(supplierId);
  if (!supplier) {
    throw new Error('FAILED_TO_LOAD_SUPPLIER_AFTER_CREATE');
  }
  return supplier;
}

export async function updateSupplier(id: string, payload: SupplierPayload): Promise<Supplier> {
  await ensureSuppliersSchema();
  const sanitized = sanitizePayload(payload);
  if (!sanitized.name) {
    throw new Error('SUPPLIER_NAME_REQUIRED');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE suppliers SET
        name = ?,
        short_name = ?,
        category = ?,
        rating = ?,
        tax_number = ?,
        invoice_title = ?,
        registered_address = ?,
        office_address = ?,
        website = ?,
        phone = ?,
        mobile = ?,
        email = ?,
        payment_term = ?,
        credit_limit = ?,
        tags = ?,
        status = ?,
        notes = ?
      WHERE id = ? AND is_deleted = 0`,
      [
        sanitized.name,
        sanitized.shortName ?? null,
        sanitized.category ?? null,
        sanitized.rating ?? null,
        sanitized.taxNumber ?? null,
        sanitized.invoiceTitle ?? null,
        sanitized.registeredAddress ?? null,
        sanitized.officeAddress ?? null,
        sanitized.website ?? null,
        sanitized.phone ?? null,
        sanitized.mobile ?? null,
        sanitized.email ?? null,
        sanitized.paymentTerm ?? null,
        Number.isFinite(sanitized.creditLimit) ? sanitized.creditLimit : 0,
        JSON.stringify(sanitized.tags ?? []),
        sanitized.status ?? 'active',
        sanitized.notes ?? null,
        id,
      ]
    );
    if (result.affectedRows === 0) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }
    await replaceContacts(connection, id, sanitized.contacts);
    await replaceBankAccounts(connection, id, sanitized.bankAccounts);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const supplier = await getSupplierById(id);
  if (!supplier) {
    throw new Error('FAILED_TO_LOAD_SUPPLIER_AFTER_UPDATE');
  }
  return supplier;
}

export async function deleteSupplier(id: string): Promise<void> {
  await ensureSuppliersSchema();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE suppliers SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND is_deleted = 0',
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error('SUPPLIER_NOT_FOUND');
  }
}
