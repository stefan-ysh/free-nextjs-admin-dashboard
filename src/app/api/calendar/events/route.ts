import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { createCalendarEvent, listCalendarEvents } from '@/lib/db/calendar';
import { checkPermission, Permissions } from '@/lib/permissions';
import type { CalendarEventPayload } from '@/types/calendar';

const allowedCalendars: Array<CalendarEventPayload['calendar']> = ['meeting', 'deadline', 'reminder', 'travel'];

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问日程模块' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function mapCalendarError(error: unknown): { status: number; message: string } | null {
  if (error instanceof Error) {
    switch (error.message) {
      case 'MISSING_TITLE':
        return { status: 400, message: '请填写日程标题' };
      case 'MISSING_START':
        return { status: 400, message: '请选择开始时间' };
      case 'INVALID_DATE':
        return { status: 400, message: '日期格式不正确，请重新选择' };
      case 'INVALID_RANGE':
        return { status: 400, message: '结束时间不能早于开始时间' };
      case 'FAILED_TO_CREATE_EVENT':
        return { status: 500, message: '日程保存失败，请稍后重试' };
      default:
        break;
    }
  }
  return null;
}

function isValidCalendar(value: unknown): value is CalendarEventPayload['calendar'] {
  return typeof value === 'string' && (allowedCalendars as string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const permission = await checkPermission(permissionUser, Permissions.CALENDAR_VIEW);
    if (!permission.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || undefined;
    const end = searchParams.get('end') || undefined;

    const events = await listCalendarEvents(start, end);
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Failed to list calendar events', error);
    return NextResponse.json({ success: false, error: '服务暂时不可用' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const permission = await checkPermission(permissionUser, Permissions.CALENDAR_MANAGE);
    if (!permission.allowed) {
      return forbiddenResponse();
    }

    const body = (await request.json()) as Partial<CalendarEventPayload>;

    if (!body?.title || !body.title.trim()) {
      return badRequestResponse('请填写日程标题');
    }

    if (!isValidCalendar(body.calendar)) {
      return badRequestResponse('请选择有效的日程类型');
    }

    if (!body.start) {
      return badRequestResponse('请选择开始时间');
    }

    const payload: CalendarEventPayload = {
      title: body.title.trim(),
      calendar: body.calendar,
      start: body.start,
      end: body.end ?? undefined,
      allDay: body.allDay ?? true,
      description: body.description?.trim() || undefined,
      location: body.location?.trim() || undefined,
      metadata:
        body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : undefined,
    };

    const created = await createCalendarEvent({ ...payload, createdBy: context.user.id });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    const mapped = mapCalendarError(error);
    if (mapped) {
      return NextResponse.json({ success: false, error: mapped.message }, { status: mapped.status });
    }
    console.error('Failed to create calendar event', error);
    return NextResponse.json({ success: false, error: '日程创建失败，请稍后再试' }, { status: 500 });
  }
}
