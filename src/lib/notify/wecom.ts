import type { RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';

type WecomMessagePayload = {
  msgtype: 'text';
  text: {
    content: string;
    mentioned_list?: string[];
    mentioned_mobile_list?: string[];
  };
};

type WecomTokenResponse = {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
};

type WecomSendResponse = {
  errcode: number;
  errmsg: string;
  invaliduser?: string;
};

type EmployeeWecomRow = RowDataPacket & {
  id: string;
  wecom_user_id: string | null;
};

function normalizeWebhook(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  return value;
}

function normalizeWecomUserId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  return value ? value : null;
}

export function isWecomNotifyEnabled(): boolean {
  return process.env.WECOM_NOTIFY_ENABLED === '1';
}

export function resolveWecomWebhook(channel?: 'approval' | 'applicant' | 'finance'): string | null {
  const channelWebhook =
    channel === 'approval'
      ? normalizeWebhook(process.env.WECOM_WEBHOOK_APPROVAL_URL)
      : channel === 'applicant'
        ? normalizeWebhook(process.env.WECOM_WEBHOOK_APPLICANT_URL)
        : channel === 'finance'
          ? normalizeWebhook(process.env.WECOM_WEBHOOK_FINANCE_URL)
          : null;
  return channelWebhook ?? normalizeWebhook(process.env.WECOM_WEBHOOK_URL);
}

export async function sendWecomTextMessage(
  content: string,
  options: {
    channel?: 'approval' | 'applicant' | 'finance';
    mentionedList?: string[];
    mentionedMobileList?: string[];
  } = {}
): Promise<boolean> {
  if (!isWecomNotifyEnabled()) return false;
  const webhook = resolveWecomWebhook(options.channel);
  if (!webhook) return false;

  const payload: WecomMessagePayload = {
    msgtype: 'text',
    text: {
      content,
      mentioned_list: options.mentionedList,
      mentioned_mobile_list: options.mentionedMobileList,
    },
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`WECOM_NOTIFY_HTTP_${response.status}`);
  }

  const result = (await response.json().catch(() => null)) as { errcode?: number; errmsg?: string } | null;
  if (result && typeof result.errcode === 'number' && result.errcode !== 0) {
    throw new Error(`WECOM_NOTIFY_${result.errcode}:${result.errmsg ?? 'UNKNOWN'}`);
  }
  return true;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

export function isWecomAppEnabled(): boolean {
  return (
    isWecomNotifyEnabled() &&
    Boolean(process.env.WECOM_CORP_ID?.trim()) &&
    Boolean(process.env.WECOM_AGENT_ID?.trim()) &&
    Boolean(process.env.WECOM_SECRET?.trim())
  );
}

async function getWecomAccessToken(): Promise<string> {
  if (!isWecomAppEnabled()) {
    throw new Error('WECOM_APP_NOT_CONFIGURED');
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 20_000) {
    return tokenCache.token;
  }

  const corpId = process.env.WECOM_CORP_ID!.trim();
  const secret = process.env.WECOM_SECRET!.trim();
  const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`;

  const response = await fetch(tokenUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`WECOM_TOKEN_HTTP_${response.status}`);
  }

  const data = (await response.json()) as WecomTokenResponse;
  if (data.errcode !== 0 || !data.access_token || !data.expires_in) {
    throw new Error(`WECOM_TOKEN_${data.errcode}:${data.errmsg}`);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: now + Math.max(30, data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function sendWecomAppTextMessageByUserIds(
  userIds: string[],
  content: string
): Promise<number> {
  const uniqueUserIds = Array.from(
    new Set(userIds.map((item) => normalizeWecomUserId(item)).filter((item): item is string => Boolean(item)))
  );
  if (!uniqueUserIds.length) return 0;
  if (!isWecomAppEnabled()) return 0;

  const accessToken = await getWecomAccessToken();
  const agentId = Number(process.env.WECOM_AGENT_ID);
  if (!Number.isFinite(agentId) || agentId <= 0) {
    throw new Error('WECOM_AGENT_ID_INVALID');
  }

  const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      touser: uniqueUserIds.join('|'),
      msgtype: 'text',
      agentid: agentId,
      text: { content },
      safe: 0,
      enable_duplicate_check: 1,
      duplicate_check_interval: 1800,
    }),
  });

  if (!response.ok) {
    throw new Error(`WECOM_APP_SEND_HTTP_${response.status}`);
  }
  const result = (await response.json()) as WecomSendResponse;
  if (result.errcode !== 0) {
    throw new Error(`WECOM_APP_SEND_${result.errcode}:${result.errmsg}`);
  }
  return uniqueUserIds.length;
}

export async function findWecomUserIdsByEmployeeIds(employeeIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(employeeIds.map((item) => item?.trim()).filter((item): item is string => Boolean(item))));
  if (!ids.length) return [];

  const placeholders = ids.map(() => '?').join(',');
  const pool = mysqlPool();
  let rows: EmployeeWecomRow[] = [];
  try {
    const [result] = await pool.query<EmployeeWecomRow[]>(
      `SELECT id, wecom_user_id
       FROM hr_employees
       WHERE id IN (${placeholders}) AND is_active = 1`,
      ids
    );
    rows = result;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'ER_BAD_FIELD_ERROR') throw error;
    return [];
  }
  return rows
    .map((row) => normalizeWecomUserId(row.wecom_user_id))
    .filter((item): item is string => Boolean(item));
}

export async function findFinanceWecomUserIds(): Promise<string[]> {
  const pool = mysqlPool();
  let rows: EmployeeWecomRow[] = [];
  try {
    const [result] = await pool.query<EmployeeWecomRow[]>(
      `SELECT id, wecom_user_id
       FROM hr_employees
       WHERE is_active = 1
         AND (
           primary_role IN ('finance','admin','super_admin')
           OR JSON_CONTAINS(roles, JSON_QUOTE('finance'), '$')
           OR JSON_CONTAINS(roles, JSON_QUOTE('admin'), '$')
           OR JSON_CONTAINS(roles, JSON_QUOTE('super_admin'), '$')
         )`
    );
    rows = result;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'ER_BAD_FIELD_ERROR') throw error;
    return [];
  }
  return rows
    .map((row) => normalizeWecomUserId(row.wecom_user_id))
    .filter((item): item is string => Boolean(item));
}

export async function sendWecomAppTextByEmployeeIds(
  employeeIds: string[],
  content: string
): Promise<number> {
  const userIds = await findWecomUserIdsByEmployeeIds(employeeIds);
  return sendWecomAppTextMessageByUserIds(userIds, content);
}

export async function sendWecomAppTextToFinance(content: string): Promise<number> {
  const userIds = await findFinanceWecomUserIds();
  return sendWecomAppTextMessageByUserIds(userIds, content);
}
