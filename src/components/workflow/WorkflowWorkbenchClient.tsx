'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import DataState from '@/components/common/DataState';
import PurchaseDetailModal from '@/components/purchases/PurchaseDetailModal';
import PurchasePayDialog from '@/components/purchases/PurchasePayDialog';
import ApprovalCommentDialog from '@/components/purchases/ApprovalCommentDialog';
import RejectionReasonDialog from '@/components/purchases/RejectionReasonDialog';
import TransferApprovalDialog from '@/components/purchases/TransferApprovalDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/usePermissions';
import type { PurchaseRowPermissions } from '@/components/purchases/PurchaseTable';
import {
  type PurchaseDetail,
  type PurchasePaymentQueueItem,
  type PurchaseRecord,
} from '@/types/purchase';
import { isWorkflowActionStatusAllowed } from '@/lib/purchases/workflow-rules';
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

type PurchaseDetailResponse = {
  success: boolean;
  data?: PurchaseDetail;
  error?: string;
};

type PurchaseActionResponse = {
  success: boolean;
  data?: PurchaseDetail;
  error?: string;
};

type FailedActionSnapshot = {
  purchaseId: string;
  action: string;
  body: Record<string, unknown>;
};

const TAB_LABELS: Record<WorkbenchTab, string> = {
  todo: '待办',
  done: '已办',
  notifications: '通知',
};

function getNotificationActionLabel(eventType: string): string {
  if (eventType === 'purchase_submitted' || eventType === 'purchase_transferred') return '去审批';
  if (eventType === 'reimbursement_submitted') return '去打款';
  if (eventType === 'reimbursement_approved') return '去打款';
  if (eventType === 'reimbursement_rejected') return '去修改';
  if (eventType === 'reimbursement_paid') return '看结果';
  if (eventType === 'purchase_rejected') return '去修改';
  if (eventType === 'payment_issue_marked') return '去处理';
  if (eventType === 'payment_issue_resolved') return '看进度';
  if (eventType === 'purchase_approved') return '去采购';
  if (eventType === 'purchase_paid') return '看结果';
  return '查看';
}

function getPendingHours(submittedAt: string | null): number {
  if (!submittedAt) return 0;
  const submitted = new Date(submittedAt).getTime();
  if (!Number.isFinite(submitted)) return 0;
  return Math.max(0, (Date.now() - submitted) / 36e5);
}

function getSlaLabel(hours: number): { label: string; className: string } | null {
  if (hours >= 48) return { label: `超时 ${Math.floor(hours)}h`, className: 'border-destructive/40 text-destructive bg-destructive/10' };
  if (hours >= 24) return { label: `临期 ${Math.floor(hours)}h`, className: 'border-chart-3/40 text-chart-3 bg-chart-3/10' };
  return null;
}

function normalizeTab(tab: string | null): WorkbenchTab {
  if (tab === 'todo' || tab === 'done' || tab === 'notifications') return tab;
  return 'todo';
}

