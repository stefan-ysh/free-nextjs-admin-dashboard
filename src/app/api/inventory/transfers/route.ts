import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listTransferOrders } from '@/lib/db/inventory';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
  return NextResponse.json({ error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: '无权访问' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.INVENTORY_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const limitParam = new URL(request.url).searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : 50;
    const data = await listTransferOrders(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.transfers] failed to load transfers', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    return NextResponse.json({ error: '加载调拨单失败' }, { status: 500 });
  }
}
