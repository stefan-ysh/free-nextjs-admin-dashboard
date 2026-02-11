import { getDepartmentBudgetSummaryByEmployee } from '@/lib/hr/budgets';
import { isAdmin, isFinance, type UserProfile } from '@/types/user';

type BudgetGuardInput = {
  purchaserId: string;
  purchaseDate?: string | null;
  totalAmount: number;
  actor: UserProfile;
};

function resolveBudgetYear(purchaseDate?: string | null): number {
  if (!purchaseDate) return new Date().getFullYear();
  const parsed = new Date(purchaseDate);
  if (Number.isNaN(parsed.getTime())) return new Date().getFullYear();
  return parsed.getFullYear();
}

export async function ensureDepartmentBudgetWithinLimit(input: BudgetGuardInput): Promise<void> {
  const totalAmount = Number(input.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return;
  }

  const year = resolveBudgetYear(input.purchaseDate);
  const summary = await getDepartmentBudgetSummaryByEmployee(input.purchaserId, year);
  if (!summary || summary.budgetAmount == null) {
    return;
  }

  const canOverride = isAdmin(input.actor) || isFinance(input.actor);
  const remaining = summary.remainingAmount ?? 0;
  if (!canOverride && totalAmount > remaining) {
    throw new Error('BUDGET_EXCEEDED');
  }
}

