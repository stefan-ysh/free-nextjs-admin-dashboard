import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { unstable_cache } from 'next/cache';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';
import { ensureHrSchema } from '@/lib/hr/schema';
import { ensureAuthSchema } from '@/lib/auth/schema';
import { hashPassword } from '@/lib/auth/password';
import { invalidateSessionsForUser } from '@/lib/auth/session';
import { findUserById as findAuthUserById } from '@/lib/auth/user';
import { mapAuthRole } from '@/lib/auth/roles';
import { revalidateTag } from 'next/cache';
import {
  UserRecord,
  UserProfile,
  UserRole,
  EmploymentStatus,
  CreateUserInput,
  UpdateUserProfileInput,
  UpdateEmployeeInfoInput,
  ListUsersParams,
  ListUsersResult,
  SocialLinks,
} from '@/types/user';

const pool = mysqlPool();

/**
 * 数据库行类型（snake_case）
 */
type RawUserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  roles: string | null;
  primary_role: string;
  display_name: string;
  phone: string | null;
  employee_code: string | null;
  department: string | null;
  job_title: string | null;
  employment_status: string | null;
  hire_date: string | null;
  termination_date: string | null;
  manager_id: string | null;
  location: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  tax_id: string | null;
  social_links: unknown;
  custom_fields: unknown;
  is_active: number;
  email_verified: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_login_at: string | null;
  password_updated_at: string | null;
};

/**
 * 映射数据库行到用户记录
 */
function parseJsonArray<T = string>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (error) {
      console.warn('Failed to parse JSON array column', error);
    }
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn('Failed to parse JSON object column', error);
    }
  }
  return {};
}

function buildDisplayName(row: RawUserRow): string {
  const candidates: Array<string | null | undefined> = [
    row.display_name,
    row.email,
    row.employee_code,
  ];

  for (const value of candidates) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return '未命名';
}

function mapUser(row: RawUserRow | undefined): UserRecord | null {
  if (!row) return null;
  const roles = parseJsonArray<UserRole>(row.roles);
  const displayName = buildDisplayName(row);

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    roles: roles.length ? roles : [UserRole.EMPLOYEE],
    primaryRole: row.primary_role as UserRole,
    displayName,
    phone: row.phone,
    employeeCode: row.employee_code,
    department: row.department,
    jobTitle: row.job_title,
    employmentStatus: row.employment_status as EmploymentStatus | null,
    hireDate: row.hire_date,
    terminationDate: row.termination_date,
    managerId: row.manager_id,
    location: row.location,
    bio: row.bio,
    city: row.city,
    country: row.country,
    postalCode: row.postal_code,
    taxId: row.tax_id,
    socialLinks: normalizeSocialLinks(parseJsonObject(row.social_links)),
    customFields: normalizeCustomFields(parseJsonObject(row.custom_fields)),
    isActive: row.is_active === 1,
    emailVerified: row.email_verified === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastLoginAt: row.last_login_at,
    passwordUpdatedAt: row.password_updated_at,
  };
}

/**
 * 移除密码哈希
 */
function toProfile(user: UserRecord): UserProfile {
  const { passwordHash, ...profile } = user;
  void passwordHash;
  return profile;
}

/**
 * 规范化社交链接
 */
function normalizeSocialLinks(input: unknown): SocialLinks {
  if (!input || typeof input !== 'object') return {};

  const normalized: SocialLinks = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof key !== 'string' || !key) continue;
    if (typeof value === 'string' && value.trim()) {
      normalized[key] = value.trim();
    } else if (value == null) {
      normalized[key] = null;
    }
  }
  return normalized;
}

/**
 * 规范化自定义字段
 */
function normalizeCustomFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

/**
 * 清理可选文本字段
 */
function sanitizeNullableText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function requireDisplayName(value: string | null | undefined): string {
  const displayName = sanitizeNullableText(value);
  if (!displayName) {
    throw new Error('DISPLAY_NAME_REQUIRED');
  }
  return displayName;
}

