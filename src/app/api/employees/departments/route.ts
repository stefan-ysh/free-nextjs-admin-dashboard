import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { getAvailableDepartments } from '@/lib/hr/employees';

function unauthorizedResponse() {
	return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
	return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

export async function GET() {
	try {
		const context = await requireCurrentUser();
		if (context.user.role !== 'finance_admin') {
			return forbiddenResponse();
		}

		const departments = await getAvailableDepartments();
		return NextResponse.json({ success: true, data: departments });
	} catch (error) {
		if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
			return unauthorizedResponse();
		}
		console.error('获取部门列表失败', error);
		return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
	}
}
