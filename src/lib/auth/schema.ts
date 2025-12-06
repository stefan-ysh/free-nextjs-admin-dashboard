import type { RowDataPacket } from 'mysql2/promise';

import { schemaPool, safeCreateIndex } from '@/lib/schema/mysql-utils';
import { AUTH_ROLE_VALUES } from './roles';

let initialized = false;

export async function ensureAuthSchema() {
  if (initialized) return;

  const pool = schemaPool();

  // NOTE: 登录账号信息全部存放在 hr_employees 表中，因此这里只维护会话表

  // Ensure auth_sessions table exists with correct foreign key to hr_employees table
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
      CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES hr_employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 如果历史遗留的外键仍然指向 users 表，主动删除并重建
  const [fkRows] = await pool.query<Array<RowDataPacket & { REFERENCED_TABLE_NAME: string }>>(`
    SELECT REFERENCED_TABLE_NAME
    FROM information_schema.referential_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'auth_sessions'
      AND constraint_name = 'fk_auth_sessions_user'
    LIMIT 1
  `);

  const referencedTable = fkRows[0]?.REFERENCED_TABLE_NAME;
  if (referencedTable && referencedTable !== 'hr_employees') {
    await pool.query('ALTER TABLE auth_sessions DROP FOREIGN KEY fk_auth_sessions_user');
    await pool.query(
      'ALTER TABLE auth_sessions ADD CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES hr_employees(id) ON DELETE CASCADE'
    );
  }

  await safeCreateIndex('CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id)');

  initialized = true;
}
