/**
 * 工作流 CC 节点通知工具
 * 当引擎流转过 CC 节点时，业务层调用此函数发送邮件/站内通知。
 */

import type { WorkflowNode } from '@/types/workflow';
import { sendEmailMessages } from '@/lib/notify/email';
import {
  listRecipientEmailsByIds,
  createInAppNotifications,
} from '@/lib/db/notifications';

interface CcNotifyContext {
  /** 触发此流转的单据 ID */
  documentId: string;
  /** 单据类型 (purchase / reimbursement) */
  documentType: 'purchase' | 'reimbursement';
  /** 单据编号/名称，用于显示 */
  documentLabel: string;
  /** 发起人 user ID（当 CC 角色包含 'applicant' 时用于解析） */
  applicantUserId?: string;
}

/**
 * 处理引擎返回的 passedCcNodes，依次发送通知。
 */
export async function notifyWorkflowCc(
  ccNodes: WorkflowNode[],
  context: CcNotifyContext
): Promise<void> {
  if (ccNodes.length === 0) return;

  for (const node of ccNodes) {
    if (node.type !== 'CC') continue;

    // 收集收件人 ID
    const recipientIds: string[] = [];

    // 1. 指定用户
    if ('users' in node && Array.isArray(node.users)) {
      recipientIds.push(...node.users);
    }

    // 2. 角色匹配（目前仅支持 'applicant' 角色）
    if ('roles' in node && Array.isArray(node.roles)) {
      if (node.roles.includes('applicant') && context.applicantUserId) {
        if (!recipientIds.includes(context.applicantUserId)) {
          recipientIds.push(context.applicantUserId);
        }
      }
    }

    if (recipientIds.length === 0) continue;

    const typeLabel = context.documentType === 'purchase' ? '采购' : '报销';
    const title = `${typeLabel}流程通知 - ${node.name || '抄送'}`;
    const content = [
      `【${title}】`,
      `单据：${context.documentLabel}`,
      `通知节点：${node.name || '抄送通知'}`,
      `详情链接：${process.env.APP_BASE_URL || 'http://localhost:3000'}/workflow/todo`,
    ].join('\n');

    // 站内通知
    try {
      await createInAppNotifications({
        recipientIds,
        eventType: 'workflow_cc',
        title,
        content,
        relatedType: context.documentType,
        relatedId: context.documentId,
        linkUrl: '/workflow/todo',
      });
    } catch (err) {
      console.error('[Workflow CC] 站内通知发送失败:', err);
    }

    // 邮件通知
    if ('sendEmail' in node && node.sendEmail) {
      try {
        const emails = await listRecipientEmailsByIds(recipientIds);
        if (emails.length > 0) {
          const emailTemplate = ('emailTemplate' in node && typeof node.emailTemplate === 'string')
            ? node.emailTemplate
            : content;

          await sendEmailMessages({
            to: emails,
            subject: `【${title}】`,
            text: emailTemplate,
          });
        }
      } catch (err) {
        console.error('[Workflow CC] 邮件通知发送失败:', err);
      }
    }
  }
}
