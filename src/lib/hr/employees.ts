import { randomUUID } from 'crypto';

import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';
import { normalizeDateInput, formatDateTimeLocal } from '@/lib/dates';
import { hashPassword } from '@/lib/auth/password';
import { invalidateSessionsForUser } from '@/lib/auth/session';
import type { UserRole } from '@/types/user';

import { ensureHrSchema } from './schema';
export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';
export type EmployeeGender = 'male' | 'female' | 'other';

const EMPLOYEE_GENDER_LABELS: Record<EmployeeGender, string> = {
  male: '男',
  female: '女',
  other: '其他',
};

export type EmployeeRecord = {
  id: string;
  userId: string | null;
  userRoles: UserRole[];
  userPrimaryRole: UserRole | null;
  employeeCode: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  gender: EmployeeGender | null;
  address: string | null;
  employmentStatus: EmploymentStatus;
  hireDate: string | null;
  terminationDate: string | null;
  location: string | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeStatusLogRecord = {
  id: string;
  employeeId: string;
  previousStatus: EmploymentStatus;
  nextStatus: EmploymentStatus;
  note: string | null;
  actorId: string | null;
  createdAt: string;
};

export type EmployeeDashboardStats = {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  terminatedEmployees: number;
  newHires30d: number;
  departures30d: number;
  recentChanges: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    previousStatus: EmploymentStatus;
    nextStatus: EmploymentStatus;
    note: string | null;
    createdAt: string;
  }>;
};

const pool = mysqlPool();

const EMPLOYEE_CODE_PREFIX = 'y';
const EMPLOYEE_CODE_PAD_LENGTH = 3;
const EMPLOYEE_CODE_REGEXP = `^${EMPLOYEE_CODE_PREFIX}[0-9]+$`;

const BASE_EMPLOYEE_SELECT = `
  SELECT
    he.id,
    he.roles,
    he.primary_role,
    he.password_hash,
    he.employee_code,
    he.display_name,
    he.email,
    he.phone,
    he.gender,
    he.address,
    he.employment_status,
    he.hire_date,
    he.termination_date,
    he.location,
    he.custom_fields,
    he.created_at,
    he.updated_at
  FROM hr_employees he
`;

type EmployeeFilterOptions = Pick<
  ListEmployeesParams,
  'search' | 'status'
>;

type MatchField = 'id' | 'employeeCode' | 'email';

type RawEmployeeRow = RowDataPacket & {
  id: string;
  roles: unknown;
  primary_role: string | null;
  password_hash: string | null;
  employee_code: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  address: string | null;
  employment_status: EmploymentStatus;
  hire_date: string | null;
  termination_date: string | null;
  location: string | null;
  custom_fields: unknown;
  created_at: string;
  updated_at: string;
};

type RawStatusLogRow = RowDataPacket & {
  id: string;
  employee_id: string;
  previous_status: EmploymentStatus;
  next_status: EmploymentStatus;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

type EmployeeSummaryRow = RowDataPacket & {
  totalEmployees: number | null;
  activeEmployees: number | null;
  onLeaveEmployees: number | null;
  terminatedEmployees: number | null;
  newHires30d: number | null;
  departures30d: number | null;
};

type RecentChangeRow = RowDataPacket & {
  id: string;
  employee_id: string;
  display_name: string | null;
  previous_status: EmploymentStatus;
  next_status: EmploymentStatus;
  note: string | null;
  created_at: string | Date;
};

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn('Failed to parse hr_employees.custom_fields JSON', error);
    }
  }
  return {};
}

function parseUserRoles(value: unknown): UserRole[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((role): role is UserRole => typeof role === 'string') as UserRole[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((role): role is UserRole => typeof role === 'string') as UserRole[];
      }
    } catch (error) {
      console.warn('Failed to parse employee.user_roles JSON', error);
    }
  }
  if (typeof value === 'object' && value) {
    try {
      const parsed = JSON.parse(JSON.stringify(value));
      if (Array.isArray(parsed)) {
        return parsed.filter((role): role is UserRole => typeof role === 'string') as UserRole[];
      }
    } catch (error) {
      console.warn('Failed to coerce employee.user_roles object', error);
    }
  }
  return [];
}

