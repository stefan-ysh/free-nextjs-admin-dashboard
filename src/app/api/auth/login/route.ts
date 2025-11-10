import { NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { detectDeviceType, hashUserAgent } from '@/lib/auth/device';
import { createSession, invalidateSessionsForDeviceType, revokeExpiredSessions } from '@/lib/auth/session';
import { findUserByEmail } from '@/lib/auth/user';
import { verifyPassword } from '@/lib/auth/password';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rememberMe = Boolean(body.rememberMe);

    if (!email || !password) {
      return NextResponse.json({ success: false, error: '邮箱与密码不能为空' }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ success: false, error: '账号或密码错误' }, { status: 401 });
    }

    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ success: false, error: '账号或密码错误' }, { status: 401 });
    }

    await revokeExpiredSessions();

    const userAgent = request.headers.get('user-agent') ?? '';
    const deviceType = detectDeviceType(userAgent);
    const userAgentHash = hashUserAgent(userAgent);

    await invalidateSessionsForDeviceType(user.id, deviceType);

    const { token, expiresAt } = await createSession({
      userId: user.id,
      deviceType,
      userAgentHash,
      rememberMe,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });

    const cookieConfig: Parameters<typeof response.cookies.set>[0] = {
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };

    if (rememberMe) {
      cookieConfig.expires = expiresAt;
      cookieConfig.maxAge = 60 * 60 * 24 * 2;
    }

    response.cookies.set(cookieConfig);

    return response;
  } catch (error) {
    console.error('登录失败', error);
    return NextResponse.json({ success: false, error: '服务器错误,请稍后重试' }, { status: 500 });
  }
}
