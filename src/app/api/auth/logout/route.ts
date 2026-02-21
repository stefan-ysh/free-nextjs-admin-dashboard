import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { invalidateSession } from '@/lib/auth/session';
import { logSystemAudit } from '@/lib/audit';
import { requireCurrentUser } from '@/lib/auth/current-user';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      try {
        const { user } = await requireCurrentUser();
        await logSystemAudit({
          userId: user.id,
          userName: user.display_name ?? '未知用户',
          action: 'LOGOUT',
          entityType: 'AUTH',
          entityId: user.id,
          entityName: user.display_name ?? '未知用户',
          description: `${user.display_name ?? '未知用户'} 登出了系统`,
        });
      } catch {
        // user might already be unauthenticated
      }
      await invalidateSession(token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('登出失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
