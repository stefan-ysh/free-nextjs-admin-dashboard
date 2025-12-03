'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import PurchaseDetailModal from '@/components/purchases/PurchaseDetailModal';
import PurchaseTable, { type PurchaseRowPermissions } from '@/components/purchases/PurchaseTable';
import RejectionReasonDialog from '@/components/purchases/RejectionReasonDialog';
import { useConfirm } from '@/hooks/useConfirm';
import { usePermissions } from '@/hooks/usePermissions';
import {
  type PurchaseDetail,
  type PurchaseRecord,
  type PurchaseStatus,
  isPurchaseApprovable,
  isPurchasePayable,
} from '@/types/purchase';

type PurchaseListResponse = {
  success: boolean;
  data?: {
    items: PurchaseRecord[];
    total: number;
  };
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

type PermissionSnapshot = {
  canApprove: boolean;
  canReject: boolean;
  canPay: boolean;
};

export default function PurchaseApprovalsClient() {
  const confirm = useConfirm();
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });

  const permissions: PermissionSnapshot = useMemo(
    () => ({
      canApprove: hasPermission('PURCHASE_APPROVE'),
      canReject: hasPermission('PURCHASE_REJECT'),
      canPay: hasPermission('PURCHASE_PAY'),
    }),
    [hasPermission]
  );

  const canAccess = permissions.canApprove || permissions.canReject || permissions.canPay;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchPendingApprovals = useCallback(async () => {
    if (permissionLoading || !canAccess) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const response = await fetch(`/api/purchases/approvals?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('加载采购审批列表失败');
      const payload: PurchaseListResponse = await response.json();
      if (!payload.success || !payload.data) throw new Error(payload.error || '获取审批列表失败');
      setRecords(payload.data.items);
    } catch (err) {
      console.error('加载采购审批列表失败', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [permissionLoading, canAccess, debouncedSearch]);

  useEffect(() => {
    if (!permissionLoading && canAccess) {
      void fetchPendingApprovals();
    }
  }, [permissionLoading, canAccess, fetchPendingApprovals, reloadToken]);

  const loadPurchaseDetail = useCallback(async (purchaseId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/purchases/${purchaseId}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('加载详情失败');
      const payload: PurchaseDetailResponse = await response.json();
      if (!payload.success || !payload.data) throw new Error(payload.error || '获取采购详情失败');
      setSelectedPurchase(payload.data);
    } catch (err) {
      console.error('加载采购详情失败', err);
      setDetailError(err instanceof Error ? err.message : '获取采购详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const performAction = useCallback(
    async (
      purchaseId: string,
      action: string,
      body: Record<string, unknown> = {},
      options?: { successMessage?: string }
    ) => {
      setMutatingId(purchaseId);
      try {
        const response = await fetch(`/api/purchases/${purchaseId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...body }),
        });
        const payload: PurchaseActionResponse = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '操作失败');
        }
        setReloadToken((token) => token + 1);
        if (payload.data) {
          setSelectedPurchase(payload.data);
          setDetailError(null);
        } else {
          void loadPurchaseDetail(purchaseId);
        }
        toast.success(options?.successMessage ?? '操作已完成');
      } catch (err) {
        console.error('审批操作失败', err);
        toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试');
      } finally {
        setMutatingId(null);
      }
    },
    [loadPurchaseDetail]
  );

  const handleApprove = useCallback(
    async (purchase: PurchaseRecord) => {
      const confirmed = await confirm({
        title: '确认通过该采购申请？',
        description: '通过后将进入打款阶段。',
        confirmText: '通过',
        cancelText: '取消',
      });
      if (!confirmed) return;
      void performAction(purchase.id, 'approve', {}, { successMessage: '已通过该采购申请' });
    },
    [confirm, performAction]
  );

  const rejecting = Boolean(rejectDialog.purchase && mutatingId === rejectDialog.purchase.id);

  const handleReject = useCallback((purchase: PurchaseRecord) => {
    setRejectDialog({ open: true, purchase });
  }, []);

  const handleRejectDialogClose = () => {
    if (rejecting) return;
    setRejectDialog({ open: false, purchase: null });
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!rejectDialog.purchase) return;
    await performAction(rejectDialog.purchase.id, 'reject', { reason }, { successMessage: '已驳回该采购申请' });
    setRejectDialog({ open: false, purchase: null });
  };

  const handlePay = useCallback(
    async (purchase: PurchaseRecord) => {
      const confirmed = await confirm({
        title: '确认标记为已打款？',
        description: '将自动生成财务支出记录。',
        confirmText: '确认打款',
        cancelText: '取消',
      });
      if (!confirmed) return;
      void performAction(purchase.id, 'pay', {}, { successMessage: '已标记为已打款' });
    },
    [confirm, performAction]
  );

  const handleView = useCallback(
    (purchase: PurchaseRecord) => {
      setSelectedPurchase({
        ...purchase,
        purchaser: {
          id: purchase.purchaserId,
          displayName: purchase.purchaserId,
          avatarUrl: null,
          employeeCode: null,
          department: null,
        },
        project: purchase.projectId
          ? { id: purchase.projectId, projectCode: purchase.projectId, projectName: '—' }
          : null,
        approver: null,
        rejecter: null,
        payer: null,
        logs: [],
        supplier: null,
      });
      void loadPurchaseDetail(purchase.id);
    },
    [loadPurchaseDetail]
  );

  const handleCloseDetail = () => {
    setSelectedPurchase(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const getRowPermissions = useCallback(
    (purchase: PurchaseRecord): PurchaseRowPermissions => ({
      canEdit: false,
      canDelete: false,
      canSubmit: false,
      canWithdraw: false,
      canApprove: permissions.canApprove && isPurchaseApprovable(purchase.status),
      canReject: permissions.canReject && isPurchaseApprovable(purchase.status),
      canPay: permissions.canPay && isPurchasePayable(purchase.status),
    }),
    [permissions.canApprove, permissions.canPay, permissions.canReject]
  );

  const handleManualRefresh = () => {
    setReloadToken((token) => token + 1);
  };

  const selectedPurchasePermissions: PurchaseRowPermissions | undefined = selectedPurchase
    ? {
        canEdit: false,
        canDelete: false,
        canSubmit: false,
        canWithdraw: false,
        canApprove:
          permissions.canApprove && isPurchaseApprovable(selectedPurchase.status as PurchaseStatus),
        canReject:
          permissions.canReject && isPurchaseApprovable(selectedPurchase.status as PurchaseStatus),
        canPay: permissions.canPay && isPurchasePayable(selectedPurchase.status as PurchaseStatus),
      }
    : undefined;

  if (permissionLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        正在加载权限信息...
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="rounded-lg border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-gray-900 dark:text-rose-200">
        当前账户无权审批采购。需要 PURCHASE_APPROVE / PURCHASE_REJECT / PURCHASE_PAY 权限，请联系管理员。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="按单号 / 物品 / 申请人检索"
            className="h-10 flex-1 rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          {error && <p className="text-xs text-rose-500 dark:text-rose-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleManualRefresh}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200"
              disabled={loading}
            >
              刷新
            </button>
          </div>
          
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex min-h-[420px] max-h-[calc(100vh-280px)] flex-col overflow-hidden">
          <PurchaseTable
            purchases={records}
            loading={loading}
            mutatingId={mutatingId}
            getRowPermissions={getRowPermissions}
            scrollAreaClassName="h-full max-h-full"
            onView={handleView}
            onEdit={() => {}}
            onDelete={() => {}}
            onSubmit={() => {}}
            onApprove={handleApprove}
            onReject={handleReject}
            onWithdraw={() => {}}
            onPay={handlePay}
          />
        </div>
      </div>

      {selectedPurchase && (
        <PurchaseDetailModal
          purchase={selectedPurchase}
          onClose={handleCloseDetail}
          permissions={selectedPurchasePermissions}
          busy={mutatingId === selectedPurchase.id}
          detailLoading={detailLoading}
          detailError={detailError}
          onReloadDetail={() => selectedPurchase && void loadPurchaseDetail(selectedPurchase.id)}
          onApprove={permissions.canApprove ? (purchase) => handleApprove(purchase) : undefined}
          onReject={permissions.canReject ? (purchase) => handleReject(purchase) : undefined}
          onPay={permissions.canPay ? (purchase) => handlePay(purchase) : undefined}
        />
      )}

      <RejectionReasonDialog
        open={rejectDialog.open}
        onClose={handleRejectDialogClose}
        onSubmit={(reason) => handleRejectSubmit(reason)}
        defaultReason={rejectDialog.purchase?.rejectionReason ?? '资料不完整'}
        submitting={rejecting}
      />
    </div>
  );
}
