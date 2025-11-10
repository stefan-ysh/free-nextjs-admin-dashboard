import { randomUUID } from 'crypto';

import { pool, sql } from '@/lib/postgres';

import { ensureHrSchema } from './schema';

export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';

export type EmployeeRecord = {
  id: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  employmentStatus: EmploymentStatus;
  hireDate: string | null;
  terminationDate: string | null;
  managerId: string | null;
  location: string | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type RawEmployeeRow = {
  id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  employment_status: EmploymentStatus;
  hire_date: string | null;
  termination_date: string | null;
  manager_id: string | null;
  location: string | null;
  custom_fields: unknown;
  created_at: string;
  updated_at: string;
};

function normalizeCustomFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function mapEmployee(row: RawEmployeeRow | undefined): EmployeeRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    employeeCode: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    jobTitle: row.job_title,
    employmentStatus: row.employment_status,
    hireDate: row.hire_date,
    terminationDate: row.termination_date,
    managerId: row.manager_id,
    location: row.location,
    customFields: normalizeCustomFields(row.custom_fields),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeNullableText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function sanitizeDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('INVALID_DATE_FORMAT');
  }
  return trimmed;
}

function sanitizeStatus(value: string | null | undefined): EmploymentStatus {
  if (!value) return 'active';
  if (value === 'active' || value === 'on_leave' || value === 'terminated') {
    return value;
  }
  throw new Error('INVALID_STATUS');
}

export type ListEmployeesParams = {
  search?: string;
  department?: string | null;
  status?: EmploymentStatus | 'all' | null;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastName' | 'department' | 'status';
  sortOrder?: 'asc' | 'desc';
};

export type ListEmployeesResult = {
  items: EmployeeRecord[];
  total: number;
  page: number;
  pageSize: number;
};

const SORT_COLUMN_MAP: Record<NonNullable<ListEmployeesParams['sortBy']>, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  lastName: 'last_name',
  department: 'department',
  status: 'employment_status',
};

