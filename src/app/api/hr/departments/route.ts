import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { createDepartment, listDepartments } from '@/lib/hr/departments';
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

function conflictResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 409 });
}

function mapDomainError(error: Error) {
  switch (error.message) {
    case 'DEPARTMENT_NAME_REQUIRED':
      return badRequestResponse('部门名称为必填项');
    case 'DEPARTMENT_CODE_CONFLICT':
      return conflictResponse('部门编码已存在');
    case 'DEPARTMENT_PARENT_NOT_FOUND':
      return badRequestResponse('父级部门不存在');
    case 'DEPARTMENT_PARENT_SELF':
      return badRequestResponse('父级部门不能是自身');
    case 'DEPARTMENT_PARENT_CYCLE':
      return badRequestResponse('父级部门形成循环引用');
    default:
      return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const departments = await listDepartments();
    return NextResponse.json({ success: true, data: departments });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取部门列表失败', error);
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

    const record = await createDepartment({
      name: body.name,
      code: body.code,
      parentId: body.parentId,
      description: body.description,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return unauthorizedResponse();
      }
      if (
        error.message === 'DEPARTMENT_NAME_REQUIRED' ||
        error.message === 'DEPARTMENT_CODE_CONFLICT' ||
        error.message === 'DEPARTMENT_PARENT_NOT_FOUND' ||
        error.message === 'DEPARTMENT_PARENT_SELF' ||
        error.message === 'DEPARTMENT_PARENT_CYCLE'
      ) {
        return mapDomainError(error);
      }
    }
    console.error('创建部门失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
