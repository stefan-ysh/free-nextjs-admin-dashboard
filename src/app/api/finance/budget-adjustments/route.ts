import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { createBudgetAdjustment, listBudgetAdjustments } from '@/lib/db/finance';
import { checkPermission, Permissions } from '@/lib/permissions';
import { UserRole } from '@/types/user';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function resolveFinanceOrgByRole(role: UserRole): 'school' | 'company' | undefined {
  if (role === UserRole.FINANCE_SCHOOL) return 'school';
  if (role === UserRole.FINANCE_COMPANY) return 'company';
  return undefined;
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const canView = await checkPermission(permissionUser, Permissions.FINANCE_VIEW_ALL);
    if (!canView.allowed) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const requestedOrg = searchParams.get('organizationType');
    const roleOrg = resolveFinanceOrgByRole(permissionUser.primaryRole);
    const organizationType =
      requestedOrg === 'school' || requestedOrg === 'company'
        ? requestedOrg
        : roleOrg;

    const data = await listBudgetAdjustments({
      organizationType,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 20),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    console.error('加载预算调整记录失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const canManage = await checkPermission(permissionUser, Permissions.FINANCE_MANAGE);
    if (!canManage.allowed) return forbiddenResponse();

    const body = (await request.json()) as {
      organizationType?: string;
      adjustmentType?: string;
      amount?: number;
      title?: string;
      note?: string | null;
      occurredAt?: string;
    };
    const organizationType = body.organizationType === 'school' || body.organizationType === 'company'
      ? body.organizationType
      : resolveFinanceOrgByRole(permissionUser.primaryRole) ?? 'company';
    const adjustmentType = body.adjustmentType === 'decrease' ? 'decrease' : 'increase';
    const amount = Number(body.amount ?? 0);
    const title = String(body.title ?? '').trim();
    const occurredAt = String(body.occurredAt ?? '');

    if (!title) return badRequestResponse('调整标题不能为空');
    if (!Number.isFinite(amount) || amount <= 0) return badRequestResponse('调整金额必须大于 0');
    if (!occurredAt) return badRequestResponse('调整日期不能为空');

    const created = await createBudgetAdjustment({
      organizationType,
      adjustmentType,
      amount,
      title,
      note: body.note ?? null,
      occurredAt,
      createdBy: permissionUser.id,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    if (error instanceof Error) {
      if (error.message === 'INVALID_DATE') return badRequestResponse('调整日期格式不正确');
      if (error.message === 'INVALID_BUDGET_ADJUSTMENT_AMOUNT') return badRequestResponse('调整金额必须大于 0');
      if (error.message === 'BUDGET_ADJUSTMENT_TITLE_REQUIRED') return badRequestResponse('调整标题不能为空');
    }
    console.error('创建预算调整失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
