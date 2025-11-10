import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import {
  deleteEmployee,
  EmploymentStatus,
  getEmployeeById,
  updateEmployee,
} from '@/lib/hr/employees';

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

export async function GET(_: Request, { params }: { params: { employeeId: string } }) {
  try {
    const context = await requireCurrentUser();
    if (context.user.role !== 'finance_admin') {
      return forbiddenResponse();
    }

    const record = await getEmployeeById(params.employeeId);
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

export async function PUT(request: Request, { params }: { params: { employeeId: string } }) {
  try {
    const context = await requireCurrentUser();
    if (context.user.role !== 'finance_admin') {
      return forbiddenResponse();
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return badRequestResponse('请求体格式错误');
    }

    const payload = {
      employeeCode: body.employeeCode,
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: body.displayName,
      email: body.email,
      phone: body.phone,
      department: body.department,
      jobTitle: body.jobTitle,
      employmentStatus: body.employmentStatus as EmploymentStatus | undefined,
      hireDate: body.hireDate,
      terminationDate: body.terminationDate,
      managerId: body.managerId,
      location: body.location,
      customFields: body.customFields,
    };

    const updated = await updateEmployee(params.employeeId, payload);
    if (!updated) {
      return notFoundResponse();
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
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
    }
    console.error('更新员工失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { employeeId: string } }) {
  try {
    const context = await requireCurrentUser();
    if (context.user.role !== 'finance_admin') {
      return forbiddenResponse();
    }

    const record = await getEmployeeById(params.employeeId);
    if (!record) {
      return notFoundResponse();
    }

    await deleteEmployee(params.employeeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('删除员工失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
