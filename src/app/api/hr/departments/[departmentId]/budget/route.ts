import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getDepartmentBudgetSummary, upsertDepartmentBudget } from '@/lib/hr/budgets';
import { checkPermission, Permissions } from '@/lib/permissions';

type RouteContext = {
  params: Promise<{ departmentId: string }>;
};

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { departmentId } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    const data = await getDepartmentBudgetSummary(departmentId, year);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取部门预算详情失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { departmentId } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_UPDATE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const body = await request.json().catch(() => ({}));
    const year = Number(body.year ?? new Date().getFullYear());
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return badRequestResponse('预算金额不正确');
    }

    await upsertDepartmentBudget(departmentId, year, amount);
    const data = await getDepartmentBudgetSummary(departmentId, year);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('更新部门预算失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
