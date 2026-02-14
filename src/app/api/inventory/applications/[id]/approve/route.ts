import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { approveApplication } from '@/lib/db/inventory-applications';

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

    const application = await approveApplication(
      id,
      permissionUser.id,
      permissionUser.displayName || permissionUser.email || 'Admin'
    );
    
    return NextResponse.json(application);
  } catch (error) {
    console.error('[inventory.applications.approve] failed', error);
    if (error instanceof Error) {
        if (error.message === 'APPLICATION_NOT_FOUND') {
            return NextResponse.json({ error: '申请不存在' }, { status: 404 });
        }
        if (error.message.includes('Stock insufficient')) {
             return NextResponse.json({ error: error.message }, { status: 409 });
        }
    }
    return NextResponse.json({ error: '通过申请失败' }, { status: 500 });
  }
}
