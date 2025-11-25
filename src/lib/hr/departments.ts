import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';

import { ensureHrSchema } from './schema';
import type { DepartmentRecord } from './types';

const pool = mysqlPool();

type RawDepartmentRow = RowDataPacket & {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function mapDepartment(row?: RawDepartmentRow): DepartmentRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    parentId: row.parent_id,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('DEPARTMENT_NAME_REQUIRED');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('DEPARTMENT_NAME_REQUIRED');
  }
  return trimmed;
}

function sanitizeOptionalText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function sanitizeCode(value: unknown): string | null {
  const text = sanitizeOptionalText(value);
  if (!text) return null;
  return text.toUpperCase();
}

function sanitizeParentId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeSortOrder(value: unknown): number {
  if (value == null) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.round(num);
}

async function assertUniqueCode(code: string | null, excludeId?: string) {
  if (!code) return;
  const params: unknown[] = [code];
  let sql = 'SELECT id FROM hr_departments WHERE code = ? LIMIT 1';
  if (excludeId) {
    sql = 'SELECT id FROM hr_departments WHERE code = ? AND id <> ? LIMIT 1';
    params.push(excludeId);
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  if (rows.length > 0) {
    throw new Error('DEPARTMENT_CODE_CONFLICT');
  }
}

async function ensureParentChainValid(targetId: string | null, parentId: string | null) {
  if (!parentId) return;
  if (targetId && parentId === targetId) {
    throw new Error('DEPARTMENT_PARENT_SELF');
  }
  let cursor: string | null = parentId;
  while (cursor) {
    if (targetId && cursor === targetId) {
      throw new Error('DEPARTMENT_PARENT_CYCLE');
    }
    const parent = await getDepartmentById(cursor);
    if (!parent) {
      throw new Error('DEPARTMENT_PARENT_NOT_FOUND');
    }
    cursor = parent.parentId;
  }
}

export async function getDepartmentById(id: string): Promise<DepartmentRecord | null> {
  await ensureHrSchema();
  const [rows] = await pool.query<RawDepartmentRow[]>(
    `SELECT id, name, code, parent_id, description, sort_order, created_at, updated_at
     FROM hr_departments
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return mapDepartment(rows[0]);
}

export async function listDepartments(): Promise<DepartmentRecord[]> {
  await ensureHrSchema();
  const [rows] = await pool.query<RawDepartmentRow[]>(
    `SELECT id, name, code, parent_id, description, sort_order, created_at, updated_at
     FROM hr_departments
     ORDER BY sort_order ASC, name ASC`
  );
  return rows
    .map((row) => mapDepartment(row))
    .filter((dept): dept is DepartmentRecord => Boolean(dept));
}

export async function listDepartmentOptions(): Promise<Array<Pick<DepartmentRecord, 'id' | 'name' | 'code' | 'parentId'>>> {
  const departments = await listDepartments();
  return departments.map((dept) => ({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    parentId: dept.parentId,
  }));
}

export type CreateDepartmentInput = {
  name: string;
  code?: string | null;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number | null;
};

export async function createDepartment(input: CreateDepartmentInput): Promise<DepartmentRecord> {
  await ensureHrSchema();
  const id = randomUUID();
  const name = sanitizeName(input.name);
  const code = sanitizeCode(input.code);
  const parentId = sanitizeParentId(input.parentId ?? null);
  const description = sanitizeOptionalText(input.description);
  const sortOrder = sanitizeSortOrder(input.sortOrder ?? 0);

  await ensureParentChainValid(id, parentId);
  await assertUniqueCode(code);

  await pool.query<ResultSetHeader>(
    `INSERT INTO hr_departments (id, name, code, parent_id, description, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, code, parentId, description, sortOrder]
  );

  const record = await getDepartmentById(id);
  if (!record) {
    throw new Error('DEPARTMENT_NOT_FOUND');
  }
  return record;
}

export type UpdateDepartmentInput = {
  name?: string;
  code?: string | null;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number | null;
};

export async function updateDepartment(id: string, input: UpdateDepartmentInput): Promise<DepartmentRecord> {
  await ensureHrSchema();
  const existing = await getDepartmentById(id);
  if (!existing) {
    throw new Error('DEPARTMENT_NOT_FOUND');
  }

  const assignments: string[] = [];
  const values: unknown[] = [];

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    const name = sanitizeName(input.name);
    assignments.push('name = ?');
    values.push(name);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'code')) {
    const code = sanitizeCode(input.code ?? null);
    await assertUniqueCode(code, id);
    assignments.push('code = ?');
    values.push(code);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'description')) {
    const description = sanitizeOptionalText(input.description);
    assignments.push('description = ?');
    values.push(description);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'sortOrder')) {
    const sortOrder = sanitizeSortOrder(input.sortOrder ?? 0);
    assignments.push('sort_order = ?');
    values.push(sortOrder);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'parentId')) {
    const parentId = sanitizeParentId(input.parentId ?? null);
    await ensureParentChainValid(id, parentId);
    assignments.push('parent_id = ?');
    values.push(parentId);
  }

  if (assignments.length === 0) {
    return existing;
  }

  values.push(id);
  await pool.query<ResultSetHeader>(`UPDATE hr_departments SET ${assignments.join(', ')} WHERE id = ?`, values);

  const record = await getDepartmentById(id);
  if (!record) {
    throw new Error('DEPARTMENT_NOT_FOUND');
  }
  return record;
}

export async function deleteDepartment(id: string): Promise<void> {
  await ensureHrSchema();
  const existing = await getDepartmentById(id);
  if (!existing) {
    throw new Error('DEPARTMENT_NOT_FOUND');
  }

  const employeeUsage = await mysqlQuery<RowDataPacket & { count: number }>`
    SELECT COUNT(*) AS count FROM hr_employees WHERE department_id = ${id}
  `;
  if (employeeUsage.rows[0]?.count > 0) {
    throw new Error('DEPARTMENT_IN_USE');
  }

  const childUsage = await mysqlQuery<RowDataPacket & { count: number }>`
    SELECT COUNT(*) AS count FROM hr_departments WHERE parent_id = ${id}
  `;
  if (childUsage.rows[0]?.count > 0) {
    throw new Error('DEPARTMENT_HAS_CHILDREN');
  }

  await pool.query<ResultSetHeader>('DELETE FROM hr_departments WHERE id = ?', [id]);
}
