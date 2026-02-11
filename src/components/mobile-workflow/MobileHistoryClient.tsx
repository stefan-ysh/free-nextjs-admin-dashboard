'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import type { PurchaseRecord } from '@/types/purchase';
import { formatMoney, reimbursementBadgeClass, reimbursementText, statusBadgeClass, statusText } from '@/components/mobile-workflow/shared';

type PurchaseListResponse = {
  success: boolean;
  data?: { items: PurchaseRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

export default function MobileHistoryClient({ currentUserId }: { currentUserId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PurchaseRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/purchases?page=1&pageSize=50&sortBy=updatedAt&sortOrder=desc', {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as PurchaseListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '加载已办失败');
      }
      setItems(
        payload.data.items.filter((item) => {
          const isMine = item.createdBy === currentUserId || item.purchaserId === currentUserId;
          if (!isMine) return false;
          // "已办" 页仅显示已处理单据，排除草稿和待审批。
          if (item.status === 'draft' || item.status === 'pending_approval') return false;
          return true;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载已办失败');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="surface-panel flex items-center justify-between p-3">
        <div>
          <p className="text-sm font-semibold">我的申请历史</p>
          <p className="text-xs text-muted-foreground">用于手机端快速查阅流程状态。</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          刷新
        </Button>
      </div>

      {loading ? <DataState variant="loading" className="p-8" /> : null}
      {!loading && error ? <DataState variant="error" description={error} className="p-8" /> : null}
      {!loading && !error && items.length === 0 ? <DataState variant="empty" title="暂无历史记录" className="p-8" /> : null}

      {!loading && !error
        ? items.map((item) => (
            <Link key={item.id} href={`/m/tasks/${item.id}`} className="surface-panel block space-y-2 p-3 transition hover:border-primary/40">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.itemName}</p>
                <span className={`rounded border px-2 py-0.5 text-[11px] ${statusBadgeClass(item.status)}`}>{statusText(item)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.purchaseNumber}</p>
              <div className="flex items-center justify-between text-xs">
                <span>{formatMoney(Number(item.totalAmount) + Number(item.feeAmount ?? 0))}</span>
                <span className={`rounded border px-2 py-0.5 text-[11px] ${reimbursementBadgeClass(item.reimbursementStatus)}`}>
                  {reimbursementText(item)}
                </span>
              </div>
            </Link>
          ))
        : null}
    </div>
  );
}
