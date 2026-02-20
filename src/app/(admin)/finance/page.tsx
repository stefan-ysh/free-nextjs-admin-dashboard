import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { getRecords, getRecordsCount, getStats, getCategories } from '@/lib/db/finance';
import { PaymentType, TransactionType } from '@/types/finance';
import FinanceClient from '@/components/finance/FinanceClient';

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await requireCurrentUser();
  const permissionUser = await toPermissionUser(context.user);
  const viewPerm = await checkPermission(permissionUser, Permissions.FINANCE_VIEW_ALL);
  const managePerm = await checkPermission(permissionUser, Permissions.FINANCE_MANAGE);

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.pageSize ?? params.limit) || 10;
  const startDate = params.startDate as string | undefined;
  const endDate = params.endDate as string | undefined;
  const typeParam = params.type as string | undefined;
  const category = (params.category as string | undefined) || undefined;
  const minAmount = params.minAmount ? Number(params.minAmount) : undefined;
  const maxAmount = params.maxAmount ? Number(params.maxAmount) : undefined;
  const keyword = (params.keyword as string | undefined)?.trim() || undefined;
  const paymentParam = params.paymentType as string | undefined;

  const effectiveStartDate = startDate;
  const effectiveEndDate = endDate;

  const offset = (page - 1) * limit;

  const typeFilter = [TransactionType.INCOME, TransactionType.EXPENSE].includes(
    typeParam as TransactionType
  )
    ? (typeParam as TransactionType)
    : undefined;

  const paymentType = Object.values(PaymentType).includes(paymentParam as PaymentType)
    ? (paymentParam as PaymentType)
    : undefined;

  const filters = {
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    type: typeFilter,
    category,
    minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
    maxAmount: Number.isFinite(maxAmount) ? maxAmount : undefined,
    keyword,
    paymentType,
  } as const;

  const [records, total, stats, incomeCategories, expenseCategories] = await Promise.all([
    getRecords({ ...filters, limit, offset }),
    getRecordsCount(filters),
    getStats(filters),
    getCategories(TransactionType.INCOME),
    getCategories(TransactionType.EXPENSE),
  ]);

  return (
    <FinanceClient
      records={records}
      stats={stats}
      categories={{ income: incomeCategories, expense: expenseCategories }}
      pagination={{
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }}
      permissions={{
        canView: viewPerm.allowed,
        canManage: managePerm.allowed,
      }}
    />
  );
}
