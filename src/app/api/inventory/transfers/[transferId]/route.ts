import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getTransferOrderDetail } from '@/lib/db/inventory';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
  return NextResponse.json({ error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: '无权访问' }, { status: 403 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ transferId: string }> }
) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.INVENTORY_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { transferId } = await params;
    const data = await getTransferOrderDetail(transferId);
    if (!data) {
      return NextResponse.json({ error: '调拨单不存在' }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.transfer] failed to load transfer detail', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    return NextResponse.json({ error: '加载调拨单失败' }, { status: 500 });
  }
}
