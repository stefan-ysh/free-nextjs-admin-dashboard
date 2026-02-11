import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listDepartmentBudgetSummaries } from '@/lib/hr/budgets';
import { checkPermission, Permissions } from '@/lib/permissions';

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
    const perm = await checkPermission(permissionUser, Permissions.USER_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    const data = await listDepartmentBudgetSummaries(year);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取部门预算失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
