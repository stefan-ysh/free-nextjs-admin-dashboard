import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import {
  createApplication,
  listApplications,
  CreateApplicationPayload,
} from '@/lib/db/inventory-applications';
import { InventoryApplicationStatus } from '@/types/inventory';

function unauthorizedResponse() {
  return NextResponse.json({ error: '未登录' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    
    // Determine permissions:
    // Regular users: see their own applications
    // Approvers (Admin/Manager): see all pending, or filtered list
    // For now, let's implement basic logic:
    // If has VIEW_INVENTORY, sees all? Or need specific permission?
    // Let's rely on query params and basic role check.
    // Simplifying: Everyone can see their own. 
    // Admins (INVENTORY_OPERATE_OUTBOUND or specialized perm) can see all.
    
    const canManage = await checkPermission(permissionUser, Permissions.INVENTORY_OPERATE_OUTBOUND);
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as InventoryApplicationStatus | null;
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 20;
    
    // If not manager, force filter by applicantId
    const applicantId = canManage.allowed ? (searchParams.get('applicantId') || undefined) : permissionUser.id;

    const result = await listApplications({
      applicantId,
      status: status ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('[inventory.applications] GET failed', error);
    return NextResponse.json({ error: '获取申请列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    
    // Any logged in user can apply? Or restricted?
    // Let's assume basic business user license is enough.
    
    const payload = (await request.json()) as CreateApplicationPayload;
    
    // Force applicant to be current user
    const safePayload: CreateApplicationPayload = {
      ...payload,
      applicantId: permissionUser.id,
      applicantName: permissionUser.displayName || permissionUser.email || '未知用户',
      department: permissionUser.department ?? undefined,
    };

    const application = await createApplication(safePayload);
    
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('[inventory.applications] POST failed', error);
    return NextResponse.json({ error: '提交申请失败' }, { status: 500 });
  }
}
