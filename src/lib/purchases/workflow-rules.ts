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
      return false;
    case 'issue':
      return false;
    case 'resolve_issue':
      return false;
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
      return '采购流程不包含独立打款节点';
    case 'submit_reimbursement':
      return '当前状态无法提交报销，请先确认审批与凭证信息';
    case 'withdraw':
      return '当前状态无法撤回';
    case 'issue':
      return '采购流程不包含付款异常处理节点';
    case 'resolve_issue':
      return '采购流程不包含付款异常处理节点';
    default:
      return '当前状态无法执行该操作';
  }
}
