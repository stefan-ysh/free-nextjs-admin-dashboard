import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value || !value.includes('@')) return null;
  return value;
}

function normalizeReplyTo(raw: string | undefined): string | null {
  return normalizeEmail(raw ?? null);
}

function parseBoolean(raw: string | undefined, fallback = false): boolean {
  if (!raw) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return fallback;
}

function envFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function buildHtmlFromText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return `<pre style="white-space:pre-wrap;font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;margin:0;">${escaped}</pre>`;
}

export function isEmailNotifyEnabled(): boolean {
  return process.env.EMAIL_NOTIFY_ENABLED === '1';
}

let cachedTransportKey = '';
let cachedTransporter: Transporter | null = null;

function getSmtpTransporter(): Transporter {
  const host = envFirst('SMTP_HOST', 'EMAIL_SMTP_HOST');
  const port = Number(envFirst('SMTP_PORT', 'EMAIL_SMTP_PORT') || '25');
  const secure = parseBoolean(envFirst('SMTP_SECURE', 'EMAIL_SMTP_SECURE'), port === 465);
  const ignoreTLS = parseBoolean(envFirst('SMTP_IGNORE_TLS', 'EMAIL_SMTP_IGNORE_TLS'), false);
  const requireTLS = parseBoolean(envFirst('SMTP_REQUIRE_TLS', 'EMAIL_SMTP_REQUIRE_TLS'), false);
  const user = envFirst('SMTP_USER', 'EMAIL_SMTP_USER');
  const pass = envFirst('SMTP_PASS', 'EMAIL_SMTP_PASS');
  const timeout = Number(envFirst('SMTP_TIMEOUT_MS', 'EMAIL_SMTP_TIMEOUT_MS') || '15000');

  if (!host || !Number.isFinite(port) || port <= 0) {
    throw new Error('EMAIL_SMTP_MISSING_CONFIG');
  }

  const key = [host, String(port), String(secure), String(ignoreTLS), String(requireTLS), user ?? ''].join('|');
  if (cachedTransporter && key === cachedTransportKey) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ignoreTLS,
    requireTLS,
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
  cachedTransportKey = key;
  return cachedTransporter;
}

async function sendBySmtp(params: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const from = envFirst('SMTP_FROM', 'EMAIL_FROM', 'SMTP_USER', 'EMAIL_SMTP_USER');
  if (!from) {
    throw new Error('EMAIL_NOTIFY_MISSING_CONFIG');
  }

  const transporter = getSmtpTransporter();
  const replyTo = normalizeReplyTo(process.env.EMAIL_REPLY_TO);
  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html ?? buildHtmlFromText(params.text),
    ...(replyTo ? { replyTo } : {}),
  });
}

export async function sendEmailMessages(params: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!isEmailNotifyEnabled()) return false;

  const recipients = Array.from(
    new Set(params.to.map((item) => normalizeEmail(item)).filter((item): item is string => Boolean(item)))
  );
  if (recipients.length === 0) return false;
  if (!params.subject?.trim() || !params.text?.trim()) return false;

  await sendBySmtp({
    to: recipients,
    subject: params.subject.trim(),
    text: params.text.trim(),
    html: params.html,
  });
  return true;
}