function mapEmployee(row: RawEmployeeRow | undefined): EmployeeRecord | null {
  if (!row) return null;
  const hireDate = row.hire_date ? formatDateTimeLocal(row.hire_date) ?? row.hire_date : null;
  const terminationDate = row.termination_date ? formatDateTimeLocal(row.termination_date) ?? row.termination_date : null;
  const createdAt = formatDateTimeLocal(row.created_at) ?? row.created_at;
  const updatedAt = formatDateTimeLocal(row.updated_at) ?? row.updated_at;
  const parsedRoles = parseUserRoles(row.roles);
  const primaryRole = row.primary_role && typeof row.primary_role === 'string'
    ? (row.primary_role as UserRole)
    : null;
  const hasLoginAccount = Boolean(row.password_hash);
  return {
    id: row.id,
    userId: hasLoginAccount ? row.id : null,
    userRoles: parsedRoles,
    userPrimaryRole: primaryRole,
    employeeCode: row.employee_code,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    gender: normalizeGenderValue(row.gender),
    address: row.address,
    employmentStatus: row.employment_status,
    hireDate,
    terminationDate,
    location: row.location,
    customFields: parseJsonObject(row.custom_fields),
    createdAt,
    updatedAt,
  };
}

function mapStatusLog(row: RawStatusLogRow): EmployeeStatusLogRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    previousStatus: row.previous_status,
    nextStatus: row.next_status,
    note: row.note,
    actorId: row.actor_id,
    createdAt: formatDateTimeLocal(row.created_at) ?? row.created_at,
  };
}

function sanitizeNullableText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function sanitizeDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (!trimmed) return null;
  return normalizeDateInput(trimmed, { errorCode: 'INVALID_DATE_FORMAT' });
}

function sanitizeStatus(value: string | null | undefined): EmploymentStatus {
  if (!value) return 'active';
  if (value === 'active' || value === 'on_leave' || value === 'terminated') {
    return value;
  }
  throw new Error('INVALID_STATUS');
}

function normalizeGenderValue(value: string | null | undefined): EmployeeGender | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'male' || normalized === 'm' || normalized === 'man' || normalized === 'boy' || normalized === '男') {
    return 'male';
  }
  if (normalized === 'female' || normalized === 'f' || normalized === 'woman' || normalized === 'girl' || normalized === '女') {
    return 'female';
  }
  if (normalized === 'other' || normalized === 'o' || normalized === 'x' || normalized === '未知' || normalized === '其他' || normalized === '保密') {
    return 'other';
  }
  return null;
}

function formatEmployeeCode(counter: number): string {
  return `${EMPLOYEE_CODE_PREFIX}${String(counter).padStart(EMPLOYEE_CODE_PAD_LENGTH, '0')}`;
}

async function findLargestSequentialEmployeeCode(): Promise<number> {
  const [rows] = await pool.query<Array<RowDataPacket & { code: string | null }>>(
    `SELECT employee_code AS code
     FROM hr_employees
     WHERE employee_code REGEXP ?
     ORDER BY LENGTH(employee_code) DESC, employee_code DESC
     LIMIT 1`,
    [EMPLOYEE_CODE_REGEXP]
  );
  const rawCode = sanitizeNullableText(rows[0]?.code ?? null);
  if (!rawCode) {
    return 0;
  }
  const numericPart = Number.parseInt(rawCode.slice(EMPLOYEE_CODE_PREFIX.length), 10);
  return Number.isNaN(numericPart) ? 0 : numericPart;
}

async function employeeCodeExists(candidate: string): Promise<boolean> {
  const [rows] = await pool.query<Array<RowDataPacket & { hit: number }>>(
    'SELECT 1 AS hit FROM hr_employees WHERE employee_code = ? LIMIT 1',
    [candidate]
  );
  return Boolean(rows[0]);
}

async function generateSequentialEmployeeCode(): Promise<string> {
  let counter = (await findLargestSequentialEmployeeCode()) + 1;
  if (counter < 1) {
    counter = 1;
  }
  // In the unlikely event of duplicates (e.g., concurrent inserts), keep moving forward until a free slot is found.
  while (true) {
    const candidate = formatEmployeeCode(counter);
    if (!(await employeeCodeExists(candidate))) {
      return candidate;
    }
    counter += 1;
  }
}

