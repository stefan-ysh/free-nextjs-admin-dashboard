'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import ProjectSelector from '@/components/common/ProjectSelector';
import DatePicker from '@/components/ui/DatePicker';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';

import PurchaseDetailModal from './PurchaseDetailModal';
import PurchaseTable, { type PurchaseRowPermissions } from './PurchaseTable';
import RejectionReasonDialog from './RejectionReasonDialog';
import {
  type PurchaseDetail,
  type PurchaseRecord,
  type PurchaseStatus,
  type PurchaseChannel,
  type PaymentMethod,
  type PurchaseStats,
  PURCHASE_STATUSES,
  PURCHASE_CHANNELS,
  PAYMENT_METHODS,
  isPurchaseSubmittable,
  isPurchaseWithdrawable,
  isPurchaseApprovable,
  isPurchasePayable,
  getPurchaseStatusText,
} from '@/types/purchase';
import { canDeletePurchase, canEditPurchase } from '@/lib/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const SORT_FIELDS = [
  { value: 'updatedAt', label: '按更新时间' },
  { value: 'purchaseDate', label: '按采购日期' },
  { value: 'totalAmount', label: '按金额' },
  { value: 'status', label: '按状态' },
] as const;

const SORT_ORDERS = [
  { value: 'desc', label: '降序' },
  { value: 'asc', label: '升序' },
] as const;

type SortField = (typeof SORT_FIELDS)[number]['value'];
type SortOrder = (typeof SORT_ORDERS)[number]['value'];

type PurchaseFilters = {
  search: string;
  status: 'all' | PurchaseStatus;
  purchaseChannel: 'all' | PurchaseChannel;
  paymentMethod: 'all' | PaymentMethod;
  startDate: string | null;
  endDate: string | null;
  projectId: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  onlyMine: boolean;
};

const DEFAULT_FILTERS: PurchaseFilters = {
  search: '',
  status: 'all',
  purchaseChannel: 'all',
  paymentMethod: 'all',
  startDate: null,
  endDate: null,
  projectId: null,
  minAmount: null,
  maxAmount: null,
  onlyMine: false,
};

const CHANNEL_LABELS: Record<PurchaseChannel, string> = {
  online: '线上',
  offline: '线下',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  wechat: '微信',
  alipay: '支付宝',
  bank_transfer: '银行转账',
  corporate_transfer: '对公转账',
  cash: '现金',
};

const amountFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

function createFallbackDetail(record: PurchaseRecord): PurchaseDetail {
  return {
    ...record,
    purchaser: {
      id: record.purchaserId,
      displayName: record.purchaserId,
      avatarUrl: null,
      employeeCode: null,
      department: null,
    },
    project: record.projectId
      ? { id: record.projectId, projectCode: record.projectId, projectName: '—' }
      : null,
    approver: record.approvedBy ? { id: record.approvedBy, displayName: record.approvedBy } : null,
    rejecter: record.rejectedBy ? { id: record.rejectedBy, displayName: record.rejectedBy } : null,
    payer: record.paidBy ? { id: record.paidBy, displayName: record.paidBy } : null,
    logs: [],
  };
}

function buildQuery(
  filters: PurchaseFilters,
  page: number,
  pageSize: number,
  sortBy: SortField,
  sortOrder: SortOrder,
  purchaserId?: string | null
) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.purchaseChannel !== 'all') params.set('purchaseChannel', filters.purchaseChannel);
  if (filters.paymentMethod !== 'all') params.set('paymentMethod', filters.paymentMethod);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.minAmount != null) params.set('minAmount', String(filters.minAmount));
  if (filters.maxAmount != null) params.set('maxAmount', String(filters.maxAmount));
  if (filters.onlyMine && purchaserId) params.set('purchaserId', purchaserId);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  params.set('sortBy', sortBy);
  params.set('sortOrder', sortOrder);
  return params.toString();
}

