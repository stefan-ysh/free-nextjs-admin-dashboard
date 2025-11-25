import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  importEmployeesFromPayload,
  BulkEmployeeImportRow,
  BulkEmployeeImportOptions,
  EmploymentStatus,
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

function normalizeStatus(value: unknown): EmploymentStatus | undefined {
  if (value === 'active' || value === 'on_leave' || value === 'terminated') {
    return value;
  }
  return undefined;
}

function normalizePayload(body: unknown): BulkEmployeeImportRow[] | null {
  if (!body) return null;
  if (Array.isArray(body)) {
    return body as BulkEmployeeImportRow[];
  }
  if (typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: BulkEmployeeImportRow[] }).items;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const [createPerm, updatePerm] = await Promise.all([
      checkPermission(permissionUser, Permissions.USER_CREATE),
      checkPermission(permissionUser, Permissions.USER_UPDATE),
    ]);

    if (!createPerm.allowed && !updatePerm.allowed) {
      return forbiddenResponse();
    }

    const rawBody = await request.json();
    const items = normalizePayload(rawBody);
    if (!items) {
      return badRequestResponse('请求体需包含 items 数组');
    }
    if (items.length === 0) {
      return badRequestResponse('导入内容不能为空');
    }
    if (items.length > 500) {
      return badRequestResponse('一次最多导入 500 条记录');
    }

    const optionsInput = (rawBody && typeof rawBody === 'object' ? (rawBody as { options?: BulkEmployeeImportOptions & { defaultStatus?: EmploymentStatus } }).options : undefined) || {};
    const matchBy = Array.isArray(optionsInput.matchBy) ? optionsInput.matchBy : undefined;
    const options: BulkEmployeeImportOptions = {
      upsert: optionsInput.upsert !== false,
      matchBy,
      defaultStatus: normalizeStatus(optionsInput.defaultStatus) ?? undefined,
      stopOnError: optionsInput.stopOnError ?? false,
    };

    const result = await importEmployeesFromPayload(items, options);
    const status = result.errors.length > 0 ? 207 : 200;
    return NextResponse.json({ success: true, data: result }, { status });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return unauthorizedResponse();
      }
      if (error.message === 'IMPORT_PAYLOAD_INVALID' || error.message === 'IMPORT_TOO_MANY_ROWS') {
        return badRequestResponse('导入数据格式不正确');
      }
      if (error.message.startsWith('DEPARTMENT_CODE_NOT_FOUND')) {
        return badRequestResponse(`未找到部门编码 ${error.message.split(':')[1] ?? ''}`);
      }
      if (error.message.startsWith('JOB_GRADE_CODE_NOT_FOUND')) {
        return badRequestResponse(`未找到职级编码 ${error.message.split(':')[1] ?? ''}`);
      }
    }
    console.error('批量导入员工失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
