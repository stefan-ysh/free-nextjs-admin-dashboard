import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { deleteCalendarEvent, updateCalendarEvent } from '@/lib/db/calendar';
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

function notFoundResponse() {
  return NextResponse.json({ success: false, error: '未找到对应的日程' }, { status: 404 });
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
      default:
        break;
    }
  }
  return null;
}

function isValidCalendar(value: unknown): value is CalendarEventPayload['calendar'] {
  return typeof value === 'string' && (allowedCalendars as string[]).includes(value);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const permission = await checkPermission(permissionUser, Permissions.CALENDAR_MANAGE);
    if (!permission.allowed) {
      return forbiddenResponse();
    }

    const updates = (await request.json()) as Partial<CalendarEventPayload>;
    const payload: Partial<CalendarEventPayload> = {};

    if (updates.title !== undefined) {
      if (!updates.title.trim()) {
        return badRequestResponse('日程标题不能为空');
      }
      payload.title = updates.title.trim();
    }

    if (updates.calendar !== undefined) {
      if (!isValidCalendar(updates.calendar)) {
        return badRequestResponse('请选择有效的日程类型');
      }
      payload.calendar = updates.calendar;
    }

    if (updates.start !== undefined) {
      payload.start = updates.start;
    }

    if (updates.end !== undefined) {
      payload.end = updates.end;
    }

    if (updates.allDay !== undefined) {
      payload.allDay = updates.allDay;
    }

    if (updates.description !== undefined) {
      payload.description = updates.description?.trim() || undefined;
    }

    if (updates.location !== undefined) {
      payload.location = updates.location?.trim() || undefined;
    }

    if (updates.metadata !== undefined) {
      payload.metadata =
        updates.metadata && typeof updates.metadata === 'object' && !Array.isArray(updates.metadata)
          ? (updates.metadata as Record<string, unknown>)
          : undefined;
    }

    const updated = await updateCalendarEvent(id, { ...payload, updatedBy: context.user.id });
    if (!updated) {
      return notFoundResponse();
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    const mapped = mapCalendarError(error);
    if (mapped) {
      return NextResponse.json({ success: false, error: mapped.message }, { status: mapped.status });
    }
    console.error('Failed to update calendar event', error);
    return NextResponse.json({ success: false, error: '更新失败，请稍后重试' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const permission = await checkPermission(permissionUser, Permissions.CALENDAR_MANAGE);
    if (!permission.allowed) {
      return forbiddenResponse();
    }

    const removed = await deleteCalendarEvent(id);
    if (!removed) {
      return notFoundResponse();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Failed to delete calendar event', error);
    return NextResponse.json({ success: false, error: '删除失败，请稍后再试' }, { status: 500 });
  }
}
