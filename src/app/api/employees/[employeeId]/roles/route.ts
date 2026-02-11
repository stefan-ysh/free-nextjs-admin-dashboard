import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { logAuthAudit } from '@/lib/auth/audit';
import { getEmployeeById } from '@/lib/hr/employees';
import { updateUserRoles } from '@/lib/users';
import { checkPermission, Permissions } from '@/lib/permissions';
import { UserRole } from '@/types/user';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function notFoundResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 404 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

const ALLOWED_ROLE_VALUES = new Set<string>(Object.values(UserRole));

function normalizeRoles(input: unknown): UserRole[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<UserRole>();
  input.forEach((value) => {
    if (typeof value !== 'string') return;
    if (!ALLOWED_ROLE_VALUES.has(value)) return;
    unique.add(value as UserRole);
  });
  return Array.from(unique);
}

function normalizePrimaryRole(role: unknown): UserRole | undefined {
  if (typeof role !== 'string') return undefined;
  if (!ALLOWED_ROLE_VALUES.has(role)) return undefined;
  return role as UserRole;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_ASSIGN_ROLES);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { employeeId } = await params;
    const employee = await getEmployeeById(employeeId);
    if (!employee) {
      return notFoundResponse('员工不存在');
    }
    if (!employee.userId) {
      return notFoundResponse('该员工尚未绑定系统账号');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      console.error('解析请求体失败', error);
      return badRequestResponse('请求体格式错误');
    }
    if (!body || typeof body !== 'object') {
      return badRequestResponse('请求体格式错误');
    }

    const roles = normalizeRoles((body as Record<string, unknown>).roles);
    const primaryRole = normalizePrimaryRole((body as Record<string, unknown>).primaryRole);

    if (!roles.length) {
      return badRequestResponse('至少需要选择一个角色');
    }

    const resolvedPrimary = primaryRole ?? roles[0];
    if (!roles.includes(resolvedPrimary)) {
      return badRequestResponse('主角色必须包含在所选角色列表中');
    }

    await updateUserRoles(employee.userId, roles, resolvedPrimary);
    const updated = await getEmployeeById(employeeId);
    await logAuthAudit({
      actorId: context.user.id,
      targetId: employeeId,
      action: 'roles.update',
      metadata: { roles, primaryRole: resolvedPrimary },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return notFoundResponse('关联账号不存在');
    }
    if (error instanceof Error && error.message === 'ROLES_REQUIRED') {
      return badRequestResponse('至少需要一个角色');
    }
    console.error('更新员工角色失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
