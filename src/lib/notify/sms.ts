import type { RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';

type SmsChannel = 'approval' | 'applicant' | 'finance';

type SmsGatewayPayload = {
  channel?: SmsChannel;
  phones: string[];
  content: string;
  app?: string;
};

type EmployeePhoneRow = RowDataPacket & {
  id: string;
  phone: string | null;
};

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.replace(/\s+/g, '').trim();
  return value ? value : null;
}

function normalizeWebhook(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  return value;
}

function parsePhones(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,\n;]/)
        .map((item) => normalizePhone(item))
        .filter((item): item is string => Boolean(item))
    )
  );
}

export function isSmsNotifyEnabled(): boolean {
  return process.env.SMS_NOTIFY_ENABLED === '1';
}

function resolveSmsWebhook(channel?: SmsChannel): string | null {
  const channelWebhook =
    channel === 'approval'
      ? normalizeWebhook(process.env.SMS_WEBHOOK_APPROVAL_URL)
      : channel === 'applicant'
        ? normalizeWebhook(process.env.SMS_WEBHOOK_APPLICANT_URL)
        : channel === 'finance'
          ? normalizeWebhook(process.env.SMS_WEBHOOK_FINANCE_URL)
          : null;
  return channelWebhook ?? normalizeWebhook(process.env.SMS_WEBHOOK_URL);
}

function resolveFallbackPhones(channel?: SmsChannel): string[] {
  if (channel === 'approval') return parsePhones(process.env.SMS_FALLBACK_APPROVAL_PHONES);
  if (channel === 'applicant') return parsePhones(process.env.SMS_FALLBACK_APPLICANT_PHONES);
  if (channel === 'finance') return parsePhones(process.env.SMS_FALLBACK_FINANCE_PHONES);
  return parsePhones(process.env.SMS_FALLBACK_PHONES);
}

export async function sendSmsTextMessage(
  content: string,
  options: {
    channel?: SmsChannel;
    phones?: string[];
  } = {}
): Promise<boolean> {
  if (!isSmsNotifyEnabled()) return false;
  const webhook = resolveSmsWebhook(options.channel);
  if (!webhook) return false;

  const explicitPhones = Array.from(
    new Set((options.phones ?? []).map((item) => normalizePhone(item)).filter((item): item is string => Boolean(item)))
  );
  const resolvedPhones = explicitPhones.length > 0 ? explicitPhones : resolveFallbackPhones(options.channel);
  if (resolvedPhones.length === 0) return false;

  const payload: SmsGatewayPayload = {
    channel: options.channel,
    phones: resolvedPhones,
    content,
    app: 'admin_cosmorigin',
  };

  const token = process.env.SMS_WEBHOOK_TOKEN?.trim();
  const response = await fetch(webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`SMS_NOTIFY_HTTP_${response.status}`);
  }
  const result = (await response.json().catch(() => null)) as
    | { success?: boolean; code?: number; message?: string }
    | null;

  if (result && result.success === false) {
    throw new Error(`SMS_NOTIFY_${result.code ?? 'FAIL'}:${result.message ?? 'UNKNOWN'}`);
  }
  return true;
}

export async function findPhonesByEmployeeIds(employeeIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(employeeIds.map((item) => item?.trim()).filter((item): item is string => Boolean(item))));
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const pool = mysqlPool();
  const [rows] = await pool.query<EmployeePhoneRow[]>(
    `SELECT id, phone
     FROM hr_employees
     WHERE id IN (${placeholders}) AND is_active = 1`,
    ids
  );
  return rows
    .map((row) => normalizePhone(row.phone))
    .filter((item): item is string => Boolean(item));
}

export async function findFinancePhones(): Promise<string[]> {
  const pool = mysqlPool();
  const [rows] = await pool.query<EmployeePhoneRow[]>(
    `SELECT id, phone
     FROM hr_employees
     WHERE is_active = 1
       AND (
         primary_role IN ('finance','admin','super_admin')
         OR JSON_CONTAINS(roles, JSON_QUOTE('finance'), '$')
         OR JSON_CONTAINS(roles, JSON_QUOTE('admin'), '$')
         OR JSON_CONTAINS(roles, JSON_QUOTE('super_admin'), '$')
       )`
  );
  return rows
    .map((row) => normalizePhone(row.phone))
    .filter((item): item is string => Boolean(item));
}

export async function sendSmsToEmployeeIds(employeeIds: string[], content: string, channel?: SmsChannel): Promise<boolean> {
  const phones = await findPhonesByEmployeeIds(employeeIds);
  return sendSmsTextMessage(content, { channel, phones });
}

export async function sendSmsToFinance(content: string): Promise<boolean> {
  const phones = await findFinancePhones();
  return sendSmsTextMessage(content, { channel: 'finance', phones });
}

