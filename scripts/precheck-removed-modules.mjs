import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const TARGET_TABLES = [
  'purchase_workflow_configs',
  'purchase_payments',
  'project_payments',
  'projects',
  'calendar_events',
  'client_logs',
  'client_contacts',
  'clients',
];

function resolveMysqlConfig() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url?.trim()) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || '3306'),
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'admin_cosmorigin'),
    };
  }
  return {
    host: process.env.MYSQL_HOST?.trim() || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER?.trim() || 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE?.trim() || 'admin_cosmorigin',
  };
}

async function main() {
  const pool = mysql.createPool({
    ...resolveMysqlConfig(),
    waitForConnections: true,
    connectionLimit: 5,
    decimalNumbers: true,
    timezone: 'Z',
  });

  try {
    const tableNamesSql = TARGET_TABLES.map(() => '?').join(',');
    const [tableRows] = await pool.query(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (${tableNamesSql})`,
      TARGET_TABLES
    );

    const existingTables = new Set(tableRows.map((row) => row.table_name));
    console.log('=== Removed Modules Cleanup Precheck ===');
    console.log(`Database: ${resolveMysqlConfig().database}`);
    console.log('');

    for (const tableName of TARGET_TABLES) {
      if (!existingTables.has(tableName)) {
        console.log(`- ${tableName}: not found (skip)`);
        continue;
      }
      const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
      const total = Number(countRows[0]?.total ?? 0);
      console.log(`- ${tableName}: exists, rows=${total}`);
    }

    console.log('');
    const [fkRows] = await pool.query(
      `SELECT
         kcu.CONSTRAINT_NAME AS constraint_name,
         kcu.TABLE_NAME AS table_name,
         kcu.COLUMN_NAME AS column_name,
         kcu.REFERENCED_TABLE_NAME AS referenced_table_name,
         kcu.REFERENCED_COLUMN_NAME AS referenced_column_name
       FROM information_schema.KEY_COLUMN_USAGE kcu
       WHERE kcu.TABLE_SCHEMA = DATABASE()
         AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
         AND (
           kcu.TABLE_NAME IN (${tableNamesSql})
           OR kcu.REFERENCED_TABLE_NAME IN (${tableNamesSql})
         )
       ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME`,
      [...TARGET_TABLES, ...TARGET_TABLES]
    );

    if (!fkRows.length) {
      console.log('Foreign keys touching removed tables: none');
    } else {
      console.log('Foreign keys touching removed tables:');
      for (const row of fkRows) {
        console.log(
          `- ${row.constraint_name}: ${row.table_name}.${row.column_name} -> ${row.referenced_table_name}.${row.referenced_column_name}`
        );
      }
    }

    console.log('');
    const [legacyColumnRows] = await pool.query(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finance_records'
         AND COLUMN_NAME = 'purchase_payment_id'`
    );
    console.log(
      `finance_records.purchase_payment_id: ${legacyColumnRows.length ? 'exists (will be removed)' : 'not found'}`
    );

    const blockingReferences = fkRows.filter((row) => {
      const table = row.table_name;
      const referencedTable = row.referenced_table_name;
      const tableIsTarget = TARGET_TABLES.includes(table);
      const referencedIsTarget = TARGET_TABLES.includes(referencedTable);
      return !tableIsTarget && referencedIsTarget;
    });

    console.log('');
    if (blockingReferences.length) {
      console.log('Result: BLOCKED');
      console.log('Reason: non-removed tables still reference removed tables.');
      process.exitCode = 2;
      return;
    }

    console.log('Result: PASS');
    console.log('You can run scripts/cleanup_removed_modules.sql safely after backup.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('precheck removed modules failed', error);
  process.exitCode = 1;
});