async function ensureEmployeeCodeValue(employeeId: string, existingCode: string | null): Promise<string> {
  const trimmed = sanitizeNullableText(existingCode ?? null);
  if (trimmed) {
    return trimmed;
  }
  const generated = await generateSequentialEmployeeCode();
  await pool.query<ResultSetHeader>(
    'UPDATE hr_employees SET employee_code = ?, updated_at = NOW() WHERE id = ?',
    [generated, employeeId]
  );
  return generated;
}

async function insertStatusLog(params: {
  employeeId: string;
  previousStatus: EmploymentStatus;
  nextStatus: EmploymentStatus;
  actorId?: string | null;
  note?: string | null;
}) {
  const { employeeId, previousStatus, nextStatus, actorId = null, note = null } = params;
  const sanitizedNote = sanitizeNullableText(note ?? null);

  await mysqlQuery`
    INSERT INTO hr_employee_status_logs (
      id,
      employee_id,
      previous_status,
      next_status,
      note,
      actor_id,
      created_at
    )
    VALUES (
      ${randomUUID()},
      ${employeeId},
      ${previousStatus},
      ${nextStatus},
      ${sanitizedNote},
      ${sanitizeNullableText(actorId ?? null)},
      NOW()
    )
  `;
}

export type ListEmployeesParams = {
  search?: string;
  status?: EmploymentStatus | 'all' | null;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'displayName' | 'status';
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
  displayName: 'display_name',
  status: 'employment_status',
};

function buildEmployeeWhereClause(filters: EmployeeFilterOptions = {}) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.search) {
    const search = `%${filters.search.trim().toLowerCase()}%`;
    const searchCondition = [
      'LOWER(he.display_name) LIKE ?',
      'LOWER(he.email) LIKE ?',
    ].join(' OR ');
    conditions.push(`(${searchCondition})`);
    values.push(search, search);
  }

  if (filters.status && filters.status !== 'all') {
    const normalizedStatus = sanitizeStatus(filters.status);
    conditions.push('he.employment_status = ?');
    values.push(normalizedStatus);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values };
}

function resolveSort(sortBy?: ListEmployeesParams['sortBy'], sortOrder?: ListEmployeesParams['sortOrder']) {
  const fallbackKey: NonNullable<ListEmployeesParams['sortBy']> = 'updatedAt';
  const key = sortBy && SORT_COLUMN_MAP[sortBy] ? sortBy : fallbackKey;
  const column = SORT_COLUMN_MAP[key];
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  return { column, direction };
}

