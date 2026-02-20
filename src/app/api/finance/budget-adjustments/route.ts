import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { createBudgetAdjustment, listBudgetAdjustments } from '@/lib/db/finance';
import { checkPermission, Permissions } from '@/lib/permissions';
import { UserRole } from '@/types/user';
import { budgetAdjustmentSchema } from '@/lib/validations/finance';
import { logSystemAudit } from '@/lib/audit';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function badRequestWithZodErrors(errors: z.ZodError) {
  const fieldErrors = errors.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
  return NextResponse.json({ success: false, error: '校验失败', details: fieldErrors }, { status: 400 });
}

function resolveFinanceOrgByRole(role: UserRole): 'school' | 'company' | undefined {
  if (role === UserRole.FINANCE_SCHOOL) return 'school';
  if (role === UserRole.FINANCE_COMPANY) return 'company';
  // 财务总监不限定组织类型
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

    const rawBody = await request.json();
    const parseResult = budgetAdjustmentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return badRequestWithZodErrors(parseResult.error);
    }

    const { organizationType, adjustmentType, amount, title, note, occurredAt } = parseResult.data;
    const resolvedOrgType = organizationType ?? resolveFinanceOrgByRole(permissionUser.primaryRole) ?? 'company';

    const created = await createBudgetAdjustment({
      organizationType: resolvedOrgType,
      adjustmentType,
      amount,
      title,
      note,
      occurredAt,
      createdBy: permissionUser.id,
    });

    await logSystemAudit({
      userId: permissionUser.id,
      userName: permissionUser.displayName,
      action: 'CREATE',
      entityType: 'BUDGET_ADJUSTMENT',
      entityId: created.id,
      entityName: title,
      newValues: { organizationType: resolvedOrgType, adjustmentType, amount, title },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    console.error('创建预算调整失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
