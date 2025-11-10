#!/usr/bin/env node

const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { sql } = require('@vercel/postgres');

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

  const existing = await sql`
    SELECT id FROM auth_users WHERE email = ${normalizedEmail} LIMIT 1
  `;

  if (existing.rows.length > 0) {
    throw new Error(`邮箱 ${normalizedEmail} 已存在`);
  }

  await sql`
    INSERT INTO auth_users (id, email, password_hash, role)
    VALUES (${id}, ${normalizedEmail}, ${passwordHash}, ${userRole})
  `;

  return { id, email: normalizedEmail, role: userRole };
}

async function main() {
  try {
    const [, , email, password, role] = process.argv;

    if (!email || !password) {
      console.error('用法: node scripts/create-admin.js <email> <password> [role]');
      process.exit(1);
    }

    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      console.error('缺少数据库连接字符串，请在 .env.local 中配置 POSTGRES_URL 或 DATABASE_URL');
      process.exit(1);
    }

    await ensureAuthSchema();
    const user = await createAdmin(email, password, role);
    console.log('管理员创建成功:', user);
    process.exit(0);
  } catch (error) {
    console.error('创建管理员失败:', error.message || error);
    process.exit(1);
  }
}

main();