export async function listEmployees(params: ListEmployeesParams = {}): Promise<ListEmployeesResult> {
  await ensureHrSchema();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const { column, direction } = resolveSort(params.sortBy, params.sortOrder);
  const { whereClause, values } = buildEmployeeWhereClause(params);
  const whereSql = whereClause ? ` ${whereClause}` : '';
  const orderClause = `ORDER BY he.${column} ${direction}, he.id ASC`;
  const dataValues = [...values, pageSize, (page - 1) * pageSize];

  const [dataResult, countResult] = await Promise.all([
    pool.query<RawEmployeeRow[]>(
      `${BASE_EMPLOYEE_SELECT}${whereSql} ${orderClause} LIMIT ? OFFSET ?`,
      dataValues
    ),
    pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM hr_employees he${whereSql}`,
      values
    ),
  ]);

  const rows = dataResult[0] ?? [];
  const total = countResult[0]?.[0]?.total ?? 0;

  return {
    items: rows.map((row) => mapEmployee(row)!).filter(Boolean),
    total: Number(total),
    page,
    pageSize,
  };
}

export type ExportEmployeesParams = Omit<ListEmployeesParams, 'page' | 'pageSize'>;

export async function exportEmployees(params: ExportEmployeesParams = {}): Promise<EmployeeRecord[]> {
  await ensureHrSchema();
  const { whereClause, values } = buildEmployeeWhereClause(params);
  const { column, direction } = resolveSort(params.sortBy, params.sortOrder);
  const whereSql = whereClause ? ` ${whereClause}` : '';
  const orderClause = `ORDER BY he.${column} ${direction}, he.id ASC`;
  const [rows] = await pool.query<RawEmployeeRow[]>(`${BASE_EMPLOYEE_SELECT}${whereSql} ${orderClause}`, values);
  return rows.map((row) => mapEmployee(row)!).filter((record): record is EmployeeRecord => Boolean(record));
}

type EmployeeExportColumn = {
  key: keyof EmployeeRecord;
  header: string;
  transform?: (value: EmployeeRecord[keyof EmployeeRecord], record: EmployeeRecord) => string | number | null;
};

const EMPLOYEE_EXPORT_COLUMNS: EmployeeExportColumn[] = [
  { key: 'id', header: '员工ID' },
  { key: 'employeeCode', header: '员工编号' },
  { key: 'displayName', header: '姓名' },
  { key: 'email', header: '邮箱' },
  { key: 'phone', header: '电话' },
  {
    key: 'gender',
    header: '性别',
    transform: (value) => (value ? EMPLOYEE_GENDER_LABELS[value as EmployeeGender] ?? (value as string) : ''),
  },
  { key: 'address', header: '住址' },
  { key: 'employmentStatus', header: '员工状态' },
  {
    key: 'hireDate',
    header: '入职日期',
    transform: (value) => (value ? formatDateTimeLocal(value as string) ?? (value as string) : ''),
  },
  {
    key: 'terminationDate',
    header: '离职日期',
    transform: (value) => (value ? formatDateTimeLocal(value as string) ?? (value as string) : ''),
  },
  { key: 'location', header: '工作地点' },
  { key: 'userId', header: '用户ID' },
  {
    key: 'createdAt',
    header: '创建时间',
    transform: (value) => (value ? formatDateTimeLocal(value as string) ?? (value as string) : ''),
  },
  {
    key: 'updatedAt',
    header: '更新时间',
    transform: (value) => (value ? formatDateTimeLocal(value as string) ?? (value as string) : ''),
  },
  {
    key: 'customFields',
    header: '自定义字段',
    transform: (value) => {
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return '';
    },
  },
];

function formatCsvCell(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  if (text === '') return '';
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function employeesToCsv(records: EmployeeRecord[]): string {
  const header = EMPLOYEE_EXPORT_COLUMNS.map((column) => column.header).join(',');
  const rows = records.map((record) =>
    EMPLOYEE_EXPORT_COLUMNS.map((column) => {
      const rawValue = column.transform ? column.transform(record[column.key], record) : record[column.key];
      return formatCsvCell(rawValue);
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

export type CreateEmployeeInput = {
  employeeCode?: string | null;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  initialPassword?: string | null;
  gender?: EmployeeGender | null;
  address?: string | null;
  employmentStatus?: EmploymentStatus;
  hireDate?: string | null;
  terminationDate?: string | null;
  location?: string | null;
  customFields?: Record<string, unknown> | null;
  roles?: UserRole[];
  primaryRole?: UserRole;
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

  if (input.email) {
    const existingEmailId = await findEmployeeIdByEmail(input.email);
    if (existingEmailId) {
      throw new Error('EMAIL_EXISTS');
    }
  }

  if (input.phone) {
    const existingPhoneId = await findEmployeeIdByPhone(input.phone);
    if (existingPhoneId) {
      throw new Error('PHONE_EXISTS');
    }
  }

  if (input.employeeCode) {
    const existingCodeId = await findEmployeeIdByCode(input.employeeCode);
    if (existingCodeId) {
      throw new Error('EMPLOYEE_CODE_EXISTS');
    }
  }

  const id = randomUUID();
  const password = sanitizeNullableText(input.initialPassword ?? null);
  const passwordHash = password ? await hashPassword(password) : null;
  if (!passwordHash) {
    throw new Error('MISSING_PASSWORD');
  }
  const payload = {
    employeeCode: sanitizeNullableText(input.employeeCode ?? null),
    displayName: requireText(input.displayName, 'display_name'),
    email: sanitizeNullableText(input.email ?? null),
    phone: sanitizeNullableText(input.phone ?? null),
    gender: normalizeGenderValue(input.gender ?? null),
    address: sanitizeNullableText(input.address ?? null),
    employmentStatus: sanitizeStatus(input.employmentStatus ?? 'active'),
    hireDate: sanitizeDate(input.hireDate ?? null),
    terminationDate: sanitizeDate(input.terminationDate ?? null),
    location: sanitizeNullableText(input.location ?? null),
    customFields: input.customFields && typeof input.customFields === 'object' ? input.customFields : {},
    roles: input.roles ?? ['employee'],
    primaryRole: input.primaryRole ?? (input.roles?.[0] || 'employee'),
  };

  if (!payload.employeeCode) {
    payload.employeeCode = await generateSequentialEmployeeCode();
  }

  await mysqlQuery`
    INSERT INTO hr_employees (
      id,
      employee_code,
      display_name,
      email,
      phone,
      password_hash,
      gender,
      address,
      employment_status,
      hire_date,
      termination_date,
      location,
      custom_fields,
      roles,
      primary_role,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${payload.employeeCode},
      ${payload.displayName},
      ${payload.email},
      ${payload.phone},
      ${passwordHash},
      ${payload.gender},
      ${payload.address},
      ${payload.employmentStatus},
      ${payload.hireDate},
      ${payload.terminationDate},
      ${payload.location},
      ${JSON.stringify(payload.customFields)},
      ${JSON.stringify(payload.roles)},
      ${payload.primaryRole},
      NOW(),
      NOW()
    )
  `;

  return (await getEmployeeById(id))!;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  employmentStatus?: EmploymentStatus;
  statusChangeNote?: string | null;
  roles?: UserRole[];
  primaryRole?: UserRole;
};

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord | null> {
  await ensureHrSchema();

  if (input.email) {
    const existingEmailId = await findEmployeeIdByEmail(input.email);
    if (existingEmailId && existingEmailId !== id) {
      throw new Error('EMAIL_EXISTS');
    }
  }

  if (input.phone) {
    const existingPhoneId = await findEmployeeIdByPhone(input.phone);
    if (existingPhoneId && existingPhoneId !== id) {
      throw new Error('PHONE_EXISTS');
    }
  }

  if (input.employeeCode) {
    const existingCodeId = await findEmployeeIdByCode(input.employeeCode);
    if (existingCodeId && existingCodeId !== id) {
      throw new Error('EMPLOYEE_CODE_EXISTS');
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let pendingStatusLog: { previous: EmploymentStatus; next: EmploymentStatus; note?: string | null } | null = null;
  let shouldInvalidateSessions = false;

  const pushField = (column: string, value: unknown) => {
    fields.push(`${column} = ?`);
    values.push(value);
  };

  if (input.employeeCode !== undefined) {
    pushField('employee_code', sanitizeNullableText(input.employeeCode ?? null));
  }
  if (input.displayName !== undefined) {
    const displayName = requireText(input.displayName, 'display_name');
    pushField('display_name', displayName);
  }
  if (input.email !== undefined) {
    pushField('email', sanitizeNullableText(input.email ?? null));
  }
  if (input.phone !== undefined) {
    pushField('phone', sanitizeNullableText(input.phone ?? null));
  }
  if (input.gender !== undefined) {
    pushField('gender', normalizeGenderValue(input.gender ?? null));
  }
  if (input.address !== undefined) {
    pushField('address', sanitizeNullableText(input.address ?? null));
  }

  if (input.employmentStatus !== undefined) {
    const normalizedStatus = sanitizeStatus(input.employmentStatus);
    const [statusRows] = await pool.query<Array<RowDataPacket & { employment_status: EmploymentStatus }>>(
      'SELECT employment_status FROM hr_employees WHERE id = ? LIMIT 1',
      [id]
    );
    const currentStatus = statusRows[0]?.employment_status;
    if (!currentStatus) {
      return null;
    }
    if (currentStatus !== normalizedStatus) {
      pendingStatusLog = {
        previous: currentStatus,
        next: normalizedStatus,
        note: sanitizeNullableText(input.statusChangeNote ?? null),
      };
    }
    pushField('employment_status', normalizedStatus);
    if (normalizedStatus === 'terminated') {
      pushField('is_active', 0);
      shouldInvalidateSessions = true;
    }
    if (normalizedStatus === 'active') {
      pushField('is_active', 1);
    }
  }
  if (input.hireDate !== undefined) {
    pushField('hire_date', sanitizeDate(input.hireDate ?? null));
  }
  if (input.terminationDate !== undefined) {
    pushField('termination_date', sanitizeDate(input.terminationDate ?? null));
  }
  if (input.location !== undefined) {
    pushField('location', sanitizeNullableText(input.location ?? null));
  }
  if (input.customFields !== undefined) {
    const normalized = input.customFields && typeof input.customFields === 'object' ? input.customFields : {};
    pushField('custom_fields', JSON.stringify(normalized));
  }
  if (input.roles !== undefined) {
    pushField('roles', JSON.stringify(input.roles));
  }
  if (input.primaryRole !== undefined) {
    pushField('primary_role', input.primaryRole);
  }

  if (!fields.length) {
    return getEmployeeById(id);
  }

  fields.push('updated_at = NOW()');
  values.push(id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE hr_employees SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    return null;
  }

  if (pendingStatusLog) {
    await insertStatusLog({
      employeeId: id,
      previousStatus: pendingStatusLog.previous,
      nextStatus: pendingStatusLog.next,
      note: pendingStatusLog.note,
    });
  }

  if (shouldInvalidateSessions) {
    await invalidateSessionsForUser(id);
  }

  return getEmployeeById(id);
}

export async function deleteEmployee(id: string): Promise<void> {
  await ensureHrSchema();
  await mysqlQuery`DELETE FROM hr_employees WHERE id = ${id}`;
}

export async function getEmployeeById(id: string): Promise<EmployeeRecord | null> {
  await ensureHrSchema();
  const [rows] = await pool.query<RawEmployeeRow[]>(
    `${BASE_EMPLOYEE_SELECT}
    WHERE he.id = ?
    LIMIT 1`,
    [id]
  );
  return mapEmployee(rows[0]);
}

export async function getEmployeeByUserId(userId: string): Promise<EmployeeRecord | null> {
  // Legacy helper maintained for compatibility with modules that still reference
  // "user" records. Since hr_employees is now the canonical user table, this
  // simply resolves by employee ID.
  return getEmployeeById(userId);
}

export async function ensureEmployeeUserAccount(employeeId: string) {
  const employee = await getEmployeeById(employeeId);
  if (!employee) {
    throw new Error('EMPLOYEE_NOT_FOUND');
  }

  const ensuredEmployeeCode = await ensureEmployeeCodeValue(employee.id, employee.employeeCode);
  const loginAccount = ensuredEmployeeCode || employee.email || employee.id;
  if (!loginAccount) {
    throw new Error('EMPLOYEE_LOGIN_ID_MISSING');
  }

  const normalizedAccount = loginAccount.trim();
  const fallbackEmail = normalizedAccount.includes('@')
    ? normalizedAccount.toLowerCase()
    : `${normalizedAccount.toLowerCase()}@staff.local`;
  const employeeDisplayName = employee.displayName?.trim() || normalizedAccount;

  const roles = employee.userRoles.length ? employee.userRoles : ['employee'];
  const primaryRole = employee.userPrimaryRole ?? roles[0];
  const passwordHash = await hashPassword(normalizedAccount);

  const fields: string[] = [
    'roles = ?',
    'primary_role = ?',
    'is_active = 1',
    'failed_login_attempts = 0',
    'locked_until = NULL',
    'updated_at = NOW()',
  ];
  const values: unknown[] = [JSON.stringify(roles), primaryRole];

  if (!employee.email || !employee.email.trim()) {
    fields.push('email = ?');
    values.push(fallbackEmail);
    fields.push('email_verified = 0');
  }

  if (!employee.displayName || !employee.displayName.trim()) {
    fields.push('display_name = ?');
    values.push(employeeDisplayName);
  }

  if (!employee.employeeCode || !employee.employeeCode.trim()) {
    fields.push('employee_code = ?');
    values.push(normalizedAccount);
  }

  fields.push('password_hash = ?');
  values.push(passwordHash);
  fields.push('password_updated_at = NOW()');

  await pool.query<ResultSetHeader>(
    `UPDATE hr_employees SET ${fields.join(', ')} WHERE id = ?`,
    [...values, employeeId]
  );

  return {
    userId: employee.id,
    loginAccount: normalizedAccount,
    initialPassword: normalizedAccount,
  };
}

export async function setEmployeeStatus(id: string, status: EmploymentStatus): Promise<EmployeeRecord | null> {
  return updateEmployee(id, { employmentStatus: status });
}

export async function listEmployeeStatusLogs(employeeId: string, limit = 20): Promise<EmployeeStatusLogRecord[]> {
  await ensureHrSchema();
  const normalizedLimit = Math.min(Math.max(limit, 1), 100);
  const [rows] = await pool.query<RawStatusLogRow[]>(
    `SELECT id, employee_id, previous_status, next_status, note, actor_id, created_at
     FROM hr_employee_status_logs
     WHERE employee_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [employeeId, normalizedLimit]
  );
  return rows.map((row) => mapStatusLog(row));
}

export type BulkEmployeeImportRow = Partial<CreateEmployeeInput> & {
  id?: string | null;
  matchBy?: MatchField[];
  statusChangeNote?: string | null;
};

export type BulkEmployeeImportOptions = {
  upsert?: boolean;
  matchBy?: MatchField[];
  defaultStatus?: EmploymentStatus;
  defaultInitialPassword?: string;
  useEmployeeCodeAsPassword?: boolean;
  stopOnError?: boolean;
};

export type BulkEmployeeImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; message: string; identifier?: string | null }>;
};

