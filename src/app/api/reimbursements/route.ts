import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { listReimbursements, createReimbursement } from '@/lib/db/reimbursements';
import { mapReimbursementError } from '@/lib/reimbursements/error-messages';
import { isReimbursementOrganizationType, isReimbursementSourceType, isReimbursementStatus } from '@/types/reimbursement';
import { UserRole } from '@/types/user';
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

function resolveFinanceOrgByRole(role: UserRole): 'school' | 'company' | null {
  if (role === UserRole.FINANCE_SCHOOL) return 'school';
  if (role === UserRole.FINANCE_COMPANY) return 'company';
  return null;
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const canViewAll = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_VIEW_ALL);
    const { searchParams } = new URL(request.url);

    const rawScope = searchParams.get('scope');
    const scope =
      rawScope === 'all' || rawScope === 'approval' || rawScope === 'pay' || rawScope === 'mine'
        ? rawScope
        : 'mine';

    if (scope === 'all' && !canViewAll.allowed) {
      return forbiddenResponse();
    }
    if (scope === 'approval') {
      const canApprove = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_APPROVE);
      if (!canApprove.allowed) return forbiddenResponse();
    }
    if (scope === 'pay') {
      const canPay = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY);
      if (!canPay.allowed) return forbiddenResponse();
    }

    const statusParam = searchParams.get('status');
    const sourceTypeParam = searchParams.get('sourceType');
    const orgTypeParam = searchParams.get('organizationType');

    const data = await listReimbursements({
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 20),
      search: searchParams.get('search') ?? undefined,
      status: isReimbursementStatus(statusParam) ? statusParam : undefined,
      sourceType: isReimbursementSourceType(sourceTypeParam) ? sourceTypeParam : undefined,
      organizationType: isReimbursementOrganizationType(orgTypeParam) ? orgTypeParam : undefined,
      category: searchParams.get('category') ?? undefined,
      currentUserId: permissionUser.id,
      scope,
      financeOrgType: resolveFinanceOrgByRole(permissionUser.primaryRole),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    console.error('获取报销列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const canCreate = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_CREATE);
    if (!canCreate.allowed) return forbiddenResponse();

    const rawBody: unknown = await request.json();
    if (!rawBody || typeof rawBody !== 'object') return badRequestResponse('请求体格式错误');

    const created = await createReimbursement(rawBody as Parameters<typeof createReimbursement>[0], permissionUser.id);
    
    await logSystemAudit({
      userId: context.user.id,
      userName: context.user.display_name ?? '未知用户',
      action: 'CREATE',
      entityType: 'REIMBURSEMENT',
      entityId: created.id,
      entityName: `${created.applicantName} - ${created.amount}元`,
      newValues: rawBody as unknown as Record<string, unknown>,
    });
    
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    const message = mapReimbursementError(error);
    if (message) return badRequestResponse(message);
    console.error('创建报销失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

