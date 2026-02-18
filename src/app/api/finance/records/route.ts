import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  getRecords,
  getRecordsCount,
  //   getRecord,
  //   updateRecord,
  //   deleteRecord
} from '@/lib/db/finance';
import { checkPermission, Permissions } from '@/lib/permissions';
import { FinanceRecord, FinanceApiResponse, TransactionType, PaymentType } from '@/types/finance';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function parseNumberParam(value: string | null): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * GET - 获取财务记录列表
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
    const requestedPage = Number.parseInt(searchParams.get('page') || '', 10);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
    const page = Number.isNaN(requestedPage) ? 1 : Math.max(1, requestedPage);
    const limit = Number.isNaN(requestedLimit)
      ? 20
      : Math.min(Math.max(1, requestedLimit), 200);
    const offset = (page - 1) * limit;

    const typeParam = searchParams.get('type') as TransactionType | null;
    const paymentParam = searchParams.get('paymentType') as PaymentType | null;
    const category = searchParams.get('category') || undefined;
    const keyword = searchParams.get('keyword')?.trim() || undefined;
    const minAmount = parseNumberParam(searchParams.get('minAmount'));
    const maxAmount = parseNumberParam(searchParams.get('maxAmount'));
    const handlerId = searchParams.get('handlerId')?.trim() || undefined;

    const typeFilter = typeParam && [TransactionType.INCOME, TransactionType.EXPENSE].includes(typeParam)
      ? typeParam
      : undefined;

    const paymentType = paymentParam && Object.values(PaymentType).includes(paymentParam)
      ? paymentParam
      : undefined;

    const filters = {
      startDate,
      endDate,
      type: typeFilter,
      paymentType,
      category: category || undefined,
      keyword,
      minAmount,
      maxAmount,
      handlerId,
    } as const;

    const [records, total] = await Promise.all([
      getRecords({ ...filters, limit, offset }),
      getRecordsCount(filters),
    ]);

    const response: FinanceApiResponse<FinanceRecord[]> = {
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Error fetching records:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}

/**
 * POST - 新增手工财务记录（已下线）
 */
export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_MANAGE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }
    return badRequestResponse('手工新增收支记录已下线，请使用“预算调整”功能');
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }

    console.error('Error creating record:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}