type PurchaseListResponse = {
  success: boolean;
  data?: {
    items: PurchaseRecord[];
    total: number;
    page: number;
    pageSize: number;
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
  canViewAll: boolean;
  canViewDepartment: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canApprove: boolean;
  canReject: boolean;
  canPay: boolean;
};

export default function PurchasesClient() {
  const router = useRouter();
  const { user: permissionUser, loading: permissionLoading, hasPermission } = usePermissions();
  const [filters, setFilters] = useState<PurchaseFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [projectFilterSummary, setProjectFilterSummary] = useState<{ id: string; name: string; code?: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });
  const confirm = useConfirm();

  const permissions: PermissionSnapshot = useMemo(
    () => ({
      canViewAll: hasPermission('PURCHASE_VIEW_ALL'),
      canViewDepartment: hasPermission('PURCHASE_VIEW_DEPARTMENT'),
      canCreate: hasPermission('PURCHASE_CREATE'),
      canUpdate: hasPermission('PURCHASE_UPDATE'),
      canApprove: hasPermission('PURCHASE_APPROVE'),
      canReject: hasPermission('PURCHASE_REJECT'),
      canPay: hasPermission('PURCHASE_PAY'),
    }),
    [hasPermission]
  );

  const canViewPurchases = permissions.canViewAll || permissions.canViewDepartment;

  const handleFilterChange = useCallback((patch: Partial<PurchaseFilters>) => {
    startTransition(() => {
      setFilters((prev) => ({ ...prev, ...patch }));
      setPage(1);
    });
  }, []);

  useEffect(() => {
    if (permissionLoading) return;
    if (!canViewPurchases) {
      setRecords([]);
      setTotal(0);
    }
  }, [permissionLoading, canViewPurchases]);

  useEffect(() => {
    if (permissionLoading || !canViewPurchases) return;

    const purchaserId = filters.onlyMine ? permissionUser?.id ?? null : null;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery(filters, page, pageSize, sortBy, sortOrder, purchaserId);
        const response = await fetch(`/api/purchases?${query}`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('列表加载失败');
        const payload: PurchaseListResponse = await response.json();
        if (!payload.success || !payload.data) {
          throw new Error(payload.error || '获取采购数据失败');
        }
        if (cancelled) return;
        setRecords(payload.data.items);
        setTotal(payload.data.total);
      } catch (err) {
        if (cancelled) return;
        console.error('加载采购列表失败', err);
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    permissionLoading,
    canViewPurchases,
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder,
    reloadToken,
    permissionUser?.id,
  ]);

  useEffect(() => {
    if (permissionLoading || !canViewPurchases) return;

    const purchaserId = filters.onlyMine ? permissionUser?.id ?? null : null;
    let cancelled = false;

    async function loadStats() {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const query = buildQuery(filters, 1, 1, sortBy, sortOrder, purchaserId);
        const response = await fetch(`/api/purchases/stats?${query}`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('统计加载失败');
        const payload: { success: boolean; data?: PurchaseStats; error?: string } = await response.json();
        if (!payload.success || !payload.data) {
          throw new Error(payload.error || '获取统计信息失败');
        }
        if (cancelled) return;
        setStats(payload.data);
      } catch (err) {
        if (cancelled) return;
        console.error('加载采购统计失败', err);
        setStats(null);
        setStatsError(err instanceof Error ? err.message : '获取统计信息失败');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [permissionLoading, canViewPurchases, filters, sortBy, sortOrder, reloadToken, permissionUser?.id]);

  const loadPurchaseDetail = useCallback(async (purchaseId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/purchases/${purchaseId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('加载采购详情失败');
      const payload: PurchaseDetailResponse = await response.json();
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || '获取采购详情失败');
      }
      setSelectedPurchase(payload.data);
      setDetailError(null);
    } catch (err) {
      console.error('加载采购详情失败', err);
      setDetailError(err instanceof Error ? err.message : '获取采购详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const statusSummary = useMemo(() => {
    const result: Record<PurchaseStatus, number> = {
      draft: 0,
      pending_approval: 0,
      approved: 0,
      rejected: 0,
      paid: 0,
      cancelled: 0,
    };
    records.forEach((record) => {
      result[record.status] += 1;
    });
    return result;
  }, [records]);

  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (filters.projectId) count += 1;
    if (filters.minAmount != null) count += 1;
    if (filters.maxAmount != null) count += 1;
    if (filters.onlyMine) count += 1;
    return count;
  }, [filters.projectId, filters.minAmount, filters.maxAmount, filters.onlyMine]);

  const handleView = useCallback(
    (purchase: PurchaseRecord) => {
      setSelectedPurchase(createFallbackDetail(purchase));
      void loadPurchaseDetail(purchase.id);
    },
    [loadPurchaseDetail]
  );

  const handleResetFilters = () => {
    startTransition(() => {
      setFilters(DEFAULT_FILTERS);
      setPage(1);
      setSortBy('updatedAt');
      setSortOrder('desc');
      setProjectFilterSummary(null);
      setShowAdvancedFilters(false);
    });
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPage((prev) => {
      if (direction === 'prev') return Math.max(1, prev - 1);
      return Math.min(totalPages, prev + 1);
    });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleManualRefresh = () => {
    setReloadToken((token) => token + 1);
    if (selectedPurchase) {
      void loadPurchaseDetail(selectedPurchase.id);
    }
  };

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const purchaserId = filters.onlyMine ? permissionUser?.id ?? null : null;
      const query = buildQuery(filters, 1, pageSize, sortBy, sortOrder, purchaserId);
      const response = await fetch(`/api/purchases/export?${query}`, {
        headers: { Accept: 'text/csv' },
      });
      if (!response.ok) {
        let errorMessage = '导出失败，请稍后再试';
        try {
          const payload = await response.json();
          if (payload?.error) errorMessage = payload.error;
        } catch (parseError) {
          console.warn('无法解析导出错误信息', parseError);
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `purchases-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('采购列表已导出');
    } catch (error) {
      console.error('导出采购失败', error);
      toast.error(error instanceof Error ? error.message : '导出失败，请稍后再试');
    } finally {
      setExporting(false);
    }
  }, [exporting, filters, permissionUser?.id, pageSize, sortBy, sortOrder]);

  const handleAmountFilterChange = useCallback(
    (field: 'minAmount' | 'maxAmount', rawValue: string) => {
      const trimmed = rawValue.trim();
      const parsed = trimmed === '' ? null : Number(trimmed);
      if (parsed != null && Number.isNaN(parsed)) return;
      handleFilterChange({ [field]: parsed } as Pick<PurchaseFilters, 'minAmount' | 'maxAmount'>);
    },
    [handleFilterChange]
  );

  const handleProjectFilterChange = useCallback(
    (projectId: string, project?: { projectName: string; projectCode: string } | null) => {
      handleFilterChange({ projectId: projectId || null });
      if (project && projectId) {
        setProjectFilterSummary({ id: projectId, name: project.projectName, code: project.projectCode });
      } else {
        setProjectFilterSummary(null);
      }
    },
    [handleFilterChange]
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (filters.search.trim()) {
      chips.push({ key: 'search', label: `关键词：${filters.search.trim()}`, onRemove: () => handleFilterChange({ search: '' }) });
    }
    if (filters.status !== 'all') {
      chips.push({ key: 'status', label: `状态：${getPurchaseStatusText(filters.status)}`, onRemove: () => handleFilterChange({ status: 'all' }) });
    }
    if (filters.purchaseChannel !== 'all') {
      chips.push({
        key: 'channel',
        label: `渠道：${CHANNEL_LABELS[filters.purchaseChannel]}`,
        onRemove: () => handleFilterChange({ purchaseChannel: 'all' }),
      });
    }
    if (filters.paymentMethod !== 'all') {
      chips.push({
        key: 'payment',
        label: `付款：${PAYMENT_LABELS[filters.paymentMethod]}`,
        onRemove: () => handleFilterChange({ paymentMethod: 'all' }),
      });
    }
    if (filters.startDate) {
      chips.push({ key: 'startDate', label: `起：${filters.startDate}`, onRemove: () => handleFilterChange({ startDate: null }) });
    }
    if (filters.endDate) {
      chips.push({ key: 'endDate', label: `止：${filters.endDate}`, onRemove: () => handleFilterChange({ endDate: null }) });
    }
    if (filters.projectId) {
      const label = projectFilterSummary
        ? `项目：${projectFilterSummary.name}${projectFilterSummary.code ? `（${projectFilterSummary.code}）` : ''}`
        : `项目：${filters.projectId}`;
      chips.push({ key: 'project', label, onRemove: () => handleProjectFilterChange('', null) });
    }
    if (filters.minAmount != null) {
      chips.push({ key: 'minAmount', label: `金额≥¥${filters.minAmount}`, onRemove: () => handleFilterChange({ minAmount: null }) });
    }
    if (filters.maxAmount != null) {
      chips.push({ key: 'maxAmount', label: `金额≤¥${filters.maxAmount}`, onRemove: () => handleFilterChange({ maxAmount: null }) });
    }
    if (filters.onlyMine) {
      chips.push({ key: 'onlyMine', label: '仅看我发起', onRemove: () => handleFilterChange({ onlyMine: false }) });
    }
    return chips;
  }, [filters, handleFilterChange, handleProjectFilterChange, projectFilterSummary]);

  const handleToggleOnlyMine = useCallback(
    (checked: boolean) => {
      handleFilterChange({ onlyMine: checked });
    },
    [handleFilterChange]
  );

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
        if (payload.data) {
          setSelectedPurchase(payload.data);
          setDetailError(null);
        } else {
          void loadPurchaseDetail(purchaseId);
        }
        setReloadToken((token) => token + 1);
        toast.success(options?.successMessage ?? '操作已完成');
      } catch (err) {
        console.error('采购操作失败', err);
        toast.error(err instanceof Error ? err.message : '操作失败，请稍后再试');
      } finally {
        setMutatingId(null);
      }
    },
    [loadPurchaseDetail]
  );

  const handleSubmit = async (purchase: PurchaseRecord) => {
    const confirmed = await confirm({
      title: '确定提交该采购申请进入审批流程吗？',
      confirmText: '提交',
      cancelText: '取消',
    });
    if (!confirmed) return;
    void performAction(purchase.id, 'submit', {}, { successMessage: '采购申请已提交' });
  };

  const handleWithdraw = async (purchase: PurchaseRecord) => {
    const confirmed = await confirm({
      title: '确定撤回该采购申请吗？',
      confirmText: '撤回',
      cancelText: '取消',
    });
    if (!confirmed) return;
    void performAction(purchase.id, 'withdraw', {}, { successMessage: '采购申请已撤回' });
  };

  const handleApprove = async (purchase: PurchaseRecord) => {
    const confirmed = await confirm({
      title: '确认通过该采购申请？',
      confirmText: '通过',
      cancelText: '取消',
    });
    if (!confirmed) return;
    void performAction(purchase.id, 'approve', {}, { successMessage: '采购申请已通过审批' });
  };

  const rejecting = Boolean(rejectDialog.purchase && mutatingId === rejectDialog.purchase.id);

  const handleReject = (purchase: PurchaseRecord) => {
    setRejectDialog({ open: true, purchase });
  };

  const handleRejectDialogClose = () => {
    if (rejecting) return;
    setRejectDialog({ open: false, purchase: null });
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!rejectDialog.purchase) return;
    await performAction(rejectDialog.purchase.id, 'reject', { reason }, { successMessage: '已驳回该采购申请' });
    setRejectDialog({ open: false, purchase: null });
  };

  const handlePay = async (purchase: PurchaseRecord) => {
    const confirmed = await confirm({
      title: '确认标记该采购为已打款？',
      description: '此操作表明款项已发放。',
      confirmText: '确认打款',
      cancelText: '取消',
    });
    if (!confirmed) return;
    void performAction(purchase.id, 'pay', {}, { successMessage: '采购已标记为已打款' });
  };

  const handleDelete = async (purchase: PurchaseRecord) => {
    const confirmed = await confirm({
      title: '确定删除该采购申请？',
      description: '删除操作不可恢复。',
      confirmText: '删除',
      cancelText: '取消',
    });
    if (!confirmed) return;

    setMutatingId(purchase.id);
    try {
      const response = await fetch(`/api/purchases/${purchase.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '删除失败');
      }
      setReloadToken((token) => token + 1);
      toast.success('采购记录已删除');
    } catch (err) {
      console.error('删除采购失败', err);
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setMutatingId(null);
    }
  };

  const getRowPermissions = useCallback(
    (purchase: PurchaseRecord): PurchaseRowPermissions => {
      if (!permissionUser) {
        return {
          canEdit: false,
          canDelete: false,
          canSubmit: false,
          canApprove: false,
          canReject: false,
          canPay: false,
          canWithdraw: false,
        };
      }

      const isOwner = permissionUser.id === purchase.createdBy;
      return {
        canEdit: canEditPurchase(permissionUser, { createdBy: purchase.createdBy, status: purchase.status }),
        canDelete: canDeletePurchase(permissionUser, { createdBy: purchase.createdBy, status: purchase.status }),
        canSubmit: isOwner && isPurchaseSubmittable(purchase.status),
        canWithdraw: isOwner && isPurchaseWithdrawable(purchase.status),
        canApprove: permissions.canApprove && isPurchaseApprovable(purchase.status),
        canReject: permissions.canReject && isPurchaseApprovable(purchase.status),
        canPay: permissions.canPay && isPurchasePayable(purchase.status),
      };
    },
    [permissionUser, permissions.canApprove, permissions.canPay, permissions.canReject]
  );

  const handleEdit = (purchase: PurchaseRecord) => {
    router.push(`/purchases/${purchase.id}/edit`);
  };

  const handleCloseDetail = () => {
    setSelectedPurchase(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const selectedPurchasePermissions = selectedPurchase ? getRowPermissions(selectedPurchase) : undefined;
  const selectedPurchaseBusy = selectedPurchase ? mutatingId === selectedPurchase.id : false;

  if (permissionLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        正在加载权限信息...
      </div>
    );
  }

  if (!canViewPurchases) {
    return (
      <div className="rounded-lg border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-gray-900 dark:text-rose-200">
        当前账户无权访问采购模块。需要 PURCHASE_VIEW_ALL 或 PURCHASE_VIEW_DEPARTMENT 权限，请联系管理员开通。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5 !pt-0">
       

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filters.search}
              onChange={(event) => handleFilterChange({ search: event.target.value })}
              placeholder="按单号 / 物品 / 用途检索"
              className="h-9 min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />

            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200"
                >
                  筛选条件
                  {activeFilterChips.length > 0 && (
                    <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-blue-600/10 px-1.5 text-xs font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
                      {activeFilterChips.length}
                    </span>
                  )}
                </button>
                
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>筛选条件</SheetTitle>
                  <SheetDescription>组合多个条件以快速定位采购记录。</SheetDescription>
                </SheetHeader>
                <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">状态</label>
                      <select
                        value={filters.status}
                        onChange={(event) => handleFilterChange({ status: event.target.value as PurchaseFilters['status'] })}
                        className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="all">全部状态</option>
                        {PURCHASE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {getPurchaseStatusText(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">渠道</label>
                      <select
                        value={filters.purchaseChannel}
                        onChange={(event) => handleFilterChange({ purchaseChannel: event.target.value as PurchaseFilters['purchaseChannel'] })}
                        className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="all">全部渠道</option>
                        {PURCHASE_CHANNELS.map((channel) => (
                          <option key={channel} value={channel}>
                            {CHANNEL_LABELS[channel]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">付款方式</label>
                      <select
                        value={filters.paymentMethod}
                        onChange={(event) => handleFilterChange({ paymentMethod: event.target.value as PurchaseFilters['paymentMethod'] })}
                        className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="all">全部付款方式</option>
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {PAYMENT_LABELS[method]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">排序字段</label>
                      <select
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value as SortField)}
                        className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        {SORT_FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">排序方式</label>
                      <select
                        value={sortOrder}
                        onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                        className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        {SORT_ORDERS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DatePicker
                      placeholder="开始日期"
                      value={filters.startDate ?? ''}
                      onChange={(value) => handleFilterChange({ startDate: value || null })}
                      containerClassName="space-y-1"
                      className="h-10 justify-start px-3 text-sm"
                    />
                    <DatePicker
                      placeholder="结束日期"
                      value={filters.endDate ?? ''}
                      onChange={(value) => handleFilterChange({ endDate: value || null })}
                      containerClassName="space-y-1"
                      className="h-10 justify-start px-3 text-sm"
                    />
                  </div>

                  <div className="rounded-lg border border-dashed border-gray-200 p-3 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters((prev) => !prev)}
                      className="flex w-full items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                      <span>{showAdvancedFilters ? '隐藏高级筛选' : '展开高级筛选'}</span>
                      {advancedFilterCount > 0 && (
                        <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-blue-600/10 px-1.5 text-xs font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
                          {advancedFilterCount}
                        </span>
                      )}
                    </button>
                    {showAdvancedFilters && (
                      <div className="mt-3 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">最低金额 (¥)</label>
                            <input
                              type="number"
                              min={0}
                              value={filters.minAmount ?? ''}
                              onChange={(event) => handleAmountFilterChange('minAmount', event.target.value)}
                              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">最高金额 (¥)</label>
                            <input
                              type="number"
                              min={0}
                              value={filters.maxAmount ?? ''}
                              onChange={(event) => handleAmountFilterChange('maxAmount', event.target.value)}
                              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">关联项目（可选）</label>
                          <ProjectSelector
                            value={filters.projectId ?? ''}
                            onChange={(projectId, project) => handleProjectFilterChange(projectId, project ?? undefined)}
                            disabled={loading}
                            helperText="快速定位对应项目的采购记录"
                          />
                        </div>
                        <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={filters.onlyMine}
                            onChange={(event) => handleToggleOnlyMine(event.target.checked)}
                            disabled={!permissionUser}
                            className="h-4 w-4"
                          />
                          <span>仅查看我发起的采购</span>
                          {!permissionUser && <span className="text-xs text-gray-400">加载账户信息后可用</span>}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                <SheetFooter className="gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetFilters();
                      setShowAdvancedFilters(false);
                    }}
                    className="h-10 rounded-md border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200"
                  >
                    重置
                  </button>
                  <SheetClose asChild>
                    <button
                      type="button"
                      className="h-10 rounded-md bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      完成
                    </button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <button
              onClick={handleManualRefresh}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200"
              disabled={loading}
            >
              刷新
            </button>
            <button
              onClick={handleExport}
              disabled={loading || exporting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200"
            >
              {exporting ? '导出中...' : '导出 CSV'}
            </button>
            {permissions.canCreate && (
              <Link
                href="/purchases/new"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                + 发起采购
              </Link>
            )}
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">实时统计</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">根据当前筛选条件自动聚合</p>
          </div>
          {statsLoading && <span className="text-xs text-gray-500 dark:text-gray-400">加载中…</span>}
          {statsError && !statsLoading && (
            <span className="text-xs text-rose-600 dark:text-rose-300">{statsError}</span>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats ? (
            <>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">总采购金额</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {amountFormatter.format(stats.totalAmount)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">共 {stats.totalPurchases} 条记录</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">待审批</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800 dark:text-amber-200">
                  {amountFormatter.format(stats.pendingAmount)}
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-200/80">{stats.pendingCount} 条待处理</p>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/30">
                <p className="text-xs uppercase tracking-wide text-sky-700 dark:text-sky-200">已批准</p>
                <p className="mt-2 text-2xl font-semibold text-sky-800 dark:text-sky-100">
                  {amountFormatter.format(stats.approvedAmount)}
                </p>
                <p className="text-xs text-sky-700/80 dark:text-sky-200/80">{stats.approvedCount} 条待打款</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-200">已打款</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-100">
                  {amountFormatter.format(stats.paidAmount)}
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">{stats.paidCount} 条已完成</p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
              {statsLoading ? '正在加载统计信息…' : '暂无统计数据'}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(statusSummary).map(([status, count]) => (
          <div key={status} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {getPurchaseStatusText(status as PurchaseStatus)}
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{count}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <PurchaseTable
          purchases={records}
          loading={loading || isPending}
          mutatingId={mutatingId}
          getRowPermissions={getRowPermissions}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onReject={handleReject}
          onWithdraw={handleWithdraw}
          onPay={handlePay}
        />

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
          <div>
            共 {total} 条 • 第 {page} / {totalPages} 页
          </div>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  每页 {size}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange('prev')}
                disabled={page === 1}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
              >
                上一页
              </button>
              <button
                onClick={() => handlePageChange('next')}
                disabled={page === totalPages}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200">
          {error}
        </div>
      )}

      <PurchaseDetailModal
        purchase={selectedPurchase}
        onClose={handleCloseDetail}
        permissions={selectedPurchasePermissions}
        busy={selectedPurchaseBusy}
        onSubmit={handleSubmit}
        onWithdraw={handleWithdraw}
        onApprove={handleApprove}
        onReject={handleReject}
        onPay={handlePay}
        detailLoading={detailLoading}
        detailError={detailError}
        onReloadDetail={selectedPurchase ? () => loadPurchaseDetail(selectedPurchase.id) : undefined}
      />

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
