import { Pool, QueryResult, QueryResultRow } from 'pg';

const connectionString =
	process.env.POSTGRES_URL_NON_POOLING ||
	process.env.DATABASE_URL_UNPOOLED ||
	process.env.POSTGRES_URL ||
	process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error(
		'缺少数据库连接字符串: 请在环境变量中配置 POSTGRES_URL_NON_POOLING、DATABASE_URL_UNPOOLED、POSTGRES_URL 或 DATABASE_URL',
	);
}

type GlobalWithPgPool = typeof globalThis & {
	__pgPool?: Pool;
};

const globalWithPool = globalThis as GlobalWithPgPool;

const pool = globalWithPool.__pgPool ?? new Pool({ connectionString });

if (!globalWithPool.__pgPool) {
	globalWithPool.__pgPool = pool;
}

function buildQueryText(strings: TemplateStringsArray, valuesLength: number): string {
	let query = '';
	for (let index = 0; index < strings.length; index += 1) {
		query += strings[index];
		if (index < valuesLength) {
			query += `$${index + 1}`;
		}
	}
	return query;
}

export async function sql<T extends QueryResultRow = QueryResultRow>(
	strings: TemplateStringsArray,
	...values: unknown[]
): Promise<QueryResult<T>> {
	const text = buildQueryText(strings, values.length);
	return pool.query<T>(text, values);
}

export { pool };
