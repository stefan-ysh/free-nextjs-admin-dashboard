import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPendingApprovals } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const [canApprove, canReject, canPay] = await Promise.all([
      checkPermission(permissionUser, Permissions.PURCHASE_APPROVE),
      checkPermission(permissionUser, Permissions.PURCHASE_REJECT),
      checkPermission(permissionUser, Permissions.PURCHASE_PAY),
    ]);

    if (!canApprove.allowed && !canReject.allowed && !canPay.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const page = parseNumber(searchParams.get('page'), 1);
    const pageSize = parseNumber(searchParams.get('pageSize'), 50);

    const data = await listPendingApprovals({ search, page, pageSize });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('加载采购审批列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
