import mysql, { Pool, PoolOptions, RowDataPacket, PoolConnection } from 'mysql2/promise';

// Use globalThis to prevent multiple pools in development
const globalForMysql = globalThis as unknown as { mysqlPool: Pool | null };

function resolvePoolOptions(): PoolOptions {
  const connectionLimit = Number(process.env.MYSQL_POOL_SIZE ?? '10');
  const mysqlTimezone = process.env.MYSQL_TIMEZONE?.trim() || '+08:00';
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;

  if (url && url.trim()) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || '3306'),
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'admin_cosmorigin'),
      waitForConnections: true,
      connectionLimit,
      decimalNumbers: true,
      timezone: mysqlTimezone,
    } satisfies PoolOptions;
  }

  const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT ?? '3306');
  const user = process.env.MYSQL_USER?.trim() || 'root';
  const password = process.env.MYSQL_PASSWORD ?? '';
  const database = process.env.MYSQL_DATABASE?.trim() || 'admin_cosmorigin';

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit,
    decimalNumbers: true,
    timezone: mysqlTimezone,
  } satisfies PoolOptions;
}

function getPool(): Pool {
  if (!globalForMysql.mysqlPool) {
    globalForMysql.mysqlPool = mysql.createPool(resolvePoolOptions());
  }
  return globalForMysql.mysqlPool;
}

function buildQuery(strings: TemplateStringsArray, values: unknown[]) {
  let sql = '';
  for (let i = 0; i < strings.length; i += 1) {
    sql += strings[i];
    if (i < values.length) {
      sql += '?';
    }
  }
  return { sql, values };
}

export type MysqlQueryResult<T> = { rows: T[] };

export async function mysqlQuery<T extends RowDataPacket = RowDataPacket>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<MysqlQueryResult<T>> {
  const poolInstance = getPool();
  const { sql, values: params } = buildQuery(strings, values);

  const start = performance.now();
  try {
    const [rows] = await poolInstance.query<T[]>(sql, params);
    const duration = performance.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[MySQL] ${duration.toFixed(2)}ms - ${sql}`);
    }

    return { rows };
  } catch (error) {
    console.error('[MySQL Error]', sql, error);
    throw error;
  }
}

export { getPool as mysqlPool };

export async function withTransaction<T>(
  handler: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
