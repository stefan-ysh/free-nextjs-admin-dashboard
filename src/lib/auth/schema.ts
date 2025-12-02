import { schemaPool, safeCreateIndex } from '@/lib/schema/mysql-utils';
import { AUTH_ROLE_VALUES } from './roles';

const ROLE_VALUES = AUTH_ROLE_VALUES;

const ROLE_ENUM_SQL = ROLE_VALUES.map((role) => `'${role}'`).join(',');

let initialized = false;

export async function ensureAuthSchema() {
  if (initialized) return;

  const pool = schemaPool();

  // NOTE: auth_users table has been consolidated into users table
  // The users table is created in src/lib/schema/users.ts
  // We no longer create auth_users table here

  // Ensure auth_sessions table exists with correct foreign key to users table
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
      CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id)');

  initialized = true;
}
