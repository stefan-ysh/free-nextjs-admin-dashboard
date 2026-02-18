import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { exportEmployees, employeesToCsv, ExportEmployeesParams, EmploymentStatus } from '@/lib/hr/employees';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function normalizeStatusParam(value: string | null): ExportEmployeesParams['status'] {
  if (!value) return undefined;
  if (value === 'all') return 'all';
  if (value === 'active' || value === 'on_leave' || value === 'terminated') {
    return value as EmploymentStatus;
  }
  return undefined;
}

const ALLOWED_SORTS: Array<NonNullable<ExportEmployeesParams['sortBy']>> = [
  'createdAt',
  'updatedAt',
  'displayName',
  'status',
];

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.USER_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'json';
    const sortByParam = searchParams.get('sortBy');
    const sortBy: ExportEmployeesParams['sortBy'] = sortByParam && (ALLOWED_SORTS as readonly string[]).includes(sortByParam)
      ? (sortByParam as NonNullable<ExportEmployeesParams['sortBy']>)
      : undefined;
    const sortOrderParam = searchParams.get('sortOrder');
    const sortOrder = sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : undefined;

    const filters: ExportEmployeesParams = {
      search: searchParams.get('search') ?? undefined,
      status: normalizeStatusParam(searchParams.get('status')),
      sortBy,
      sortOrder,
    };

    const records = await exportEmployees(filters);

    if (format === 'csv') {
      const csv = `\uFEFF${employeesToCsv(records)}`;
      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="employees-${timestamp}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('导出员工数据失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
