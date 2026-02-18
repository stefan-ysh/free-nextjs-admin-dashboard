import type { ReimbursementRecord } from '@/types/reimbursement';
import {
  createInAppNotifications,
  listFinanceRecipientIds,
  listRecipientEmailsByIds,
} from '@/lib/db/notifications';
import { sendEmailMessages } from '@/lib/notify/email';

type ReimbursementNotifyEvent =
  | 'reimbursement_submitted'
  | 'reimbursement_approved'
  | 'reimbursement_rejected'
  | 'reimbursement_paid';

function buildAppBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

function buildDetailLink(reimbursementId: string): string {
  return `${buildAppBaseUrl()}/reimbursements?focus=${encodeURIComponent(reimbursementId)}`;
}

function buildEmailSubject(title: string): string {
  return `【${title}】`;
}

function buildEmailHtml(title: string, content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let detailUrl: string | null = null;
  const items = lines
    .map((line) => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      if (line.startsWith('处理链接：') || line.startsWith('详情链接：')) {
        const url = line.replace(/^(处理链接：|详情链接：)/, '').trim();
        if (/^https?:\/\//i.test(url)) {
          detailUrl = url;
          return '';
        }
      }
      return `<li style="margin:0 0 8px;">${escaped}</li>`;
    })
    .filter(Boolean)
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fb;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="padding:16px 20px;background:#111827;color:#ffffff;font-size:16px;font-weight:700;">${title}</div>
        <div style="padding:18px 20px;color:#111827;">
          <ul style="margin:0;padding-left:18px;line-height:1.65;">${items}</ul>
          ${detailUrl ? `
            <div style="margin-top:14px;">
              <a href="${detailUrl}" style="display:inline-block;padding:9px 14px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none;font-size:13px;">
                查看详情
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function buildCommonLines(reimbursement: ReimbursementRecord) {
  const sourceText = reimbursement.sourceType === 'purchase' ? '关联采购报销' : '直接报销';
  return [
    `报销单号：${reimbursement.reimbursementNumber}`,
    `标题：${reimbursement.title}`,
    `来源：${sourceText}`,
    `分类：${reimbursement.category}`,
    `金额：${Number(reimbursement.amount).toFixed(2)} 元`,
    reimbursement.sourcePurchaseNumber ? `关联采购：${reimbursement.sourcePurchaseNumber}` : null,
  ].filter((item): item is string => Boolean(item));
}

async function dispatch(params: {
  eventType: ReimbursementNotifyEvent;
  title: string;
  content: string;
  reimbursementId: string;
  recipientIds: string[];
}) {
  const dedupedRecipientIds = Array.from(
    new Set(params.recipientIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))
  );
  if (dedupedRecipientIds.length === 0) return;

  await createInAppNotifications({
    recipientIds: dedupedRecipientIds,
    eventType: params.eventType,
    title: params.title,
    content: params.content,
    relatedType: 'reimbursement',
    relatedId: params.reimbursementId,
    linkUrl: '/reimbursements',
  });

  const emails = await listRecipientEmailsByIds(dedupedRecipientIds);
  await sendEmailMessages({
    to: emails,
    subject: buildEmailSubject(params.title),
    text: params.content,
    html: buildEmailHtml(params.title, params.content),
  });
}

export async function notifyReimbursementEvent(
  event: ReimbursementNotifyEvent,
  reimbursement: ReimbursementRecord
): Promise<void> {
  const detailLink = buildDetailLink(reimbursement.id);
  const common = buildCommonLines(reimbursement);

  if (event === 'reimbursement_submitted') {
    const title = '报销待审批';
    const content = [`【${title}】`, ...common, '请尽快完成审批。', `处理链接：${detailLink}`].join('\n');
    await dispatch({
      eventType: event,
      title,
      content,
      reimbursementId: reimbursement.id,
      recipientIds: reimbursement.pendingApproverId ? [reimbursement.pendingApproverId] : [],
    });
    return;
  }

  if (event === 'reimbursement_approved') {
    const title = '报销审批通过';
    const financeRecipients = await listFinanceRecipientIds(reimbursement.organizationType);
    const content = [
      `【${title}】`,
      ...common,
      '已通过审批，请财务核对附件后执行打款。',
      `处理链接：${detailLink}`,
    ].join('\n');
    await dispatch({
      eventType: event,
      title,
      content,
      reimbursementId: reimbursement.id,
      recipientIds: [reimbursement.applicantId, reimbursement.createdBy, ...financeRecipients],
    });
    return;
  }

  if (event === 'reimbursement_rejected') {
    const title = '报销审批驳回';
    const content = [
      `【${title}】`,
      ...common,
      `驳回原因：${reimbursement.rejectionReason || '请进入系统查看详情'}`,
      '处理方式：请修改报销信息并重新提交。',
      `处理链接：${detailLink}`,
    ].join('\n');
    await dispatch({
      eventType: event,
      title,
      content,
      reimbursementId: reimbursement.id,
      recipientIds: [reimbursement.applicantId, reimbursement.createdBy],
    });
    return;
  }

  const title = '报销已打款';
  const content = [
    `【${title}】`,
    ...common,
    '财务已完成打款，报销流程结束。',
    `详情链接：${detailLink}`,
  ].join('\n');
  await dispatch({
    eventType: event,
    title,
    content,
    reimbursementId: reimbursement.id,
    recipientIds: [reimbursement.applicantId, reimbursement.createdBy],
  });
}
