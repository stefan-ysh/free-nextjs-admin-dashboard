import { hasInvoiceEvidence, type PurchaseRecord, type ReimbursementStatus } from '@/types/purchase';

export type WorkflowActionKey =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'transfer'
  | 'pay'
  | 'submit_reimbursement'
  | 'withdraw'
  | 'issue'
  | 'resolve_issue';

type WorkflowPurchaseLike = Pick<
  PurchaseRecord,
  'status' | 'reimbursementStatus' | 'invoiceType' | 'invoiceStatus' | 'invoiceImages' | 'receiptImages'
> & {
  paymentIssueOpen?: boolean;
  remainingAmount?: number;
};

const REIMBURSEMENT_SUBMIT_ALLOWED = new Set<ReimbursementStatus>([
  'invoice_pending',
  'reimbursement_rejected',
]);

export function isWorkflowActionStatusAllowed(
  action: WorkflowActionKey,
  purchase: WorkflowPurchaseLike
): boolean {
  switch (action) {
    case 'submit':
      return purchase.status === 'draft' || purchase.status === 'rejected';
    case 'approve':
    case 'reject':
    case 'transfer':
      return purchase.status === 'pending_approval';
    case 'withdraw':
      return purchase.status === 'pending_approval';
    case 'submit_reimbursement':
      if (purchase.status !== 'approved') return false;
      if (!REIMBURSEMENT_SUBMIT_ALLOWED.has(purchase.reimbursementStatus)) return false;
      return hasInvoiceEvidence(purchase);
    case 'pay':
      if (purchase.status !== 'approved') return false;
      if (purchase.reimbursementStatus !== 'reimbursement_pending') return false;
      if (purchase.paymentIssueOpen) return false;
      if (typeof purchase.remainingAmount === 'number') return purchase.remainingAmount > 0;
      return true;
    case 'issue':
      return purchase.status === 'approved' && !purchase.paymentIssueOpen;
    case 'resolve_issue':
      return purchase.status === 'approved' && Boolean(purchase.paymentIssueOpen);
    default:
      return false;
  }
}

export function getWorkflowActionBlockedMessage(action: WorkflowActionKey): string {
  switch (action) {
    case 'submit':
      return '当前状态无法重新提交';
    case 'approve':
      return '当前状态无法审批';
    case 'reject':
      return '当前状态无法驳回';
    case 'transfer':
      return '当前状态无法转审';
    case 'pay':
      return '当前状态无法打款';
    case 'submit_reimbursement':
      return '当前状态无法提交报销，请先确认审批与凭证信息';
    case 'withdraw':
      return '当前状态无法撤回';
    case 'issue':
      return '当前状态无法标记异常';
    case 'resolve_issue':
      return '当前状态无法解除异常';
    default:
      return '当前状态无法执行该操作';
  }
}
