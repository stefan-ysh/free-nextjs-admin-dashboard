import type { Pool, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '@/lib/mysql';

type MysqlError = {
  code?: string;
};

const pool = mysqlPool();

export function schemaPool(): Pool {
  return pool;
}

export async function runDDL(sql: string): Promise<void> {
  await pool.query(sql);
}

export async function safeCreateIndex(sql: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch (error) {
    const code = (error as MysqlError).code;
    if (code !== 'ER_DUP_KEYNAME' && code !== 'ER_CANT_DROP_FIELD_OR_KEY' && code !== 'ER_LOCK_DEADLOCK') {
      throw error;
    }
  }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

export async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  const exists = await columnExists(table, column);
  if (exists) return;
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

async function constraintExists(table: string, constraintName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1`,
    [table, constraintName]
  );
  return rows.length > 0;
}

export async function ensureForeignKey(
  table: string,
  constraintName: string,
  definition: string
): Promise<void> {
  const exists = await constraintExists(table, constraintName);
  if (exists) return;
  await pool.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraintName}\` ${definition}`);
}
