export type NormalizeDateOptions = {
  errorCode?: string;
};

const DATE_ONLY_PATTERN = /^(\d{4}-\d{2}-\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/;

const CHINA_TIMEZONE = 'Asia/Shanghai';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: CHINA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: CHINA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type DateFormatMode = 'date' | 'dateTime';

function applyChinaFormat(date: Date, mode: DateFormatMode): string {
  const formatter = mode === 'dateTime' ? dateTimeFormatter : dateFormatter;
  const parts = formatter.formatToParts(date);
  const resolved: Partial<Record<string, string>> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      resolved[part.type] = part.value;
    }
  }
  const dateSegment = `${resolved.year}-${resolved.month}-${resolved.day}`;
  if (mode === 'date') {
    return dateSegment;
  }
  return `${dateSegment} ${resolved.hour}:${resolved.minute}:${resolved.second}`;
}

function resolveDateInput(value: string | Date): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return new Date(value.getTime());
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00+08:00`);
  }

  const dateTimeMatch = trimmed.match(DATE_TIME_PATTERN);
  if (dateTimeMatch) {
    return new Date(`${dateTimeMatch[1]}T${dateTimeMatch[2]}+08:00`);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

/**
 * Converts various date inputs (YYYY-MM-DD, ISO strings, Date objects) into `YYYY-MM-DD`.
 * Returns null for null/undefined/empty string inputs and throws when parsing fails.
 */
export function normalizeDateInput(
  value: string | Date | null | undefined,
  options: NormalizeDateOptions = {}
): string | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(options.errorCode ?? 'INVALID_DATE');
    }
    const formatted = formatDateOnly(value);
    if (!formatted) {
      throw new Error(options.errorCode ?? 'INVALID_DATE');
    }
    return formatted;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const formatted = formatDateOnly(trimmed);
  if (!formatted) {
    throw new Error(options.errorCode ?? 'INVALID_DATE');
  }
  return formatted;
}

export function toChinaDateTimeIso(date: string, time: string): string {
  const safeDate = date.trim();
  if (!DATE_ONLY_PATTERN.test(safeDate)) {
    throw new Error('INVALID_DATE');
  }
  const safeTime = (time || '00:00').trim();
  const normalizedTime = /^\d{2}:\d{2}$/.test(safeTime) ? `${safeTime}:00` : safeTime;
  const parsed = new Date(`${safeDate}T${normalizedTime}+08:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_DATE');
  }
  return parsed.toISOString();
}

export function formatDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const date = resolveDateInput(typeof value === 'string' ? value : new Date(value));
  if (!date) {
    return null;
  }
  return applyChinaFormat(date, 'date');
}

export function formatDateTimeLocal(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const date = resolveDateInput(typeof value === 'string' ? value : new Date(value));
  if (!date) {
    return null;
  }
  return applyChinaFormat(date, 'dateTime');
}
