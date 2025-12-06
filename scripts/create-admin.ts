import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';

import './load-env';

import { mysqlQuery } from '@/lib/mysql';
import { ensureHrSchema } from '@/lib/hr/schema';
import { hashPassword } from '@/lib/auth/password';
import { AUTH_ROLE_VALUES, mapAuthRole } from '@/lib/auth/roles';
import type { UserRole } from '@/types/user';

type ExistingRow = RowDataPacket & { id: string };

function usageMessage() {
  console.log(
    `用法: npm run seed:admin -- <email> <password> [role]\n可选角色: ${AUTH_ROLE_VALUES.join(', ')}`
  );
}

function resolveRole(rawRole?: string): { authRole: string; userRole: UserRole } {
  if (!rawRole) {
    return { authRole: 'finance_admin', userRole: mapAuthRole('finance_admin') };
  }
  const normalized = rawRole.trim().toLowerCase();
  if (!AUTH_ROLE_VALUES.includes(normalized as (typeof AUTH_ROLE_VALUES)[number])) {
    throw new Error(`角色 ${normalized} 无效，可选值: ${AUTH_ROLE_VALUES.join(', ')}`);
  }
  return { authRole: normalized, userRole: mapAuthRole(normalized) };
}

function splitNameFromEmail(email: string) {
  const prefix = email.split('@')[0];
  if (!prefix) {
    return { firstName: '管理员', lastName: '系统' };
  }
  if (prefix.length === 1) {
    return { firstName: prefix, lastName: prefix };
  }
  return { firstName: prefix.slice(1), lastName: prefix.slice(0, 1) };
}

async function ensureUniqueEmail(email: string) {
  const existing = await mysqlQuery<ExistingRow>`
    SELECT id FROM hr_employees WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1
  `;
  if (existing.rows.length) {
    throw new Error(`邮箱 ${email} 已存在`);
  }
}

async function createAdmin(email: string, password: string, role?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { authRole, userRole } = resolveRole(role);
  const passwordHash = await hashPassword(password);
  const { firstName, lastName } = splitNameFromEmail(normalizedEmail);
  const displayName = normalizedEmail.split('@')[0] || '管理员';
  const employeeCode = normalizedEmail.replace(/[^a-z0-9]+/gi, '').slice(0, 32) || displayName;

  await ensureHrSchema();
  await ensureUniqueEmail(normalizedEmail);

  const id = randomUUID();
  const roles = JSON.stringify([userRole]);

  await mysqlQuery`
    INSERT INTO hr_employees (
      id,
      email,
      password_hash,
      roles,
      primary_role,
      first_name,
      last_name,
      display_name,
      employee_code,
      employment_status,
      is_active,
      email_verified,
      created_by
    ) VALUES (
      ${id},
      ${normalizedEmail},
      ${passwordHash},
      ${roles},
      ${userRole},
      ${firstName},
      ${lastName},
      ${displayName},
      ${employeeCode},
      'active',
      1,
      1,
      NULL
    )
  `;

  console.log('管理员创建成功:', {
    id,
    email: normalizedEmail,
    role: authRole,
  });
}

async function main() {
  try {
    const [, , email, password, role] = process.argv;
    if (!email || !password) {
      usageMessage();
      process.exit(1);
      return;
    }
    await createAdmin(email, password, role);
    process.exit(0);
  } catch (error) {
    console.error('创建管理员失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();