export async function importEmployeesFromPayload(
  rows: BulkEmployeeImportRow[],
  options: BulkEmployeeImportOptions = {}
): Promise<BulkEmployeeImportResult> {
  await ensureHrSchema();

  if (!Array.isArray(rows)) {
    throw new Error('IMPORT_PAYLOAD_INVALID');
  }

  if (rows.length > 500) {
    throw new Error('IMPORT_TOO_MANY_ROWS');
  }

  const stats: BulkEmployeeImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const defaultMatchOrder = resolveMatchOrder(options.matchBy);

  for (const [index, row] of rows.entries()) {
    try {
      const matchOrder = resolveMatchOrder(row.matchBy?.length ? row.matchBy : undefined, defaultMatchOrder);
      const normalizedInput = await normalizeBulkImportRow(row, options);
      const existingId = await resolveExistingEmployeeId(row, matchOrder);

      if (existingId) {
        await updateEmployee(existingId, { ...normalizedInput, statusChangeNote: row.statusChangeNote ?? null });
        stats.updated += 1;
        continue;
      }

      if (options.upsert === false) {
        stats.skipped += 1;
        continue;
      }

      await createEmployee(normalizedInput);
      stats.created += 1;
    } catch (error) {
      let message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      if (message === 'MISSING_PASSWORD') {
        message = '缺少初始密码';
      }
      if (message === 'EMAIL_EXISTS') {
        message = '邮箱已存在';
      }
      if (message === 'PHONE_EXISTS') {
        message = '手机号已存在';
      }
      if (message === 'EMPLOYEE_CODE_EXISTS') {
        message = '员工编号已存在';
      }
      const identifier = row.employeeCode ?? row.email ?? row.id ?? null;
      stats.errors.push({ index, message, identifier });
      if (options.stopOnError) {
        break;
      }
    }
  }

  return stats;
}