export default function WorkflowWorkbenchClient({
  currentUserId,
  initialTab = 'todo',
}: {
  currentUserId: string;
  initialTab?: WorkbenchTab;
}) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(normalizeTab(initialTab));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [todoApprovals, setTodoApprovals] = useState<PurchaseRecord[]>([]);
  const [todoPayments, setTodoPayments] = useState<PurchasePaymentQueueItem[]>([]);
  const [doneItems, setDoneItems] = useState<PurchaseRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<FailedActionSnapshot | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<NotificationRecord | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });
  const [transferDialog, setTransferDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });
  const [payDialog, setPayDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });

  const { hasPermission } = usePermissions();
  const canApprove = hasPermission('PURCHASE_APPROVE');
  const canReject = hasPermission('PURCHASE_REJECT');
  const canTransfer = hasPermission('PURCHASE_APPROVE');
  const canPay = hasPermission('PURCHASE_PAY');
  const canHandleApprovalTasks = canApprove || canReject || canTransfer;
  const canHandlePaymentTasks = canPay;

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

  const loadPurchaseDetail = useCallback(async (purchaseId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/purchases/${purchaseId}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as PurchaseDetailResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '加载详情失败');
      }
      setSelectedPurchase(payload.data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
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
      todo:
        (canHandleApprovalTasks ? todoApprovals.length : 0) +
        (canHandlePaymentTasks ? todoPayments.length : 0),
      done: doneItems.length,
      notifications: notifications.length,
    }),
    [
      canHandleApprovalTasks,
      canHandlePaymentTasks,
      doneItems.length,
      notifications.length,
      todoApprovals.length,
      todoPayments.length,
    ]
  );

  const openPurchaseDetail = useCallback(
    (purchaseId: string) => {
      void loadPurchaseDetail(purchaseId);
    },
    [loadPurchaseDetail]
  );

  const openNotificationDetail = useCallback(
    (item: NotificationRecord) => {
      setSelectedNotification(item);
      if (item.isRead) return;
      setNotifications((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry))
      );
      void markNotificationsRead({ ids: [item.id] });
    },
    [markNotificationsRead]
  );

  const performAction = useCallback(
    async (
      purchaseId: string,
      action: string,
      body: Record<string, unknown> = {},
      options?: { successMessage?: string }
    ) => {
      setMutatingId(purchaseId);
      setActionError(null);
      try {
        const response = await fetch(`/api/purchases/${purchaseId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...body }),
        });
        const payload = (await response.json()) as PurchaseActionResponse;
        if (!response.ok || !payload.success) throw new Error(payload.error || '操作失败');

        if (payload.data) {
          setSelectedPurchase(payload.data);
          setDetailError(null);
        } else {
          await loadPurchaseDetail(purchaseId);
        }
        await loadAll();
        toast.success(options?.successMessage ?? '操作已完成');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : '操作失败，请稍后重试';
        setActionError(message);
        setLastFailedAction({ purchaseId, action, body });
        toast.error(message);
        return false;
      } finally {
        setMutatingId(null);
      }
    },
    [loadAll, loadPurchaseDetail]
  );

  const handleApprove = useCallback((purchase: PurchaseRecord | PurchaseDetail) => {
    setApproveDialog({ open: true, purchase });
  }, []);

  const handleReject = useCallback((purchase: PurchaseRecord | PurchaseDetail) => {
    setRejectDialog({ open: true, purchase });
  }, []);

  const handleTransfer = useCallback((purchase: PurchaseRecord | PurchaseDetail) => {
    setTransferDialog({ open: true, purchase });
  }, []);

  const handlePay = useCallback((purchase: PurchaseRecord | PurchaseDetail) => {
    setPayDialog({ open: true, purchase });
  }, []);

  const handleApproveDialogClose = useCallback(() => {
    if (mutatingId && approveDialog.purchase && mutatingId === approveDialog.purchase.id) return;
    setApproveDialog({ open: false, purchase: null });
  }, [approveDialog.purchase, mutatingId]);

  const handleRejectDialogClose = useCallback(() => {
    if (mutatingId && rejectDialog.purchase && mutatingId === rejectDialog.purchase.id) return;
    setRejectDialog({ open: false, purchase: null });
  }, [mutatingId, rejectDialog.purchase]);

  const handleTransferDialogClose = useCallback(() => {
    if (mutatingId && transferDialog.purchase && mutatingId === transferDialog.purchase.id) return;
    setTransferDialog({ open: false, purchase: null });
  }, [mutatingId, transferDialog.purchase]);

  const handlePayDialogClose = useCallback(() => {
    if (mutatingId && payDialog.purchase && mutatingId === payDialog.purchase.id) return;
    setPayDialog({ open: false, purchase: null });
  }, [mutatingId, payDialog.purchase]);

  const handleApproveSubmit = useCallback(async (comment: string) => {
    if (!approveDialog.purchase) return;
    const success = await performAction(
      approveDialog.purchase.id,
      'approve',
      { comment },
      { successMessage: '已通过该采购申请' }
    );
    if (success) setApproveDialog({ open: false, purchase: null });
  }, [approveDialog.purchase, performAction]);

  const handleRejectSubmit = useCallback(async (reason: string) => {
    if (!rejectDialog.purchase) return;
    const success = await performAction(
      rejectDialog.purchase.id,
      'reject',
      { reason },
      { successMessage: '已驳回该采购申请' }
    );
    if (success) setRejectDialog({ open: false, purchase: null });
  }, [performAction, rejectDialog.purchase]);

  const handleTransferSubmit = useCallback(async (payload: { approverId: string; comment: string }) => {
    if (!transferDialog.purchase) return;
    const success = await performAction(
      transferDialog.purchase.id,
      'transfer',
      { toApproverId: payload.approverId, comment: payload.comment },
      { successMessage: '已转交审批' }
    );
    if (success) setTransferDialog({ open: false, purchase: null });
  }, [performAction, transferDialog.purchase]);

  const handlePaySubmit = useCallback(async (amount: number, note?: string) => {
    if (!payDialog.purchase) return;
    const success = await performAction(
      payDialog.purchase.id,
      'pay',
      { amount, note },
      { successMessage: '已记录打款' }
    );
    if (success) setPayDialog({ open: false, purchase: null });
  }, [payDialog.purchase, performAction]);

  const handleSubmitFromDetail = useCallback(async (purchase: PurchaseRecord) => {
    await performAction(
      purchase.id,
      'submit',
      {},
      { successMessage: '已重新提交审批' }
    );
  }, [performAction]);

  const selectedPurchasePermissions: PurchaseRowPermissions | undefined = selectedPurchase
    ? {
      canEdit: selectedPurchase.createdBy === currentUserId && selectedPurchase.status === 'rejected',
      canDelete: false,
      canDuplicate: false,
      canSubmit:
        selectedPurchase.createdBy === currentUserId &&
        isWorkflowActionStatusAllowed('submit', selectedPurchase),
      canWithdraw: false,
      canApprove: canApprove && isWorkflowActionStatusAllowed('approve', selectedPurchase),
      canTransfer: canTransfer && isWorkflowActionStatusAllowed('transfer', selectedPurchase),
      canReject: canReject && isWorkflowActionStatusAllowed('reject', selectedPurchase),
      canPay:
        canPay &&
        isWorkflowActionStatusAllowed('pay', selectedPurchase),
      canSubmitReimbursement: false,
    }
    : undefined;

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
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                activeTab === tab
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {TAB_LABELS[tab]} {counters[tab]}
            </button>
          ))}
        </div>
      </div>

      {loading ? <DataState variant="loading" className="min-h-[220px]" /> : null}
      {!loading && error ? <DataState variant="error" description={error} className="min-h-[220px]" /> : null}
      {!loading && !error && actionError ? (
        <div className="surface-panel flex items-center justify-between gap-3 p-3">
          <p className="text-xs text-destructive">{actionError}</p>
          {lastFailedAction ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void performAction(lastFailedAction.purchaseId, lastFailedAction.action, lastFailedAction.body)
              }
            >
              重试上次操作
            </Button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && activeTab === 'todo' ? (
        <div className="space-y-4">
          {!canHandleApprovalTasks && !canHandlePaymentTasks ? (
            <div className="surface-panel p-4">
              <DataState variant="empty" title="当前角色暂无待办处理权限" className="min-h-[180px]" />
            </div>
          ) : null}

          {canHandleApprovalTasks ? (
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
                    <div key={item.id} className="surface-table flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">{item.purchaseNumber}</p>
                        <p className="text-[11px] text-muted-foreground">
                          申请人 {item.purchaserId} · 组织 {item.organizationType === 'school' ? '学校' : '单位'} · 当前审批人 {item.pendingApproverId ?? '未分配'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        {(() => {
                          const sla = getSlaLabel(getPendingHours(item.submittedAt));
                          return sla ? (
                            <span className={`rounded border px-2 py-0.5 text-[11px] ${sla.className}`}>{sla.label}</span>
                          ) : null;
                        })()}
                        <span className={`rounded border px-2 py-0.5 text-[11px] ${statusBadgeClass(item.status)}`}>
                          {statusText(item)}
                        </span>
                        <span className="text-sm">{formatMoney(Number(item.totalAmount) + Number(item.feeAmount ?? 0))}</span>
                        <Button size="sm" variant="outline" onClick={() => openPurchaseDetail(item.id)}>
                          查看详情
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {canHandlePaymentTasks ? (
            <div className="surface-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">待财务确认</h2>
                <span className="text-xs text-muted-foreground">{todoPayments.length} 条</span>
              </div>
              {paymentError ? <p className="mb-2 text-xs text-chart-3">{paymentError}</p> : null}
              {todoPayments.length === 0 ? (
                <DataState variant="empty" title="暂无待付款任务" className="min-h-[120px]" />
              ) : (
                <div className="space-y-2">
                  {todoPayments.map((item) => (
                    <div key={item.id} className="surface-table flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">{item.purchaseNumber}</p>
                        <p className="text-[11px] text-muted-foreground">
                          申请人 {item.purchaserName || item.purchaserId} · 组织 {item.organizationType === 'school' ? '学校' : '单位'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className={`rounded border px-2 py-0.5 text-[11px] ${reimbursementBadgeClass(item.reimbursementStatus)}`}>
                          {reimbursementText(item)}
                        </span>
                        <span className="text-sm">待付 {formatMoney(item.remainingAmount)}</span>
                        <Button size="sm" variant="outline" onClick={() => openPurchaseDetail(item.id)}>
                          查看详情
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && activeTab === 'done' ? (
        <div className="surface-panel p-4">
          {doneItems.length === 0 ? (
            <DataState variant="empty" title="暂无已办记录" className="min-h-[180px]" />
          ) : (
            <div className="space-y-2">
              {doneItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openPurchaseDetail(item.id)}
                  className="surface-table block w-full p-3 text-left transition hover:border-primary/40"
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
                </button>
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
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => openNotificationDetail(item)}>
                      {getNotificationActionLabel(item.eventType)}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <PurchaseDetailModal
        purchase={selectedPurchase}
        onClose={() => {
          setSelectedPurchase(null);
          setDetailError(null);
        }}
        permissions={selectedPurchasePermissions}
        busy={Boolean(selectedPurchase && mutatingId === selectedPurchase.id)}
        detailLoading={detailLoading}
        detailError={detailError}
        onReloadDetail={() => {
          if (!selectedPurchase?.id) return;
          void loadPurchaseDetail(selectedPurchase.id);
        }}
        onApprove={canApprove ? (purchase) => handleApprove(purchase) : undefined}
        onTransfer={canTransfer ? (purchase) => handleTransfer(purchase) : undefined}
        onReject={canReject ? (purchase) => handleReject(purchase) : undefined}
        onPay={canPay ? (purchase) => handlePay(purchase) : undefined}
        onSubmit={(purchase) => void handleSubmitFromDetail(purchase)}
      />
      <ApprovalCommentDialog
        open={approveDialog.open}
        onClose={handleApproveDialogClose}
        onSubmit={handleApproveSubmit}
        submitting={Boolean(mutatingId && approveDialog.purchase)}
      />
      <RejectionReasonDialog
        open={rejectDialog.open}
        onClose={handleRejectDialogClose}
        onSubmit={handleRejectSubmit}
        defaultReason={rejectDialog.purchase?.rejectionReason ?? '资料不完整'}
        submitting={Boolean(mutatingId && rejectDialog.purchase)}
      />
      <TransferApprovalDialog
        open={transferDialog.open}
        onClose={handleTransferDialogClose}
        onSubmit={handleTransferSubmit}
        submitting={Boolean(mutatingId && transferDialog.purchase)}
      />
      <PurchasePayDialog
        open={payDialog.open}
        purchase={payDialog.purchase}
        onOpenChange={(open) => {
          if (!open) handlePayDialogClose();
        }}
        onSubmit={handlePaySubmit}
        busy={Boolean(mutatingId && payDialog.purchase && mutatingId === payDialog.purchase.id)}
      />
      <Dialog open={Boolean(selectedNotification)} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title ?? '通知详情'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-line text-muted-foreground">{selectedNotification?.content ?? ''}</p>
            {selectedNotification?.createdAt ? (
              <p className="text-xs text-muted-foreground">{new Date(selectedNotification.createdAt).toLocaleString('zh-CN')}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedNotification(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
