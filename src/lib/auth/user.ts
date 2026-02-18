import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';
import { ensureHrSchema } from '@/lib/hr/schema';
import { ensureAuthSchema } from './schema';
import { hashPassword } from './password';
import { AUTH_ROLE_VALUES, AuthUserRole } from './roles';

export const AUTH_USER_ROLES = AUTH_ROLE_VALUES;

export type UserRole = AuthUserRole;

export type SocialLinks = Record<string, string | null>;

const pool = mysqlPool();

async function ensureAuthAndHrSchemas() {
  await Promise.all([ensureAuthSchema(), ensureHrSchema()]);
}

type RawUserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  roles: unknown; // JSON array of roles
  primary_role: string;
  display_name: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  postal_code: string | null;
  tax_id: string | null;
  social_links: unknown;
  custom_fields: unknown;
  is_active: number;
  email_verified: number;
  employment_status: string | null;
  failed_login_attempts: number | null;
  locked_until: string | null;
  password_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole; // Keep for backward compatibility
  roles: UserRole[]; // Array of roles from hr_employees table
  primary_role: UserRole;
  display_name: string | null;
  gender: 'male' | 'female' | 'other' | null;
  phone: string | null;
  address: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  postal_code: string | null;
  tax_id: string | null;
  social_links: SocialLinks;
  employment_status: string | null;
  is_active: boolean;
  email_verified: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  password_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserProfile = Omit<UserRecord, 'password_hash'>;

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
      console.warn('Failed to parse JSON object column', error);
    }
  }
  return {};
}

function parseJsonArray<T = string>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (error) {
      console.warn('Failed to parse JSON array column', error);
    }
  }
  return [];
}

function normalizeGender(value: string | null | undefined): 'male' | 'female' | 'other' | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'male' || normalized === 'm' || normalized === '男') return 'male';
  if (normalized === 'female' || normalized === 'f' || normalized === '女') return 'female';
  if (normalized === 'other' || normalized === 'o' || normalized === '其他') return 'other';
  return null;
}

function buildDisplayName(row: RawUserRow): string {
  const candidates: Array<string | null | undefined> = [
    row.display_name,
    row.email,
  ];

  for (const value of candidates) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return '未命名';
}

function normalizeSocialLinks(input: unknown): SocialLinks {
  if (!input || typeof input !== 'object') {
    return {};
  }

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

function mapUser(row: RawUserRow | undefined): UserRecord | null {
  if (!row) return null;

  const roles = parseJsonArray<UserRole>(row.roles);
  const primaryRole = row.primary_role as UserRole;
  const displayName = buildDisplayName(row);

  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    roles: roles.length ? roles : [primaryRole],
    primary_role: primaryRole,
    role: primaryRole, // For backward compatibility
    display_name: displayName,
    gender: normalizeGender(row.gender),
    phone: row.phone,
    address: row.address ?? null,
    bio: row.bio,
    country: row.country,
    city: row.city,
    postal_code: row.postal_code,
    tax_id: row.tax_id,
    social_links: normalizeSocialLinks(parseJsonObject(row.social_links)),
    employment_status: row.employment_status ?? null,
    is_active: row.is_active === 1,
    email_verified: row.email_verified === 1,
    failed_login_attempts: Number(row.failed_login_attempts ?? 0),
    locked_until: row.locked_until ?? null,
    password_updated_at: row.password_updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function cleanSocialLinks(links: SocialLinks | null | undefined): Record<string, string> {
  if (!links) return {};
  const cleaned: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(links)) {
    if (!rawKey) continue;
    const key = rawKey.trim();
    if (!key) continue;
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (value) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureAuthAndHrSchemas();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM hr_employees WHERE email = ? LIMIT 1',
    [email.toLowerCase()]
  );
  return mapUser(rows[0]);
}

export async function findUserByEmployeeCode(employeeCode: string): Promise<UserRecord | null> {
  await ensureAuthAndHrSchemas();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM hr_employees WHERE employee_code = ? LIMIT 1',
    [employeeCode]
  );
  return mapUser(rows[0]);
}

export async function findUserByPhone(phone: string): Promise<UserRecord | null> {
  await ensureAuthAndHrSchemas();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM hr_employees WHERE phone = ? LIMIT 2',
    [phone]
  );
  if (rows.length > 1) {
    throw new Error('PHONE_NOT_UNIQUE');
  }
  return mapUser(rows[0]);
}

