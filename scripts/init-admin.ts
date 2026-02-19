import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';

import './load-env';

import { mysqlQuery } from '@/lib/mysql';
import { ensureHrSchema } from '@/lib/hr/schema';
import { hashPassword } from '@/lib/auth/password';
import { mapAuthRole } from '@/lib/auth/roles';

type ExistingRow = RowDataPacket & { id: string };

const DEFAULT_EMAIL = '404735976@qq.com';
const DEFAULT_PASSWORD = 'Yuanshuai2021$';
const DEFAULT_ROLE = 'super_admin';

async function ensureUniqueEmail(email: string) {
  const existing = await mysqlQuery<ExistingRow>`
    SELECT id FROM hr_employees WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1
  `;
  if (existing.rows.length) {
    return false;
  }
  return true;
}

// function splitNameFromEmail removed as not needed for schema


async function createAdmin() {
  await ensureHrSchema();

  const email = process.env.ADMIN_EMAIL || DEFAULT_EMAIL;
  const password = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const role = process.env.ADMIN_ROLE || DEFAULT_ROLE;

  const normalizedEmail = email.trim().toLowerCase();
  
  // Check if admin already exists
  const isUnique = await ensureUniqueEmail(normalizedEmail);
  if (!isUnique) {
    console.log(`管理员账号 ${normalizedEmail} 已存在，跳过创建。`);
    return;
  }

  const userRole = mapAuthRole(role);
  const passwordHash = await hashPassword(password);
  const displayName = normalizedEmail.split('@')[0] || '管理员';
  const employeeCode = normalizedEmail.replace(/[^a-z0-9]+/gi, '').slice(0, 32) || displayName;

  const id = randomUUID();
  const roles = JSON.stringify([userRole]);

  await mysqlQuery`
    INSERT INTO hr_employees (
      id,
      email,
      password_hash,
      roles,
      primary_role,
      display_name,
      employee_code,
      employment_status,
      is_active,
      email_verified,
      created_by,
      social_links,
      custom_fields,
      created_at,
      updated_at
    ) VALUES (
      ${id},
      ${normalizedEmail},
      ${passwordHash},
      ${roles},
      ${userRole},
      ${displayName},
      ${employeeCode},
      'active',
      1,
      1,
      NULL,
      '{}',
      '{}',
      NOW(),
      NOW()
    )
  `;

  console.log('管理员创建成功:', {
    id,
    email: normalizedEmail,
    role: role,
  });
}

async function main() {
  try {
    await createAdmin();
    process.exit(0);
  } catch (error) {
    console.error('初始化管理员失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();
