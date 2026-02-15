import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { sendEmailMessages } from '@/lib/notify/email';

type SendEmailPayload = {
  to?: unknown;
  subject?: unknown;
  content?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function unauthorized() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function normalizeRecipients(input: unknown): string[] {
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) return input.filter((item): item is string => typeof item === 'string');
  return [];
}

export async function POST(request: Request) {
  try {
    await requireCurrentUser();
    const body = (await request.json().catch(() => ({}))) as SendEmailPayload;
    const recipients = normalizeRecipients(body.to).map((item) => item.trim()).filter(Boolean);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (recipients.length === 0) return badRequest('收件人不能为空');
    if (!subject) return badRequest('主题不能为空');
    if (!content) return badRequest('内容不能为空');

    const sent = await sendEmailMessages({
      to: recipients,
      subject,
      text: content,
    });
    if (!sent) {
      return NextResponse.json(
        { success: false, error: '邮件通知未启用或配置不完整' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorized();
    }
    console.error('Error sending email:', error);
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}
