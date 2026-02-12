'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import ProjectSelector from '@/components/common/ProjectSelector';
import { FORM_DRAWER_WIDTH_WIDE } from '@/components/common/form-drawer-width';
import SupplierSelector from '@/components/common/SupplierSelector';
import DatePicker from '@/components/ui/DatePicker';
import { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import UserSelect from '@/components/common/UserSelect';
import PurchaseDetailModal from './PurchaseDetailModal';
import PurchaseTable, { type PurchaseRowPermissions } from './PurchaseTable';
import PurchasePayDialog from './PurchasePayDialog';
import PurchaseInboundDrawer from './PurchaseInboundDrawer';
import RejectionReasonDialog from './RejectionReasonDialog';
import ApprovalCommentDialog from './ApprovalCommentDialog';
import TransferApprovalDialog from './TransferApprovalDialog';
import {
  type PurchaseDetail,
  type PurchaseRecord,
  type PurchaseStatus,
  type PurchaseChannel,
  type PurchaseOrganization,
  type PaymentMethod,
  type PurchaseStats,
  PURCHASE_STATUSES,
  PURCHASE_CHANNELS,
  PURCHASE_ORGANIZATIONS,
  PAYMENT_METHODS,
  isPurchaseSubmittable,
  isPurchaseWithdrawable,
  isPurchaseApprovable,
  isPurchasePayable,
  isReimbursementSubmittable,
  getPurchaseStatusText,
} from '@/types/purchase';
import { canDeletePurchase, canEditPurchase } from '@/lib/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';
import { formatDateOnly } from '@/lib/dates';

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
  organizationType: 'all' | PurchaseOrganization;
  paymentMethod: 'all' | PaymentMethod;
  startDate: string | null;
  endDate: string | null;
  projectId: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  purchaserId: string | null;
  supplierId: string | null;
};

const DEFAULT_FILTERS: PurchaseFilters = {
  search: '',
  status: 'all',
  purchaseChannel: 'all',
  organizationType: 'all',
  paymentMethod: 'all',
  startDate: null,
  endDate: null,
  projectId: null,
  minAmount: null,
  maxAmount: null,
  purchaserId: null,
  supplierId: null,
};

const CHANNEL_LABELS: Record<PurchaseChannel, string> = {
  online: '线上',
  offline: '线下',
};

const ORGANIZATION_LABELS: Record<PurchaseOrganization, string> = {
  school: '学校',
  company: '单位',
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
  const dueAmount = record.totalAmount + (record.feeAmount ?? 0);
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
    pendingApprover: record.pendingApproverId ? { id: record.pendingApproverId, displayName: record.pendingApproverId } : null,
    rejecter: record.rejectedBy ? { id: record.rejectedBy, displayName: record.rejectedBy } : null,
    payer: record.paidBy ? { id: record.paidBy, displayName: record.paidBy } : null,
    payments: [],
    paidAmount: 0,
    remainingAmount: dueAmount,
    dueAmount,
    logs: [],
    supplier: null,
  };
}

