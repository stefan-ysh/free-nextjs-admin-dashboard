'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

import FileUpload from '@/components/common/FileUpload';
import { SearchableEntitySelect } from '@/components/common/SearchableEntitySelect';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Pagination from '@/components/tables/Pagination';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import WorkflowStepList from '@/components/common/WorkflowStepList';
import RejectionReasonDialog from '@/components/purchases/RejectionReasonDialog';
import PaymentConfirmDialog from './PaymentConfirmDialog';
import ReimbursementDetailDrawer from './ReimbursementDetailDrawer';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { formatDateOnly } from '@/lib/dates';
import type {
  CreateReimbursementInput,
  ListReimbursementsResult,
  ReimbursementDetails,
  ReimbursementOrganizationType,
  ReimbursementLog,
  ReimbursementRecord,
  ReimbursementSourceType,
  UpdateReimbursementInput,
} from '@/types/reimbursement';
import { REIMBURSEMENT_CATEGORY_FIELDS, REIMBURSEMENT_CATEGORY_OPTIONS } from '@/types/reimbursement';
import { UserRole } from '@/types/user';
import type { PurchaseRecord } from '@/types/purchase';
import { ExportUtils } from '@/lib/export-utils';

type ListResponse = { success: boolean; data?: ListReimbursementsResult; error?: string };
type ActionResponse = { success: boolean; data?: ReimbursementRecord; error?: string };
type PurchaseListResponse = {
  success: boolean;
  data?: { items: PurchaseRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

type EligibilityResponse = {
  success: boolean;
  data?: { eligible: boolean; reason?: string };
  error?: string;
};
type DetailResponse = {
  success: boolean;
  data?: (ReimbursementRecord & { logs?: ReimbursementLog[] }) | null;
  error?: string;
};

type ReimbursementFormState = CreateReimbursementInput & { hasInvoice: boolean };

const STATUS_LABELS: Record<ReimbursementRecord['status'], string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已审批',
  rejected: '已驳回',
  paid: '已打款',
};

const SOURCE_LABELS: Record<ReimbursementSourceType, string> = {
  purchase: '关联采购',
  direct: '直接报销',
};

const ORG_LABELS: Record<ReimbursementOrganizationType, string> = {
  school: '学校',
  company: '单位',
};

const STATUS_STYLES: Record<ReimbursementRecord['status'], string> = {
  draft: 'border-border/80 text-muted-foreground',
  pending_approval: 'border-chart-3/40 text-chart-3 bg-chart-3/10',
  approved: 'border-chart-1/40 text-chart-1 bg-chart-1/10',
  rejected: 'border-destructive/40 text-destructive bg-destructive/10',
  paid: 'border-chart-5/40 text-chart-5 bg-chart-5/10',
};



const MONEY = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });

function normalizeDetailsByCategory(category: string, details: ReimbursementDetails | null | undefined): ReimbursementDetails {
  const fields = REIMBURSEMENT_CATEGORY_FIELDS[category] ?? [];
  const source = details ?? {};
  if (fields.length === 0) {
    return Object.fromEntries(
      Object.entries(source)
        .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
        .filter(([key, value]) => key && value)
    );
  }
  const allowed = new Set(fields.map((item) => item.key));
  const result: ReimbursementDetails = {};
  for (const [key, value] of Object.entries(source)) {
    if (!allowed.has(key)) continue;
    const text = String(value ?? '').trim();
    if (!text) continue;
    result[key] = text;
  }
  return result;
}

function getCategoryRequiredMessage(category: string, details: ReimbursementDetails): string | null {
  const fields = REIMBURSEMENT_CATEGORY_FIELDS[category] ?? [];
  for (const field of fields) {
    if (!field.required) continue;
    if (!details[field.key]?.trim()) {
      return `请填写「${field.label}」`;
    }
  }
  return null;
}

function toDateInputValue(value?: string | null): string {
  return formatDateOnly(value) ?? '';
}

function buildDefaultForm(): ReimbursementFormState {
  return {
    sourceType: 'direct',
    category: '交通',
    title: '',
    amount: 0,
    occurredAt: formatDateOnly(new Date()) ?? '',
    organizationType: 'company',
    sourcePurchaseId: '',
    description: '',
    details: {},
    invoiceImages: [],
    receiptImages: [],
    attachments: [],
    hasInvoice: true,
  };
}

function hasReimbursementEvidence(row: Pick<ReimbursementRecord, 'invoiceImages' | 'receiptImages'>): boolean {
  return row.invoiceImages.length > 0 || row.receiptImages.length > 0;
}