export async function getEmployeeDashboardStats(limit = 6): Promise<EmployeeDashboardStats> {
  await ensureHrSchema();

  const [[summary]] = await pool.query<EmployeeSummaryRow[]>(
    `SELECT
       COUNT(*) AS totalEmployees,
       SUM(CASE WHEN employment_status = 'active' THEN 1 ELSE 0 END) AS activeEmployees,
       SUM(CASE WHEN employment_status = 'on_leave' THEN 1 ELSE 0 END) AS onLeaveEmployees,
       SUM(CASE WHEN employment_status = 'terminated' THEN 1 ELSE 0 END) AS terminatedEmployees,
       SUM(CASE WHEN hire_date IS NOT NULL AND hire_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS newHires30d,
       SUM(CASE WHEN termination_date IS NOT NULL AND termination_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS departures30d
     FROM hr_employees`
  );

  const maxChanges = Math.min(Math.max(limit, 1), 20);
  const [changeRows] = await pool.query<RecentChangeRow[]>(
    `SELECT
       l.id,
       l.employee_id,
       he.display_name,
       l.previous_status,
       l.next_status,
       l.note,
       l.created_at
     FROM hr_employee_status_logs l
     LEFT JOIN hr_employees he ON he.id = l.employee_id
     ORDER BY l.created_at DESC
     LIMIT ?`,
    [maxChanges]
  );

  const toIsoString = (value: string | Date): string => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  };

  return {
    totalEmployees: Number(summary?.totalEmployees ?? 0),
    activeEmployees: Number(summary?.activeEmployees ?? 0),
    onLeaveEmployees: Number(summary?.onLeaveEmployees ?? 0),
    terminatedEmployees: Number(summary?.terminatedEmployees ?? 0),
    newHires30d: Number(summary?.newHires30d ?? 0),
    departures30d: Number(summary?.departures30d ?? 0),
    recentChanges: changeRows.map((row) => {
      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: row.display_name?.trim() || '未命名员工',
        previousStatus: row.previous_status,
        nextStatus: row.next_status,
        note: row.note ?? null,
        createdAt: toIsoString(row.created_at),
      };
    }),
  };
}

