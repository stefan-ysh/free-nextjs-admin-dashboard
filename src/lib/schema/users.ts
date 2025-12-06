import type { RowDataPacket } from 'mysql2/promise';

import { ensureHrSchema } from '@/lib/hr/schema';
import { schemaPool } from '@/lib/schema/mysql-utils';

/**
 * @deprecated 用户表已合并到 hr_employees，保留该方法是为了兼容旧的 ensureUsersSchema 调用。
 */
export async function ensureUsersSchema() {
  const pool = schemaPool();

  // Drop any foreign keys that still reference the legacy users table before removing it
  const [legacyFkRows] = await pool.query<
    Array<RowDataPacket & { TABLE_NAME: string; CONSTRAINT_NAME: string }>
  >(`
    SELECT TABLE_NAME, CONSTRAINT_NAME
    FROM information_schema.referential_constraints
    WHERE constraint_schema = DATABASE()
      AND referenced_table_name = 'users'
  `);

  for (const fk of legacyFkRows) {
    await pool.query(`ALTER TABLE \`${fk.TABLE_NAME}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);

    // Only reimbursement_logs keeps a renamed FK; recreate it pointing at hr_employees
    if (fk.TABLE_NAME === 'reimbursement_logs' && fk.CONSTRAINT_NAME === 'fk_reimbursement_operator') {
      await pool.query(
        'ALTER TABLE reimbursement_logs ADD CONSTRAINT fk_reimbursement_operator FOREIGN KEY (operator_id) REFERENCES hr_employees(id) ON DELETE RESTRICT'
      );
    }
  }

  // 彻底移除遗留的 users/auth_users 表，防止后续代码意外写入
  await pool.query('DROP TABLE IF EXISTS users');
  await pool.query('DROP TABLE IF EXISTS auth_users');
  await ensureHrSchema();
}
