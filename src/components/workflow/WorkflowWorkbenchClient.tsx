'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import type { PurchasePaymentQueueItem, PurchaseRecord } from '@/types/purchase';
import { formatMoney, reimbursementBadgeClass, reimbursementText, statusBadgeClass, statusText } from '@/components/mobile-workflow/shared';

type WorkbenchTab = 'todo' | 'done' | 'notifications';

type PurchaseListResponse = {
  success: boolean;
  data?: { items: PurchaseRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

type PaymentQueueResponse = {
  success: boolean;
  data?: { items: PurchasePaymentQueueItem[]; total: number; page: number; pageSize: number };
  error?: string;
};

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

const TAB_LABELS: Record<WorkbenchTab, string> = {
  todo: '待办',
  done: '已办',
  notifications: '通知',
};

function normalizeTab(tab: string | null): WorkbenchTab {
  if (tab === 'todo' || tab === 'done' || tab === 'notifications') return tab;
  return 'todo';
}

function typeLabel(eventType: string): string {
  if (eventType === 'purchase_submitted') return '待审批';
  if (eventType === 'purchase_approved') return '已审批';
  if (eventType === 'reimbursement_submitted') return '待财务';
  if (eventType === 'purchase_paid') return '已打款';
  if (eventType === 'payment_issue_marked') return '付款异常';
  if (eventType === 'payment_issue_resolved') return '异常解除';
  return '其他';
}

function toDesktopLink(linkUrl: string | null): string {
  if (!linkUrl) return '/workflow/notifications';
  if (linkUrl.startsWith('/m/tasks')) return '/workflow/todo';
  if (linkUrl.startsWith('/m/notifications')) return '/workflow/notifications';
  if (linkUrl.startsWith('/m/history')) return '/workflow/done';
  return linkUrl;
}

export default function WorkflowWorkbenchClient({
  currentUserId,
  initialTab = 'todo',
}: {
  currentUserId: string;
  initialTab?: WorkbenchTab;
}) {
  const activeTab = normalizeTab(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [todoApprovals, setTodoApprovals] = useState<PurchaseRecord[]>([]);
  const [todoPayments, setTodoPayments] = useState<PurchasePaymentQueueItem[]>([]);
  const [doneItems, setDoneItems] = useState<PurchaseRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  const { hasPermission } = usePermissions();
  const canPay = hasPermission('PURCHASE_PAY');

  const markNotificationsRead = useCallback(async (options: { ids?: string[]; markAll?: boolean }) => {
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

  const loadTodo = useCallback(async () => {
    const [approvalResult, paymentResult] = await Promise.allSettled([
      fetch('/api/purchases/approvals?page=1&pageSize=40', { headers: { Accept: 'application/json' } }),
      canPay
        ? fetch('/api/finance/payments?status=pending&page=1&pageSize=40', { headers: { Accept: 'application/json' } })
        : Promise.resolve(null),
    ]);

    if (approvalResult.status === 'fulfilled') {
      const approvalPayload = (await approvalResult.value.json()) as PurchaseListResponse;
      if (approvalResult.value.ok && approvalPayload.success && approvalPayload.data) {
        setTodoApprovals(approvalPayload.data.items);
      } else if (approvalResult.value.status === 403) {
        setTodoApprovals([]);
      } else {
        throw new Error(approvalPayload.error || '加载待办失败');
      }
    } else {
      throw new Error('加载待办失败');
    }

    if (canPay && paymentResult.status === 'fulfilled' && paymentResult.value) {
      const paymentPayload = (await paymentResult.value.json()) as PaymentQueueResponse;
      if (!paymentResult.value.ok || !paymentPayload.success || !paymentPayload.data) {
        setTodoPayments([]);
        setPaymentError(paymentPayload.error || '待付款加载失败');
      } else {
        setTodoPayments(paymentPayload.data.items);
      }
    } else if (canPay && paymentResult.status === 'rejected') {
      setTodoPayments([]);
      setPaymentError('待付款加载失败');
    } else {
      setTodoPayments([]);
    }
  }, [canPay]);

  const loadDone = useCallback(async () => {
    const response = await fetch('/api/purchases?page=1&pageSize=80&sortBy=updatedAt&sortOrder=desc', {
      headers: { Accept: 'application/json' },
    });
    const payload = (await response.json()) as PurchaseListResponse;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error || '加载已办失败');
    }

    const filtered = payload.data.items.filter((item) => {
      const isMine = item.createdBy === currentUserId || item.purchaserId === currentUserId;
      if (!isMine) return false;
      if (item.status === 'draft' || item.status === 'pending_approval') return false;
      return true;
    });
    setDoneItems(filtered);
  }, [currentUserId]);

  const loadNotifications = useCallback(async () => {
    const response = await fetch('/api/notifications?page=1&pageSize=80', {
      headers: { Accept: 'application/json' },
    });
    const payload = (await response.json()) as NotificationListResponse;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error || '加载通知失败');
    }
    setNotifications(payload.data.items);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPaymentError(null);
    try {
      await Promise.all([loadTodo(), loadDone(), loadNotifications()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [loadDone, loadNotifications, loadTodo]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const counters = useMemo(
    () => ({
      todo: todoApprovals.length + todoPayments.length,
      done: doneItems.length,
      notifications: notifications.length,
    }),
    [doneItems.length, notifications.length, todoApprovals.length, todoPayments.length]
  );

  return (
    <section className="space-y-4">
      <div className="surface-toolbar p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold sm:text-lg">流程工作台</h1>
            <p className="text-xs text-muted-foreground">PC 端统一查看待办、已办和通知。</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadAll()} disabled={loading}>
            刷新
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['todo', 'done', 'notifications'] as const).map((tab) => (
            <Link
              key={tab}
              href={tab === 'todo' ? '/workflow/todo' : tab === 'done' ? '/workflow/done' : '/workflow/notifications'}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                activeTab === tab
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {TAB_LABELS[tab]} {counters[tab]}
            </Link>
          ))}
        </div>
      </div>

      {loading ? <DataState variant="loading" className="min-h-[220px]" /> : null}
      {!loading && error ? <DataState variant="error" description={error} className="min-h-[220px]" /> : null}

      {!loading && !error && activeTab === 'todo' ? (
        <div className="space-y-4">
          <div className="surface-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">待审批</h2>
              <span className="text-xs text-muted-foreground">{todoApprovals.length} 条</span>
            </div>
            {todoApprovals.length === 0 ? (
              <DataState variant="empty" title="暂无待审批任务" className="min-h-[120px]" />
            ) : (
              <div className="space-y-2">
                {todoApprovals.map((item) => (
                  <div key={item.id} className="surface-table flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">{item.purchaseNumber}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded border px-2 py-0.5 text-[11px] ${statusBadgeClass(item.status)}`}>
                        {statusText(item)}
                      </span>
                      <span className="text-sm">{formatMoney(Number(item.totalAmount) + Number(item.feeAmount ?? 0))}</span>
                      <Link href="/purchases/approvals" className="text-xs text-primary underline underline-offset-2">
                        去审批
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="surface-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">待财务确认</h2>
              <span className="text-xs text-muted-foreground">{todoPayments.length} 条</span>
            </div>
            {paymentError ? <p className="mb-2 text-xs text-amber-500">{paymentError}</p> : null}
            {todoPayments.length === 0 ? (
              <DataState variant="empty" title="暂无待付款任务" className="min-h-[120px]" />
            ) : (
              <div className="space-y-2">
                {todoPayments.map((item) => (
                  <div key={item.id} className="surface-table flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">{item.purchaseNumber}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded border px-2 py-0.5 text-[11px] ${reimbursementBadgeClass(item.reimbursementStatus)}`}>
                        {reimbursementText(item)}
                      </span>
                      <span className="text-sm">待付 {formatMoney(item.remainingAmount)}</span>
                      <Link href="/finance/payments" className="text-xs text-primary underline underline-offset-2">
                        去处理
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!loading && !error && activeTab === 'done' ? (
        <div className="surface-panel p-4">
          {doneItems.length === 0 ? (
            <DataState variant="empty" title="暂无已办记录" className="min-h-[180px]" />
          ) : (
            <div className="space-y-2">
              {doneItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/purchases?search=${encodeURIComponent(item.purchaseNumber)}`}
                  className="surface-table block p-3 transition hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.itemName}</p>
                    <span className={`rounded border px-2 py-0.5 text-[11px] ${statusBadgeClass(item.status)}`}>
                      {statusText(item)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.purchaseNumber}</span>
                    <span>{formatMoney(Number(item.totalAmount) + Number(item.feeAmount ?? 0))}</span>
                  </div>
                  <div className="mt-1">
                    <span className={`rounded border px-2 py-0.5 text-[11px] ${reimbursementBadgeClass(item.reimbursementStatus)}`}>
                      {reimbursementText(item)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!loading && !error && activeTab === 'notifications' ? (
        <div className="surface-panel p-4">
          <div className="mb-3 flex items-center justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!notifications.some((item) => !item.isRead)}
              onClick={() => {
                setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
                void markNotificationsRead({ markAll: true });
              }}
            >
              全部已读
            </Button>
          </div>
          {notifications.length === 0 ? (
            <DataState variant="empty" title="暂无通知" className="min-h-[180px]" />
          ) : (
            <div className="space-y-2">
              {notifications.map((item) => (
                <article key={item.id} className="surface-table p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {!item.isRead ? <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" /> : null}
                      {item.title}
                    </p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {typeLabel(item.eventType)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs whitespace-pre-line text-muted-foreground">{item.content}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    {item.linkUrl ? (
                      <Link
                        href={toDesktopLink(item.linkUrl)}
                        className="text-primary underline underline-offset-2"
                        onClick={() => {
                          if (item.isRead) return;
                          setNotifications((prev) =>
                            prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry))
                          );
                          void markNotificationsRead({ ids: [item.id] });
                        }}
                      >
                        查看
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
