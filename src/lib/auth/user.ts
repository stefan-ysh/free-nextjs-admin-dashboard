import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';
import { ensureAuthSchema } from './schema';
import { hashPassword } from './password';
import { AUTH_ROLE_VALUES, AuthUserRole } from './roles';

export const AUTH_USER_ROLES = AUTH_ROLE_VALUES;

export type UserRole = AuthUserRole;

export type SocialLinks = Record<string, string | null>;

const pool = mysqlPool();

type RawUserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  job_title: string | null;
  phone: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  postal_code: string | null;
  tax_id: string | null;
  avatar_url: string | null;
  social_links: unknown;
  password_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRecord = Omit<RawUserRow, 'social_links'> & {
  social_links: SocialLinks;
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
      console.warn('Failed to parse auth_users.social_links JSON', error);
    }
  }
  return {};
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
  return {
    ...row,
    social_links: normalizeSocialLinks(parseJsonObject(row.social_links)),
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
  await ensureAuthSchema();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM auth_users WHERE email = ? LIMIT 1',
    [email.toLowerCase()]
  );
  return mapUser(rows[0]);
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureAuthSchema();
  const [rows] = await pool.query<RawUserRow[]>(
    'SELECT * FROM auth_users WHERE id = ? LIMIT 1',
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
  await ensureAuthSchema();
  const email = params.email.toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('邮箱已存在');
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(params.password);
  const role = params.role ?? 'staff';
  const displayName = params.displayName?.trim() || email.split('@')[0];

  await mysqlQuery`
    INSERT INTO auth_users (id, email, password_hash, role, display_name)
    VALUES (${id}, ${email}, ${passwordHash}, ${role}, ${displayName})
  `;

  return (await findUserById(id))!;
}

export async function updateUserPassword(userId: string, password: string): Promise<void> {
  await ensureAuthSchema();
  const passwordHash = await hashPassword(password);
  await mysqlQuery`
    UPDATE auth_users
    SET password_hash = ${passwordHash}, password_updated_at = NOW(), updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export type UpdateUserProfileInput = {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  jobTitle: string | null;
  phone: string | null;
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
  await ensureAuthSchema();

  const payload = {
    firstName: sanitizeNullableText(input.firstName),
    lastName: sanitizeNullableText(input.lastName),
    displayName: sanitizeNullableText(input.displayName),
    jobTitle: sanitizeNullableText(input.jobTitle),
    phone: sanitizeNullableText(input.phone),
    bio: sanitizeNullableText(input.bio),
    country: sanitizeNullableText(input.country),
    city: sanitizeNullableText(input.city),
    postalCode: sanitizeNullableText(input.postalCode),
    taxId: sanitizeNullableText(input.taxId),
    socialLinks: cleanSocialLinks(input.socialLinks ?? null),
  };

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE auth_users
      SET
        first_name = ?,
        last_name = ?,
        display_name = ?,
        job_title = ?,
        phone = ?,
        bio = ?,
        country = ?,
        city = ?,
        postal_code = ?,
        tax_id = ?,
        social_links = ?,
        updated_at = NOW()
      WHERE id = ?`,
    [
      payload.firstName,
      payload.lastName,
      payload.displayName,
      payload.jobTitle,
      payload.phone,
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

export async function updateUserAvatar(userId: string, avatarUrl: string | null): Promise<UserRecord> {
  await ensureAuthSchema();
  const sanitized = sanitizeNullableText(avatarUrl);
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE auth_users SET avatar_url = ?, updated_at = NOW() WHERE id = ?',
    [sanitized, userId]
  );

  if (result.affectedRows === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return (await findUserById(userId))!;
}
