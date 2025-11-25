import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getStats } from '@/lib/db/finance';
import { checkPermission, Permissions } from '@/lib/permissions';
import { FinanceApiResponse, FinanceStats, TransactionType, PaymentType } from '@/types/finance';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function parseNumberParam(value: string | null): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * GET - 获取财务统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const typeParam = searchParams.get('type') as TransactionType | null;
    const paymentParam = searchParams.get('paymentType') as PaymentType | null;
    const category = searchParams.get('category') || undefined;
    const keyword = searchParams.get('keyword')?.trim() || undefined;
    const minAmount = parseNumberParam(searchParams.get('minAmount'));
    const maxAmount = parseNumberParam(searchParams.get('maxAmount'));

    const typeFilter = typeParam && [TransactionType.INCOME, TransactionType.EXPENSE].includes(typeParam)
      ? typeParam
      : undefined;

    const paymentType = paymentParam && Object.values(PaymentType).includes(paymentParam)
      ? paymentParam
      : undefined;

    const stats = await getStats({
      startDate,
      endDate,
      type: typeFilter,
      paymentType,
      category: category || undefined,
      keyword,
      minAmount,
      maxAmount,
    });

    const response: FinanceApiResponse<FinanceStats> = {
      success: true,
      data: stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
