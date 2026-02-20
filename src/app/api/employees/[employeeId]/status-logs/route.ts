import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listEmployeeStatusLogs } from '@/lib/hr/employees';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { employeeId } = await params;
    const { searchParams } = new URL(request.url);
    const limitParam = Number.parseInt(searchParams.get('pageSize') ?? searchParams.get('limit') ?? '', 10);
    const limit = Number.isNaN(limitParam)
      ? 25
      : Math.min(Math.max(limitParam, 1), 100);
    const logs = await listEmployeeStatusLogs(employeeId, limit);

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取状态变更记录失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