function buildQuery(
  filters: PurchaseFilters,
  page: number,
  pageSize: number,
  sortBy: SortField,
  sortOrder: SortOrder
) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.purchaseChannel !== 'all') params.set('purchaseChannel', filters.purchaseChannel);
  if (filters.organizationType !== 'all') params.set('organizationType', filters.organizationType);
  if (filters.paymentMethod !== 'all') params.set('paymentMethod', filters.paymentMethod);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.supplierId) params.set('supplierId', filters.supplierId);
  if (filters.minAmount != null) params.set('minAmount', String(filters.minAmount));
  if (filters.maxAmount != null) params.set('maxAmount', String(filters.maxAmount));
  if (filters.purchaserId) params.set('purchaserId', filters.purchaserId);
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
  canReceive: boolean;
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
  const [supplierFilterSummary, setSupplierFilterSummary] = useState<{ id: string; name: string; shortName?: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });
  const [withdrawDialog, setWithdrawDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
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
  const [inboundDrawer, setInboundDrawer] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
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
      canReceive: hasPermission('INVENTORY_OPERATE_INBOUND'),
    }),
    [hasPermission]
  );

  const canViewPurchases = permissions.canViewAll || permissions.canViewDepartment || permissions.canCreate;

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

    if (permissionLoading || !canViewPurchases) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery(filters, page, pageSize, sortBy, sortOrder);
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

    if (permissionLoading || !canViewPurchases) return;

    let cancelled = false;

    async function loadStats() {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const query = buildQuery(filters, 1, 1, sortBy, sortOrder);
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
  const showPaginationNav = totalPages > 1;

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
    if (filters.supplierId) count += 1;
    if (filters.minAmount != null) count += 1;
    if (filters.maxAmount != null) count += 1;
    if (filters.purchaserId) count += 1;
    return count;
  }, [filters.projectId, filters.supplierId, filters.minAmount, filters.maxAmount, filters.purchaserId]);

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
      setSupplierFilterSummary(null);
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
      const query = buildQuery(filters, 1, pageSize, sortBy, sortOrder);
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
      const today = formatDateOnly(new Date()) ?? new Date().toISOString().split('T')[0];
      link.download = `purchases-${today}.csv`;
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
  }, [exporting, filters, pageSize, sortBy, sortOrder]);

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

  const handleSupplierFilterChange = useCallback(
    (supplierId: string, supplier?: { name: string; shortName?: string | null } | null) => {
      handleFilterChange({ supplierId: supplierId || null });
      if (supplier && supplierId) {
        setSupplierFilterSummary({ id: supplierId, name: supplier.name, shortName: supplier.shortName ?? undefined });
      } else {
        setSupplierFilterSummary(null);
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
    if (filters.organizationType !== 'all') {
      chips.push({
        key: 'organization',
        label: `组织：${ORGANIZATION_LABELS[filters.organizationType]}`,
        onRemove: () => handleFilterChange({ organizationType: 'all' }),
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
    if (filters.supplierId) {
      const label = supplierFilterSummary
        ? `供应商：${supplierFilterSummary.name}${supplierFilterSummary.shortName ? `（${supplierFilterSummary.shortName}）` : ''}`
        : `供应商：${filters.supplierId}`;
      chips.push({ key: 'supplier', label, onRemove: () => handleSupplierFilterChange('', null) });
    }
    if (filters.minAmount != null) {
      chips.push({ key: 'minAmount', label: `金额≥¥${filters.minAmount}`, onRemove: () => handleFilterChange({ minAmount: null }) });
    }
    if (filters.maxAmount != null) {
      chips.push({ key: 'maxAmount', label: `金额≤¥${filters.maxAmount}`, onRemove: () => handleFilterChange({ maxAmount: null }) });
    }
    if (filters.purchaserId) {
      chips.push({ key: 'purchaserId', label: '指定员工', onRemove: () => handleFilterChange({ purchaserId: null }) });
    }
    return chips;
  }, [filters, handleFilterChange, handleProjectFilterChange, handleSupplierFilterChange, projectFilterSummary, supplierFilterSummary]);



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
        return true;
      } catch (err) {
        console.error('采购操作失败', err);
        toast.error(err instanceof Error ? err.message : '操作失败，请稍后再试');
        return false;
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
    setWithdrawDialog({ open: true, purchase });
  };

  const handleApprove = (purchase: PurchaseRecord) => {
    setApproveDialog({ open: true, purchase });
  };

  const rejecting = Boolean(rejectDialog.purchase && mutatingId === rejectDialog.purchase.id);

  const handleReject = (purchase: PurchaseRecord) => {
    setRejectDialog({ open: true, purchase });
  };

  const handleTransfer = (purchase: PurchaseRecord) => {
    setTransferDialog({ open: true, purchase });
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

  const handleWithdrawDialogClose = () => {
    if (mutatingId && withdrawDialog.purchase && mutatingId === withdrawDialog.purchase.id) return;
    setWithdrawDialog({ open: false, purchase: null });
  };

  const handleWithdrawSubmit = async (reason: string) => {
    if (!withdrawDialog.purchase) return;
    await performAction(withdrawDialog.purchase.id, 'withdraw', { reason }, { successMessage: '采购申请已撤回' });
    setWithdrawDialog({ open: false, purchase: null });
  };

  const handlePay = (purchase: PurchaseRecord | PurchaseDetail) => {
    setPayDialog({ open: true, purchase });
  };

  const handleSubmitReimbursement = async (purchase: PurchaseRecord) => {
    const confirmed = await confirm({
      title: '确认提交报销申请？',
      description: '提交后将通知财务进入待办队列。',
      confirmText: '提交报销',
      cancelText: '取消',
    });
    if (!confirmed) return;
    void performAction(
      purchase.id,
      'submit_reimbursement',
      {},
      { successMessage: '报销申请已提交，等待财务确认' }
    );
  };

  const handleReceive = (purchase: PurchaseRecord | PurchaseDetail) => {
    setInboundDrawer({ open: true, purchase });
  };

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
      { successMessage: '采购申请已通过审批' }
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
          canDuplicate: false,
          canSubmit: false,
          canApprove: false,
          canTransfer: false,
          canReject: false,
          canPay: false,
          canSubmitReimbursement: false,
          canWithdraw: false,
        };
      }

      const isOwner = permissionUser.id === purchase.createdBy;
      return {
        canEdit: canEditPurchase(permissionUser, { createdBy: purchase.createdBy, status: purchase.status }),
        canDelete: canDeletePurchase(permissionUser, { createdBy: purchase.createdBy, status: purchase.status }),
        canDuplicate: permissions.canCreate && (isOwner || permissions.canViewAll),
        canSubmit: isOwner && isPurchaseSubmittable(purchase.status),
        canWithdraw: isOwner && isPurchaseWithdrawable(purchase.status),
        canApprove: permissions.canApprove && isPurchaseApprovable(purchase.status),
        canTransfer: permissions.canApprove && isPurchaseApprovable(purchase.status),
        canReject: permissions.canReject && isPurchaseApprovable(purchase.status),
        canPay:
          permissions.canPay &&
          isPurchasePayable(purchase.status) &&
          purchase.reimbursementStatus === 'reimbursement_pending',
        canSubmitReimbursement: isOwner && isReimbursementSubmittable(purchase),
      };
    },
    [permissionUser, permissions.canApprove, permissions.canCreate, permissions.canPay, permissions.canReject, permissions.canViewAll]
  );

  const handleEdit = (purchase: PurchaseRecord) => {
    router.push(`/purchases/${purchase.id}/edit`);
  };

  const handleDuplicate = async (purchase: PurchaseRecord) => {
    setMutatingId(purchase.id);
    try {
      const response = await fetch(`/api/purchases/${purchase.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });
      const payload: PurchaseActionResponse = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '复制申请失败');
      }
      toast.success('已复制为新草稿，正在跳转编辑页');
      router.push(`/purchases/${payload.data.id}/edit`);
      router.refresh();
    } catch (err) {
      console.error('复制采购失败', err);
      toast.error(err instanceof Error ? err.message : '复制失败，请稍后再试');
    } finally {
      setMutatingId(null);
    }
  };

  const handleCloseDetail = () => {
    setSelectedPurchase(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const selectedPurchasePermissions = selectedPurchase ? getRowPermissions(selectedPurchase) : undefined;
  const canReceive = Boolean(
    permissions.canReceive &&
    selectedPurchase &&
    (selectedPurchase.status === 'approved' || selectedPurchase.status === 'paid')
  );
  const selectedPurchaseBusy = selectedPurchase ? mutatingId === selectedPurchase.id : false;

  if (permissionLoading) {
    return (
      <div className="panel-frame p-6 text-sm text-muted-foreground">
        正在加载权限信息...
      </div>
    );
  }

  if (!canViewPurchases) {
    return (
      <div className="alert-box alert-danger p-6 text-sm">
        当前账户无权访问采购模块。需要 PURCHASE_CREATE、PURCHASE_VIEW_ALL 或 PURCHASE_VIEW_DEPARTMENT 权限，请联系管理员开通。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Section */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {stats ? (
            <>
              <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                <span className="font-medium text-foreground">总采购金额</span>
                <span className="font-semibold text-foreground">{amountFormatter.format(stats.totalAmount)}</span>
                <span className="text-[10px] text-muted-foreground/80">共 {stats.totalPurchases} 条</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                <span className="font-medium text-foreground">待审批</span>
                <span className="font-semibold text-chart-3">{amountFormatter.format(stats.pendingAmount)}</span>
                <span className="text-[10px] text-muted-foreground/80">{stats.pendingCount} 条</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                <span className="font-medium text-foreground">已批准</span>
                <span className="font-semibold text-chart-1">{amountFormatter.format(stats.approvedAmount)}</span>
                <span className="text-[10px] text-muted-foreground/80">{stats.approvedCount} 条</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                <span className="font-medium text-foreground">已打款</span>
                <span className="font-semibold text-chart-5">{amountFormatter.format(stats.paidAmount)}</span>
                <span className="text-[10px] text-muted-foreground/80">{stats.paidCount} 条</span>
              </div>
            </>
          ) : (
            <div className="rounded-full border border-dashed border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground">
              {statsLoading ? '正在加载统计信息…' : '暂无统计数据'}
            </div>
          )}
        </div>
        <div>
          {statsLoading && <span className="text-xs text-muted-foreground">加载中…</span>}
          {statsError && !statsLoading && (
            <span className="text-xs text-destructive">{statsError}</span>
          )}
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="surface-toolbar p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={filters.search}
              onChange={(event) => handleFilterChange({ search: event.target.value })}
              placeholder="按单号 / 物品 / 用途检索"
              className="h-10 w-full"
            />
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2">
            {permissions.canViewAll && (
              <div className="w-[160px]">
                <UserSelect
                  value={filters.purchaserId}
                  onChange={(val) => handleFilterChange({ purchaserId: val })}
                  placeholder="筛选申请人..."
                  className="h-10"
                />
              </div>
            )}

            <Drawer open={filterSheetOpen} onOpenChange={setFilterSheetOpen} direction="right">
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 px-4">
                  筛选
                  {activeFilterChips.length > 0 && (
                    <Badge className="ml-1 rounded-full px-2 py-0 text-[10px]" variant="secondary">
                      {activeFilterChips.length}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent side="right" className={FORM_DRAWER_WIDTH_WIDE}>
                <DrawerHeader>
                  <DrawerTitle>筛选条件</DrawerTitle>
                  <DrawerDescription>组合多个条件以快速定位采购记录。</DrawerDescription>
                </DrawerHeader>
                <DrawerBody>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">状态</label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => handleFilterChange({ status: value as PurchaseFilters['status'] })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="全部状态" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部状态</SelectItem>
                          {PURCHASE_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {getPurchaseStatusText(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">渠道</label>
                      <Select
                        value={filters.purchaseChannel}
                        onValueChange={(value) => handleFilterChange({ purchaseChannel: value as PurchaseFilters['purchaseChannel'] })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="全部渠道" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部渠道</SelectItem>
                          {PURCHASE_CHANNELS.map((channel) => (
                            <SelectItem key={channel} value={channel}>
                              {CHANNEL_LABELS[channel]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">组织</label>
                      <Select
                        value={filters.organizationType}
                        onValueChange={(value) => handleFilterChange({ organizationType: value as PurchaseFilters['organizationType'] })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="全部组织" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部组织</SelectItem>
                          {PURCHASE_ORGANIZATIONS.map((org) => (
                            <SelectItem key={org} value={org}>
                              {ORGANIZATION_LABELS[org]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">付款方式</label>
                      <Select
                        value={filters.paymentMethod}
                        onValueChange={(value) => handleFilterChange({ paymentMethod: value as PurchaseFilters['paymentMethod'] })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="全部付款方式" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部付款方式</SelectItem>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {PAYMENT_LABELS[method]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">排序字段</label>
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortField)}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="排序字段" />
                        </SelectTrigger>
                        <SelectContent>
                          {SORT_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">排序方式</label>
                      <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="排序方式" />
                        </SelectTrigger>
                        <SelectContent>
                          {SORT_ORDERS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DatePicker
                      placeholder="开始日期"
                      value={filters.startDate ?? ''}
                      onChange={(value: string) => handleFilterChange({ startDate: value || null })}
                      containerClassName="space-y-1"
                      className="h-10 justify-start px-3 text-sm"
                    />
                    <DatePicker
                      placeholder="结束日期"
                      value={filters.endDate ?? ''}
                      onChange={(value: string) => handleFilterChange({ endDate: value || null })}
                      containerClassName="space-y-1"
                      className="h-10 justify-start px-3 text-sm"
                    />
                  </div>

                  <div className="rounded-lg border border-dashed border-border p-3 dark:border-border">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters((prev) => !prev)}
                      className="flex w-full items-center justify-between text-sm font-medium text-foreground"
                    >
                      <span>{showAdvancedFilters ? '隐藏高级筛选' : '展开高级筛选'}</span>
                      {advancedFilterCount > 0 && (
                        <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                          {advancedFilterCount}
                        </span>
                      )}
                    </button>
                    {showAdvancedFilters && (
                      <div className="mt-3 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">最低金额 (¥)</label>
                            <Input
                              type="number"
                              min={0}
                              value={filters.minAmount ?? ''}
                              onChange={(event) => handleAmountFilterChange('minAmount', event.target.value)}
                              className="h-10"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">最高金额 (¥)</label>
                            <Input
                              type="number"
                              min={0}
                              value={filters.maxAmount ?? ''}
                              onChange={(event) => handleAmountFilterChange('maxAmount', event.target.value)}
                              className="h-10"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">关联项目（可选）</label>
                          <ProjectSelector
                            value={filters.projectId ?? ''}
                            onChange={(projectId, project) => handleProjectFilterChange(projectId, project ?? undefined)}
                            disabled={loading}
                            helperText="快速定位对应项目的采购记录"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">关联供应商（可选）</label>
                          <SupplierSelector
                            value={filters.supplierId ?? ''}
                            onChange={(supplierId, supplier) => handleSupplierFilterChange(supplierId, supplier ?? undefined)}
                            disabled={loading}
                            helperText="默认展示状态为正常的供应商，可输入关键字搜索"
                            status="all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </DrawerBody>
                <DrawerFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      handleResetFilters();
                      setShowAdvancedFilters(false);
                    }}
                  >
                    重置
                  </Button>
                  <DrawerClose asChild>
                    <Button type="button">
                      完成
                    </Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-10 px-3 text-muted-foreground">
              清空
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              className="h-10"
              disabled={loading}
            >
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading || exporting}
              className="h-10"
            >
              {exporting ? '导出中...' : '导出 CSV'}
            </Button>
            {permissions.canCreate && (
              <Button asChild size="sm" className="h-10">
                <Link href="/purchases/new">+ 发起采购</Link>
              </Button>
            )}
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 text-xs sm:flex-wrap">
              {activeFilterChips.map((chip) => (
                <Button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-full px-3 text-xs"
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </Button>
              ))}
            </div>
          )}
        </div>


      </div>

      {/* Status summary grid removed to avoid duplicating the metrics shown in the real-time stats card above */}

      <div className="surface-table">
        <PurchaseTable
          purchases={records}
          loading={loading || isPending}
          mutatingId={mutatingId}
          getRowPermissions={getRowPermissions}
          onView={handleView}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onTransfer={handleTransfer}
          onReject={handleReject}
          onWithdraw={handleWithdraw}
          onPay={handlePay}
          onSubmitReimbursement={handleSubmitReimbursement}
        />

      </div>

      <div className="flex flex-col gap-3 border-t border-transparent px-2 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>共 {total} 条 • 第 {page} / {totalPages} 页</div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select value={String(pageSize)} onValueChange={(value) => handlePageSizeChange(Number(value))}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="每页数量" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  每页 {size} 条
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showPaginationNav && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('prev')}
                disabled={page === 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> 上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('next')}
                disabled={page === totalPages}
                className="gap-1"
              >
                下一页 <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-box alert-danger px-4 py-3 text-sm">
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
        onTransfer={handleTransfer}
        onReject={handleReject}
        onPay={handlePay}
        onSubmitReimbursement={handleSubmitReimbursement}
        onReceive={handleReceive}
        canReceive={canReceive}
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

      <RejectionReasonDialog
        open={withdrawDialog.open}
        onClose={handleWithdrawDialogClose}
        onSubmit={(reason) => handleWithdrawSubmit(reason)}
        defaultReason="主动撤回，补充资料后重新提交"
        submitting={Boolean(mutatingId && withdrawDialog.purchase && mutatingId === withdrawDialog.purchase.id)}
        title="撤回采购申请"
        description="请输入撤回原因，系统会记录撤回说明并通知相关审批人。"
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

      <PurchaseInboundDrawer
        open={inboundDrawer.open}
        purchase={inboundDrawer.purchase}
        onOpenChange={(open) => {
          if (!open) setInboundDrawer({ open: false, purchase: null });
        }}
        onSuccess={() => setInboundDrawer({ open: false, purchase: null })}
      />
    </div>
  );
}
