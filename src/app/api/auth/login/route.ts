import { NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { detectDeviceType, hashUserAgent } from '@/lib/auth/device';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, invalidateSessionsForDeviceType, revokeExpiredSessions } from '@/lib/auth/session';
import {
  clearLoginFailures,
  findUserByLoginIdentifier,
  recordFailedLoginAttempt,
  updateLastLogin,
} from '@/lib/auth/user';
import { logSystemAudit } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifierRaw =
      typeof body.email === 'string'
        ? body.email
        : typeof body.account === 'string'
          ? body.account
          : '';
    const identifier = identifierRaw.trim();
    const password = typeof body.password === 'string' ? body.password : '';
    const rememberMe = Boolean(body.rememberMe);

    if (!identifier || !password) {
      return NextResponse.json({ success: false, error: '账号与密码不能为空' }, { status: 400 });
    }

    let user;
    try {
      user = await findUserByLoginIdentifier(identifier);
    } catch (error) {
      if (error instanceof Error && error.message === 'PHONE_NOT_UNIQUE') {
        return NextResponse.json({ success: false, error: '手机号重复，请联系管理员处理' }, { status: 409 });
      }
      throw error;
    }
    if (!user) {
      return NextResponse.json({ success: false, error: '账号或密码错误' }, { status: 401 });
    }
    if (!user.is_active || user.employment_status === 'terminated') {
      return NextResponse.json({ success: false, error: '账号已停用或离职' }, { status: 403 });
    }
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (!Number.isNaN(lockedUntil.getTime()) && lockedUntil > new Date()) {
        return NextResponse.json({ success: false, error: '账号已被锁定，请稍后再试' }, { status: 429 });
      }
      await clearLoginFailures(user.id);
    }

    if (!user.password_hash) {
      return NextResponse.json({ success: false, error: '账号尚未设置密码，请联系管理员' }, { status: 403 });
    }

    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      await recordFailedLoginAttempt(user.id);
      return NextResponse.json({ success: false, error: '账号或密码错误' }, { status: 401 });
    }
    await clearLoginFailures(user.id);

    await revokeExpiredSessions();

    const userAgent = request.headers.get('user-agent') ?? '';
    const deviceType = detectDeviceType(userAgent);
    const userAgentHash = hashUserAgent(userAgent);
    
    await invalidateSessionsForDeviceType(user.id, deviceType);
    await updateLastLogin(user.id);

    const { token, expiresAt } = await createSession({
      userId: user.id,
      deviceType,
      userAgentHash,
      userAgent,
      rememberMe,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        jobTitle: null,
        expiresAt,
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

    try {
      await logSystemAudit({
        userId: user.id,
        userName: user.display_name ?? user.email ?? '未知用户',
        action: 'LOGIN',
        entityType: 'AUTH',
        entityId: user.id,
        entityName: user.display_name ?? user.email ?? '未知用户',
        description: `${user.display_name || user.email} 登录了系统 (IP: ${request.headers.get('x-forwarded-for') || '未知'})`,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    } catch (e) {
      console.error('Audit log failed', e);
    }

    return response;
  } catch (error) {
    console.error('登录失败', error);
    return NextResponse.json({ success: false, error: '服务器错误,请稍后重试' }, { status: 500 });
  }
}
