import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { rejectApplication } from '@/lib/db/inventory-applications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const perm = await checkPermission(permissionUser, Permissions.INVENTORY_OPERATE_OUTBOUND);
    if (!perm.allowed) {
      return NextResponse.json({ error: '无权操作' }, { status: 403 });
    }

    const body = await request.json();
    const reason = body.reason;

    const application = await rejectApplication(
      id,
      permissionUser.id,
      permissionUser.displayName || permissionUser.email || 'Admin',
      reason
    );
    
    return NextResponse.json(application);
  } catch (error) {
    console.error('[inventory.applications.reject] failed', error);
    if (error instanceof Error && error.message === 'APPLICATION_NOT_FOUND') {
        return NextResponse.json({ error: '申请不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: '拒绝申请失败' }, { status: 500 });
  }
}
