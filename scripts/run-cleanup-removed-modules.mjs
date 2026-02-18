import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

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
  const sqlPath = path.join(process.cwd(), 'scripts', 'cleanup_removed_modules.sql');
  const sqlText = await fs.readFile(sqlPath, 'utf8');

  const conn = await mysql.createConnection({
    ...resolveMysqlConfig(),
    multipleStatements: true,
  });

  try {
    await conn.query(sqlText);
    console.log('cleanup_removed_modules.sql executed successfully');
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('run cleanup removed modules failed', error);
  process.exitCode = 1;
});
