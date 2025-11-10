import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { findUserById } from '@/lib/auth/user';
import { findActiveSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const session = await findActiveSession(token);
    if (!session) {
      return NextResponse.json({ success: false, error: '会话已失效' }, { status: 401 });
    }

    const user = await findUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        expiresAt: session.expires_at,
      },
    });
  } catch (error) {
    console.error('获取会话失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
