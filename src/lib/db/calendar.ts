import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';
import { ensureCalendarSchema } from '@/lib/schema/calendar';
import type { CalendarEventRecord, CalendarEventPayload } from '@/types/calendar';

const pool = mysqlPool();

type CalendarEventRow = RowDataPacket & {
  id: string;
  title: string;
  calendar: CalendarEventRecord['calendar'];
  description: string | null;
  location: string | null;
  start_at: Date | string;
  end_at: Date | string | null;
  all_day: 0 | 1 | boolean;
  metadata_json: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseMetadata(value?: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    console.warn('Failed to parse calendar event metadata', error);
    return undefined;
  }
}

function normalizeDateTime(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('INVALID_DATE');
  }
  return date;
}

function mapCalendarEvent(row: CalendarEventRow): CalendarEventRecord {
  return {
    id: row.id,
    title: row.title,
    calendar: row.calendar,
    start: toIso(row.start_at)!,
    end: toIso(row.end_at),
    allDay: Boolean(row.all_day),
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    createdBy: row.created_by ?? undefined,
    metadata: parseMetadata(row.metadata_json),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function normalizeRange(start?: string | null, end?: string | null): [Date, Date] {
  const min = start ? new Date(start) : new Date('1970-01-01T00:00:00.000Z');
  const max = end ? new Date(end) : new Date('2100-12-31T23:59:59.000Z');

  if (Number.isNaN(min.getTime()) || Number.isNaN(max.getTime())) {
    throw new Error('INVALID_DATE');
  }

  return min <= max ? [min, max] : [max, min];
}

export async function listCalendarEvents(start?: string, end?: string): Promise<CalendarEventRecord[]> {
  await ensureCalendarSchema();
  const [rangeStart, rangeEnd] = normalizeRange(start, end);
  const [rows] = await pool.query<CalendarEventRow[]>(
    `SELECT * FROM calendar_events
     WHERE start_at <= ? AND (end_at IS NULL OR end_at >= ?)
     ORDER BY start_at ASC`,
    [rangeEnd, rangeStart]
  );
  return rows.map(mapCalendarEvent);
}

export async function getCalendarEvent(id: string): Promise<CalendarEventRecord | null> {
  await ensureCalendarSchema();
  const [rows] = await pool.query<CalendarEventRow[]>(
    'SELECT * FROM calendar_events WHERE id = ? LIMIT 1',
    [id]
  );
  if (!rows.length) return null;
  return mapCalendarEvent(rows[0]);
}

export async function createCalendarEvent(
  input: CalendarEventPayload & { createdBy?: string }
): Promise<CalendarEventRecord> {
  await ensureCalendarSchema();
  if (!input.title?.trim()) {
    throw new Error('MISSING_TITLE');
  }
  if (!input.start) {
    throw new Error('MISSING_START');
  }
  const id = randomUUID();
  const startAt = normalizeDateTime(input.start);
  const endAt = normalizeDateTime(input.end ?? undefined);
  if (startAt && endAt && startAt > endAt) {
    throw new Error('INVALID_RANGE');
  }
  const allDay = input.allDay ?? true;

  await pool.query(
    `INSERT INTO calendar_events (
      id, title, calendar, description, location,
      start_at, end_at, all_day, metadata_json, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.calendar,
      input.description ?? null,
      input.location ?? null,
      startAt,
      endAt ?? null,
      allDay ? 1 : 0,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.createdBy ?? null,
      input.createdBy ?? null,
    ]
  );

  const saved = await getCalendarEvent(id);
  if (!saved) {
    throw new Error('FAILED_TO_CREATE_EVENT');
  }
  return saved;
}

export async function updateCalendarEvent(
  id: string,
  updates: Partial<CalendarEventPayload> & { updatedBy?: string }
): Promise<CalendarEventRecord | null> {
  await ensureCalendarSchema();
  const existing = await getCalendarEvent(id);
  if (!existing) {
    return null;
  }

  const merged: CalendarEventPayload & { allDay: boolean } = {
    title: updates.title ?? existing.title,
    calendar: updates.calendar ?? existing.calendar,
    start: updates.start ?? existing.start,
    end: updates.end ?? existing.end,
    description: updates.description ?? existing.description,
    location: updates.location ?? existing.location,
    metadata: updates.metadata ?? existing.metadata,
    allDay: updates.allDay ?? existing.allDay,
  };

  const startAt = normalizeDateTime(merged.start);
  const endAt = normalizeDateTime(merged.end ?? undefined);
  if (startAt && endAt && startAt > endAt) {
    throw new Error('INVALID_RANGE');
  }

  await pool.query(
    `UPDATE calendar_events SET
      title = ?,
      calendar = ?,
      description = ?,
      location = ?,
      start_at = ?,
      end_at = ?,
      all_day = ?,
      metadata_json = ?,
      updated_by = ?,
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE id = ?`,
    [
      merged.title,
      merged.calendar,
      merged.description ?? null,
      merged.location ?? null,
      startAt,
      endAt ?? null,
      merged.allDay ? 1 : 0,
      merged.metadata ? JSON.stringify(merged.metadata) : null,
      updates.updatedBy ?? null,
      id,
    ]
  );

  return getCalendarEvent(id);
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  await ensureCalendarSchema();
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM calendar_events WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
