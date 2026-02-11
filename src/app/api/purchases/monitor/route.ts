import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getPurchaseMonitorData } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import { parsePurchaseListParams } from '../query-utils';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function parseOverdueHours(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 48;
  return Math.max(1, Math.min(240, Math.floor(parsed)));
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const [canViewAll, canViewDepartment, canApprove, canReject, canPay] = await Promise.all([
      checkPermission(permissionUser, Permissions.PURCHASE_VIEW_ALL),
      checkPermission(permissionUser, Permissions.PURCHASE_VIEW_DEPARTMENT),
      checkPermission(permissionUser, Permissions.PURCHASE_APPROVE),
      checkPermission(permissionUser, Permissions.PURCHASE_REJECT),
      checkPermission(permissionUser, Permissions.PURCHASE_PAY),
    ]);

    if (!canViewAll.allowed && !canViewDepartment.allowed && !canApprove.allowed && !canReject.allowed && !canPay.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const params = parsePurchaseListParams(searchParams);
    const overdueHours = parseOverdueHours(searchParams.get('overdueHours'));

    if (!canViewAll.allowed) {
      params.purchaserId = context.user.id;
    }

    const data = await getPurchaseMonitorData(params, overdueHours);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取采购流程监控失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
