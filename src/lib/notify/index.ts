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
  return `${buildAppBaseUrl()}/workflow/todo`;
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
    linkUrl: '/workflow/todo',
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
    financeOrgType?: 'school' | 'company';
  }
) {
  const recipientIds = params.financeGroup
    ? await listFinanceRecipientIds(params.financeOrgType)
    : (params.employeeIds ?? []);

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
    | 'specification'
    | 'quantity'
    | 'totalAmount'
    | 'feeAmount'
    | 'purchaser'
    | 'approver'
    | 'rejecter'
    | 'pendingApprover'
    | 'organizationType'
    | 'paidAmount'
    | 'remainingAmount'
    | 'dueAmount'
    | 'paymentIssueReason'
    | 'rejectionReason'
    | 'logs'
  >
): Promise<void> {
  const policy = getNotifyPolicy()[event];
  if (!policy.enabled || policy.channels.length === 0) return;

  const detailLink = buildDetailLink(purchase.id);
  const applicant = purchase.purchaser?.displayName || '申请人';
  const approver = purchase.pendingApprover?.displayName || '审批人';
  const quantityText = `${Number(purchase.quantity ?? 0)} 件`;
  const totalAmount = Number((purchase.totalAmount ?? 0) + (purchase.feeAmount ?? 0)).toFixed(2);
  const approvedBy = purchase.approver?.displayName || '审批管理员';
  const rejectedBy = purchase.rejecter?.displayName || approvedBy;
  const itemListText = purchase.specification
    ? `${purchase.itemName}（规格：${purchase.specification}）`
    : purchase.itemName;
  const latestTransferLog = [...(purchase.logs ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .find((log) => log.action === 'transfer');
  const transferredBy = latestTransferLog?.operatorName || '审批管理员';
  const transferredTo = purchase.pendingApprover?.displayName || '审批管理员';

  if (event === 'purchase_submitted') {
    const title = '采购待审批';
    const content = [
        `【${title}】`,
        `采购单号：${purchase.purchaseNumber}`,
        `物品：${purchase.itemName}`,
        `数量：${quantityText}`,
        `总价：${totalAmount} 元`,
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
        `数量：${quantityText}`,
        `总价：${totalAmount} 元`,
        `审批人：${approvedBy}`,
        '审批通过后将进入待入库，请采购申请人尽快完成到货入库。',
        '系统已按规则默认完成付款记录；后续如需报销，请在报销中心发起申请。',
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

  if (event === 'purchase_rejected') {
    const title = '采购审批驳回';
    const content = [
      `【${title}】`,
      `采购单号：${purchase.purchaseNumber}`,
      `采购清单：${itemListText}`,
      `数量：${quantityText}`,
      `审批人：${rejectedBy}`,
      `驳回原因：${purchase.rejectionReason || '请进入系统查看详情'}`,
      '处理方式：请先修改采购信息或补充资料，再重新提交审批。',
      '建议步骤：打开采购详情 -> 根据驳回意见修正 -> 点击“重新提交审批”。',
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

  if (event === 'purchase_transferred') {
    const title = '采购审批转审';
    const content = [
      `【${title}】`,
      `采购单号：${purchase.purchaseNumber}`,
      `物品：${purchase.itemName}`,
      `申请人：${applicant}`,
      `转审人：${transferredBy}`,
      `转审到：${transferredTo}`,
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
      financeOrgType: purchase.organizationType,
      purchaseId: purchase.id,
      content,
    });
    return;
  }

  if (event === 'purchase_paid') {
    const title = '采购已完成打款';
    const paidAmount = Number(purchase.paidAmount ?? 0);
    const dueAmount = Number(purchase.dueAmount ?? 0);
    const reimburseType = paidAmount + 0.01 >= dueAmount ? '全款报销' : '部分报销';
    const content = [
        `【${title}】`,
        `采购单号：${purchase.purchaseNumber}`,
        `物品：${purchase.itemName}`,
        `报销类型：${reimburseType}`,
        `已打款：${paidAmount.toFixed(2)} 元`,
        `应付总额：${dueAmount.toFixed(2)} 元`,
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
      '处理方式：请根据异常说明补充资料，并与财务确认后继续流程。',
      '建议步骤：进入详情查看异常说明 -> 补充凭证/修正信息 -> 等待财务复核。',
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
