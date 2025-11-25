#!/usr/bin/env node

import path from 'node:path';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const cwd = process.cwd();

dotenv.config({ path: path.join(cwd, '.env.local') });
dotenv.config({ path: path.join(cwd, '.env') });

function resolvePoolOptions() {
  const connectionLimit = Number(process.env.MYSQL_POOL_SIZE ?? '10');
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;

  if (url && url.trim()) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || '3306'),
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'tailadmin_local'),
      waitForConnections: true,
      connectionLimit,
      decimalNumbers: true,
      timezone: 'Z'
    };
  }

  const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT ?? '3306');
  const user = process.env.MYSQL_USER?.trim() || 'root';
  const password = process.env.MYSQL_PASSWORD ?? '';
  const database = process.env.MYSQL_DATABASE?.trim() || 'tailadmin_local';

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit,
    decimalNumbers: true,
    timezone: 'Z'
  };
}

const pool = mysql.createPool(resolvePoolOptions());

function buildQueryText(strings, valuesLength) {
  let query = '';
  for (let index = 0; index < strings.length; index += 1) {
    query += strings[index];
    if (index < valuesLength) {
      query += '?';
    }
  }
  return query;
}

async function sql(strings, ...values) {
  const text = buildQueryText(strings, values.length);
  return pool.query(text, values);
}

const ROLE_VALUES = [
  'super_admin',
  'admin',
  'finance_admin',
  'finance',
  'hr',
  'department_manager',
  'staff',
  'employee'
];
const ROLE_ENUM_SQL = ROLE_VALUES.map((role) => `'${role}'`).join(',');

async function ensureAuthSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id CHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM(${ROLE_ENUM_SQL}) NOT NULL DEFAULT 'staff',
      first_name VARCHAR(120),
      last_name VARCHAR(120),
      display_name VARCHAR(255),
      job_title VARCHAR(120),
      phone VARCHAR(60),
      bio TEXT,
      country VARCHAR(120),
      city VARCHAR(120),
      postal_code VARCHAR(40),
      tax_id VARCHAR(120),
      avatar_url TEXT,
      social_links JSON NOT NULL DEFAULT (JSON_OBJECT()),
      password_updated_at DATETIME(3),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(
    `ALTER TABLE auth_users MODIFY COLUMN role ENUM(${ROLE_ENUM_SQL}) NOT NULL DEFAULT 'staff'`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      session_token CHAR(64) NOT NULL UNIQUE,
      device_type VARCHAR(32) NOT NULL,
      user_agent_hash CHAR(64) NOT NULL,
      user_agent TEXT,
      remember_me TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      expires_at DATETIME(3) NOT NULL,
      last_active DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await pool.query('CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id)');
  } catch (error) {
    if (error?.code !== 'ER_DUP_KEYNAME') {
      throw error;
    }
  }
}

async function createAdmin(email, password, role) {
  const id = randomUUID();
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedRole = role?.trim().toLowerCase();
  if (normalizedRole && !ROLE_VALUES.includes(normalizedRole)) {
    throw new Error(
      `角色 ${normalizedRole} 无效，可选值: ${ROLE_VALUES.join(', ')}`
    );
  }
  const userRole = normalizedRole || 'finance_admin';
  const displayName = normalizedEmail.split('@')[0];

  const [existing] = await sql`
      SELECT id FROM auth_users WHERE email = ${normalizedEmail} LIMIT 1
    `;

  if (existing.length > 0) {
    throw new Error(`邮箱 ${normalizedEmail} 已存在`);
  }

  await sql`
    INSERT INTO auth_users (id, email, password_hash, role, display_name)
    VALUES (${id}, ${normalizedEmail}, ${passwordHash}, ${userRole}, ${displayName})
  `;

  return { id, email: normalizedEmail, role: userRole };
}

async function main() {
  let exitCode = 0;
  try {
    const [, , email, password, role] = process.argv;

    if (!email || !password) {
      console.error(
        `用法: npm run seed:admin -- <email> <password> [role]\n可选角色: ${ROLE_VALUES.join(', ')}`
      );
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
