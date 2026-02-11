import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { logAuthAudit } from '@/lib/auth/audit';
import { getEmployeeById } from '@/lib/hr/employees';
import { updateUserPassword } from '@/lib/users';
import { checkPermission, Permissions } from '@/lib/permissions';

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_UPDATE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { employeeId } = await params;
    const employee = await getEmployeeById(employeeId);
    if (!employee) {
      return notFoundResponse('员工不存在');
    }

    const body = await request.json().catch(() => ({}));
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword.trim() : '';

    if (!newPassword) {
      return badRequestResponse('请输入新密码');
    }
    if (newPassword.length < 8) {
      return badRequestResponse('新密码至少需要 8 个字符');
    }
    if (confirmPassword && confirmPassword !== newPassword) {
      return badRequestResponse('两次输入的新密码不一致');
    }

    await updateUserPassword(employeeId, newPassword);
    await logAuthAudit({
      actorId: context.user.id,
      targetId: employeeId,
      action: 'password.reset',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('重置员工密码失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
