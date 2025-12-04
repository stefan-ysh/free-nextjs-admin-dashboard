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
import { deleteAvatarAsset, saveAvatarToLocal } from '@/lib/storage/avatar';

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
  let uploadedAvatarPath: string | null = null;
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

    const trimmedAvatarDataUrl = typeof body.avatarDataUrl === 'string' ? body.avatarDataUrl.trim() : '';
    const shouldRemoveAvatar = Boolean(body.removeAvatar);
    if (trimmedAvatarDataUrl) {
      uploadedAvatarPath = await saveAvatarToLocal(trimmedAvatarDataUrl);
    }

    const payload: UpdateEmployeeInput = {
      userId: body.userId,
      employeeCode: body.employeeCode,
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: body.displayName,
      email: body.email,
      phone: body.phone,
      department: body.department,
      departmentId: body.departmentId,
      jobTitle: body.jobTitle,
      jobGradeId: body.jobGradeId,
      nationalId: body.nationalId,
      gender: body.gender,
      address: body.address,
      organization: body.organization,
      educationBackground: body.educationBackground,
      employmentStatus: body.employmentStatus as EmploymentStatus | undefined,
      hireDate: body.hireDate,
      terminationDate: body.terminationDate,
      managerId: body.managerId,
      location: body.location,
      customFields: body.customFields,
      statusChangeNote: body.statusChangeNote,
    };

    if (uploadedAvatarPath) {
      payload.avatarUrl = uploadedAvatarPath;
    } else if (shouldRemoveAvatar) {
      payload.avatarUrl = null;
    }

    const updated = await updateEmployee(employeeId, payload);
    if (!updated) {
      if (uploadedAvatarPath) {
        await deleteAvatarAsset(uploadedAvatarPath).catch(() => undefined);
      }
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

    if (shouldRemoveAvatar && existingRecord.avatarUrl) {
      await deleteAvatarAsset(existingRecord.avatarUrl).catch(() => undefined);
    } else if (uploadedAvatarPath && existingRecord.avatarUrl && existingRecord.avatarUrl !== uploadedAvatarPath) {
      await deleteAvatarAsset(existingRecord.avatarUrl).catch(() => undefined);
    }

    return NextResponse.json({ success: true, data: finalRecord });
  } catch (error) {
    if (uploadedAvatarPath) {
      await deleteAvatarAsset(uploadedAvatarPath).catch(() => undefined);
    }
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return unauthorizedResponse();
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
      if (error.message === 'FILE_TOO_LARGE') {
        return badRequestResponse('头像文件超过允许大小');
      }
      if (error.message === 'UNSUPPORTED_FILE_TYPE') {
        return badRequestResponse('头像文件格式不受支持');
      }
      if (error.message === 'The provided string is not a valid base64 data URI') {
        return badRequestResponse('头像数据无效');
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
