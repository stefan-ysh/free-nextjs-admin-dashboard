import {
  getPurchaseStatusText,
  getReimbursementStatusText,
  type PurchaseDetail,
  type PurchasePaymentQueueItem,
  type PurchaseRecord,
} from '@/types/purchase';

export type PurchaseLike = PurchaseRecord | PurchaseDetail | PurchasePaymentQueueItem;

export const moneyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

export function formatMoney(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return moneyFormatter.format(0);
  return moneyFormatter.format(n);
}

export function statusBadgeClass(status: string): string {
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'approved') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-muted text-muted-foreground border-border';
}

export function reimbursementBadgeClass(status: string): string {
  if (status === 'invoice_pending') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'reimbursement_pending') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'reimbursed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'reimbursement_rejected') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-muted text-muted-foreground border-border';
}

export function statusText(record: Pick<PurchaseLike, 'status'>): string {
  return getPurchaseStatusText(record.status);
}

export function reimbursementText(record: Pick<PurchaseLike, 'reimbursementStatus'>): string {
  return getReimbursementStatusText(record.reimbursementStatus);
}
