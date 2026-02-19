import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  deleteEmployee,
  EmploymentStatus,
  getEmployeeById,
  ensureEmployeeUserAccount,
  updateEmployee,
  UpdateEmployeeInput,
} from '@/lib/hr/employees';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function notFoundResponse() {
  return NextResponse.json({ success: false, error: '员工不存在' }, { status: 404 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(
  _: Request,
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
    const record = await getEmployeeById(employeeId);
    if (!record) {
      return notFoundResponse();
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取员工详情失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
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
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return badRequestResponse('请求体格式错误');
    }

    const existingRecord = await getEmployeeById(employeeId);
    if (!existingRecord) {
      return notFoundResponse();
    }



    const payload: UpdateEmployeeInput = {
      employeeCode: body.employeeCode,
      displayName: body.displayName,
      email: body.email,
      phone: body.phone,
      gender: body.gender,
      address: body.address,
      employmentStatus: body.employmentStatus as EmploymentStatus | undefined,
      hireDate: body.hireDate,
      terminationDate: body.terminationDate,
      location: body.location,
      customFields: body.customFields,
      statusChangeNote: body.statusChangeNote,
      roles: body.roles,
      primaryRole: body.primaryRole,
    };



    const updated = await updateEmployee(employeeId, payload);
    if (!updated) {
      return notFoundResponse();
    }

    let finalRecord = updated;
    if (!finalRecord.userId) {
      try {
        await ensureEmployeeUserAccount(employeeId);
        const refreshed = await getEmployeeById(employeeId);
        if (refreshed) {
          finalRecord = refreshed;
        }
      } catch (autoBindError) {
        console.warn('更新后自动生成系统账号失败', autoBindError);
      }
    }


    return NextResponse.json({ success: true, data: finalRecord });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return unauthorizedResponse();
      }
      if (error.message === 'EMAIL_EXISTS') {
        return badRequestResponse('邮箱已存在');
      }
      if (error.message === 'PHONE_EXISTS') {
        return badRequestResponse('手机号已存在');
      }
      if (error.message === 'EMPLOYEE_CODE_EXISTS') {
        return badRequestResponse('员工编号已存在');
      }
      if (error.message.startsWith('MISSING_')) {
        return badRequestResponse('缺少必填字段');
      }
      if (error.message === 'INVALID_DATE_FORMAT') {
        return badRequestResponse('日期格式需为 YYYY-MM-DD');
      }
      if (error.message === 'INVALID_STATUS') {
        return badRequestResponse('无效的员工状态');
      }
      if (error.message === 'USER_NOT_FOUND') {
        return badRequestResponse('关联的用户不存在');
      }
    }
    console.error('更新员工失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_DELETE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { employeeId } = await params;
    const record = await getEmployeeById(employeeId);
    if (!record) {
      return notFoundResponse();
    }

    await deleteEmployee(employeeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('删除员工失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
