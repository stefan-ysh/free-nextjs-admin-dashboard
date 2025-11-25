import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getProjectStats } from '@/lib/db/projects';
import { checkPermission, Permissions } from '@/lib/permissions';

function unauthorizedResponse() {
	return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse(reason = '无权访问') {
	return NextResponse.json({ success: false, error: reason }, { status: 403 });
}

function serverErrorResponse() {
	return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
}

export async function GET() {
	try {
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const canViewAll = await checkPermission(permissionUser, Permissions.PROJECT_VIEW_ALL);
		if (!canViewAll.allowed) {
			return forbiddenResponse(canViewAll.reason ?? '无权查看项目统计');
		}

		const stats = await getProjectStats();
		return NextResponse.json({ success: true, data: stats });
	} catch (error) {
		if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
			return unauthorizedResponse();
		}
		console.error('获取项目统计失败', error);
		return serverErrorResponse();
	}
}
