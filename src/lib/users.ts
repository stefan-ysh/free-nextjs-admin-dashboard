import { randomUUID } from 'crypto';
import { pool, sql } from '@/lib/postgres';
import { ensureUsersSchema } from '@/lib/schema/users';
import { hashPassword } from '@/lib/auth/password';
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

/**
 * 数据库行类型（snake_case）
 */
type RawUserRow = {
  id: string;
  email: string;
  password_hash: string;
  roles: string[];
  primary_role: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
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
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_login_at: string | null;
  password_updated_at: string | null;
};

/**
 * 映射数据库行到用户记录
 */
function mapUser(row: RawUserRow | undefined): UserRecord | null {
  if (!row) return null;
  
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    roles: row.roles as UserRole[],
    primaryRole: row.primary_role as UserRole,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
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
    socialLinks: normalizeSocialLinks(row.social_links),
    customFields: normalizeCustomFields(row.custom_fields),
    isActive: row.is_active,
    emailVerified: row.email_verified,
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

/**
 * 通过邮箱查找用户
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureUsersSchema();
  const result = await sql<RawUserRow>`
    SELECT * FROM users WHERE email = ${email.toLowerCase()} LIMIT 1
  `;
  return mapUser(result.rows[0]);
}

/**
 * 通过 ID 查找用户
 */
export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureUsersSchema();
  const result = await sql<RawUserRow>`
    SELECT * FROM users WHERE id = ${id} LIMIT 1
  `;
  return mapUser(result.rows[0]);
}

/**
 * 通过员工编号查找用户
 */
export async function findUserByEmployeeCode(employeeCode: string): Promise<UserRecord | null> {
  await ensureUsersSchema();
  const result = await sql<RawUserRow>`
    SELECT * FROM users WHERE employee_code = ${employeeCode} LIMIT 1
  `;
  return mapUser(result.rows[0]);
}

/**
 * 创建用户
 */
export async function createUser(
  input: CreateUserInput,
  createdBy?: string
): Promise<UserRecord> {
  await ensureUsersSchema();
  
  const email = input.email.toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }
  
  // 如果提供了员工编号，检查是否重复
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
  const displayName = input.displayName?.trim() || 
                      `${input.firstName || ''} ${input.lastName || ''}`.trim() ||
                      email.split('@')[0];
  
  const result = await sql<RawUserRow>`
    INSERT INTO users (
      id, email, password_hash, roles, primary_role,
      first_name, last_name, display_name,
      employee_code, department, job_title, employment_status, hire_date, manager_id,
      created_by
    ) VALUES (
      ${id}, ${email}, ${passwordHash}, ${roles}, ${primaryRole},
      ${sanitizeNullableText(input.firstName)},
      ${sanitizeNullableText(input.lastName)},
      ${displayName},
      ${sanitizeNullableText(input.employeeCode)},
      ${sanitizeNullableText(input.department)},
      ${sanitizeNullableText(input.jobTitle)},
      ${input.employmentStatus ?? null},
      ${input.hireDate ?? null},
      ${input.managerId ?? null},
      ${createdBy ?? null}
    )
    RETURNING *
  `;
  
  return mapUser(result.rows[0])!;
}

/**
 * 更新用户资料
 */
export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput
): Promise<UserRecord> {
  await ensureUsersSchema();
  
  const result = await sql<RawUserRow>`
    UPDATE users
    SET
      first_name = ${sanitizeNullableText(input.firstName ?? undefined)},
      last_name = ${sanitizeNullableText(input.lastName ?? undefined)},
      display_name = ${input.displayName ?? undefined},
      phone = ${sanitizeNullableText(input.phone ?? undefined)},
      bio = ${sanitizeNullableText(input.bio ?? undefined)},
      city = ${sanitizeNullableText(input.city ?? undefined)},
      country = ${sanitizeNullableText(input.country ?? undefined)},
      postal_code = ${sanitizeNullableText(input.postalCode ?? undefined)},
      tax_id = ${sanitizeNullableText(input.taxId ?? undefined)},
      social_links = ${input.socialLinks ? JSON.stringify(input.socialLinks) : undefined},
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
  
  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }
  
  return mapUser(result.rows[0])!;
}

/**
 * 更新员工信息
 */
export async function updateEmployeeInfo(
  userId: string,
  input: UpdateEmployeeInfoInput
): Promise<UserRecord> {
  await ensureUsersSchema();
  
  // 如果要更新员工编号，检查是否重复
  if (input.employeeCode) {
    const existing = await findUserByEmployeeCode(input.employeeCode);
    if (existing && existing.id !== userId) {
      throw new Error('EMPLOYEE_CODE_EXISTS');
    }
  }
  
  const result = await sql<RawUserRow>`
    UPDATE users
    SET
      employee_code = ${input.employeeCode ?? undefined},
      department = ${sanitizeNullableText(input.department ?? undefined)},
      job_title = ${sanitizeNullableText(input.jobTitle ?? undefined)},
      employment_status = ${input.employmentStatus ?? undefined},
      hire_date = ${input.hireDate ?? undefined},
      termination_date = ${input.terminationDate ?? undefined},
      manager_id = ${input.managerId ?? undefined},
      location = ${sanitizeNullableText(input.location ?? undefined)},
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
  
  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }
  
  return mapUser(result.rows[0])!;
}

/**
 * 更新用户角色
 */
