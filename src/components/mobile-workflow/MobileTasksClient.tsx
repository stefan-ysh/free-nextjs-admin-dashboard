'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import type { PurchaseRecord } from '@/types/purchase';
import type { ReimbursementRecord } from '@/types/reimbursement';
import {
  formatMoney,
  statusBadgeClass,
  statusText,
} from '@/components/mobile-workflow/shared';

type PurchaseListResponse = {
  success: boolean;
  data?: { items: PurchaseRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

type ReimbursementListResponse = {
  success: boolean;
  data?: { items: ReimbursementRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

export default function MobileTasksClient({
  canApprove,
  canReject,
  canPay,
}: {
  currentUserId: string;
  canApprove: boolean;
  canReject: boolean;
  canPay: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [approvalItems, setApprovalItems] = useState<PurchaseRecord[]>([]);
  const [paymentItems, setPaymentItems] = useState<ReimbursementRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPaymentError(null);
    try {
      const [approvalsResult, paymentsResult] = await Promise.allSettled([
        fetch('/api/purchases/approvals?page=1&pageSize=30', { headers: { Accept: 'application/json' } }),
        canPay
          ? fetch('/api/reimbursements?scope=pay&page=1&pageSize=30', { headers: { Accept: 'application/json' } })
          : Promise.resolve(null),
      ]);

      if (approvalsResult.status !== 'fulfilled') {
        throw new Error('加载待审批失败');
      }
      const approvalsPayload = (await approvalsResult.value.json()) as PurchaseListResponse;
      if (!approvalsResult.value.ok || !approvalsPayload.success || !approvalsPayload.data) {
        throw new Error(approvalsPayload.error || '加载待审批失败');
      }
      setApprovalItems(approvalsPayload.data.items);

      if (canPay && paymentsResult.status === 'fulfilled' && paymentsResult.value) {
        const paymentPayload = (await paymentsResult.value.json()) as ReimbursementListResponse;
        if (!paymentsResult.value.ok || !paymentPayload.success || !paymentPayload.data) {
          setPaymentItems([]);
          setPaymentError(paymentPayload.error || '待报销打款加载失败');
        } else {
          setPaymentItems(paymentPayload.data.items);
        }
      } else if (canPay && paymentsResult.status === 'rejected') {
        setPaymentItems([]);
        setPaymentError('待付款加载失败');
      } else {
        setPaymentItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [canPay]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalCount = approvalItems.length + paymentItems.length;
  const title = useMemo(() => `当前待办 ${totalCount} 条`, [totalCount]);
  const hasApproval = approvalItems.length > 0;
  const hasPayment = paymentItems.length > 0;
  const showFinanceSection = canPay || canApprove || canReject;

  return (
    <div className="space-y-3">
      <div className="surface-panel p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{title}</p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>待审批 {approvalItems.length}</span>
              <span>待财务 {paymentItems.length}</span>
              {paymentError ? <span className="text-chart-3">财务队列暂不可用</span> : null}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            刷新
          </Button>
        </div>
      </div>

      {loading ? <DataState variant="loading" className="p-8" /> : null}
      {!loading && error ? <DataState variant="error" description={error} className="p-8" /> : null}

      {!loading && !error ? (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold">待审批</h2>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {approvalItems.length}
              </span>
            </div>
            {!hasApproval ? (
              <p className="surface-panel px-3 py-2 text-xs text-muted-foreground">暂无待审批任务</p>
            ) : null}
            {approvalItems.map((item) => (
              <Link
                key={`approval-${item.id}`}
                href={`/m/tasks/${item.id}`}
                className="surface-panel block space-y-2 p-3 transition hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.itemName}</p>
                  <span className={`rounded border px-2 py-0.5 text-[11px] ${statusBadgeClass(item.status)}`}>
                    {statusText(item)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{item.purchaseNumber}</p>
                <div className="flex items-center justify-between text-xs">
                  <span>申请金额 {formatMoney(Number(item.totalAmount) + Number(item.feeAmount ?? 0))}</span>
                  <span className="text-muted-foreground">去审批</span>
                </div>
              </Link>
            ))}
          </section>

          {showFinanceSection && (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">待财务确认</h2>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {paymentItems.length}
              </span>
            </div>
              {paymentError ? (
                <p className="surface-panel border-chart-3/40 px-3 py-2 text-xs text-chart-3">
                  财务队列暂时不可用：{paymentError}
                </p>
              ) : null}
              {!hasPayment ? (
                <p className="surface-panel px-3 py-2 text-xs text-muted-foreground">暂无待付款任务</p>
              ) : null}
              {paymentItems.map((item) => (
                <Link
                  key={`payment-${item.reimbursementNumber}`}
                  href={`/reimbursements?scope=pay&focus=${encodeURIComponent(item.id)}`}
                  className="surface-panel block space-y-2 p-3 transition hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <span className="rounded border border-chart-3/30 bg-chart-3/15 px-2 py-0.5 text-[11px] text-chart-3">
                      待打款
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.reimbursementNumber}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span>待付 {formatMoney(item.amount)}</span>
                    <span className="text-muted-foreground">去处理</span>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
