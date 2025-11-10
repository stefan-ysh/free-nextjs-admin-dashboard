import { randomUUID } from 'crypto';

import { sql } from '@/lib/postgres';
import { ensureAuthSchema } from './schema';
import { hashPassword } from './password';

export type UserRole = 'finance_admin' | 'staff';

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureAuthSchema();
  const result = await sql<UserRecord>`
    SELECT * FROM auth_users WHERE email = ${email.toLowerCase()} LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureAuthSchema();
  const result = await sql<UserRecord>`
    SELECT * FROM auth_users WHERE id = ${id} LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function createUser(params: {
  email: string;
  password: string;
  role?: UserRole;
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

  const result = await sql<UserRecord>`
    INSERT INTO auth_users (id, email, password_hash, role)
    VALUES (${id}, ${email}, ${passwordHash}, ${role})
    RETURNING *
  `;

  return result.rows[0];
}

export async function updateUserPassword(userId: string, password: string): Promise<void> {
  await ensureAuthSchema();
  const passwordHash = await hashPassword(password);
  await sql`
    UPDATE auth_users
    SET password_hash = ${passwordHash}, updated_at = NOW()
    WHERE id = ${userId}
  `;
}