export async function updateUserRoles(
  userId: string,
  roles: UserRole[],
  primaryRole?: UserRole
): Promise<UserRecord> {
  await ensureUsersSchema();
  
  if (roles.length === 0) {
    throw new Error('ROLES_REQUIRED');
  }
  
  const newPrimaryRole = primaryRole ?? roles[0];
  if (!roles.includes(newPrimaryRole)) {
    throw new Error('PRIMARY_ROLE_NOT_IN_ROLES');
  }
  
  const result = await sql<RawUserRow>`
    UPDATE users
    SET
      roles = ${roles},
      primary_role = ${newPrimaryRole},
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
  
  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }
  
  return mapUser(result.rows[0])!;
}

/**
 * 更新用户密码
 */
export async function updateUserPassword(userId: string, password: string): Promise<void> {
  await ensureUsersSchema();
  const passwordHash = await hashPassword(password);
  
  await sql`
    UPDATE users
    SET 
      password_hash = ${passwordHash},
      password_updated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${userId}
  `;
}

/**
 * 更新用户头像
 */
export async function updateUserAvatar(
  userId: string,
  avatarUrl: string | null
): Promise<UserRecord> {
  await ensureUsersSchema();
  const sanitized = sanitizeNullableText(avatarUrl);
  
  const result = await sql<RawUserRow>`
    UPDATE users
    SET avatar_url = ${sanitized}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
  
  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }
  
  return mapUser(result.rows[0])!;
}

/**
 * 更新最后登录时间
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await ensureUsersSchema();
  await sql`
    UPDATE users
    SET last_login_at = NOW()
    WHERE id = ${userId}
  `;
}

/**
 * 列出用户（支持筛选和分页）
 */
export async function listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
  await ensureUsersSchema();
  
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const sortBy = params.sortBy ?? 'updatedAt';
  const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';
  
  const sortColumnMap: Record<string, string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    lastName: 'last_name',
    department: 'department',
    employmentStatus: 'employment_status',
  };
  const sortColumn = sortColumnMap[sortBy] || 'updated_at';
  
  const conditions: string[] = [];
  const values: unknown[] = [];
  
  // 搜索条件
  if (params.search) {
    const searchIndex = values.length + 1;
    values.push(`%${params.search.trim()}%`);
    conditions.push(`(
      first_name ILIKE $${searchIndex} OR 
      last_name ILIKE $${searchIndex} OR 
      display_name ILIKE $${searchIndex} OR 
      email ILIKE $${searchIndex} OR
      employee_code ILIKE $${searchIndex}
    )`);
  }
  
  // 角色筛选
  if (params.roles && params.roles.length > 0) {
    values.push(params.roles);
    conditions.push(`roles && $${values.length}::text[]`);
  }
  
  // 部门筛选
  if (params.department) {
    values.push(params.department.trim());
    conditions.push(`department = $${values.length}`);
  }
  
  // 雇佣状态筛选
  if (params.employmentStatus && params.employmentStatus !== 'all') {
    values.push(params.employmentStatus);
    conditions.push(`employment_status = $${values.length}`);
  }
  
  // 激活状态筛选
  if (params.isActive !== undefined) {
    values.push(params.isActive);
    conditions.push(`is_active = $${values.length}`);
  }
  
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = `ORDER BY ${sortColumn} ${sortOrder}, id ASC`;
  const limitClause = `LIMIT $${values.length + 1}`;
  const offsetClause = `OFFSET $${values.length + 2}`;
  
  const dataValues = [...values, pageSize, (page - 1) * pageSize];
  
  const baseSelect = `SELECT * FROM users`;
  const dataQuery = `${baseSelect} ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`;
  const countQuery = `SELECT COUNT(*)::int AS total FROM users ${whereClause}`;
  
  const [dataResult, countResult] = await Promise.all([
    pool.query<RawUserRow>(dataQuery, dataValues),
    pool.query<{ total: number }>(countQuery, values),
  ]);
  
  return {
    items: dataResult.rows.map(row => toProfile(mapUser(row)!)),
    total: countResult.rows[0]?.total ?? 0,
    page,
    pageSize,
  };
}

/**
 * 删除用户（软删除 - 设置为不活跃）
 */
export async function deactivateUser(userId: string): Promise<void> {
  await ensureUsersSchema();
  await sql`
    UPDATE users
    SET is_active = false, updated_at = NOW()
    WHERE id = ${userId}
  `;
}

/**
 * 激活用户
 */
export async function activateUser(userId: string): Promise<void> {
  await ensureUsersSchema();
  await sql`
    UPDATE users
    SET is_active = true, updated_at = NOW()
    WHERE id = ${userId}
  `;
}

/**
 * 获取部门列表
 */
export async function getDepartments(): Promise<string[]> {
  await ensureUsersSchema();
  const result = await sql<{ department: string }>`
    SELECT DISTINCT department
    FROM users
    WHERE department IS NOT NULL
    ORDER BY department
  `;
  return result.rows.map(row => row.department);
}

/**
 * 获取某个经理的下属
 */
export async function getSubordinates(managerId: string): Promise<UserProfile[]> {
  await ensureUsersSchema();
  const result = await sql<RawUserRow>`
    SELECT * FROM users
    WHERE manager_id = ${managerId}
    AND is_active = true
    ORDER BY last_name, first_name
  `;
  return result.rows.map(row => toProfile(mapUser(row)!));
}
