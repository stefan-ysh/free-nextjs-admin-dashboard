import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  createEmployee,
  EmploymentStatus,
  listEmployees,
  ListEmployeesParams,
} from '@/lib/hr/employees';
import { deleteAvatarAsset, saveAvatarToLocal } from '@/lib/storage/avatar';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function normalizeStatusParam(value: string | null): ListEmployeesParams['status'] {
  if (!value) return undefined;
  if (value === 'all') return 'all';
  if (value === 'active' || value === 'on_leave' || value === 'terminated') {
    return value as EmploymentStatus;
  }
  return undefined;
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
    const search = searchParams.get('search') ?? undefined;
    const department = searchParams.get('department') ?? undefined;
    const departmentId = searchParams.get('departmentId') ?? undefined;
    const jobGradeId = searchParams.get('jobGradeId') ?? undefined;
    const status = normalizeStatusParam(searchParams.get('status'));
    const page = Number.parseInt(searchParams.get('page') ?? '', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '', 10);
    const sortByParam = searchParams.get('sortBy') ?? undefined;
    const sortOrderParam = searchParams.get('sortOrder') ?? undefined;

    const allowedSorts: ListEmployeesParams['sortBy'][] = [
      'createdAt',
      'updatedAt',
      'lastName',
      'department',
      'status',
    ];
    const sortBy = allowedSorts.includes(sortByParam as ListEmployeesParams['sortBy'])
      ? (sortByParam as ListEmployeesParams['sortBy'])
      : undefined;

    const sortOrder = sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : undefined;

    const result = await listEmployees({
      search,
      department,
      departmentId,
      jobGradeId,
      status,
      page: Number.isNaN(page) ? undefined : page,
      pageSize: Number.isNaN(pageSize) ? undefined : pageSize,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取员工列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uploadedAvatarPath: string | null = null;
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_CREATE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return badRequestResponse('请求体格式错误');
    }

    const trimmedAvatarDataUrl = typeof body.avatarDataUrl === 'string' ? body.avatarDataUrl.trim() : '';
    if (trimmedAvatarDataUrl) {
      uploadedAvatarPath = await saveAvatarToLocal(trimmedAvatarDataUrl);
    }

    const result = await createEmployee({
      userId: body.userId,
      employeeCode: body.employeeCode,
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: body.displayName,
      avatarUrl: uploadedAvatarPath ?? null,
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
      employmentStatus: body.employmentStatus,
      hireDate: body.hireDate,
      terminationDate: body.terminationDate,
      managerId: body.managerId,
      location: body.location,
      customFields: body.customFields,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
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
    console.error('创建员工失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