function resolveMatchOrder(
  input?: MatchField[] | null,
  fallback?: MatchField[]
): MatchField[] {
  const normalized = normalizeMatchFields(input);
  if (normalized.length > 0) {
    return normalized;
  }
  if (fallback && fallback.length > 0) {
    return fallback;
  }
  return ['id', 'employeeCode', 'email'];
}

function normalizeMatchFields(matchBy?: MatchField[] | null): MatchField[] {
  if (!matchBy) return [];
  return matchBy.filter((value): value is MatchField => value === 'id' || value === 'employeeCode' || value === 'email');
}

async function resolveExistingEmployeeId(row: BulkEmployeeImportRow, matchOrder: MatchField[]): Promise<string | null> {
  for (const field of matchOrder) {
    if (field === 'id' && row.id) {
      const exists = await employeeExistsById(row.id);
      if (exists) {
        return row.id;
      }
    }
    if (field === 'employeeCode' && row.employeeCode) {
      const id = await findEmployeeIdByCode(row.employeeCode);
      if (id) {
        return id;
      }
    }
    if (field === 'email' && row.email) {
      const id = await findEmployeeIdByEmail(row.email);
      if (id) {
        return id;
      }
    }
  }
  return null;
}

async function employeeExistsById(id: string): Promise<boolean> {
  const [rows] = await pool.query<Array<RowDataPacket & { id: string }>>(
    'SELECT id FROM hr_employees WHERE id = ? LIMIT 1',
    [id]
  );
  return Boolean(rows[0]?.id);
}

