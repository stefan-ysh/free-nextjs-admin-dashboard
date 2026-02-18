import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPurchaseAuditLogs } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import { isReimbursementAction } from '@/types/purchase';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const canAudit = await checkPermission(permissionUser, Permissions.PURCHASE_AUDIT_VIEW);
    if (!canAudit.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const actionParam = searchParams.get('action');

    const result = await listPurchaseAuditLogs({
      search: searchParams.get('search') ?? undefined,
      action: actionParam === 'all' || actionParam == null ? 'all' : isReimbursementAction(actionParam) ? actionParam : 'all',
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      operatorId: searchParams.get('operatorId') ?? undefined,
      page: parseNumber(searchParams.get('page'), 1),
      pageSize: parseNumber(searchParams.get('pageSize'), 30),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取采购审计日志失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
