import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { listInAppNotificationsByRecipient, markInAppNotificationsAsRead } from '@/lib/db/notifications';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
    const data = await listInAppNotificationsByRecipient({
      recipientId: context.user.id,
      page,
      pageSize,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('读取站内通知失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireCurrentUser();
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown; markAll?: unknown };
    const markAll = body?.markAll === true;
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    const affected = await markInAppNotificationsAsRead({
      recipientId: context.user.id,
      ids: markAll ? [] : ids,
    });
    return NextResponse.json({ success: true, data: { affected } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('标记通知已读失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
