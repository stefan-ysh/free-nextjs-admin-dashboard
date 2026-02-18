import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPendingApprovals } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';

import { parsePurchaseListParams } from '../query-utils';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const [canApprove, canReject] = await Promise.all([
      checkPermission(permissionUser, Permissions.PURCHASE_APPROVE),
      checkPermission(permissionUser, Permissions.PURCHASE_REJECT),
    ]);

    if (!canApprove.allowed && !canReject.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const params = parsePurchaseListParams(searchParams);

    const data = await listPendingApprovals({
      ...params,
      // Strict "my todo" semantics: only items currently assigned to me.
      pendingApproverId: context.user.id,
      includeUnassignedApprovals: false,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('加载采购审批列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
