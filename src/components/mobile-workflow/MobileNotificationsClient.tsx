'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { PurchaseRecord } from '@/types/purchase';

type NotificationRecord = {
  id: string;
  eventType: string;
  title: string;
  content: string;
  linkUrl: string | null;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

type NotificationListResponse = {
  success: boolean;
  data?: { items: NotificationRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

type ApprovalListResponse = {
  success: boolean;
  data?: { items: PurchaseRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

export default function MobileNotificationsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [activeType, setActiveType] = useState<'all' | NotificationRecord['eventType']>('all');

  const markAsRead = useCallback(async (options: { ids?: string[]; markAll?: boolean }) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: options.ids ?? [],
        markAll: options.markAll === true,
      }),
      keepalive: true,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications?page=1&pageSize=50', {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as NotificationListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '加载通知失败');
      }
      let normalized = payload.data.items;

      // Fallback: if no persisted in-app notifications yet, derive quick reminders
      // from current pending approvals so /m/notifications is not empty.
      if (normalized.length === 0) {
        const approvalResp = await fetch('/api/purchases/approvals?page=1&pageSize=20', {
          headers: { Accept: 'application/json' },
        });
        if (approvalResp.ok) {
          const approvalPayload = (await approvalResp.json()) as ApprovalListResponse;
          if (approvalPayload.success && approvalPayload.data?.items?.length) {
            normalized = approvalPayload.data.items.map((item) => ({
              id: `fallback-${item.id}`,
              eventType: 'purchase_submitted',
              title: `采购待审批：${item.itemName}`,
              content: `采购单号：${item.purchaseNumber}\n申请金额：${Number(item.totalAmount ?? 0).toFixed(2)} 元`,
              linkUrl: `/m/tasks/${item.id}`,
              relatedType: 'purchase',
              relatedId: item.id,
              isRead: false,
              createdAt: item.updatedAt,
              readAt: null,
            }));
          }
        }
      }

      setItems(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载通知失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const notifications = useMemo(() => {
    const sorted = [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const filtered = activeType === 'all' ? sorted : sorted.filter((item) => item.eventType === activeType);
    return filtered.slice(0, 50);
  }, [items, activeType]);

  const counters = useMemo(() => {
    const base = {
      all: items.length,
      purchase_submitted: 0,
      purchase_approved: 0,
      reimbursement_submitted: 0,
      purchase_paid: 0,
      payment_issue_marked: 0,
      payment_issue_resolved: 0,
    };
    for (const item of items) {
      if (item.eventType in base) {
        base[item.eventType as keyof typeof base] += 1;
      }
    }
    return base;
  }, [items]);

  const typeLabel: Record<string, string> = {
    purchase_submitted: '待审批',
    purchase_approved: '已审批',
    reimbursement_submitted: '待财务',
    purchase_paid: '已打款',
    payment_issue_marked: '付款异常',
    payment_issue_resolved: '异常解除',
  };

  return (
    <div className="space-y-3">
      <div className="surface-panel flex items-center justify-between p-3">
        <div>
          <p className="text-sm font-semibold">消息与提醒</p>
          <p className="text-xs text-muted-foreground">按类型查看采购审批/报销/打款通知。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!items.some((item) => !item.isRead && !item.id.startsWith('fallback-'))}
            onClick={() => {
              setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
              void markAsRead({ markAll: true });
            }}
          >
            全部已读
          </Button>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            刷新
          </Button>
        </div>
      </div>

      {!loading && !error ? (
        <div className="surface-panel flex flex-wrap gap-2 p-2">
          {[
            { key: 'all', label: '全部', count: counters.all },
            { key: 'purchase_submitted', label: '待审批', count: counters.purchase_submitted },
            { key: 'purchase_approved', label: '已审批', count: counters.purchase_approved },
            { key: 'reimbursement_submitted', label: '待财务', count: counters.reimbursement_submitted },
            { key: 'purchase_paid', label: '已打款', count: counters.purchase_paid },
            { key: 'payment_issue_marked', label: '付款异常', count: counters.payment_issue_marked },
            { key: 'payment_issue_resolved', label: '异常解除', count: counters.payment_issue_resolved },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveType(item.key as typeof activeType)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                activeType === item.key
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {item.label} {item.count}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <DataState variant="loading" className="p-8" /> : null}
      {!loading && error ? <DataState variant="error" description={error} className="p-8" /> : null}
      {!loading && !error && notifications.length === 0 ? <DataState variant="empty" title="暂无通知" className="p-8" /> : null}

      {!loading && !error
        ? notifications.map((item) => (
            <article key={item.id} className="surface-panel space-y-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                {!item.isRead ? <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" /> : null}
                {item.title}
                </p>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {typeLabel[item.eventType] ?? item.eventType}
                </span>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{item.content}</p>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString('zh-CN')}</p>
                {item.linkUrl ? (
                  <Link
                    href={item.linkUrl}
                    className="text-xs text-primary underline underline-offset-2"
                    onClick={() => {
                      if (item.id.startsWith('fallback-') || item.isRead) return;
                      setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
                      void markAsRead({ ids: [item.id] });
                    }}
                  >
                    查看
                  </Link>
                ) : null}
              </div>
            </article>
          ))
        : null}
    </div>
  );
}
