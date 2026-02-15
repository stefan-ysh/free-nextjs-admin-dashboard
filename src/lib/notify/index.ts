import type { PurchaseDetail } from '@/types/purchase';
import {
  createInAppNotifications,
  listFinanceRecipientIds,
  listRecipientEmailsByIds,
} from '@/lib/db/notifications';
import type { NotifyChannel } from '@/lib/notify/policy';
import { getNotifyPolicy, type PurchaseNotifyEvent } from '@/lib/notify/policy';
import { sendEmailMessages } from '@/lib/notify/email';

function buildAppBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

function buildDetailLink(purchaseId: string): string {
  return `${buildAppBaseUrl()}/m/tasks/${purchaseId}`;
}

function buildEmailSubject(title: string): string {
  return `【${title}】`;
}

function buildEmailHtml(title: string, content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

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
          return `<li style="margin:0 0 10px;"><a href="${url}" style="color:#2563eb;text-decoration:none;">查看详情</a></li>`;
        }
      }
      return `<li style="margin:0 0 10px;">${escaped}</li>`;
    })
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fb;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="padding:16px 20px;background:#111827;color:#ffffff;font-size:16px;font-weight:600;">${title}</div>
        <div style="padding:18px 20px;color:#111827;">
          <ul style="margin:0;padding-left:18px;line-height:1.7;">${items}</ul>
        </div>
      </div>
    </div>
  `;
}

async function sendInAppMessage(params: {
  event: PurchaseNotifyEvent;
  title: string;
  content: string;
  purchaseId: string;
  recipientIds: string[];
}): Promise<void> {
  if (!params.content || params.recipientIds.length === 0) return;
  await createInAppNotifications({
    recipientIds: params.recipientIds,
    eventType: params.event,
    title: params.title,
    content: params.content,
    relatedType: 'purchase',
    relatedId: params.purchaseId,
    linkUrl: `/m/tasks/${params.purchaseId}`,
  });
}

async function dispatchByPolicy(
  event: PurchaseNotifyEvent,
  params: {
    channels: NotifyChannel[];
    title: string;
    content: string;
    purchaseId: string;
    employeeIds?: string[];
    financeGroup?: boolean;
  }
) {
  const recipientIds = params.financeGroup ? await listFinanceRecipientIds() : (params.employeeIds ?? []);

  for (const channel of params.channels) {
    if (channel === 'in_app') {
      await sendInAppMessage({
        event,
        title: params.title,
        content: params.content,
        purchaseId: params.purchaseId,
        recipientIds,
      });
      continue;
    }
    if (channel === 'email') {
      const recipientEmails = await listRecipientEmailsByIds(recipientIds);
      await sendEmailMessages({
        to: recipientEmails,
        subject: buildEmailSubject(params.title),
        text: params.content,
        html: buildEmailHtml(params.title, params.content),
      });
    }
  }
}

export async function notifyPurchaseEvent(
  event: PurchaseNotifyEvent,
  purchase: Pick<
    PurchaseDetail,
    | 'id'
    | 'purchaseNumber'
    | 'itemName'
    | 'purchaser'
    | 'pendingApprover'
    | 'remainingAmount'
    | 'dueAmount'
    | 'paymentIssueReason'
  >
): Promise<void> {
  const policy = getNotifyPolicy()[event];
  if (!policy.enabled || policy.channels.length === 0) return;

  const detailLink = buildDetailLink(purchase.id);
  const applicant = purchase.purchaser?.displayName || purchase.purchaser?.id || '申请人';
  const approver = purchase.pendingApprover?.displayName || purchase.pendingApprover?.id || '审批人';

  if (event === 'purchase_submitted') {
    const title = '采购待审批';
    const content = [
        `【${title}】`,
        `采购单号：${purchase.purchaseNumber}`,
        `物品：${purchase.itemName}`,
        `申请人：${applicant}`,
        `当前审批人：${approver}`,
        `处理链接：${detailLink}`,
      ].join('\n');
    await dispatchByPolicy(event, {
      channels: policy.channels,
      title,
      employeeIds: purchase.pendingApprover?.id ? [purchase.pendingApprover.id] : [],
      purchaseId: purchase.id,
      content,
    });
    return;
  }

  if (event === 'purchase_approved') {
    const title = '采购审批通过';
    const content = [
        `【${title}】`,
        `采购单号：${purchase.purchaseNumber}`,
        `物品：${purchase.itemName}`,
        '请尽快完成采购、入库并上传发票后提交报销。',
        `详情链接：${detailLink}`,
      ].join('\n');
    await dispatchByPolicy(event, {
      channels: policy.channels,
      title,
      employeeIds: purchase.purchaser?.id ? [purchase.purchaser.id] : [],
      purchaseId: purchase.id,
      content,
    });
    return;
  }

  if (event === 'reimbursement_submitted') {
    const title = '报销待财务确认';
    const content = [
        `【${title}】`,
        `采购单号：${purchase.purchaseNumber}`,
        `物品：${purchase.itemName}`,
        `申请人：${applicant}`,
        `应付金额：${Number(purchase.dueAmount ?? 0).toFixed(2)} 元`,
        `待付金额：${Number(purchase.remainingAmount ?? 0).toFixed(2)} 元`,
        `处理链接：${detailLink}`,
      ].join('\n');
    await dispatchByPolicy(event, {
      channels: policy.channels,
      title,
      financeGroup: true,
      purchaseId: purchase.id,
      content,
    });
    return;
  }

  if (event === 'purchase_paid') {
    const title = '采购已完成打款';
    const content = [
        `【${title}】`,
        `采购单号：${purchase.purchaseNumber}`,
        `物品：${purchase.itemName}`,
        '财务已确认打款，采购流程已完成。',
        `详情链接：${detailLink}`,
      ].join('\n');
    await dispatchByPolicy(event, {
      channels: policy.channels,
      title,
      employeeIds: purchase.purchaser?.id ? [purchase.purchaser.id] : [],
      purchaseId: purchase.id,
      content,
    });
    return;
  }

  if (event === 'payment_issue_marked') {
    const title = '报销打款异常';
    const content = [
      `【${title}】`,
      `采购单号：${purchase.purchaseNumber}`,
      `物品：${purchase.itemName}`,
      `异常说明：${purchase.paymentIssueReason || '请联系财务查看详情'}`,
      '请根据异常说明补充资料后继续流程。',
      `详情链接：${detailLink}`,
    ].join('\n');
    await dispatchByPolicy(event, {
      channels: policy.channels,
      title,
      employeeIds: purchase.purchaser?.id ? [purchase.purchaser.id] : [],
      purchaseId: purchase.id,
      content,
    });
    return;
  }

  if (event === 'payment_issue_resolved') {
    const title = '打款异常已解除';
    const content = [
      `【${title}】`,
      `采购单号：${purchase.purchaseNumber}`,
      `物品：${purchase.itemName}`,
      '财务已解除异常，流程恢复，可继续关注打款进度。',
      `详情链接：${detailLink}`,
    ].join('\n');
    await dispatchByPolicy(event, {
      channels: policy.channels,
      title,
      employeeIds: purchase.purchaser?.id ? [purchase.purchaser.id] : [],
      purchaseId: purchase.id,
      content,
    });
  }
}
