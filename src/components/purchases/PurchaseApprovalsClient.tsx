'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import PurchaseDetailModal from '@/components/purchases/PurchaseDetailModal';
import PurchaseTable, { type PurchaseRowPermissions } from '@/components/purchases/PurchaseTable';
import PurchasePayDialog from '@/components/purchases/PurchasePayDialog';
import RejectionReasonDialog from '@/components/purchases/RejectionReasonDialog';
import ApprovalCommentDialog from '@/components/purchases/ApprovalCommentDialog';
import TransferApprovalDialog from '@/components/purchases/TransferApprovalDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  canTransfer: boolean;
  canReject: boolean;
  canPay: boolean;
};

export default function PurchaseApprovalsClient() {
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [overdueHours, setOverdueHours] = useState('48');
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
  const [payDialog, setPayDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
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

  const permissions: PermissionSnapshot = useMemo(
    () => ({
      canApprove: hasPermission('PURCHASE_APPROVE'),
      canTransfer: hasPermission('PURCHASE_APPROVE'),
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
      if (minAmount.trim()) params.set('minAmount', minAmount.trim());
      if (maxAmount.trim()) params.set('maxAmount', maxAmount.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
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
  }, [permissionLoading, canAccess, debouncedSearch, minAmount, maxAmount, startDate, endDate]);

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
        return true;
      } catch (err) {
        console.error('审批操作失败', err);
        toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试');
        return false;
      } finally {
        setMutatingId(null);
      }
    },
    [loadPurchaseDetail]
  );

  const handleApprove = useCallback((purchase: PurchaseRecord) => {
    setApproveDialog({ open: true, purchase });
  }, []);

  const rejecting = Boolean(rejectDialog.purchase && mutatingId === rejectDialog.purchase.id);

  const handleReject = useCallback((purchase: PurchaseRecord) => {
    setRejectDialog({ open: true, purchase });
  }, []);

  const handleTransfer = useCallback((purchase: PurchaseRecord) => {
    setTransferDialog({ open: true, purchase });
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

  const handlePay = useCallback((purchase: PurchaseRecord | PurchaseDetail) => {
    setPayDialog({ open: true, purchase });
  }, []);

  const handlePayDialogClose = () => {
    if (mutatingId && payDialog.purchase && mutatingId === payDialog.purchase.id) return;
    setPayDialog({ open: false, purchase: null });
  };

  const handleApproveDialogClose = () => {
    if (mutatingId && approveDialog.purchase && mutatingId === approveDialog.purchase.id) return;
    setApproveDialog({ open: false, purchase: null });
  };

  const handleApproveSubmit = async (comment: string) => {
    if (!approveDialog.purchase) return;
    const success = await performAction(
      approveDialog.purchase.id,
      'approve',
      { comment },
      { successMessage: '已通过该采购申请' }
    );
    if (success) {
      setApproveDialog({ open: false, purchase: null });
    }
  };

  const handlePaySubmit = async (amount: number, note?: string) => {
    if (!payDialog.purchase) return;
    const success = await performAction(
      payDialog.purchase.id,
      'pay',
      { amount, note },
      { successMessage: '已记录打款' }
    );
    if (success) {
      setPayDialog({ open: false, purchase: null });
    }
  };

  const handleTransferDialogClose = () => {
    if (mutatingId && transferDialog.purchase && mutatingId === transferDialog.purchase.id) return;
    setTransferDialog({ open: false, purchase: null });
  };

  const handleTransferSubmit = async (payload: { approverId: string; comment: string }) => {
    if (!transferDialog.purchase) return;
    const success = await performAction(
      transferDialog.purchase.id,
      'transfer',
      { toApproverId: payload.approverId, comment: payload.comment },
      { successMessage: '已转交审批' }
    );
    if (success) {
      setTransferDialog({ open: false, purchase: null });
    }
  };

  const getPendingHours = useCallback((purchase: PurchaseRecord) => {
    if (!purchase.submittedAt) return 0;
    const submitted = new Date(purchase.submittedAt).getTime();
    if (Number.isNaN(submitted)) return 0;
    return Math.max(0, (Date.now() - submitted) / 36e5);
  }, []);

  const visibleRecords = useMemo(() => {
    if (!overdueOnly) return records;
    const threshold = Number(overdueHours) || 48;
    return records.filter((record) => getPendingHours(record) >= threshold);
  }, [records, overdueOnly, overdueHours, getPendingHours]);

  const getRowClassName = useCallback((purchase: PurchaseRecord) => {
    const threshold = Number(overdueHours) || 48;
    if (getPendingHours(purchase) >= threshold) {
      return 'bg-destructive/10';
    }
    return '';
  }, [getPendingHours, overdueHours]);

  const handleView = useCallback(
    (purchase: PurchaseRecord) => {
      setSelectedPurchase({
        ...purchase,
        payments: [],
        paidAmount: 0,
        remainingAmount: purchase.totalAmount + (purchase.feeAmount ?? 0),
        dueAmount: purchase.totalAmount + (purchase.feeAmount ?? 0),
        purchaser: {
          id: purchase.purchaserId,
          displayName: purchase.purchaserId,
          employeeCode: null,
          department: null,
        },
        approver: null,
        pendingApprover: purchase.pendingApproverId
          ? { id: purchase.pendingApproverId, displayName: purchase.pendingApproverId }
          : null,
        rejecter: null,
        payer: null,
        logs: [],
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
      canDuplicate: false,
      canSubmit: false,
      canWithdraw: false,
      canApprove: permissions.canApprove && isPurchaseApprovable(purchase.status),
      canTransfer: permissions.canTransfer && isPurchaseApprovable(purchase.status),
      canReject: permissions.canReject && isPurchaseApprovable(purchase.status),
      canPay:
        permissions.canPay &&
        isPurchasePayable(purchase.status) &&
        purchase.reimbursementStatus === 'reimbursement_pending',
      canSubmitReimbursement: false,
    }),
    [permissions.canApprove, permissions.canPay, permissions.canReject, permissions.canTransfer]
  );

  const handleManualRefresh = () => {
    setReloadToken((token) => token + 1);
  };

  const selectedPurchasePermissions: PurchaseRowPermissions | undefined = selectedPurchase
    ? {
      canEdit: false,
      canDelete: false,
      canDuplicate: false,
      canSubmit: false,
      canWithdraw: false,
      canApprove:
        permissions.canApprove && isPurchaseApprovable(selectedPurchase.status as PurchaseStatus),
      canTransfer:
        permissions.canTransfer && isPurchaseApprovable(selectedPurchase.status as PurchaseStatus),
      canReject:
        permissions.canReject && isPurchaseApprovable(selectedPurchase.status as PurchaseStatus),
      canPay:
        permissions.canPay &&
        isPurchasePayable(selectedPurchase.status as PurchaseStatus) &&
        selectedPurchase.reimbursementStatus === 'reimbursement_pending',
      canSubmitReimbursement: false,
    }
    : undefined;

  if (permissionLoading) {
    return (
      <div className="panel-frame p-6 text-sm text-muted-foreground">
        正在加载权限信息...
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="alert-box alert-danger p-6 text-sm">
        当前账户无权审批采购。需要 PURCHASE_APPROVE / PURCHASE_REJECT / PURCHASE_PAY 权限，请联系管理员。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-toolbar p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="按单号 / 物品 / 申请人检索"
            className="h-10 flex-1"
          />
          <Input
            value={minAmount}
            onChange={(event) => setMinAmount(event.target.value)}
            placeholder="最小金额"
            className="h-10 w-28"
          />
          <Input
            value={maxAmount}
            onChange={(event) => setMaxAmount(event.target.value)}
            placeholder="最大金额"
            className="h-10 w-28"
          />
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 w-44" />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 w-44" />
          <select
            value={overdueHours}
            onChange={(event) => setOverdueHours(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="24">超时阈值24h</option>
            <option value="48">超时阈值48h</option>
            <option value="72">超时阈值72h</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
            仅看超时
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              刷新
            </Button>
          </div>
          
        </div>
      </div>

      <div className="surface-table">
        <div className="flex min-h-[420px] max-h-[calc(100vh-280px)] flex-col overflow-hidden">
          <PurchaseTable
            purchases={visibleRecords}
            loading={loading}
            mutatingId={mutatingId}
            getRowPermissions={getRowPermissions}
            getRowClassName={getRowClassName}
            scrollAreaClassName="h-full max-h-full"
            onView={handleView}
            onEdit={() => {}}
            onDuplicate={() => {}}
            onDelete={() => {}}
            onSubmit={() => {}}
            onApprove={handleApprove}
            onTransfer={handleTransfer}
            onReject={handleReject}
            onWithdraw={() => {}}
            onPay={handlePay}
            onSubmitReimbursement={() => {}}
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
          onTransfer={permissions.canTransfer ? (purchase) => handleTransfer(purchase) : undefined}
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

      <PurchasePayDialog
        open={payDialog.open}
        purchase={payDialog.purchase}
        onOpenChange={(open) => {
          if (!open) handlePayDialogClose();
        }}
        onSubmit={handlePaySubmit}
        busy={Boolean(mutatingId && payDialog.purchase && mutatingId === payDialog.purchase.id)}
      />

      <ApprovalCommentDialog
        open={approveDialog.open}
        onClose={handleApproveDialogClose}
        onSubmit={handleApproveSubmit}
        submitting={Boolean(mutatingId && approveDialog.purchase)}
      />

      <TransferApprovalDialog
        open={transferDialog.open}
        onClose={handleTransferDialogClose}
        onSubmit={handleTransferSubmit}
        submitting={Boolean(mutatingId && transferDialog.purchase)}
      />
    </div>
  );
}
