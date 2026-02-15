import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { ensureEmployeeUserAccount } from '@/lib/hr/employees';

export async function POST(request: Request) {
	try {
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const perm = await checkPermission(permissionUser, Permissions.USER_UPDATE);
		if (!perm.allowed) {
			return NextResponse.json({ success: false, error: '无权操作' }, { status: 403 });
		}

		const body = await request.json();
		const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
		if (!employeeId) {
			return NextResponse.json({ success: false, error: '缺少 employeeId' }, { status: 400 });
		}

		const result = await ensureEmployeeUserAccount(employeeId);

		return NextResponse.json({
			success: true,
			data: {
				userId: result.userId,
				loginAccount: result.loginAccount,
				initialPassword: result.initialPassword,
			},
		});
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'UNAUTHENTICATED') {
				return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
			}
			if (error.message === 'EMPLOYEE_NOT_FOUND') {
				return NextResponse.json({ success: false, error: '员工不存在' }, { status: 404 });
			}
			if (error.message === 'EMPLOYEE_LOGIN_ID_MISSING') {
				return NextResponse.json({ success: false, error: '该员工缺少编号或邮箱，无法生成账号' }, { status: 400 });
			}
		}
		console.error('自动为员工生成账号失败', error);
		return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
	}
}