async function findEmployeeIdByCode(code: string): Promise<string | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const [rows] = await pool.query<Array<RowDataPacket & { id: string }>>(
    'SELECT id FROM hr_employees WHERE employee_code = ? LIMIT 1',
    [trimmed]
  );
  return rows[0]?.id ?? null;
}

async function findEmployeeIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [rows] = await pool.query<Array<RowDataPacket & { id: string }>>(
    'SELECT id FROM hr_employees WHERE LOWER(email) = ? LIMIT 1',
    [normalized]
  );
  return rows[0]?.id ?? null;
}

async function findEmployeeIdByPhone(phone: string): Promise<string | null> {
  const normalized = phone.trim();
  if (!normalized) return null;
  const [rows] = await pool.query<Array<RowDataPacket & { id: string }>>(
    'SELECT id FROM hr_employees WHERE phone = ? LIMIT 1',
    [normalized]
  );
  return rows[0]?.id ?? null;
}

async function normalizeBulkImportRow(
  row: BulkEmployeeImportRow,
  options: BulkEmployeeImportOptions
): Promise<CreateEmployeeInput> {
  const resolvedDisplayName = sanitizeNullableText(row.displayName ?? null) ?? '未命名员工';

  const customFields =
    row.customFields && typeof row.customFields === 'object' && !Array.isArray(row.customFields)
      ? row.customFields
      : null;

  const resolvedPassword =
    row.initialPassword ??
    (options.useEmployeeCodeAsPassword ? row.employeeCode ?? null : null) ??
    options.defaultInitialPassword ??
    null;

  return {
    employeeCode: row.employeeCode ?? null,
    displayName: resolvedDisplayName,
    email: row.email ?? null,
    phone: row.phone ?? null,
    initialPassword: resolvedPassword,
    gender: normalizeGenderValue(row.gender ?? null),
    address: row.address ?? null,
    employmentStatus: row.employmentStatus ?? options.defaultStatus ?? 'active',
    hireDate: row.hireDate ?? null,
    terminationDate: row.terminationDate ?? null,
    location: row.location ?? null,
    customFields,
  };
}
