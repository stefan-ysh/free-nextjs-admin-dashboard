'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import DataState from '@/components/common/DataState';
import PurchaseDetailModal from '@/components/purchases/PurchaseDetailModal';
import PurchaseInboundDrawer from '@/components/purchases/PurchaseInboundDrawer';

import ApprovalCommentDialog from '@/components/purchases/ApprovalCommentDialog';
import RejectionReasonDialog from '@/components/purchases/RejectionReasonDialog';
import TransferApprovalDialog from '@/components/purchases/TransferApprovalDialog';
import PaymentConfirmDialog from '@/components/reimbursements/PaymentConfirmDialog';
import ReimbursementDetailDrawer from '@/components/reimbursements/ReimbursementDetailDrawer';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import type { PurchaseRowPermissions } from '@/components/purchases/PurchaseTable';
import {
  type PurchaseDetail,
  type PurchaseRecord,
} from '@/types/purchase';
import type { ReimbursementRecord } from '@/types/reimbursement';
import { isWorkflowActionStatusAllowed } from '@/lib/purchases/workflow-rules';
import { formatMoney, reimbursementText, statusBadgeClass, statusText } from '@/components/mobile-workflow/shared';

type WorkbenchTab = 'todo' | 'done';

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

type UnifiedWorkflowItem = {
  id: string;
  kind: 'purchase' | 'reimbursement';
  taskLabel: string;
  title: string;
  number: string;
  description: string;
  amount: number;
  updatedAt: string;
  statusLabel: string;
  statusClass: string;
  actionLabel: string;
  onAction: () => void;
};

const REIMBURSEMENT_STATUS_TEXT: Record<ReimbursementRecord['status'], string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '待打款',
  rejected: '已驳回',
  paid: '已打款',
};

const TAB_LABELS: Record<WorkbenchTab, string> = {
  todo: '待办',
  done: '已办',
};

