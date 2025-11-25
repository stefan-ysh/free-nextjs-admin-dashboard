import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getEmployeeByUserId } from '@/lib/hr/employees';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
	return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
	return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function notFoundResponse() {
	return NextResponse.json({ success: false, error: '未找到员工' }, { status: 404 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
	try {
		const { userId } = await params;
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const perm = await checkPermission(permissionUser, Permissions.USER_VIEW_ALL);
		if (!perm.allowed) {
			return forbiddenResponse();
		}

		const employee = await getEmployeeByUserId(userId);
		if (!employee) {
			return notFoundResponse();
		}

		return NextResponse.json({ success: true, data: employee });
	} catch (error) {
		if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
			return unauthorizedResponse();
		}
		console.error('通过用户 ID 获取员工失败', error);
		return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
	}
}
