import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  createEmployee,
  EmploymentStatus,
  getEmployeeById,
  listEmployees,
  ListEmployeesParams,
  ensureEmployeeUserAccount,
} from '@/lib/hr/employees';
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
    const status = normalizeStatusParam(searchParams.get('status'));
    const page = Number.parseInt(searchParams.get('page') ?? '', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '', 10);
    const sortByParam = searchParams.get('sortBy') ?? undefined;
    const sortOrderParam = searchParams.get('sortOrder') ?? undefined;

    const allowedSorts: ListEmployeesParams['sortBy'][] = [
      'createdAt',
      'updatedAt',
      'displayName',
      'status',
    ];
    const sortBy = allowedSorts.includes(sortByParam as ListEmployeesParams['sortBy'])
      ? (sortByParam as ListEmployeesParams['sortBy'])
      : undefined;

    const sortOrder = sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : undefined;

    const result = await listEmployees({
      search,
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
    const initialPassword = typeof body.initialPassword === 'string' ? body.initialPassword.trim() : '';
    if (!initialPassword) {
      return badRequestResponse('请设置初始密码');
    }


    const result = await createEmployee({
      employeeCode: body.employeeCode,
      displayName: body.displayName,
      email: body.email,
      phone: body.phone,
      initialPassword,
      gender: body.gender,
      address: body.address,
      employmentStatus: body.employmentStatus,
      hireDate: body.hireDate,
      terminationDate: body.terminationDate,
      location: body.location,
      customFields: body.customFields,
      roles: body.roles,
      primaryRole: body.primaryRole,
    });

    let finalRecord = result;
    if (!finalRecord.userId) {
      try {
        await ensureEmployeeUserAccount(result.id);
        const refreshed = await getEmployeeById(result.id);
        if (refreshed) {
          finalRecord = refreshed;
        }
      } catch (autoBindError) {
        console.warn('自动生成系统账号失败', autoBindError);
      }
    }

    return NextResponse.json({ success: true, data: finalRecord }, { status: 201 });
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
        return badRequestResponse('工号已存在');
      }
      if (error.message === 'MISSING_PASSWORD') {
        return badRequestResponse('请设置初始密码');
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
    console.error('创建员工失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