export async function listEmployees(params: ListEmployeesParams = {}): Promise<ListEmployeesResult> {
  await ensureHrSchema();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const sortBy = params.sortBy ?? 'updatedAt';
  const sortColumn = SORT_COLUMN_MAP[sortBy];
  const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.search) {
    const fragmentIndex = values.length + 1;
    values.push(`%${params.search.trim()}%`);
    conditions.push(`(first_name ILIKE $${fragmentIndex} OR last_name ILIKE $${fragmentIndex} OR display_name ILIKE $${fragmentIndex} OR email ILIKE $${fragmentIndex})`);
  }

  if (params.department) {
    values.push(params.department.trim());
    conditions.push(`department = $${values.length}`);
  }

  if (params.status && params.status !== 'all') {
    const normalizedStatus = sanitizeStatus(params.status);
    values.push(normalizedStatus);
    conditions.push(`employment_status = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = `ORDER BY ${sortColumn} ${sortOrder}, id ASC`;
  const limitClause = `LIMIT $${values.length + 1}`;
  const offsetClause = `OFFSET $${values.length + 2}`;

  const dataValues = [...values, pageSize, (page - 1) * pageSize];

  const baseSelect = `
    SELECT
      id,
      employee_code,
      first_name,
      last_name,
      display_name,
      email,
      phone,
      department,
      job_title,
      employment_status,
      hire_date,
      termination_date,
      manager_id,
      location,
      custom_fields,
      created_at,
      updated_at
    FROM hr_employees
  `;

  const dataQuery = `${baseSelect} ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`;
  const countQuery = `SELECT COUNT(*)::int AS total FROM hr_employees ${whereClause}`;

  const [dataResult, countResult] = await Promise.all([
    pool.query<RawEmployeeRow>(dataQuery, dataValues),
    pool.query<{ total: number }>(countQuery, values),
  ]);

  return {
    items: dataResult.rows.map((row) => mapEmployee(row)!).filter(Boolean),
    total: countResult.rows[0]?.total ?? 0,
    page,
    pageSize,
  };
}

export type CreateEmployeeInput = {
  employeeCode?: string | null;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employmentStatus?: EmploymentStatus;
  hireDate?: string | null;
  terminationDate?: string | null;
  managerId?: string | null;
  location?: string | null;
  customFields?: Record<string, unknown> | null;
};

function requireText(value: string | null | undefined, field: string): string {
  const sanitized = sanitizeNullableText(value);
  if (!sanitized) {
    throw new Error(`MISSING_${field.toUpperCase()}`);
  }
  return sanitized;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeRecord> {
  await ensureHrSchema();

  const id = randomUUID();
  const payload = {
    employeeCode: sanitizeNullableText(input.employeeCode ?? null),
    firstName: requireText(input.firstName, 'first_name'),
    lastName: requireText(input.lastName, 'last_name'),
    displayName: sanitizeNullableText(input.displayName ?? null),
    email: sanitizeNullableText(input.email ?? null),
    phone: sanitizeNullableText(input.phone ?? null),
    department: sanitizeNullableText(input.department ?? null),
    jobTitle: sanitizeNullableText(input.jobTitle ?? null),
    employmentStatus: sanitizeStatus(input.employmentStatus ?? 'active'),
    hireDate: sanitizeDate(input.hireDate ?? null),
    terminationDate: sanitizeDate(input.terminationDate ?? null),
    managerId: sanitizeNullableText(input.managerId ?? null),
    location: sanitizeNullableText(input.location ?? null),
    customFields: input.customFields && typeof input.customFields === 'object' ? input.customFields : {},
  };

  const result = await sql<RawEmployeeRow>`
    INSERT INTO hr_employees (
      id,
      employee_code,
      first_name,
      last_name,
      display_name,
      email,
      phone,
      department,
      job_title,
      employment_status,
      hire_date,
      termination_date,
      manager_id,
      location,
      custom_fields
    )
    VALUES (
      ${id},
      ${payload.employeeCode},
      ${payload.firstName},
      ${payload.lastName},
      ${payload.displayName},
      ${payload.email},
      ${payload.phone},
      ${payload.department},
      ${payload.jobTitle},
      ${payload.employmentStatus},
      ${payload.hireDate},
      ${payload.terminationDate},
      ${payload.managerId},
      ${payload.location},
      ${JSON.stringify(payload.customFields)}::jsonb
    )
    RETURNING *
  `;

  return mapEmployee(result.rows[0])!;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  employmentStatus?: EmploymentStatus;
};

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord | null> {
  await ensureHrSchema();

  const fields: string[] = [];
  const values: unknown[] = [];

  const pushField = (column: string, value: unknown, cast?: string) => {
    values.push(value);
    const placeholder = `$${values.length}${cast ? `::${cast}` : ''}`;
    fields.push(`${column} = ${placeholder}`);
  };

  if (input.employeeCode !== undefined) {
    pushField('employee_code', sanitizeNullableText(input.employeeCode ?? null));
  }
  if (input.firstName !== undefined) {
    pushField('first_name', requireText(input.firstName, 'first_name'));
  }
  if (input.lastName !== undefined) {
    pushField('last_name', requireText(input.lastName, 'last_name'));
  }
  if (input.displayName !== undefined) {
    pushField('display_name', sanitizeNullableText(input.displayName ?? null));
  }
  if (input.email !== undefined) {
    pushField('email', sanitizeNullableText(input.email ?? null));
  }
  if (input.phone !== undefined) {
    pushField('phone', sanitizeNullableText(input.phone ?? null));
  }
  if (input.department !== undefined) {
    pushField('department', sanitizeNullableText(input.department ?? null));
  }
  if (input.jobTitle !== undefined) {
    pushField('job_title', sanitizeNullableText(input.jobTitle ?? null));
  }
  if (input.employmentStatus !== undefined) {
    pushField('employment_status', sanitizeStatus(input.employmentStatus));
  }
  if (input.hireDate !== undefined) {
    pushField('hire_date', sanitizeDate(input.hireDate ?? null));
  }
  if (input.terminationDate !== undefined) {
    pushField('termination_date', sanitizeDate(input.terminationDate ?? null));
  }
  if (input.managerId !== undefined) {
    pushField('manager_id', sanitizeNullableText(input.managerId ?? null));
  }
  if (input.location !== undefined) {
    pushField('location', sanitizeNullableText(input.location ?? null));
  }
  if (input.customFields !== undefined) {
    const normalized = input.customFields && typeof input.customFields === 'object' ? input.customFields : {};
    pushField('custom_fields', JSON.stringify(normalized), 'jsonb');
  }

  if (!fields.length) {
    const current = await sql<RawEmployeeRow>`SELECT * FROM hr_employees WHERE id = ${id} LIMIT 1`;
    return mapEmployee(current.rows[0]) ?? null;
  }

  values.push(id);
  const query = `
    UPDATE hr_employees
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING *
  `;

  const result = await pool.query<RawEmployeeRow>(query, values);
  return mapEmployee(result.rows[0]);
}

export async function deleteEmployee(id: string): Promise<void> {
  await ensureHrSchema();
  await sql`DELETE FROM hr_employees WHERE id = ${id}`;
}

export async function getEmployeeById(id: string): Promise<EmployeeRecord | null> {
  await ensureHrSchema();
  const result = await sql<RawEmployeeRow>`SELECT * FROM hr_employees WHERE id = ${id} LIMIT 1`;
  return mapEmployee(result.rows[0]);
}

export async function setEmployeeStatus(id: string, status: EmploymentStatus): Promise<EmployeeRecord | null> {
  return updateEmployee(id, { employmentStatus: status });
}
