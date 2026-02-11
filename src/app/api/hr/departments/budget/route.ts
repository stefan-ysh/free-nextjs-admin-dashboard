import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getDepartmentBudgetSummary, getDepartmentBudgetSummaryByEmployee } from '@/lib/hr/budgets';
import { checkPermission, Permissions } from '@/lib/permissions';
import { mysqlPool } from '@/lib/mysql';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');
    const yearParam = searchParams.get('year');
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    if (!departmentId && !employeeId) {
      return NextResponse.json({ success: false, error: '缺少部门或员工信息' }, { status: 400 });
    }

    if (employeeId && employeeId !== context.user.id) {
      const perm = await checkPermission(permissionUser, Permissions.USER_VIEW_ALL);
      if (!perm.allowed) {
        return forbiddenResponse();
      }
    }

    let summary = null;
    let resolvedDepartmentId = departmentId ?? null;
    if (departmentId) {
      summary = await getDepartmentBudgetSummary(departmentId, year);
    } else if (employeeId) {
      summary = await getDepartmentBudgetSummaryByEmployee(employeeId, year);
      if (summary) {
        resolvedDepartmentId = summary.departmentId;
      }
    }

    if (!summary || !resolvedDepartmentId) {
      return NextResponse.json({ success: true, data: null });
    }

    const pool = mysqlPool();
    const [rows] = await pool.query<Array<RowDataPacket & { name: string | null }>>(
      'SELECT name FROM hr_departments WHERE id = ? LIMIT 1',
      [resolvedDepartmentId]
    );
    const departmentName = rows[0]?.name ?? null;

    return NextResponse.json({
      success: true,
      data: {
        ...summary,
        departmentName,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取部门预算失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
