import { type UserProfile } from '@/types/user';

type BudgetGuardInput = {
  purchaserId: string;
  purchaseDate?: string | null;
  totalAmount: number;
  actor: UserProfile;
};

export async function ensureDepartmentBudgetWithinLimit(_input: BudgetGuardInput): Promise<void> {
  // Budget check disabled as department module is removed.
  void _input;
  return;
}