export async function findUserByLoginIdentifier(identifier: string): Promise<UserRecord | null> {
  const normalized = identifier.trim();
  if (!normalized) return null;

  if (normalized.includes('@')) {
    return findUserByEmail(normalized);
  }

  const byEmployeeCode = await findUserByEmployeeCode(normalized);
  if (byEmployeeCode) return byEmployeeCode;

  const byPhone = await findUserByPhone(normalized);
  if (byPhone) return byPhone;

  return findUserByEmail(normalized.toLowerCase());
}

export async function recordFailedLoginAttempt(userId: string): Promise<void> {
  await ensureAuthAndHrSchemas();
  await pool.query(
    `UPDATE hr_employees
      SET
        failed_login_attempts = IF(failed_login_attempts >= 4, 0, failed_login_attempts + 1),
        locked_until = IF(failed_login_attempts >= 4, DATE_ADD(NOW(), INTERVAL 15 MINUTE), locked_until),
        updated_at = NOW()
      WHERE id = ?`,
    [userId]
  );
}

export async function clearLoginFailures(userId: string): Promise<void> {
  await ensureAuthAndHrSchemas();
  await pool.query(
    `UPDATE hr_employees
      SET
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
      WHERE id = ?`,
    [userId]
  );
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureAuthAndHrSchemas();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM hr_employees WHERE id = ? LIMIT 1',
    [id]
  );
  return mapUser(rows[0]);
}

export async function createUser(params: {
  email: string;
  password: string;
  role?: UserRole;
  displayName?: string;
}): Promise<UserRecord> {
  await ensureAuthAndHrSchemas();
  const email = params.email.toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('邮箱已存在');
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(params.password);
  const role = params.role ?? 'staff';
  const displayName = sanitizeNullableText(params.displayName ?? null);
  if (!displayName) {
    throw new Error('DISPLAY_NAME_REQUIRED');
  }

  // Convert single role to roles array for hr_employees table
  const rolesJson = JSON.stringify([role]);

  await pool.query(
    `INSERT INTO hr_employees (
      id, email, password_hash, roles, primary_role, display_name, is_active, email_verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
    [id, email, passwordHash, rolesJson, role, displayName]
  );

  return (await findUserById(id))!;
}

export async function updateUserPassword(userId: string, password: string): Promise<void> {
  await ensureAuthAndHrSchemas();
  const passwordHash = await hashPassword(password);
  await pool.query(
    `UPDATE hr_employees
      SET
        password_hash = ?,
        password_updated_at = NOW(),
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
      WHERE id = ?`,
    [passwordHash, userId]
  );
}

export type UpdateUserProfileInput = {
  displayName: string | null;
  gender: 'male' | 'female' | 'other' | null;
  phone: string | null;
  address: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  taxId: string | null;
  socialLinks: SocialLinks | null;
};

function sanitizeNullableText(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function updateUserProfile(userId: string, input: UpdateUserProfileInput): Promise<UserRecord> {
  await ensureAuthAndHrSchemas();
  const current = await findUserById(userId);
  if (!current) {
    throw new Error('USER_NOT_FOUND');
  }

  const payload = {
    displayName: sanitizeNullableText(input.displayName) ?? current.display_name ?? current.email,
    gender: normalizeGender(input.gender),
    phone: sanitizeNullableText(input.phone),
    address: sanitizeNullableText(input.address),
    bio: sanitizeNullableText(input.bio),
    country: sanitizeNullableText(input.country),
    city: sanitizeNullableText(input.city),
    postalCode: sanitizeNullableText(input.postalCode),
    taxId: sanitizeNullableText(input.taxId),
    socialLinks: cleanSocialLinks(input.socialLinks ?? null),
  };
  if (!payload.displayName || !payload.displayName.trim()) {
    throw new Error('DISPLAY_NAME_REQUIRED');
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE hr_employees
      SET
        display_name = ?,
        gender = ?,
        phone = ?,
        address = ?,
        bio = ?,
        country = ?,
        city = ?,
        postal_code = ?,
        tax_id = ?,
        social_links = ?,
        updated_at = NOW()
      WHERE id = ?`,
    [
      payload.displayName,
      payload.gender,
      payload.phone,
      payload.address,
      payload.bio,
      payload.country,
      payload.city,
      payload.postalCode,
      payload.taxId,
      JSON.stringify(payload.socialLinks),
      userId,
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return (await findUserById(userId))!;
}