/**
 * 通过邮箱查找用户
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureHrSchema();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM hr_employees WHERE email = ? LIMIT 1',
    [email.toLowerCase()]
  );
  return mapUser(rows[0]);
}

/**
 * 通过 ID 查找用户
 */
export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureHrSchema();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM hr_employees WHERE id = ? LIMIT 1',
    [id]
  );
  return mapUser(rows[0]);
}

/**
 * 通过工号查找用户
 */
export async function findUserByEmployeeCode(employeeCode: string): Promise<UserRecord | null> {
  await ensureHrSchema();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM hr_employees WHERE employee_code = ? LIMIT 1',
    [employeeCode]
  );
  return mapUser(rows[0]);
}

/**
 * 创建用户
 */
export async function createUser(
  input: CreateUserInput,
  createdBy?: string
): Promise<UserRecord> {
  await ensureHrSchema();

  const email = input.email.toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  // 如果提供了工号，检查是否重复
  if (input.employeeCode) {
    const existingEmployee = await findUserByEmployeeCode(input.employeeCode);
    if (existingEmployee) {
      throw new Error('EMPLOYEE_CODE_EXISTS');
    }
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const roles = input.roles ?? [UserRole.EMPLOYEE];
  const primaryRole = input.primaryRole ?? roles[0];
  const displayName = requireDisplayName(input.displayName ?? null);

  await mysqlQuery`
    INSERT INTO hr_employees (
      id, email, password_hash, roles, primary_role,
      display_name,
      employee_code, department, job_title, employment_status, hire_date, manager_id,
      created_by
    ) VALUES (
      ${id}, ${email}, ${passwordHash}, ${JSON.stringify(roles)}, ${primaryRole},
      ${displayName},
      ${sanitizeNullableText(input.employeeCode)},
      ${sanitizeNullableText(input.department)},
      ${sanitizeNullableText(input.jobTitle)},
      ${input.employmentStatus ?? null},
      ${input.hireDate ?? null},
      ${input.managerId ?? null},
      ${createdBy ?? null}
    )
  `;

  if (input.department) {
    revalidateTag('departments', 'default');
  }

  return (await findUserById(id))!;
}

/**
 * 更新用户资料
 */
export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput
): Promise<UserRecord> {
  await ensureHrSchema();
  const current = await findUserById(userId);
  if (!current) {
    throw new Error('USER_NOT_FOUND');
  }
  const nextDisplayName = sanitizeNullableText(input.displayName ?? undefined) ?? current.displayName ?? current.email;
  if (!nextDisplayName || !nextDisplayName.trim()) {
    throw new Error('DISPLAY_NAME_REQUIRED');
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE hr_employees
      SET
        display_name = ?,
        phone = ?,
        bio = ?,
        city = ?,
        country = ?,
        postal_code = ?,
        tax_id = ?,
        social_links = ?,
        updated_at = NOW()
      WHERE id = ?`,
    [
      nextDisplayName,
      sanitizeNullableText(input.phone ?? undefined),
      sanitizeNullableText(input.bio ?? undefined),
      sanitizeNullableText(input.city ?? undefined),
      sanitizeNullableText(input.country ?? undefined),
      sanitizeNullableText(input.postalCode ?? undefined),
      sanitizeNullableText(input.taxId ?? undefined),
      input.socialLinks ? JSON.stringify(input.socialLinks) : JSON.stringify({}),
      userId,
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return (await findUserById(userId))!;
}

/**
 * 更新员工信息
 */
export async function updateEmployeeInfo(
  userId: string,
  input: UpdateEmployeeInfoInput
): Promise<UserRecord> {
  await ensureHrSchema();

  // 如果要更新工号，检查是否重复
  if (input.employeeCode) {
    const existing = await findUserByEmployeeCode(input.employeeCode);
    if (existing && existing.id !== userId) {
      throw new Error('EMPLOYEE_CODE_EXISTS');
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE hr_employees
      SET
        employee_code = ?,
        department = ?,
        job_title = ?,
        employment_status = ?,
        hire_date = ?,
        termination_date = ?,
        manager_id = ?,
        location = ?,
        updated_at = NOW()
      WHERE id = ?`,
    [
      input.employeeCode ?? null,
      sanitizeNullableText(input.department ?? undefined),
      sanitizeNullableText(input.jobTitle ?? undefined),
      input.employmentStatus ?? null,
      input.hireDate ?? null,
      input.terminationDate ?? null,
      input.managerId ?? null,
      sanitizeNullableText(input.location ?? undefined),
      userId,
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  if (input.department) {
    revalidateTag('departments', 'default');
  }

  return (await findUserById(userId))!;
}

/**
 * 更新用户角色
 */
export async function updateUserRoles(
  userId: string,
  roles: UserRole[],
  primaryRole?: UserRole
): Promise<UserRecord> {
  await ensureHrSchema();
  await ensureAuthSchema();

  if (roles.length === 0) {
    throw new Error('ROLES_REQUIRED');
  }

  const newPrimaryRole = primaryRole ?? roles[0];
  if (!roles.includes(newPrimaryRole)) {
    throw new Error('PRIMARY_ROLE_NOT_IN_ROLES');
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE hr_employees
      SET
        roles = ?,
        primary_role = ?,
        updated_at = NOW()
      WHERE id = ?`,
    [JSON.stringify(roles), newPrimaryRole, userId]
  );

  if (result.affectedRows === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return (await findUserById(userId))!;
}

/**
 * 更新用户密码
 */
export async function updateUserPassword(userId: string, password: string): Promise<void> {
  await ensureHrSchema();
  const passwordHash = await hashPassword(password);

  await mysqlQuery`
    UPDATE hr_employees
    SET 
      password_hash = ${passwordHash},
      password_updated_at = NOW(),
      failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export async function ensureBusinessUserRecord(userId: string): Promise<UserRecord> {
  await ensureHrSchema();
  const existing = await findUserById(userId);
  if (existing) return existing;

  const authUser = await findAuthUserById(userId);
  if (!authUser) {
    throw new Error('USER_NOT_FOUND');
  }

  const displayName = authUser.display_name?.trim() || authUser.email;
  const mappedRole = mapAuthRole(authUser.role);
  const roles = [mappedRole];
  const passwordHash = await hashPassword(randomUUID());

  try {
    await mysqlQuery`
      INSERT INTO hr_employees (
        id, email, password_hash, roles, primary_role,
        display_name,
        phone,
        employment_status, hire_date, manager_id,
        bio, city, country, postal_code, tax_id,
        social_links, is_active, email_verified,
        created_at, updated_at, password_updated_at
      ) VALUES (
        ${authUser.id},
        ${authUser.email.toLowerCase()},
        ${passwordHash},
        ${JSON.stringify(roles)},
        ${mappedRole},
        ${displayName},
        ${sanitizeNullableText(authUser.phone)},
        ${'active'},
        ${null},
        ${null},
        ${sanitizeNullableText(authUser.bio)},
        ${sanitizeNullableText(authUser.city)},
        ${sanitizeNullableText(authUser.country)},
        ${sanitizeNullableText(authUser.postal_code)},
        ${sanitizeNullableText(authUser.tax_id)},
        ${JSON.stringify(authUser.social_links ?? {})},
        ${1},
        ${1},
        ${authUser.created_at},
        ${authUser.updated_at},
        ${authUser.password_updated_at ?? null}
      )
    `;
  } catch (error) {
    const sqlError = error as { code?: string };
    if (sqlError?.code !== 'ER_DUP_ENTRY') {
      throw error;
    }
  }

  return (await findUserById(userId))!;
}

/**
 * 更新最后登录时间
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await ensureHrSchema();
  await mysqlQuery`
    UPDATE hr_employees
    SET last_login_at = NOW()
    WHERE id = ${userId}
  `;
}

/**
 * 列出用户（支持筛选和分页）
 */
export async function listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
  await ensureHrSchema();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const sortBy = params.sortBy ?? 'updatedAt';
  const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const sortColumnMap: Record<string, string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    displayName: 'display_name',
    department: 'department',
    employmentStatus: 'employment_status',
  };
  const sortColumn = sortColumnMap[sortBy] || 'updated_at';

  const conditions: string[] = [];
  const values: unknown[] = [];

  // 搜索条件
  if (params.search) {
    const search = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(display_name) LIKE ? OR 
      LOWER(email) LIKE ? OR
      LOWER(employee_code) LIKE ?
    )`);
    values.push(search, search, search);
  }

  // 角色筛选
  if (params.roles && params.roles.length > 0) {
    const roleClauses = params.roles.map(() => "COALESCE(roles, '') LIKE CONCAT('%\"', ?, '\"%')");
    conditions.push(`(${roleClauses.join(' OR ')})`);
    params.roles.forEach(role => values.push(role));
  }

  // 部门筛选
  if (params.department) {
    conditions.push('department = ?');
    values.push(params.department.trim());
  }

  // 雇佣状态筛选
  if (params.employmentStatus && params.employmentStatus !== 'all') {
    conditions.push('employment_status = ?');
    values.push(params.employmentStatus);
  }

  // 激活状态筛选
  if (params.isActive !== undefined) {
    conditions.push('is_active = ?');
    values.push(params.isActive ? 1 : 0);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = `ORDER BY ${sortColumn} ${sortOrder}, id ASC`;

  const dataParams = [...values, pageSize, (page - 1) * pageSize];

  const [dataResult, countResult] = await Promise.all([
    pool.query<RawUserRow[]>(
      `SELECT * FROM hr_employees ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      dataParams
    ),
    pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM hr_employees ${whereClause}`,
      values
    ),
  ]);

  const rows = dataResult[0] ?? [];
  const total = countResult[0]?.[0]?.total ?? 0;

  return {
    items: rows.map(row => toProfile(mapUser(row)!)),
    total: Number(total),
    page,
    pageSize,
  };
}

/**
 * 删除用户（软删除 - 设置为不活跃）
 */
export async function deactivateUser(userId: string): Promise<void> {
  await ensureHrSchema();
  await mysqlQuery`
    UPDATE hr_employees
    SET is_active = 0, updated_at = NOW()
    WHERE id = ${userId}
  `;
  await invalidateSessionsForUser(userId);
}

/**
 * 激活用户
 */
export async function activateUser(userId: string): Promise<void> {
  await ensureHrSchema();
  await mysqlQuery`
    UPDATE hr_employees
    SET is_active = 1, updated_at = NOW()
    WHERE id = ${userId}
  `;
}

/**
 * 获取部门列表
 */
export const getDepartments = unstable_cache(
  async (): Promise<string[]> => {
    await ensureHrSchema();
    const result = await mysqlQuery<RowDataPacket & { department: string }>`
      SELECT DISTINCT department
      FROM hr_employees
      WHERE department IS NOT NULL
      ORDER BY department
    `;
    return result.rows.map(row => row.department);
  },
  ['departments-list'],
  { tags: ['departments'], revalidate: 3600 }
);

/**
 * 获取某个经理的下属
 */
export async function getSubordinates(managerId: string): Promise<UserProfile[]> {
  await ensureHrSchema();
  const result = await mysqlQuery<RawUserRow>`
    SELECT * FROM hr_employees
    WHERE manager_id = ${managerId}
      AND is_active = 1
    ORDER BY display_name, id
  `;
  return result.rows.map(row => toProfile(mapUser(row)!));
}
