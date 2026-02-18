import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getPurchaseStats } from '@/lib/db/purchases';
import { UserRole } from '@/types/user';
import { parsePurchaseListParams } from '../query-utils';

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const isSuperAdmin = permissionUser.primaryRole === UserRole.SUPER_ADMIN;

    const { searchParams } = new URL(request.url);
    const params = parsePurchaseListParams(searchParams);

    if (!isSuperAdmin) {
      params.purchaserId = context.user.id;
    }

    const stats = await getPurchaseStats(params);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    console.error('获取采购统计失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
