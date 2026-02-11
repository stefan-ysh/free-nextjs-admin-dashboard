import type { PurchaseDetail } from '@/types/purchase';
import {
  sendSmsTextMessage,
  sendSmsToEmployeeIds,
  sendSmsToFinance,
} from '@/lib/notify/sms';
import { createInAppNotifications, listFinanceRecipientIds } from '@/lib/db/notifications';
import type { NotifyChannel } from '@/lib/notify/policy';
import { getNotifyPolicy, type PurchaseNotifyEvent } from '@/lib/notify/policy';

type SmsTargetChannel = 'approval' | 'applicant' | 'finance';

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

async function sendTargetedOrFallback(params: {
  content: string;
  employeeIds?: string[];
  channel: SmsTargetChannel;
  financeGroup?: boolean;
}): Promise<void> {
  const { content, employeeIds = [], channel, financeGroup } = params;
  let sent = false;

  try {
    if (financeGroup) {
      sent = await sendSmsToFinance(content);
    } else if (employeeIds.length > 0) {
      sent = await sendSmsToEmployeeIds(employeeIds, content, channel);
    }
  } catch (error) {
    console.warn('[sms] 精准短信发送失败，回退默认通道', error);
  }

  if (sent) return;
  await sendSmsTextMessage(content, { channel });
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

async function sendEmailMessage(event: PurchaseNotifyEvent, content: string): Promise<void> {
  // Keep a no-op placeholder for later email provider integration.
  if (!content) return;
  console.info(`[notify][email] ${event}`);
}

async function dispatchByPolicy(
  event: PurchaseNotifyEvent,
  params: {
    channels: NotifyChannel[];
    title: string;
    content: string;
    purchaseId: string;
    employeeIds?: string[];
    smsChannel: SmsTargetChannel;
    financeGroup?: boolean;
  }
) {
  for (const channel of params.channels) {
    if (channel === 'sms') {
      await sendTargetedOrFallback({
        content: params.content,
        employeeIds: params.employeeIds,
        channel: params.smsChannel,
        financeGroup: params.financeGroup,
      });
      continue;
    }
    if (channel === 'in_app') {
      const recipientIds = params.financeGroup ? await listFinanceRecipientIds() : (params.employeeIds ?? []);
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
      await sendEmailMessage(event, params.content);
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
      smsChannel: 'approval',
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
      smsChannel: 'applicant',
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
      smsChannel: 'finance',
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
      smsChannel: 'applicant',
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
      smsChannel: 'applicant',
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
      smsChannel: 'applicant',
      purchaseId: purchase.id,
      content,
    });
  }
}
