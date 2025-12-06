import fs from 'node:fs/promises';
import path from 'node:path';

import Papa from 'papaparse';

import './load-env';

import { mysqlPool } from '../src/lib/mysql';
import { ensureHrSchema } from '../src/lib/hr/schema';
import type { CreateEmployeeInput, EmployeeGender, EmploymentStatus } from '../src/lib/hr/employees';
import { createEmployee, updateEmployee } from '../src/lib/hr/employees';

const HEADERS = {
  name: '姓名',
  gender: '性别',
  phone: '电话',
  nationalId: '身份证',
  email: '邮箱',
  bank: '银行',
  bankBranch: '开户行',
  bankAccount: '银行账号',
  jobTitle: '职位',
} as const;

type CsvRow = Record<(typeof HEADERS)[keyof typeof HEADERS], string | undefined> & {
  [key: string]: string | undefined;
};

type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
};

function sanitize(value: string | undefined | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeGender(value: string | null): EmployeeGender | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['male', 'm', '男', 'nan'].includes(normalized)) return 'male';
  if (['female', 'f', '女', 'nv'].includes(normalized)) return 'female';
  return 'other';
}

function splitChineseName(fullName: string | null): { firstName: string; lastName: string } {
  const fallback = fullName?.trim();
  if (!fallback) {
    return { firstName: '员工', lastName: '未名' };
  }
  if (fallback.length === 1) {
    return { firstName: fallback, lastName: fallback };
  }
  const lastName = fallback[0];
  const firstName = fallback.slice(1) || fallback;
  return { firstName, lastName };
}

async function findEmployeeIdBy(column: string, value: string | null): Promise<string | null> {
  if (!value) return null;
  const pool = mysqlPool();
  const [rows] = await pool.query<Array<{ id: string } & Record<string, string>>>(
    `SELECT id FROM hr_employees WHERE ${column} = ? LIMIT 1`,
    [value]
  );
  return rows[0]?.id ?? null;
}

async function resolveExistingEmployee(row: CsvRow): Promise<string | null> {
  const nationalId = sanitize(row[HEADERS.nationalId]);
  const email = sanitize(row[HEADERS.email]);
  const phone = sanitize(row[HEADERS.phone]);

  return (
    (nationalId ? await findEmployeeIdBy('national_id', nationalId) : null) ||
    (email ? await findEmployeeIdBy('LOWER(email)', email.toLowerCase()) : null) ||
    (phone ? await findEmployeeIdBy('phone', phone) : null)
  );
}

function buildEmployeeInput(row: CsvRow): CreateEmployeeInput {
  const fullName = sanitize(row[HEADERS.name]);
  const { firstName, lastName } = splitChineseName(fullName);
  const nationalId = sanitize(row[HEADERS.nationalId]);
  const gender = normalizeGender(sanitize(row[HEADERS.gender]));
  const phone = sanitize(row[HEADERS.phone]);
  const email = sanitize(row[HEADERS.email]);
  const bankName = sanitize(row[HEADERS.bank]);
  const bankAccount = sanitize(row[HEADERS.bankAccount]);
  const bankBranch = sanitize(row[HEADERS.bankBranch]);
  const jobTitle = sanitize(row[HEADERS.jobTitle]);

  return {
    employeeCode: nationalId ?? null,
    firstName,
    lastName,
    displayName: fullName,
    email,
    phone,
    jobTitle,
    nationalId,
    gender,
    employmentStatus: 'active' as EmploymentStatus,
    customFields: {
      bankName,
      bankAccount,
      bankBranch,
    },
  } satisfies CreateEmployeeInput;
}

async function upsertEmployee(row: CsvRow, stats: ImportStats): Promise<void> {
  const name = sanitize(row[HEADERS.name]);
  if (!name) {
    stats.skipped += 1;
    console.warn('Skipped row without 姓名:', row);
    return;
  }

  const input = buildEmployeeInput(row);
  const existingId = await resolveExistingEmployee(row);

  if (existingId) {
    await updateEmployee(existingId, input);
    stats.updated += 1;
    return;
  }

  await createEmployee(input);
  stats.created += 1;
}

async function main() {
  const [, , rawPath] = process.argv;
  if (!rawPath) {
    console.error('用法: npx tsx scripts/import-employees.ts <employees.csv>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), rawPath);
  const fileBuffer = await fs.readFile(absolutePath, 'utf8');

  const parsed = Papa.parse<CsvRow>(fileBuffer, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length) {
    console.error('CSV 解析失败:', parsed.errors);
    process.exit(1);
  }

  await ensureHrSchema();

  const stats: ImportStats = { created: 0, updated: 0, skipped: 0 };

  for (const row of parsed.data) {
    try {
      await upsertEmployee(row, stats);
    } catch (error) {
      stats.skipped += 1;
      console.error('导入行失败:', row, error);
    }
  }

  console.log(`导入完成 -> 新增 ${stats.created} 条, 更新 ${stats.updated} 条, 跳过 ${stats.skipped} 条.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('导入过程中出现异常:', error);
  process.exit(1);
});