export default function ReimbursementsClient() {
  const { user, hasPermission, loading: permissionLoading } = usePermissions();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  // Pagination state
  const [page, setPage] = useState(() => parseInt(searchParams.get('page') || '1', 10));
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '20', 10));

  // Dialog states
  const [deleteTarget, setDeleteTarget] = useState<ReimbursementRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ReimbursementRecord | null>(null);
  const [payTarget, setPayTarget] = useState<ReimbursementRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [scope, setScope] = useState<'mine' | 'approval' | 'pay' | 'all'>('mine');
  const [search, setSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<'draft' | 'submit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState(false);
  const [form, setForm] = useState<ReimbursementFormState>(buildDefaultForm);

  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseRecord[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const [eligibilityChecking, setEligibilityChecking] = useState(false);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string } | null>(null);
  const handledFocusRef = useRef<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ReimbursementRecord | null>(null);
  const [currentLogs, setCurrentLogs] = useState<ReimbursementLog[]>([]);



  const canCreate = hasPermission('REIMBURSEMENT_CREATE');
  const canApprove = hasPermission('REIMBURSEMENT_APPROVE');
  const canPay = hasPermission('REIMBURSEMENT_PAY');
  const canViewAll = hasPermission('REIMBURSEMENT_VIEW_ALL');

  const scopeOptions = useMemo(() => {
    const options: Array<{ value: 'mine' | 'approval' | 'pay' | 'all'; label: string }> = [{ value: 'mine', label: '我的报销' }];
    if (canApprove) options.push({ value: 'approval', label: '待我审批' });
    if (canPay) options.push({ value: 'pay', label: '待我打款' });
    if (canViewAll) options.push({ value: 'all', label: '全部报销' });
    return options;
  }, [canApprove, canPay, canViewAll]);

  useEffect(() => {
    const queryScope = searchParams.get('scope');
    const hasScopeKey = searchParams.has('scope');
    const allowed = new Set(scopeOptions.map((item) => item.value));

    if (hasScopeKey && queryScope && allowed.has(queryScope as 'mine' | 'approval' | 'pay' | 'all')) {
      setScope(queryScope as 'mine' | 'approval' | 'pay' | 'all');
      return;
    }

    // Always default to 'mine' so users see their own submissions first
    setScope('mine');
    setSelectedIds([]);
  }, [scopeOptions, searchParams]);

  const role = user?.primaryRole;

  const canOperatePay = useCallback(
    (row: ReimbursementRecord) => {
      if (!canPay || (row.status !== 'approved' && row.status !== 'pending_approval')) return false;
      if (role === UserRole.FINANCE_SCHOOL) return row.organizationType === 'school';
      if (role === UserRole.FINANCE_COMPANY) return row.organizationType === 'company';
      return false;
    },
    [canPay, role]
  );

  const isOwner = useCallback(
    (row: ReimbursementRecord) => row.createdBy === user?.id || row.applicantId === user?.id,
    [user?.id]
  );

  const editable = useCallback(
    (row: ReimbursementRecord) =>
      isOwner(row) &&
      (row.status === 'draft' || row.status === 'rejected'),
    [isOwner]
  );

  const {
    data: listData,
    isLoading: isListLoading,
    isFetching: isListFetching,
  } = useQuery({
    queryKey: ['reimbursements', 'list', scope, search, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('scope', scope);
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (search.trim()) params.set('search', search.trim());
      
      const response = await fetch(`/api/reimbursements?${params.toString()}`, { 
        headers: { Accept: 'application/json' },
      });
      
      const payload = (await response.json()) as ListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? '加载报销列表失败');
      }
      return payload.data;
    },
    placeholderData: keepPreviousData,
    enabled: !permissionLoading,
  });

  const records = useMemo(() => listData?.items ?? [], [listData?.items]);
  const totalItems = listData?.total ?? 0;
  const loading = isListLoading || isListFetching;

  const fetchList = useCallback(async () => {
    setSelectedIds([]);
    await queryClient.invalidateQueries({ queryKey: ['reimbursements', 'list'] });
  }, [queryClient]);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? records.map((r) => r.id) : []);
  }, [records]);

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: '批量审批通过',
      description: `确定要批准选中的 ${selectedIds.length} 项报销申请吗？`,
    });
    if (!ok) return;

    setBatchActionLoading(true);
    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            await runAction(id, 'approve');
            return true;
          } catch {
            return false;
          }
        })
      );
      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        toast.success(`成功审批 ${successCount} 项${successCount < selectedIds.length ? `，${selectedIds.length - successCount} 项失败` : ''}`);
        await fetchList();
      } else {
        toast.error('批量审批失败');
      }
    } catch {
      toast.error('批量操作过程中发生错误');
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchPay = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: '批量标记打款',
      description: `确定要对选中的 ${selectedIds.length} 项报销进行打款标记吗？`,
    });
    if (!ok) return;

    setBatchActionLoading(true);
    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            await runAction(id, 'pay', { note: '批量操作统一打款' });
            return true;
          } catch {
            return false;
          }
        })
      );
      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        toast.success(`成功打款 ${successCount} 项${successCount < selectedIds.length ? `，${selectedIds.length - successCount} 项失败` : ''}`);
        await fetchList();
      } else {
        toast.error('批量打款失败');
      }
    } catch {
      toast.error('批量操作过程中发生错误');
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleExport = useCallback(async () => {
    if (loading) return;
    try {
      toast.info('正在准备导出...');
      const params = new URLSearchParams();
      params.set('scope', scope);
      params.set('page', '1');
      params.set('pageSize', '1000'); // Export limit
      if (search.trim()) params.set('search', search.trim());
      
      const response = await fetch(`/api/reimbursements?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as ListResponse;
      
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? '导出失败：无法获取数据');
      }

      const items = payload.data.items;
      if (items.length === 0) {
        toast.info('没有可导出的数据');
        return;
      }

      const today = formatDateOnly(new Date()) ?? new Date().toISOString().split('T')[0];
      
      const exportData = items.map(item => ({
        reimbursementNumber: item.reimbursementNumber,
        title: item.title,
        sourceType: SOURCE_LABELS[item.sourceType] || item.sourceType,
        purchaseNumber: item.sourcePurchaseNumber || '',
        organizationType: ORG_LABELS[item.organizationType] || item.organizationType,
        category: item.category,
        amount: item.amount,
        status: STATUS_LABELS[item.status] || item.status,
        occurredAt: formatDateOnly(item.occurredAt),
        applicantName: item.applicantName || '未知',
        // Images
        invoiceImages: item.invoiceImages,
        receiptImages: item.receiptImages,
      }));

      const columns = [
        { header: '报销单号', key: 'reimbursementNumber', width: 20 },
        { header: '标题', key: 'title', width: 25 },
        { header: '来源', key: 'sourceType', width: 12 },
        { header: '关联采购单', key: 'purchaseNumber', width: 20 },
        { header: '组织', key: 'organizationType', width: 12 },
        { header: '分类', key: 'category', width: 12 },
        { header: '金额', key: 'amount', width: 12 },
        { header: '状态', key: 'status', width: 12 },
        { header: '发生日期', key: 'occurredAt', width: 15 },
        { header: '申请人', key: 'applicantName', width: 15 },
        { header: '发票图片', key: 'invoiceImages', width: 18 },
        { header: '收款凭证', key: 'receiptImages', width: 18 },
      ];

      await ExportUtils.exportToExcel({
        filename: `报销清单-${today}`,
        sheetName: '报销记录',
        columns,
        data: exportData,
        imageKeys: ['invoiceImages', 'receiptImages'],
      });

      toast.success(`成功导出 ${items.length} 条记录`);
    } catch (error) {
      console.error('导出失败', error);
      toast.error(error instanceof Error ? error.message : '导出失败');
    }
  }, [loading, scope, search]);

  const filterEligiblePurchases = useCallback(
    async (items: PurchaseRecord[], excludeReimbursementId?: string | null): Promise<PurchaseRecord[]> => {
      const checks = await Promise.all(
        items.map(async (item) => {
          try {
            const params = new URLSearchParams();
            params.set('purchaseId', item.id);
            if (excludeReimbursementId) params.set('reimbursementId', excludeReimbursementId);
            const response = await fetch(`/api/reimbursements/purchase-eligibility?${params.toString()}`, {
              headers: { Accept: 'application/json' },
            });
            const payload = (await response.json()) as EligibilityResponse;
            return Boolean(response.ok && payload.success && payload.data?.eligible);
          } catch {
            return false;
          }
        })
      );
      return items.filter((_, index) => checks[index]);
    },
    []
  );

  const fetchPurchases = useCallback(async (excludeReimbursementId?: string | null): Promise<PurchaseRecord[]> => {
    setPurchaseLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '100');
      params.set('sortBy', 'updatedAt');
      params.set('sortOrder', 'desc');
      const response = await fetch(`/api/purchases?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as PurchaseListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? '加载采购单失败');
      }
      const rawOptions = payload.data.items.filter(
        (item) =>
          (item.status === 'approved' || item.status === 'pending_inbound' || item.status === 'paid') &&
          item.paymentMethod !== 'corporate_transfer'
      );
      const options = await filterEligiblePurchases(rawOptions, excludeReimbursementId);
      setPurchaseOptions((prev) => {
        if (prev.length === options.length && prev.every((item, index) => item.id === options[index]?.id)) {
          return prev;
        }
        return options;
      });
      return options;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载采购单失败');
      setPurchaseOptions([]);
      return [];
    } finally {
      setPurchaseLoading(false);
    }
  }, [filterEligiblePurchases]);

  const fetchPurchaseEntities = useCallback(
    async (keyword: string): Promise<PurchaseRecord[]> => {
      const options = purchaseOptions;
      const normalized = keyword.trim().toLowerCase();
      if (!normalized) return options;
      return options.filter((item) => {
        const text = `${item.purchaseNumber} ${item.itemName} ${item.purpose ?? ''}`.toLowerCase();
        return text.includes(normalized);
      });
    },
    [purchaseOptions]
  );
  const purchaseMap = useMemo(() => new Map(purchaseOptions.map((item) => [item.id, item])), [purchaseOptions]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    if (!drawerOpen || form.sourceType !== 'purchase') return;
    void fetchPurchases(editingId);
  }, [drawerOpen, editingId, form.sourceType, fetchPurchases]);

  useEffect(() => {
    if (!drawerOpen || detailMode || form.sourceType !== 'purchase' || !form.sourcePurchaseId?.trim()) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setEligibilityChecking(true);
    const params = new URLSearchParams();
    params.set('purchaseId', form.sourcePurchaseId.trim());
    if (editingId) params.set('reimbursementId', editingId);
    void fetch(`/api/reimbursements/purchase-eligibility?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = (await response.json()) as EligibilityResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? '关联采购校验失败');
        }
        if (cancelled) return;
        setEligibility(payload.data);
      })
      .catch((error) => {
        if (cancelled) return;
        setEligibility({ eligible: false, reason: error instanceof Error ? error.message : '关联采购校验失败' });
      })
      .finally(() => {
        if (!cancelled) setEligibilityChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [drawerOpen, detailMode, editingId, form.sourceType, form.sourcePurchaseId]);

  const runAction = useCallback(
    async (id: string, action: 'submit' | 'approve' | 'reject' | 'pay' | 'withdraw', body: Record<string, unknown> = {}) => {
      const response = await fetch(`/api/reimbursements/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const payload = (await response.json()) as ActionResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '操作失败');
      }
      return payload.data ?? null;
    },
    []
  );

  const resetForm = useCallback(() => {
    setForm({
      sourceType: 'direct',
      category: '交通',
      title: '',
      amount: 0,
      occurredAt: formatDateOnly(new Date()) ?? '',
      organizationType: 'company',
      sourcePurchaseId: '',
      description: '',
      details: {},
      invoiceImages: [],
      receiptImages: [],
      attachments: [],
      hasInvoice: true,
    });
    setEditingId(null);
    setDetailMode(false);
    setEligibility(null);
    setEligibilityChecking(false);
    setCurrentLogs([]);
    const defaultOrg: ReimbursementOrganizationType = user?.primaryRole === UserRole.FINANCE_SCHOOL ? 'school' : 'company';
    setForm((prev) => ({ ...prev, organizationType: defaultOrg }));
  }, [user]);

  const applyRecordToForm = useCallback((row: ReimbursementRecord) => {
    setForm({
      sourceType: row.sourceType,
      sourcePurchaseId: row.sourcePurchaseId ?? '',
      organizationType: row.organizationType,
      category: row.category,
      title: row.title,
      amount: row.amount,
      occurredAt: toDateInputValue(row.occurredAt),
      description: row.description ?? '',
      details: normalizeDetailsByCategory(row.category, row.details),
      invoiceImages: row.invoiceImages,
      receiptImages: row.receiptImages,
      attachments: row.attachments,
      hasInvoice: row.details?.hasInvoice === 'true',
    });
  }, []);

  const loadDetailLogs = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/reimbursements/${id}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as DetailResponse;
      if (!response.ok || !payload.success || !payload.data) return;
      setCurrentLogs((payload.data.logs ?? []).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      setCurrentLogs([]);
    }
  }, []);

  const openCreateDrawer = useCallback(() => {
    resetForm();
    setDetailMode(false);
    setDrawerOpen(true);
  }, [resetForm]);

  const openEditDrawer = useCallback((row: ReimbursementRecord) => {
    setEditingId(row.id);
    setDetailMode(false);
    setEligibility(null);
    applyRecordToForm(row);
    void loadDetailLogs(row.id);
    setDrawerOpen(true);
  }, [applyRecordToForm, loadDetailLogs]);

  const openDetailDrawer = useCallback((row: ReimbursementRecord) => {
    setDetailRecord(row);
    setDetailDrawerOpen(true);
  }, []);

  const resolvePurchaseInvoiceRequired = useCallback(
    async (purchaseId: string): Promise<boolean | null> => {
      const candidate = purchaseMap.get(purchaseId);
      if (candidate) {
        return candidate.invoiceType !== 'none' && candidate.invoiceStatus !== 'not_required';
      }
      const response = await fetch(`/api/purchases/${purchaseId}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as { success: boolean; data?: PurchaseRecord; error?: string };
      if (!response.ok || !payload.success || !payload.data) {
        return null;
      }
      return payload.data.invoiceType !== 'none' && payload.data.invoiceStatus !== 'not_required';
    },
    [purchaseMap]
  );

  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || records.length === 0 || !scope) return;
    if (handledFocusRef.current === focusId) return;
    const target = records.find((item) => item.id === focusId);
    if (target) {
      if (editable(target)) {
        openEditDrawer(target);
      } else {
        openDetailDrawer(target);
      }
      handledFocusRef.current = focusId;
    }
  }, [editable, openDetailDrawer, openEditDrawer, records, scope, searchParams]);

  const submitForm = useCallback(async (intent: 'draft' | 'submit') => {
    setSubmitIntent(intent);
    setSubmitting(true);
    try {
      const payloadBase: CreateReimbursementInput = {
        ...form,
        title: form.title.trim(),
        category: form.category.trim(),
        amount: Number(form.amount),
        occurredAt: form.occurredAt,
        sourcePurchaseId: form.sourceType === 'purchase' ? form.sourcePurchaseId?.trim() || '' : undefined,
        description: form.description?.trim() || undefined,
        details: {
          ...normalizeDetailsByCategory(form.category, form.details),
          hasInvoice: String(form.hasInvoice),
        },
        invoiceImages: form.invoiceImages ?? [],
        receiptImages: form.receiptImages ?? [],
        attachments: form.attachments ?? [],
      };

      if (!payloadBase.title) {
        throw new Error('请填写报销标题');
      }
      if (!payloadBase.category) {
        throw new Error('请选择报销分类');
      }
      const categoryRequiredError = getCategoryRequiredMessage(payloadBase.category, payloadBase.details ?? {});
      if (categoryRequiredError) {
        throw new Error(categoryRequiredError);
      }
      if (!Number.isFinite(payloadBase.amount) || payloadBase.amount <= 0) {
        throw new Error('报销金额必须大于 0');
      }
      if (payloadBase.sourceType === 'purchase' && !payloadBase.sourcePurchaseId) {
        throw new Error('请选择关联采购单');
      }

      let savedRecord: ReimbursementRecord;
      if (editingId) {
        const response = await fetch(`/api/reimbursements/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBase as UpdateReimbursementInput),
        });
        const body = (await response.json()) as ActionResponse;
        if (!response.ok || !body.success || !body.data) {
          throw new Error(body.error ?? '更新报销失败');
        }
        savedRecord = body.data;
      } else {
        const response = await fetch('/api/reimbursements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBase),
        });
        const body = (await response.json()) as ActionResponse;
        if (!response.ok || !body.success || !body.data) {
          throw new Error(body.error ?? '创建报销失败');
        }
        savedRecord = body.data;
      }

      if (intent === 'submit') {
        if (payloadBase.sourceType === 'purchase' && payloadBase.sourcePurchaseId) {
          const invoiceRequired = await resolvePurchaseInvoiceRequired(payloadBase.sourcePurchaseId);
          if (invoiceRequired == null) {
            throw new Error('无法校验采购单发票规则，请稍后重试');
          }
          if (invoiceRequired === true && (payloadBase.invoiceImages?.length ?? 0) === 0) {
            throw new Error('该采购单要求补充发票，提交报销前请先上传发票附件');
          }
        } else {
             // 直接报销验证
             if (form.hasInvoice && (payloadBase.invoiceImages?.length ?? 0) === 0) {
                 throw new Error('您标记了需要发票，请上传发票附件');
             }
             if (!form.hasInvoice && (payloadBase.receiptImages?.length ?? 0) === 0) {
                 throw new Error('您标记为无需发票，请上传收款凭证');
             }
        }
        await runAction(savedRecord.id, 'submit');
        toast.success('报销申请已提交审批');
      } else {
        toast.success(editingId ? '报销草稿已更新' : '报销草稿已创建');
      }

      setDrawerOpen(false);
      resetForm();
      await fetchList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
      setSubmitIntent(null);
    }
  }, [editingId, fetchList, form, resetForm, resolvePurchaseInvoiceRequired, runAction]);

  const handleDelete = useCallback(
    (row: ReimbursementRecord) => {
      if (!editable(row)) return;
      setDeleteTarget(row);
    },
    [editable]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/reimbursements/${deleteTarget.id}`, { method: 'DELETE' });
      const body = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? '删除失败');
      }
      toast.success('报销草稿已删除');
      setDeleteTarget(null);
      await fetchList();
      await fetchList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setActionLoading(false);
    }
  }, [deleteTarget, fetchList]);

  const handleSubmit = useCallback(
    async (row: ReimbursementRecord) => {
      if (row.sourceType === 'purchase' && row.sourcePurchaseId) {
        setActionLoading(true);
        const invoiceRequired = await resolvePurchaseInvoiceRequired(row.sourcePurchaseId);
        if (invoiceRequired == null) {
          toast.error('无法校验采购单发票规则，请稍后重试');
          setActionLoading(false);
          return;
        }
        if (invoiceRequired === true && (row.invoiceImages?.length ?? 0) === 0) {
          toast.error('该采购单要求补充发票，提交报销前请先上传发票附件');
          setActionLoading(false);
          return;
        }
        setActionLoading(false);
      } else if (!hasReimbursementEvidence(row)) {
        toast.error('请先上传发票或收款凭证后再提交');
        return;
      }

      setActionLoading(true);
      try {
        await runAction(row.id, 'submit');
        toast.success('已提交审批');
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '提交失败');
      } finally {
        setActionLoading(false);
      }
    },
    [fetchList, resolvePurchaseInvoiceRequired, runAction]
  );

  const handleApprove = useCallback(
    async (row: ReimbursementRecord) => {
      setActionLoading(true);
      try {
        await runAction(row.id, 'approve');
        toast.success('审批通过');
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '审批失败');
      } finally {
        setActionLoading(false);
      }
    },
    [fetchList, runAction]
  );

  const handleReject = useCallback(
    (row: ReimbursementRecord) => {
      setRejectTarget(row);
    },
    []
  );

  const confirmReject = useCallback(
    async (reason: string) => {
      if (!rejectTarget) return;
      setActionLoading(true);
      try {
        await runAction(rejectTarget.id, 'reject', { reason });
        toast.success('已驳回');
        setRejectTarget(null);
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '驳回失败');
      } finally {
        setActionLoading(false);
      }
    },
    [rejectTarget, fetchList, runAction]
  );



  const resolvePurchaseEntity = useCallback(async (id: string): Promise<PurchaseRecord | null> => {
    const found = purchaseMap.get(id);
    if (found) return found;
    const response = await fetch(`/api/purchases/${id}`, { headers: { Accept: 'application/json' } });
    const payload = (await response.json()) as { success: boolean; data?: PurchaseRecord; error?: string };
    if (!response.ok || !payload.success || !payload.data) return null;
    return payload.data;
  }, [purchaseMap]);

  const selectedPurchase = form.sourceType === 'purchase' ? purchaseMap.get(form.sourcePurchaseId?.trim() || '') ?? null : null;
  const selectedPurchaseInvoiceRequired = Boolean(
    selectedPurchase && selectedPurchase.invoiceType !== 'none' && selectedPurchase.invoiceStatus !== 'not_required'
  );
  const shouldShowEvidenceUpload =
    form.sourceType === 'purchase' ? selectedPurchaseInvoiceRequired : true;
  
  const showInvoiceUpload = form.sourceType === 'purchase' ? selectedPurchaseInvoiceRequired : form.hasInvoice;
  const isReadOnlyView = detailMode;

  const handlePay = useCallback(
    (row: ReimbursementRecord) => {
      setPayTarget(row);
    },
    []
  );

  const confirmPay = useCallback(
    async (note: string) => {
      if (!payTarget) return;
      setActionLoading(true);
      try {
        await runAction(payTarget.id, 'pay', { note });
        toast.success('已标记打款');
        setPayTarget(null);
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '打款失败');
      } finally {
        setActionLoading(false);
      }
    },
    [payTarget, fetchList, runAction]
  );
  


  useKeyboardShortcuts({
    onEnter: () => {
      if (
        drawerOpen &&
        !submitting &&
        !isReadOnlyView &&
        !(form.sourceType === 'purchase' && eligibility != null && !eligibility.eligible)
      ) {
        void submitForm('submit');
      }
    },
    onEscape: () => {
      if (drawerOpen && !submitting) {
        setDrawerOpen(false);
      } else if (detailDrawerOpen) {
        setDetailDrawerOpen(false);
      }
    },
    enabled: drawerOpen || detailDrawerOpen,
  });

  return (
    <section className="space-y-4">
      <div className="surface-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {scopeOptions.length > 1 && (
            <Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="按单号/标题/分类搜索"
            className="w-[260px]"
          />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
            导出
          </Button>
          <Button variant="outline" size="sm" onClick={() => void fetchList()} disabled={loading}>
            刷新
          </Button>
          {canCreate && <Button size="sm" onClick={openCreateDrawer}>发起报销</Button>}
        </div>
      </div>

      <div className="surface-card flex-1 min-h-0 flex flex-col">
        {/* Mobile View */}
        <div className="md:hidden space-y-3 p-4 overflow-y-auto">
          {loading ? (
            <div className="text-center text-muted-foreground p-4">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-center text-muted-foreground p-4">暂无报销记录</div>
          ) : (
            records.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{row.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{row.reimbursementNumber}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_STYLES[row.status]}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                    onCheckedChange={(checked: boolean | 'indeterminate') => handleSelect(row.id, !!checked)}
                      aria-label="Select row"
                    />
                  </div>
                </div>
                
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span>申请人</span>
                    <span className="text-foreground font-medium">{row.applicantName || '未知'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>来源</span>
                    <span className="text-foreground">{SOURCE_LABELS[row.sourceType]}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>组织</span>
                    <span className="text-foreground">{ORG_LABELS[row.organizationType]}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>金额</span>
                    <span className="text-foreground font-medium">{MONEY.format(row.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>关联单号</span>
                    <span className="text-foreground truncate max-w-[150px]">{row.sourcePurchaseNumber ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>发生日期</span>
                    <span className="text-foreground">{toDateInputValue(row.occurredAt)}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-dashed flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => openDetailDrawer(row)}>
                    详情
                  </Button>
                  {editable(row) && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => openEditDrawer(row)}>
                        编辑
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 px-3 text-destructive hover:text-destructive" onClick={() => void handleDelete(row)}>
                        删除
                      </Button>
                    </>
                  )}
                  {isOwner(row) && (row.status === 'draft' || row.status === 'rejected') && (
                    <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => void handleSubmit(row)}>
                      提交
                    </Button>
                  )}
                  {canApprove && row.status === 'pending_approval' && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 px-3 text-destructive hover:text-destructive" onClick={() => void handleReject(row)}>
                        驳回
                      </Button>
                      {!canPay ? (
                        <Button size="sm" variant="default" className="h-8 px-3" onClick={() => void handleApprove(row)}>
                          通过
                        </Button>
                      ) : null}
                    </>
                  )}
                  {canOperatePay(row) && (
                    <Button size="sm" variant="default" className="h-8 px-3" onClick={() => handlePay(row)}>
                      标记打款
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:flex md:flex-col flex-1 min-h-0">
          <Table stickyHeader scrollAreaClassName="custom-scrollbar max-h-[calc(100vh-280px)]" className="whitespace-nowrap">
            <TableHeader className="bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-12 px-4 text-center">
                  <Checkbox
                    checked={records.length > 0 && selectedIds.length === records.length}
                    onCheckedChange={(checked: boolean | 'indeterminate') => handleSelectAll(!!checked)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>报销单号</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>申请人</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>关联采购单</TableHead>
                <TableHead>组织</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>发生日期</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    暂无报销记录
                  </TableCell>
                </TableRow>
              ) : (
                records.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="px-4 text-center">
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={(checked: boolean | 'indeterminate') => handleSelect(row.id, !!checked)}
                        aria-label="Select row"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.reimbursementNumber}</TableCell>
                    <TableCell className="min-w-[150px] whitespace-normal">
                      <div className="max-w-[200px] truncate" title={row.title}>
                        {row.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.applicantName || '未知'}
                    </TableCell>
                    <TableCell>{SOURCE_LABELS[row.sourceType]}</TableCell>
                    <TableCell className="font-mono text-xs">{row.sourcePurchaseNumber ?? '-'}</TableCell>
                    <TableCell>{ORG_LABELS[row.organizationType]}</TableCell>
                    <TableCell className="font-medium">{MONEY.format(row.amount)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </TableCell>
                    <TableCell>{toDateInputValue(row.occurredAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDetailDrawer(row)}>
                          详情
                        </Button>
                        {editable(row) && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEditDrawer(row)}>
                              编辑
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => void handleDelete(row)}>
                              删除
                            </Button>
                          </>
                        )}
                        {isOwner(row) && (row.status === 'draft' || row.status === 'rejected') && (
                          <Button size="sm" variant="outline" onClick={() => void handleSubmit(row)}>
                            提交
                          </Button>
                        )}
                        {canApprove && row.status === 'pending_approval' && (
                          <>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => void handleReject(row)}>
                              驳回
                            </Button>
                            {!canPay ? (
                              <Button size="sm" variant="default" onClick={() => void handleApprove(row)}>
                                通过
                              </Button>
                            ) : null}
                          </>
                        )}
                        {canOperatePay(row) && (
                          <Button size="sm" variant="default" onClick={() => handlePay(row)}>
                            标记打款
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Desktop & Mobile container */}
        {totalItems > pageSize && (
          <div className="surface-card mt-3 flex flex-col md:flex-row items-center justify-between gap-4 p-4 text-sm text-muted-foreground">
            <div>
              共 {totalItems} 条 · 第 {page} / {Math.ceil(totalItems / pageSize)} 页
            </div>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(totalItems / pageSize)}
              onPageChange={handlePageChange}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) resetForm();
        }}
        direction="right"
      >
          <DrawerContent side="right" className="w-full max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>{editingId ? '编辑报销草稿' : '发起报销'}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">报销来源</div>
                <Select
                  value={form.sourceType}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      sourceType: value as ReimbursementSourceType,
                      category: value === 'purchase' ? '采购报销' : prev.category,
                      details: normalizeDetailsByCategory(value === 'purchase' ? '采购报销' : prev.category, prev.details),
                      sourcePurchaseId: value === 'purchase' ? prev.sourcePurchaseId ?? '' : '',
                      hasInvoice: value === 'direct' ? true : prev.hasInvoice,
                    }))
                  }
                disabled={isReadOnlyView}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">直接报销</SelectItem>
                    <SelectItem value="purchase">关联采购</SelectItem>
                  </SelectContent>
                </Select>
              </div>



              <div className="space-y-2">
                <div className="text-sm font-medium">是否需要发票</div>
                <div className="flex h-10 items-center gap-2">
                  <Switch
                    id="has-invoice-switch"
                    checked={form.sourceType === 'purchase' ? (selectedPurchaseInvoiceRequired ?? false) : form.hasInvoice}
                    onCheckedChange={(checked) => {
                      if (form.sourceType === 'direct') {
                        setForm((prev) => ({ ...prev, hasInvoice: checked }));
                      }
                    }}
                    disabled={isReadOnlyView || form.sourceType === 'purchase'}
                  />
                  <Label htmlFor="has-invoice-switch" className="text-xs text-muted-foreground font-normal cursor-pointer">
                    {form.sourceType === 'purchase'
                      ? (selectedPurchaseInvoiceRequired ? '关联采购单要求发票' : '关联采购单无需发票')
                      : (form.hasInvoice ? '需上传发票附件' : '无需发票，建议上传收款凭证')}
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">组织</div>
                <Select
                  value={form.organizationType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, organizationType: value as ReimbursementOrganizationType }))
                  }
                  disabled={isReadOnlyView || form.sourceType === 'purchase'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">学校</SelectItem>
                    <SelectItem value="company">单位</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.sourceType === 'purchase' && (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">关联采购单</div>
                  <SearchableEntitySelect<PurchaseRecord>
                    value={form.sourcePurchaseId?.trim() || ''}
                    onChange={(value, entity) => {
                      const picked = entity ?? purchaseMap.get(value);
                      setForm((prev) => ({
                        ...prev,
                        sourcePurchaseId: value,
                        organizationType: (picked?.organizationType ?? prev.organizationType) as ReimbursementOrganizationType,
                        // Sync basic info
                        title: picked ? `${picked?.itemName ?? '采购'}报销` : prev.title,
                        amount: picked ? Number(picked.totalAmount) + Number(picked.feeAmount ?? 0) : prev.amount,
                        occurredAt: picked ? toDateInputValue(picked.purchaseDate) : prev.occurredAt,
                        description: picked?.notes?.trim() ? `采购备注：${picked.notes}` : prev.description,
                        details: {
                          ...(prev.details ?? {}),
                          purchaseUsage: picked?.purpose?.trim() || prev.details?.purchaseUsage || '',
                          inboundNote: picked?.notes?.trim() || prev.details?.inboundNote || '',
                        },
                      }));
                    }}
                    fetchEntities={fetchPurchaseEntities}
                    resolveEntity={resolvePurchaseEntity}
                    mapOption={(item) => ({
                      id: item.id,
                      label: `${item.purchaseNumber} · ${item.itemName}`,
                      description: `${item.organizationType === 'school' ? '学校' : '单位'} · ${MONEY.format(Number(item.totalAmount) + Number(item.feeAmount ?? 0))}`,
                      data: item,
                    })}
                    placeholder={purchaseLoading ? '加载采购单中...' : '请选择采购单'}
                    searchPlaceholder="输入采购单号或物品搜索"
                    emptyText="暂无可关联采购单"
                    panelClassName="w-[460px]"
                    disabled={purchaseLoading || isReadOnlyView}
                  />
                </div>
                {eligibilityChecking ? (
                  <p className="text-xs text-muted-foreground">正在校验关联采购单是否已入库...</p>
                ) : eligibility ? (
                  eligibility.eligible ? (
                    <p className="text-xs text-chart-5">该采购单已满足入库条件，可关联报销。</p>
                  ) : (
                    <p className="text-xs text-destructive">{eligibility.reason ?? '该采购单暂不可关联报销'}</p>
                  )
                ) : null}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">报销分类</div>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      category: value,
                      details: normalizeDetailsByCategory(value, prev.details),
                    }))
                  }
                  disabled={isReadOnlyView}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REIMBURSEMENT_CATEGORY_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">发生日期</div>
                <DatePicker
                  value={form.occurredAt}
                  onChange={(value) => setForm((prev) => ({ ...prev, occurredAt: value }))}
                  clearable={false}
                  placeholder="选择发生日期"
                  disabled={isReadOnlyView || form.sourceType === 'purchase'}
                />
              </div>
            </div>

            {(REIMBURSEMENT_CATEGORY_FIELDS[form.category] ?? []).length > 0 ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="text-sm font-medium">分类信息</div>
                <div className="grid gap-4 md:grid-cols-2">
                  {(REIMBURSEMENT_CATEGORY_FIELDS[form.category] ?? []).map((field) => {
                    const value = form.details?.[field.key] ?? '';
                    const label = (
                      <div className="text-sm font-medium">
                        {field.label}
                        {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                      </div>
                    );
                    if (field.type === 'textarea') {
                      return (
                        <div key={field.key} className="space-y-2 md:col-span-2">
                          {label}
                          <Textarea
                            value={value}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                details: { ...(prev.details ?? {}), [field.key]: event.target.value },
                              }))
                            }
                            placeholder={field.placeholder}
                            rows={3}
                            disabled={isReadOnlyView}
                          />
                        </div>
                      );
                    }
                    if (field.type === 'select' && field.options?.length) {
                      return (
                        <div key={field.key} className="space-y-2">
                          {label}
                          <Select
                            value={value}
                            onValueChange={(nextValue) =>
                              setForm((prev) => ({
                                ...prev,
                                details: { ...(prev.details ?? {}), [field.key]: nextValue },
                              }))
                            }
                            disabled={isReadOnlyView}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={field.placeholder || `请选择${field.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    }
                    if (field.type === 'date') {
                      return (
                        <div key={field.key} className="space-y-2">
                          {label}
                          <DatePicker
                            value={value}
                            onChange={(nextValue) =>
                              setForm((prev) => ({
                                ...prev,
                                details: { ...(prev.details ?? {}), [field.key]: nextValue },
                              }))
                            }
                            clearable={!field.required}
                            placeholder={field.placeholder || `选择${field.label}`}
                            disabled={isReadOnlyView}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={field.key} className="space-y-2">
                        {label}
                        <Input
                          value={value}
                          type={field.type === 'number' ? 'number' : 'text'}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              details: { ...(prev.details ?? {}), [field.key]: event.target.value },
                            }))
                          }
                          placeholder={field.placeholder}
                          disabled={isReadOnlyView}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">标题</div>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="例如：打车报销（客户拜访）"
                  disabled={isReadOnlyView}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">金额</div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))}
                  disabled={isReadOnlyView}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">说明</div>
              <Textarea
                value={form.description ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="可选说明"
                rows={3}
                disabled={isReadOnlyView}
              />
            </div>

            {shouldShowEvidenceUpload ? (
              <>
                <div className="space-y-3 rounded-xl border border-border/60 p-3">
                  <div>
                    <div className="text-sm font-medium">收款凭证</div>
                    <p className="text-xs text-muted-foreground">

                      {form.sourceType === 'purchase'
                        ? '该采购单标记为有发票，请在下方“发票附件”上传发票；此处可补充收款凭证。'
                        : form.hasInvoice 
                          ? '直接报销需至少上传发票或收款凭证其中一项。'
                          : '您标记为无需发票，请上传收款凭证。'}
                    </p>
                  </div>
                  <FileUpload
                    files={form.receiptImages ?? []}
                    onChange={(files) => setForm((prev) => ({ ...prev, receiptImages: files }))}
                    maxFiles={8}
                    folder="reimbursements/receipts"
                    prefix="receipt"
                    buttonLabel="上传收款凭证"
                    helperText="支持 JPG/PNG/PDF，每个文件 ≤5MB"
                    disabled={submitting}
                    readOnly={isReadOnlyView}
                  />
                </div>



                {showInvoiceUpload && (
                  <div className="space-y-3 rounded-xl border border-border/60 p-3">
                    <div className="text-sm font-medium">发票附件</div>
                    <FileUpload
                      files={form.invoiceImages ?? []}
                      onChange={(files) => setForm((prev) => ({ ...prev, invoiceImages: files }))}
                      maxFiles={8}
                      folder="reimbursements/invoices"
                      prefix="invoice"
                      buttonLabel="上传发票"
                      helperText="支持 JPG/PNG/PDF，每个文件 ≤5MB"
                      disabled={submitting}
                      readOnly={isReadOnlyView}
                    />
                  </div>
                )}
              </>
            ) : null}

            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="text-sm font-medium">其他附件</div>
              <FileUpload
                files={form.attachments ?? []}
                onChange={(files) => setForm((prev) => ({ ...prev, attachments: files }))}
                maxFiles={10}
                folder="reimbursements/attachments"
                prefix="attachment"
                buttonLabel="上传附件"
                helperText="可上传报销明细、行程单等材料"
                disabled={submitting}
                readOnly={isReadOnlyView}
              />
            </div>

            {editingId ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="text-sm font-medium">流程节点</div>
                <WorkflowStepList logs={currentLogs} />
              </div>
            ) : null}


          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void submitForm('draft')}
              disabled={
                submitting ||
                (form.sourceType === 'purchase' && eligibility != null && !eligibility.eligible)
              }
            >
              {submitting && submitIntent === 'draft' ? '保存中...' : editingId ? '保存修改' : '保存草稿'}
            </Button>
            <Button
              size="sm"
              onClick={() => void submitForm('submit')}
              disabled={
                submitting ||
                (form.sourceType === 'purchase' && eligibility != null && !eligibility.eligible)
              }
            >
              {submitting && submitIntent === 'submit' ? '提交中...' : '提交报销'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ReimbursementDetailDrawer
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        record={detailRecord}
        onSuccess={() => void fetchList()}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除报销草稿 &quot;{deleteTarget?.title}&quot;。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RejectionReasonDialog
        open={!!rejectTarget}
        onClose={() => !actionLoading && setRejectTarget(null)}
        onSubmit={confirmReject}
        submitting={actionLoading}
        title="驳回报销申请"
        description="请填写驳回原因，提交后申请人将收到通知。"
      />

      <PaymentConfirmDialog
        open={!!payTarget}
        onClose={() => !actionLoading && setPayTarget(null)}
        onSubmit={confirmPay}
        submitting={actionLoading}
      />

      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4 py-2 px-4 bg-background border shadow-2xl rounded-full">
            <span className="text-sm font-medium whitespace-nowrap pl-2">
              已选中 <span className="text-primary">{selectedIds.length}</span> 项
            </span>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              {canApprove && (
                <Button 
                  size="sm" 
                  onClick={handleBatchApprove}
                  disabled={batchActionLoading}
                  className="h-8 rounded-full"
                >
                  批量通过
                </Button>
              )}
              {canPay && (
                <Button 
                  size="sm" 
                  onClick={handleBatchPay}
                  disabled={batchActionLoading}
                  className="h-8 rounded-full"
                >
                  批量打款
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedIds([])}
                className="h-8 rounded-full"
              >
                取消选中
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
