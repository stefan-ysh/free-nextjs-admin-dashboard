import { schemaPool, safeCreateIndex } from '@/lib/schema/mysql-utils';
import { AUTH_ROLE_VALUES } from './roles';

const ROLE_VALUES = AUTH_ROLE_VALUES;

const ROLE_ENUM_SQL = ROLE_VALUES.map((role) => `'${role}'`).join(',');

let initialized = false;

export async function ensureAuthSchema() {
  if (initialized) return;

  const pool = schemaPool();

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

  await safeCreateIndex('CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id)');

  initialized = true;
}
