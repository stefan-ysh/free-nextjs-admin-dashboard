import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { listSessionsForUser, revokeExpiredSessions, revokeSessionById } from '@/lib/auth/session';

function buildDeviceLabel(userAgent: string | null, fallback: string) {
  if (!userAgent) return fallback;
  const trimmed = userAgent.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 200);
}

export async function GET() {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    await revokeExpiredSessions();
    const sessions = await listSessionsForUser(context.user.id);

    const devices = sessions.map((session) => ({
      id: session.id,
      deviceType: session.device_type,
      rememberMe: session.remember_me,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      lastActive: session.last_active ?? session.created_at,
      isCurrent: session.id === context.session.id,
      userAgent: buildDeviceLabel(session.user_agent, session.device_type === 'mobile' ? '移动设备' : '桌面设备'),
    }));

    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    console.error('获取登录设备失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';

    if (!sessionId) {
      return NextResponse.json({ success: false, error: '缺少 sessionId 参数' }, { status: 400 });
    }

    if (sessionId === context.session.id) {
      return NextResponse.json({ success: false, error: '无法移除当前使用的设备' }, { status: 400 });
    }

    await revokeSessionById(sessionId, context.user.id);

    // System audit
    const { logSystemAudit } = await import('@/lib/audit');
    await logSystemAudit({
      userId: context.user.id,
      userName: context.user.display_name ?? '未知用户',
      action: 'REVOKE',
      entityType: 'AUTH',
      entityId: sessionId,
      entityName: '登录设备/会话',
      description: `${context.user.display_name ?? '未知用户'} 移除了一个登录设备/会话`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('移除登录设备失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
