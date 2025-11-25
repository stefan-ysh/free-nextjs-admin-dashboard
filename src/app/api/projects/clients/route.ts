import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { listClientSuggestions } from '@/lib/db/projects';

const MAX_LIMIT = 50;

function jsonResponse(body: object, init?: ResponseInit) {
	return NextResponse.json(body, init);
}

export async function GET(request: Request) {
	try {
		const context = await requireCurrentUser();
		const permissionUser = await toPermissionUser(context.user);
		const canCreate = await checkPermission(permissionUser, Permissions.PROJECT_CREATE);
		const canViewAll = await checkPermission(permissionUser, Permissions.PROJECT_VIEW_ALL);
		if (!canCreate.allowed && !canViewAll.allowed) {
			return jsonResponse({ success: false, error: canCreate.reason ?? '无权访问' }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const search = searchParams.get('search') ?? undefined;
		const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10);
		const limit = Number.isNaN(limitParam) ? undefined : Math.max(1, Math.min(limitParam, MAX_LIMIT));
		const suggestions = await listClientSuggestions({ search, limit });
		return jsonResponse({ success: true, data: suggestions });
	} catch (error) {
		if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
			return jsonResponse({ success: false, error: '未登录' }, { status: 401 });
		}
		console.error('获取客户列表失败', error);
		return jsonResponse({ success: false, error: '服务器错误' }, { status: 500 });
	}
}