function normalizeTab(tab: string | null): WorkbenchTab {
  if (tab === 'todo' || tab === 'done') return tab;
  if (tab === 'notifications') return 'todo';
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
  const [todoApprovals, setTodoApprovals] = useState<PurchaseRecord[]>([]);
  const [todoInbound, setTodoInbound] = useState<PurchaseRecord[]>([]);
  const [todoRejected, setTodoRejected] = useState<PurchaseRecord[]>([]);
  const [todoReimbursementApprovals, setTodoReimbursementApprovals] = useState<ReimbursementRecord[]>([]);
  const [todoReimbursementPays, setTodoReimbursementPays] = useState<ReimbursementRecord[]>([]);
  const [todoReimbursementRejected, setTodoReimbursementRejected] = useState<ReimbursementRecord[]>([]);
  const [donePurchases, setDonePurchases] = useState<PurchaseRecord[]>([]);
  const [doneReimbursements, setDoneReimbursements] = useState<ReimbursementRecord[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<FailedActionSnapshot | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const [inboundDrawer, setInboundDrawer] = useState<{ open: boolean; purchase: PurchaseRecord | null }>({
    open: false,
    purchase: null,
  });
  const [reimbursementDrawer, setReimbursementDrawer] = useState<{ open: boolean; record: ReimbursementRecord | null }>({ open: false, record: null });
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
  const [payTarget, setPayTarget] = useState<ReimbursementRecord | null>(null);

  const { hasPermission } = usePermissions();
  const canApprove = hasPermission('PURCHASE_APPROVE');
  const canReject = hasPermission('PURCHASE_REJECT');
  const canTransfer = hasPermission('PURCHASE_APPROVE');
  const canInboundOwn = hasPermission('INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY');
  const canInboundAll = hasPermission('INVENTORY_OPERATE_INBOUND');
  const canHandleApprovalTasks = canApprove || canReject || canTransfer;
  const canHandleInboundTasks = canInboundOwn || canInboundAll;
  const canReimbursementApprove = hasPermission('REIMBURSEMENT_APPROVE');
  const canReimbursementPay = hasPermission('REIMBURSEMENT_PAY');
  const canCreateReimbursement = hasPermission('REIMBURSEMENT_CREATE');
  const canCreatePurchase = hasPermission('PURCHASE_CREATE');
  const showReimbursementApprovalTasks = canReimbursementApprove && !canReimbursementPay;

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
    const [approvalResult, inboundResult, rejectedResult, reimbursementApprovalResult, reimbursementPayResult, reimbursementRejectedResult] = await Promise.allSettled([
      canHandleApprovalTasks
        ? fetch('/api/purchases/approvals?page=1&pageSize=40', { headers: { Accept: 'application/json' } })
        : Promise.resolve(null),
      canHandleInboundTasks
        ? fetch('/api/purchases?status=pending_inbound&page=1&pageSize=40&sortBy=updatedAt&sortOrder=desc', {
            headers: { Accept: 'application/json' },
          })
        : Promise.resolve(null),
      canCreatePurchase
        ? fetch('/api/purchases?status=rejected&page=1&pageSize=40&sortBy=updatedAt&sortOrder=desc', {
            headers: { Accept: 'application/json' },
          })
        : Promise.resolve(null),
      showReimbursementApprovalTasks
        ? fetch('/api/reimbursements?scope=approval&page=1&pageSize=40', { headers: { Accept: 'application/json' } })
        : Promise.resolve(null),
      canReimbursementPay
        ? fetch('/api/reimbursements?scope=pay&page=1&pageSize=40', { headers: { Accept: 'application/json' } })
        : Promise.resolve(null),
      canCreateReimbursement
        ? fetch('/api/reimbursements?scope=mine&status=rejected&page=1&pageSize=40', { headers: { Accept: 'application/json' } })
        : Promise.resolve(null),
    ]);

    if (canHandleApprovalTasks && approvalResult.status === 'fulfilled' && approvalResult.value) {
      const approvalPayload = (await approvalResult.value.json()) as PurchaseListResponse;
      if (approvalResult.value.ok && approvalPayload.success && approvalPayload.data) {
        setTodoApprovals(approvalPayload.data.items);
      } else if (approvalResult.value.status === 403) {
        setTodoApprovals([]);
      } else {
        throw new Error(approvalPayload.error || '加载待办失败');
      }
    } else if (canHandleApprovalTasks) {
      throw new Error('加载待办失败');
    } else {
      setTodoApprovals([]);
    }

    if (canHandleInboundTasks && inboundResult.status === 'fulfilled' && inboundResult.value) {
      const inboundPayload = (await inboundResult.value.json()) as PurchaseListResponse;
      if (inboundResult.value.ok && inboundPayload.success && inboundPayload.data) {
        setTodoInbound(inboundPayload.data.items);
      } else {
        setTodoInbound([]);
      }
    } else {
      setTodoInbound([]);
    }

    if (canCreatePurchase && rejectedResult.status === 'fulfilled' && rejectedResult.value) {
      const rejectedPayload = (await rejectedResult.value.json()) as PurchaseListResponse;
      if (rejectedResult.value.ok && rejectedPayload.success && rejectedPayload.data) {
        setTodoRejected(rejectedPayload.data.items.filter((item) => item.createdBy === currentUserId || item.purchaserId === currentUserId));
      } else {
        setTodoRejected([]);
      }
    } else {
      setTodoRejected([]);
    }

    if (showReimbursementApprovalTasks && reimbursementApprovalResult.status === 'fulfilled' && reimbursementApprovalResult.value) {
      const payload = (await reimbursementApprovalResult.value.json()) as ReimbursementListResponse;
      if (reimbursementApprovalResult.value.ok && payload.success && payload.data) {
        setTodoReimbursementApprovals(payload.data.items);
      } else {
        setTodoReimbursementApprovals([]);
      }
    } else {
      setTodoReimbursementApprovals([]);
    }

    if (canReimbursementPay && reimbursementPayResult.status === 'fulfilled' && reimbursementPayResult.value) {
      const payload = (await reimbursementPayResult.value.json()) as ReimbursementListResponse;
      if (reimbursementPayResult.value.ok && payload.success && payload.data) {
        setTodoReimbursementPays(payload.data.items);
      } else {
        setTodoReimbursementPays([]);
      }
    } else {
      setTodoReimbursementPays([]);
    }

    if (canCreateReimbursement && reimbursementRejectedResult.status === 'fulfilled' && reimbursementRejectedResult.value) {
      const payload = (await reimbursementRejectedResult.value.json()) as ReimbursementListResponse;
      if (reimbursementRejectedResult.value.ok && payload.success && payload.data) {
        setTodoReimbursementRejected(
          payload.data.items.filter((item) => item.applicantId === currentUserId || item.createdBy === currentUserId)
        );
      } else {
        setTodoReimbursementRejected([]);
      }
    } else {
      setTodoReimbursementRejected([]);
    }
  }, [
    canHandleApprovalTasks,
    canHandleInboundTasks,
    canCreatePurchase,
    showReimbursementApprovalTasks,
    canReimbursementPay,
    canCreateReimbursement,
    currentUserId,
  ]);

  const loadDone = useCallback(async () => {
    const [purchaseResponse, reimbursementDoneResponse] = await Promise.all([
      fetch('/api/purchases?scope=workflow_done&page=1&pageSize=80&sortBy=updatedAt&sortOrder=desc', {
        headers: { Accept: 'application/json' },
      }),
      canReimbursementPay
        ? fetch('/api/reimbursements?scope=all&page=1&pageSize=120', {
            headers: { Accept: 'application/json' },
          })
        : fetch('/api/reimbursements?scope=mine&page=1&pageSize=120', {
            headers: { Accept: 'application/json' },
          }),
    ]);

    const purchasePayload = (await purchaseResponse.json()) as PurchaseListResponse;
    if (!purchaseResponse.ok || !purchasePayload.success || !purchasePayload.data) {
      throw new Error(purchasePayload.error || '加载已办失败');
    }

    const filteredPurchases = purchasePayload.data.items.filter((item) => {
      const requesterRelated = item.createdBy === currentUserId || item.purchaserId === currentUserId;
      const approverRelated = item.approvedBy === currentUserId || item.rejectedBy === currentUserId;
      const requesterDone = item.status !== 'draft';

      // 当前角色已执行过操作后即计入已办：
      // 申请人（提交/撤回/重提等）按非草稿计入。
      if (requesterRelated && requesterDone) return true;
      // 审批人视角：自己完成审批/驳回后计入已办。
      if (approverRelated && item.status !== 'pending_approval') return true;
      return false;
    });
    setDonePurchases(filteredPurchases);

    const reimbursementPayload = (await reimbursementDoneResponse.json()) as ReimbursementListResponse;
    if (reimbursementDoneResponse.ok && reimbursementPayload.success && reimbursementPayload.data) {
      const filteredReimbursements = reimbursementPayload.data.items.filter((item) => {
        const applicantRelated = item.applicantId === currentUserId || item.createdBy === currentUserId;
        const financeRelated =
          item.paidBy === currentUserId || item.approvedBy === currentUserId || item.rejectedBy === currentUserId;

        if (applicantRelated && item.status !== 'draft' && item.status !== 'rejected') return true;
        if (financeRelated && item.status !== 'pending_approval') return true;
        return false;
      });
      setDoneReimbursements(filteredReimbursements);
    } else {
      setDoneReimbursements([]);
    }
  }, [canReimbursementPay, currentUserId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadTodo(), loadDone()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [loadDone, loadTodo]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const counters = useMemo(
    () => ({
      todo:
        (canHandleApprovalTasks ? todoApprovals.length : 0) +
        (canHandleInboundTasks ? todoInbound.length : 0) +
        (canCreatePurchase ? todoRejected.length : 0) +
        (showReimbursementApprovalTasks ? todoReimbursementApprovals.length : 0) +
        (canReimbursementPay ? todoReimbursementPays.length : 0) +
        (canCreateReimbursement ? todoReimbursementRejected.length : 0),
      done: donePurchases.length + doneReimbursements.length,
    }),
    [
      canHandleApprovalTasks,
      canHandleInboundTasks,
      canCreatePurchase,
      showReimbursementApprovalTasks,
      canReimbursementPay,
      canCreateReimbursement,
      donePurchases.length,
      doneReimbursements.length,
      todoApprovals.length,
      todoInbound.length,
      todoRejected.length,
      todoReimbursementApprovals.length,
      todoReimbursementPays.length,
      todoReimbursementRejected.length,
    ]
  );

  const openPurchaseDetail = useCallback(
    (purchaseId: string) => {
      void loadPurchaseDetail(purchaseId);
    },
    [loadPurchaseDetail]
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

  const handlePayConfirm = useCallback(
    async (note: string) => {
      if (!payTarget) return;
      setMutatingId(payTarget.id);
      try {
        const response = await fetch(`/api/reimbursements/${payTarget.id}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pay', note }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '打款失败');
        }
        toast.success('已标记打款');
        setPayTarget(null);
        void loadAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '打款失败');
      } finally {
        setMutatingId(null);
      }
    },
    [payTarget, loadAll]
  );

  const unifiedPayItems = useMemo(
    () =>
      todoReimbursementPays.map((item) => ({
        id: item.id,
        source: 'reimbursement' as const,
        title: item.title,
        number: item.reimbursementNumber,
        applicant: item.applicantName || '未知用户',
        organizationType: item.organizationType,
        amount: item.amount,
        reimbursementId: item.id,
      })),
    [todoReimbursementPays]
  );

  const todoUnifiedItems = useMemo<UnifiedWorkflowItem[]>(() => {
    const items: UnifiedWorkflowItem[] = [];

    if (canHandleApprovalTasks) {
      items.push(
        ...todoApprovals.map((item) => ({
          id: `purchase-approval-${item.id}`,
          kind: 'purchase' as const,
          taskLabel: '采购审批',
          title: item.itemName,
          number: item.purchaseNumber,
          description: `申请人 ${item.purchaserName || '未知用户'} · 组织 ${item.organizationType === 'school' ? '学校' : '单位'} · 当前审批人 ${item.pendingApproverName || '未分配'}`,
          amount: Number(item.totalAmount) + Number(item.feeAmount ?? 0),
          updatedAt: item.updatedAt,
          statusLabel: statusText(item),
          statusClass: statusBadgeClass(item.status),
          actionLabel: '去审批',
          onAction: () => openPurchaseDetail(item.id),
        }))
      );
    }

    if (canHandleInboundTasks) {
      items.push(
        ...todoInbound.map((item) => ({
          id: `purchase-inbound-${item.id}`,
          kind: 'purchase' as const,
          taskLabel: '到货入库',
          title: item.itemName,
          number: item.purchaseNumber,
          description: `组织 ${item.organizationType === 'school' ? '学校' : '单位'} · 已入库 ${Number(item.inboundQuantity ?? 0)} / ${Number(item.quantity ?? 0)}`,
          amount: Number(item.totalAmount) + Number(item.feeAmount ?? 0),
          updatedAt: item.updatedAt,
          statusLabel: statusText(item),
          statusClass: statusBadgeClass(item.status),
          actionLabel: '去入库',
          onAction: () => {
			setInboundDrawer({ open: true, purchase: item });
          },
        }))
      );
    }

    if (canCreatePurchase) {
      items.push(
        ...todoRejected.map((item) => ({
          id: `purchase-rejected-${item.id}`,
          kind: 'purchase' as const,
          taskLabel: '驳回待处理',
          title: item.itemName,
          number: item.purchaseNumber,
          description: '驳回后需修改并重新提交审批',
          amount: Number(item.totalAmount) + Number(item.feeAmount ?? 0),
          updatedAt: item.updatedAt,
          statusLabel: statusText(item),
          statusClass: statusBadgeClass(item.status),
          actionLabel: '去处理',
          onAction: () => openPurchaseDetail(item.id),
        }))
      );
    }

    if (canReimbursementPay) {
      items.push(
        ...unifiedPayItems.map((item) => {
          const originalRecord = todoReimbursementPays.find(r => r.id === item.reimbursementId);
          return {
            id: `reimbursement-pay-${item.id}`,
            kind: 'reimbursement' as const,
            taskLabel: '报销打款',
            title: item.title,
            number: item.number,
            description: `申请人 ${item.applicant || '未知用户'} · 组织 ${item.organizationType === 'school' ? '学校' : '单位'}`,
            amount: item.amount,
            updatedAt: new Date().toISOString(),
            statusLabel: '待打款',
            statusClass: 'border-primary/30 bg-primary/10 text-primary',
            actionLabel: '去处理',
            onAction: () => {
               if (originalRecord) {
                 setReimbursementDrawer({ open: true, record: originalRecord });
               } else {
                 toast.error('找不到报销记录');
               }
            },
          };
        })
      );
    }

    if (showReimbursementApprovalTasks) {
      items.push(
        ...todoReimbursementApprovals.map((item) => ({
          id: `reimbursement-approval-${item.id}`,
          kind: 'reimbursement' as const,
          taskLabel: '报销审批',
          title: item.title,
          number: item.reimbursementNumber,
          description: `由 ${item.applicantName || '未知用户'} 提交`,
          amount: item.amount,
          updatedAt: item.updatedAt,
          statusLabel: '审批中',
          statusClass: 'border-chart-3/40 bg-chart-3/10 text-chart-3',
          actionLabel: '去处理',
          onAction: () => {
            setReimbursementDrawer({ open: true, record: item });
          },
        }))
      );
    }

    if (canCreateReimbursement) {
      items.push(
        ...todoReimbursementRejected.map((item) => ({
          id: `reimbursement-rejected-${item.id}`,
          kind: 'reimbursement' as const,
          taskLabel: '报销驳回待处理',
          title: item.title,
          number: item.reimbursementNumber,
          description: `申请人 ${item.applicantName || '未知用户'} · 组织 ${item.organizationType === 'school' ? '学校' : '单位'} · 需补充材料后重新提交`,
          amount: item.amount,
          updatedAt: item.updatedAt,
          statusLabel: REIMBURSEMENT_STATUS_TEXT[item.status] ?? '已驳回',
          statusClass: 'border-destructive/40 bg-destructive/10 text-destructive',
          actionLabel: '编辑详情',
          onAction: () => {
            window.location.href = `/reimbursements?scope=mine&focus=${encodeURIComponent(item.id)}`;
          },
        }))
      );
    }

    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [
    canHandleApprovalTasks,
    canHandleInboundTasks,
    canCreatePurchase,
    canReimbursementPay,
    showReimbursementApprovalTasks,
    canCreateReimbursement,
    todoApprovals,
    todoInbound,
    todoRejected,
    unifiedPayItems,
    todoReimbursementPays,
    todoReimbursementApprovals,
    todoReimbursementRejected,
    openPurchaseDetail,
    // setInboundDrawer, // state setter is stable
    // setPayTarget, // state setter is stable
  ]);

  const doneUnifiedItems = useMemo<UnifiedWorkflowItem[]>(() => {
    const items: UnifiedWorkflowItem[] = [];
    items.push(
      ...donePurchases.map((item) => ({
        id: `purchase-done-${item.id}`,
        kind: 'purchase' as const,
        taskLabel: '采购已办',
        title: item.itemName,
        number: item.purchaseNumber,
        description: `采购状态 ${statusText(item)} · 报销状态 ${reimbursementText(item)}`,
        amount: Number(item.totalAmount) + Number(item.feeAmount ?? 0),
        updatedAt: item.updatedAt,
        statusLabel: statusText(item),
        statusClass: statusBadgeClass(item.status),
        actionLabel: '查看详情',
        onAction: () => openPurchaseDetail(item.id),
      }))
    );
    items.push(
      ...doneReimbursements.map((item) => ({
        id: `reimbursement-done-${item.id}`,
        kind: 'reimbursement' as const,
        taskLabel: '报销已办',
        title: item.title,
        number: item.reimbursementNumber,
        description: `申请人 ${item.applicantName || '未知用户'} · 组织 ${item.organizationType === 'school' ? '学校' : '单位'}`,
        amount: item.amount,
        updatedAt: item.updatedAt,
        statusLabel: REIMBURSEMENT_STATUS_TEXT[item.status] ?? '已处理',
        statusClass: item.status === 'paid' ? 'border-chart-5/40 bg-chart-5/10 text-chart-5' : 'border-border bg-muted/40 text-muted-foreground',
        actionLabel: '查看详情',
        onAction: () => {
          const scope = canReimbursementPay ? 'all' : 'mine';
          window.location.href = `/reimbursements?scope=${scope}&focus=${encodeURIComponent(item.id)}`;
        },
      }))
    );
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [donePurchases, doneReimbursements, openPurchaseDetail, canReimbursementPay]);

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
      canPay: false,
      canSubmitReimbursement: false,
      canReceive: false,
    }
    : undefined;

  return (
    <section className="space-y-4">
      <div className="surface-toolbar p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold sm:text-lg">流程工作台</h1>
          <Button size="sm" variant="outline" onClick={() => void loadAll()} disabled={loading}>
            刷新
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['todo', 'done'] as const).map((tab) => (
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
        <div className="surface-panel p-4">
          {todoUnifiedItems.length === 0 ? (
            <DataState variant="empty" title="暂无待办事项" className="min-h-[180px]" />
          ) : (
            <div className="space-y-2">
              {todoUnifiedItems.map((item) => (
                <div key={item.id} className="surface-table flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{item.taskLabel}</span>
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.number}</p>
                    <p className="text-[11px] text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className={`rounded border px-2 py-0.5 text-[11px] ${item.statusClass}`}>{item.statusLabel}</span>
                    <span className="text-sm">{formatMoney(item.amount)}</span>
                    <Button size="sm" onClick={item.onAction}>
                      {item.actionLabel}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!loading && !error && activeTab === 'done' ? (
        <div className="surface-panel p-4">
          {doneUnifiedItems.length === 0 ? (
            <DataState variant="empty" title="暂无已办记录" className="min-h-[180px]" />
          ) : (
            <div className="space-y-2">
              {doneUnifiedItems.map((item) => (
                <div key={item.id} className="surface-table flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{item.taskLabel}</span>
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.number}</p>
                    <p className="text-[11px] text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className={`rounded border px-2 py-0.5 text-[11px] ${item.statusClass}`}>{item.statusLabel}</span>
                    <span className="text-sm">{formatMoney(item.amount)}</span>
                    <Button size="sm" variant="outline" onClick={item.onAction}>
                      {item.actionLabel}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <ReimbursementDetailDrawer
        open={reimbursementDrawer.open}
        onClose={() => setReimbursementDrawer({ open: false, record: null })}
        record={reimbursementDrawer.record}
        onSuccess={() => void loadAll()}
      />
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

      <PurchaseInboundDrawer
        open={inboundDrawer.open}
        purchase={inboundDrawer.purchase}
        onOpenChange={(open) => setInboundDrawer((prev) => ({ ...prev, open }))}
        onSuccess={() => {
          void loadAll();
          toast.success('入库已完成');
        }}
      />
      <PaymentConfirmDialog
        open={!!payTarget}
        onClose={() => !mutatingId && setPayTarget(null)}
        onSubmit={handlePayConfirm}
        submitting={!!mutatingId}
      />
    </section>
  );
}
