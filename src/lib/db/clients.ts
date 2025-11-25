import { randomUUID } from 'crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '@/lib/mysql';
import { ensureClientsSchema } from '@/lib/schema/clients';
import type {
  Client,
  ClientAddress,
  ClientContact,
  ClientContactInput,
  ClientListParams,
  ClientListResult,
  ClientPayload,
  ClientStats,
  ClientStatus,
  ClientType,
} from '@/types/client';

const pool = mysqlPool();

type ClientRow = RowDataPacket & {
  id: string;
  type: ClientType;
  display_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  tax_number: string | null;
  invoice_title: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  payment_term: string | null;
  credit_limit: number;
  outstanding_amount: number;
  tags: string | null;
  status: ClientStatus;
  owner_id: string | null;
  source: string;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: string;
  is_deleted: number;
};

type ClientContactRow = RowDataPacket & {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  mobile: string | null;
  email: string | null;
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
    console.warn('[clients] failed to parse JSON column', error);
    return undefined;
  }
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapClientRow(row: ClientRow): Client {
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    companyName: row.company_name ?? undefined,
    contactPerson: row.contact_person ?? undefined,
    mobile: row.mobile ?? undefined,
    email: row.email ?? undefined,
    taxNumber: row.tax_number ?? undefined,
    invoiceTitle: row.invoice_title ?? undefined,
    billingAddress: parseJson(row.billing_address),
    shippingAddress: parseJson(row.shipping_address),
    paymentTerm: row.payment_term ?? undefined,
    creditLimit: Number(row.credit_limit ?? 0),
    outstandingAmount: Number(row.outstanding_amount ?? 0),
    tags: parseJson<string[]>(row.tags) ?? [],
    status: row.status,
    ownerId: row.owner_id ?? undefined,
    source: (row.source ?? 'manual') as Client['source'],
    notes: row.notes ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapClientContact(row: ClientContactRow): ClientContact {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    role: row.role ?? undefined,
    mobile: row.mobile ?? undefined,
    email: row.email ?? undefined,
    isPrimary: row.is_primary === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function buildListQuery(params: ClientListParams) {
  const conditions: string[] = ['is_deleted = 0'];
  const values: unknown[] = [];

  if (params.search) {
    const keyword = `%${params.search.trim()}%`;
    conditions.push('(' + ['display_name', 'company_name', 'mobile', 'tax_number'].map((col) => `${col} LIKE ?`).join(' OR ') + ')');
    values.push(keyword, keyword, keyword, keyword);
  }

  if (params.type && params.type !== 'all') {
    conditions.push('type = ?');
    values.push(params.type);
  }

  if (params.status && params.status !== 'all') {
    conditions.push('status = ?');
    values.push(params.status);
  }

  if (params.ownerId) {
    conditions.push('owner_id = ?');
    values.push(params.ownerId);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values };
}

export async function listClients(params: ClientListParams = {}): Promise<ClientListResult> {
  await ensureClientsSchema();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const { whereClause, values } = buildListQuery(params);

  const [rows] = await pool.query<ClientRow[]>(
    `SELECT * FROM clients ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM clients ${whereClause}`,
    values
  );
  const total = Number(countRows[0]?.total ?? 0);

  return {
    items: rows.map(mapClientRow),
    total,
    page,
    pageSize,
  };
}

export async function getClientById(id: string): Promise<Client | null> {
  await ensureClientsSchema();
  const [rows] = await pool.query<ClientRow[]>(
    'SELECT * FROM clients WHERE id = ? AND is_deleted = 0 LIMIT 1',
    [id]
  );
  if (!rows[0]) return null;
  const client = mapClientRow(rows[0]);
  client.contacts = await fetchContactsByClientId(id);
  return client;
}

function sanitizePayload(payload: ClientPayload): ClientPayload {
  return {
    ...payload,
    displayName: payload.displayName.trim(),
    companyName: payload.companyName?.trim(),
    contactPerson: payload.contactPerson?.trim(),
    mobile: payload.mobile?.trim(),
    email: payload.email?.trim(),
    taxNumber: payload.taxNumber?.trim(),
    invoiceTitle: payload.invoiceTitle?.trim(),
    paymentTerm: payload.paymentTerm?.trim(),
    notes: payload.notes?.trim(),
  };
}

function sanitizeContacts(list?: ClientContactInput[]): ClientContactInput[] {
  if (!Array.isArray(list)) return [];
  const normalized: ClientContactInput[] = [];
  list.forEach((contact, index) => {
    const name = contact.name?.trim();
    if (!name) return;
    normalized.push({
      name,
      role: contact.role?.trim() || undefined,
      mobile: contact.mobile?.trim() || undefined,
      email: contact.email?.trim() || undefined,
      isPrimary: contact.isPrimary ?? index === 0,
    });
  });

  if (!normalized.length) return [];
  if (!normalized.some((contact) => contact.isPrimary)) {
    normalized[0].isPrimary = true;
  }
  return normalized;
}

function mergePayload(existing: Client, partial: Partial<ClientPayload>): ClientPayload {
  const billingAddress: ClientAddress | undefined = partial.billingAddress ?? existing.billingAddress;
  const shippingAddress: ClientAddress | undefined = partial.shippingAddress ?? existing.shippingAddress;
  return {
    type: partial.type ?? existing.type,
    displayName: partial.displayName ?? existing.displayName,
    companyName: partial.companyName ?? existing.companyName,
    contactPerson: partial.contactPerson ?? existing.contactPerson,
    mobile: partial.mobile ?? existing.mobile,
    email: partial.email ?? existing.email,
    taxNumber: partial.taxNumber ?? existing.taxNumber,
    invoiceTitle: partial.invoiceTitle ?? existing.invoiceTitle,
    billingAddress,
    shippingAddress,
    paymentTerm: partial.paymentTerm ?? existing.paymentTerm,
    creditLimit: partial.creditLimit ?? existing.creditLimit,
    tags: partial.tags ?? existing.tags,
    status: partial.status ?? existing.status,
    source: partial.source ?? existing.source,
    notes: partial.notes ?? existing.notes,
  };
}

export async function createClient(payload: ClientPayload, userId: string): Promise<Client> {
  await ensureClientsSchema();
  if (!payload.displayName?.trim()) {
    throw new Error('CLIENT_NAME_REQUIRED');
  }
  const normalized = sanitizePayload(payload);
  const contacts = sanitizeContacts(payload.contacts);
  const id = randomUUID();
  const tagsJson = JSON.stringify(normalized.tags ?? []);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
    `INSERT INTO clients (
      id, type, display_name, company_name, contact_person, mobile, email,
      tax_number, invoice_title, billing_address, shipping_address, payment_term,
      credit_limit, outstanding_amount, tags, status, owner_id, source, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        normalized.type,
        normalized.displayName,
        normalized.companyName ?? null,
        normalized.contactPerson ?? null,
        normalized.mobile ?? null,
        normalized.email ?? null,
        normalized.taxNumber ?? null,
        normalized.invoiceTitle ?? null,
        normalized.billingAddress ? JSON.stringify(normalized.billingAddress) : JSON.stringify({}),
        normalized.shippingAddress ? JSON.stringify(normalized.shippingAddress) : JSON.stringify({}),
        normalized.paymentTerm ?? null,
        Number(normalized.creditLimit ?? 0),
        tagsJson,
        normalized.status ?? 'active',
        null,
        normalized.source ?? 'manual',
        normalized.notes ?? null,
        userId,
      ]
    );
    if (contacts.length) {
      await replaceContacts(connection, id, contacts);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const created = await getClientById(id);
  if (!created) {
    throw new Error('CLIENT_NOT_FOUND');
  }
  return created;
}

export async function updateClient(id: string, payload: Partial<ClientPayload>): Promise<Client> {
  await ensureClientsSchema();
  const existing = await getClientById(id);
  if (!existing) {
    throw new Error('CLIENT_NOT_FOUND');
  }
  const merged = mergePayload(existing, payload);
  const normalized = sanitizePayload(merged);
  const contactsUpdate = Array.isArray(payload.contacts) ? sanitizeContacts(payload.contacts) : null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
    `UPDATE clients SET
      type = ?,
      display_name = ?,
      company_name = ?,
      contact_person = ?,
      mobile = ?,
      email = ?,
      tax_number = ?,
      invoice_title = ?,
      billing_address = ?,
      shipping_address = ?,
      payment_term = ?,
      credit_limit = ?,
      tags = ?,
      status = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE id = ? AND is_deleted = 0`,
      [
        normalized.type,
        normalized.displayName,
        normalized.companyName ?? null,
        normalized.contactPerson ?? null,
        normalized.mobile ?? null,
        normalized.email ?? null,
        normalized.taxNumber ?? null,
        normalized.invoiceTitle ?? null,
        normalized.billingAddress ? JSON.stringify(normalized.billingAddress) : JSON.stringify({}),
        normalized.shippingAddress ? JSON.stringify(normalized.shippingAddress) : JSON.stringify({}),
        normalized.paymentTerm ?? null,
        Number(normalized.creditLimit ?? 0),
        JSON.stringify(normalized.tags ?? []),
        normalized.status ?? 'active',
        normalized.notes ?? null,
        id,
      ]
    );
    if (contactsUpdate) {
      await replaceContacts(connection, id, contactsUpdate);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const updated = await getClientById(id);
  if (!updated) throw new Error('CLIENT_NOT_FOUND');
  return updated;
}

export async function softDeleteClient(id: string): Promise<void> {
  await ensureClientsSchema();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE clients SET is_deleted = 1, status = "inactive", deleted_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND is_deleted = 0',
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error('CLIENT_NOT_FOUND');
  }
}

type ClientSummaryRow = RowDataPacket & {
  totalClients: number | null;
  activeClients: number | null;
  inactiveClients: number | null;
  blacklistedClients: number | null;
  totalCredit: number | null;
  outstanding: number | null;
};

type ClientTrendRow = RowDataPacket & {
  newClients30d: number | null;
};

type TopOutstandingRow = RowDataPacket & {
  id: string;
  display_name: string;
  status: ClientStatus;
  outstanding_amount: number | null;
};

export async function getClientStats(limit = 6): Promise<ClientStats> {
  await ensureClientsSchema();

  const [[summary]] = await pool.query<ClientSummaryRow[]>(
    `SELECT
       COUNT(*) AS totalClients,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeClients,
       SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactiveClients,
       SUM(CASE WHEN status = 'blacklisted' THEN 1 ELSE 0 END) AS blacklistedClients,
       SUM(credit_limit) AS totalCredit,
       SUM(outstanding_amount) AS outstanding
     FROM clients
     WHERE is_deleted = 0`
  );

  const [[trend]] = await pool.query<ClientTrendRow[]>(
    `SELECT
       SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS newClients30d
     FROM clients
     WHERE is_deleted = 0`
  );

  const maxRows = Math.min(Math.max(limit, 1), 10);
  const [topRows] = await pool.query<TopOutstandingRow[]>(
    `SELECT id, display_name, status, outstanding_amount
     FROM clients
     WHERE is_deleted = 0
     ORDER BY outstanding_amount DESC
     LIMIT ?`,
    [maxRows]
  );

  return {
    totalClients: Number(summary?.totalClients ?? 0),
    activeClients: Number(summary?.activeClients ?? 0),
    inactiveClients: Number(summary?.inactiveClients ?? 0),
    blacklistedClients: Number(summary?.blacklistedClients ?? 0),
    newClients30d: Number(trend?.newClients30d ?? 0),
    totalCredit: Number(summary?.totalCredit ?? 0),
    outstanding: Number(summary?.outstanding ?? 0),
    topOutstandingClients: topRows.map((row) => ({
      id: row.id,
      displayName: row.display_name || '未命名客户',
      status: row.status,
      outstandingAmount: Number(row.outstanding_amount ?? 0),
    })),
  };
}

async function fetchContactsByClientId(clientId: string, connection?: PoolConnection): Promise<ClientContact[]> {
  const executor = connection ?? pool;
  const [rows] = await executor.query<ClientContactRow[]>(
    'SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, created_at ASC',
    [clientId]
  );
  return rows.map(mapClientContact);
}

async function replaceContacts(connection: PoolConnection, clientId: string, contacts: ClientContactInput[]): Promise<void> {
  await connection.query('DELETE FROM client_contacts WHERE client_id = ?', [clientId]);
  if (!contacts.length) return;
  const placeholders = contacts.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
  const values = contacts.flatMap((contact) => [
    randomUUID(),
    clientId,
    contact.name,
    contact.role ?? null,
    contact.mobile ?? null,
    contact.email ?? null,
    contact.isPrimary ? 1 : 0,
  ]);
  await connection.query(
    `INSERT INTO client_contacts (id, client_id, name, role, mobile, email, is_primary) VALUES ${placeholders}`,
    values
  );
}
