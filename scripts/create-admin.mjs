#!/usr/bin/env node

import path from 'node:path';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

function exitIf(condition, message) {
  if (condition) {
    console.error(message);
    process.exit(1);
  }
}

const cwd = process.cwd();

dotenv.config({ path: path.join(cwd, '.env.local') });
dotenv.config({ path: path.join(cwd, '.env') });

exitIf(
  !process.env.POSTGRES_URL_NON_POOLING &&
    !process.env.DATABASE_URL_UNPOOLED &&
    !process.env.POSTGRES_URL &&
    !process.env.DATABASE_URL,
  '缺少数据库连接字符串，请在 .env.local 中配置 POSTGRES_URL_NON_POOLING、DATABASE_URL_UNPOOLED、POSTGRES_URL 或 DATABASE_URL'
);

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

const pool = new Pool({ connectionString, max: 5 });

function rowsFrom(result) {
  if (!result) return [];
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

function buildQueryText(strings, valuesLength) {
  let query = '';
  for (let index = 0; index < strings.length; index += 1) {
    query += strings[index];
    if (index < valuesLength) {
      query += `$${index + 1}`;
    }
  }
  return query;
}

async function sql(strings, ...values) {
  const text = buildQueryText(strings, values.length);
  return pool.query(text, values);
}

async function ensureAuthSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS auth_users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      session_token TEXT NOT NULL UNIQUE,
      device_type TEXT NOT NULL,
      user_agent_hash TEXT NOT NULL,
      remember_me BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function createAdmin(email, password, role) {
  const id = randomUUID();
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const userRole = role || 'finance_admin';

  const existing = rowsFrom(
    await sql`
      SELECT id FROM auth_users WHERE email = ${normalizedEmail} LIMIT 1
    `
  );

  if (existing.length > 0) {
    throw new Error(`邮箱 ${normalizedEmail} 已存在`);
  }

  await sql`
    INSERT INTO auth_users (id, email, password_hash, role)
    VALUES (${id}, ${normalizedEmail}, ${passwordHash}, ${userRole})
  `;

  return { id, email: normalizedEmail, role: userRole };
}

async function main() {
  let exitCode = 0;
  try {
    const [, , email, password, role] = process.argv;

    if (!email || !password) {
      console.error('用法: npm run seed:admin -- <email> <password> [role]');
      exitCode = 1;
      return;
    }

    await ensureAuthSchema();
    const user = await createAdmin(email, password, role);
    console.log('管理员创建成功:', user);
  } catch (error) {
    console.error('创建管理员失败:', error);
    exitCode = 1;
  } finally {
    try {
      await pool.end();
    } catch (closeError) {
      console.warn('关闭数据库连接池时出错:', closeError);
    }
    process.exit(exitCode);
  }
}

main();
