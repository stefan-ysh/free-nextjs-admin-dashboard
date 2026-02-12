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
  if (status === 'pending_approval') return 'bg-chart-3/15 text-chart-3 border-chart-3/30';
  if (status === 'approved') return 'bg-chart-2/15 text-chart-2 border-chart-2/30';
  if (status === 'paid') return 'bg-chart-5/15 text-chart-5 border-chart-5/30';
  if (status === 'rejected') return 'bg-destructive/15 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

export function reimbursementBadgeClass(status: string): string {
  if (status === 'invoice_pending') return 'bg-chart-3/15 text-chart-3 border-chart-3/30';
  if (status === 'reimbursement_pending') return 'bg-chart-2/15 text-chart-2 border-chart-2/30';
  if (status === 'reimbursed') return 'bg-chart-5/15 text-chart-5 border-chart-5/30';
  if (status === 'reimbursement_rejected') return 'bg-destructive/15 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

export function statusText(record: Pick<PurchaseLike, 'status'>): string {
  return getPurchaseStatusText(record.status);
}

export function reimbursementText(record: Pick<PurchaseLike, 'reimbursementStatus'>): string {
  return getReimbursementStatusText(record.reimbursementStatus);
}
