import type { RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';
import { ensureHrSchema } from '@/lib/hr/schema';

const pool = mysqlPool();

type BudgetRow = RowDataPacket & {
  department_id: string;
  budget_year: number;
  budget_amount: number;
};

type DepartmentRow = RowDataPacket & {
  department_id: string | null;
  department: string | null;
};

export type DepartmentBudgetSummary = {
  departmentId: string;
  year: number;
  budgetAmount: number | null;
  usedAmount: number;
  remainingAmount: number | null;
};

function normalizeYear(value?: number | string | null): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  const year = Number.isFinite(parsed) ? Math.trunc(parsed) : new Date().getFullYear();
  return year > 1970 ? year : new Date().getFullYear();
}

export async function upsertDepartmentBudget(
  departmentId: string,
  year: number,
  amount: number
): Promise<void> {
  await ensureHrSchema();
  const normalizedYear = normalizeYear(year);
  const normalizedAmount = Number.isFinite(amount) ? Math.max(0, Number(amount)) : 0;
  await pool.query(
    `INSERT INTO hr_department_budgets (department_id, budget_year, budget_amount)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE budget_amount = VALUES(budget_amount), updated_at = CURRENT_TIMESTAMP(3)`,
    [departmentId, normalizedYear, normalizedAmount]
  );
}

async function getBudgetAmount(departmentId: string, year: number): Promise<number | null> {
  await ensureHrSchema();
  const normalizedYear = normalizeYear(year);
  const [rows] = await pool.query<BudgetRow[]>(
    `SELECT department_id, budget_year, budget_amount
     FROM hr_department_budgets
     WHERE department_id = ? AND budget_year = ?
     LIMIT 1`,
    [departmentId, normalizedYear]
  );
  if (!rows.length) return null;
  return Number(rows[0].budget_amount ?? 0);
}

async function getDepartmentUsedAmount(departmentId: string, year: number): Promise<number> {
  await ensureHrSchema();
  const normalizedYear = normalizeYear(year);
  const [rows] = await pool.query<Array<RowDataPacket & { total: number | null }>>(
    `
    SELECT COALESCE(SUM(p.total_amount + p.fee_amount), 0) AS total
    FROM purchases p
    INNER JOIN hr_employees e ON e.id = p.purchaser_id
    WHERE e.department_id = ?
      AND p.is_deleted = 0
      AND p.status IN ('pending_approval','approved','paid')
      AND YEAR(p.purchase_date) = ?
    `,
    [departmentId, normalizedYear]
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getDepartmentBudgetSummary(
  departmentId: string,
  year: number
): Promise<DepartmentBudgetSummary> {
  const normalizedYear = normalizeYear(year);
  const [budgetAmount, usedAmount] = await Promise.all([
    getBudgetAmount(departmentId, normalizedYear),
    getDepartmentUsedAmount(departmentId, normalizedYear),
  ]);
  const remainingAmount = budgetAmount == null ? null : Math.max(0, Number((budgetAmount - usedAmount).toFixed(2)));
  return {
    departmentId,
    year: normalizedYear,
    budgetAmount,
    usedAmount,
    remainingAmount,
  };
}

export async function getDepartmentBudgetSummaryByEmployee(
  employeeId: string,
  year: number
): Promise<DepartmentBudgetSummary | null> {
  await ensureHrSchema();
  const [rows] = await pool.query<DepartmentRow[]>(
    'SELECT department_id, department FROM hr_employees WHERE id = ? LIMIT 1',
    [employeeId]
  );
  const departmentId = rows[0]?.department_id ?? null;
  if (!departmentId) {
    return null;
  }
  return getDepartmentBudgetSummary(departmentId, year);
}

export async function listDepartmentBudgetSummaries(year: number): Promise<DepartmentBudgetSummary[]> {
  await ensureHrSchema();
  const normalizedYear = normalizeYear(year);
  const [rows] = await pool.query<Array<RowDataPacket & {
    department_id: string;
    budget_amount: number | null;
    used_amount: number | null;
  }>>(
    `
    SELECT
      d.id AS department_id,
      b.budget_amount AS budget_amount,
      COALESCE(SUM(CASE
        WHEN p.id IS NOT NULL
         AND p.is_deleted = 0
         AND p.status IN ('pending_approval','approved','paid')
         AND YEAR(p.purchase_date) = ?
        THEN p.total_amount + p.fee_amount
        ELSE 0
      END), 0) AS used_amount
    FROM hr_departments d
    LEFT JOIN hr_department_budgets b
      ON b.department_id = d.id AND b.budget_year = ?
    LEFT JOIN hr_employees e ON e.department_id = d.id
    LEFT JOIN purchases p ON p.purchaser_id = e.id
    GROUP BY d.id, b.budget_amount
    ORDER BY d.name ASC
    `,
    [normalizedYear, normalizedYear]
  );

  return rows.map((row) => {
    const budgetAmount = row.budget_amount == null ? null : Number(row.budget_amount);
    const usedAmount = Number(row.used_amount ?? 0);
    const remainingAmount = budgetAmount == null ? null : Math.max(0, Number((budgetAmount - usedAmount).toFixed(2)));
    return {
      departmentId: row.department_id,
      year: normalizedYear,
      budgetAmount,
      usedAmount,
      remainingAmount,
    };
  });
}

