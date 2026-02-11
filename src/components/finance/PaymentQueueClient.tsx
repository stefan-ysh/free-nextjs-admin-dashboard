'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import PurchaseDetailModal from '@/components/purchases/PurchaseDetailModal';
import PurchasePayDialog from '@/components/purchases/PurchasePayDialog';
import PaymentIssueDialog from '@/components/purchases/PaymentIssueDialog';
import DataState from '@/components/common/DataState';
import Pagination from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateOnly } from '@/lib/dates';
import type {
  PaymentQueueStatus,
  PurchaseDetail,
  PurchasePaymentQueueItem,
  PurchaseRecord,
} from '@/types/purchase';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

const STATUS_OPTIONS: Array<{ key: PaymentQueueStatus; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待付款' },
  { key: 'processing', label: '付款中' },
  { key: 'issue', label: '付款异常' },
  { key: 'paid', label: '已付款' },
];

type PaymentQueueResponse = {
  success: boolean;
  data?: {
    items: PurchasePaymentQueueItem[];
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

function getPaymentStatusLabel(purchase: PurchasePaymentQueueItem) {
  if (purchase.paymentIssueOpen) {
    return { label: '付款异常', variant: 'destructive' as const };
  }
  if (purchase.status === 'paid' || purchase.remainingAmount <= 0) {
    return { label: '已付款', variant: 'success' as const };
  }
  if (purchase.paidAmount > 0) {
    return { label: '付款中', variant: 'warning' as const };
  }
  return { label: '待付款', variant: 'secondary' as const };
}

export default function PaymentQueueClient() {
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const [status, setStatus] = useState<PaymentQueueStatus>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<PurchasePaymentQueueItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [batchPayOpen, setBatchPayOpen] = useState(false);
  const [batchResolveOpen, setBatchResolveOpen] = useState(false);
  const [payDialog, setPayDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });
  const [issueDialog, setIssueDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; purchase: PurchaseRecord | PurchaseDetail | null }>({
    open: false,
    purchase: null,
  });

  const canPay = hasPermission('PURCHASE_PAY');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchQueue = useCallback(async () => {
    if (permissionLoading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const response = await fetch(`/api/finance/payments?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('加载付款队列失败');
      const payload: PaymentQueueResponse = await response.json();
      if (!payload.success || !payload.data) throw new Error(payload.error || '加载付款队列失败');
      setRecords(payload.data.items);
      setTotal(payload.data.total);
    } catch (err) {
      console.error('加载付款队列失败', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [permissionLoading, page, pageSize, status, debouncedSearch]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue, reloadToken]);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [status, debouncedSearch, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

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
        console.error('付款操作失败', err);
        toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试');
        return false;
      } finally {
        setMutatingId(null);
      }
    },
    [loadPurchaseDetail]
  );

  const handleView = useCallback((purchase: PurchasePaymentQueueItem) => {
    void loadPurchaseDetail(purchase.id);
  }, [loadPurchaseDetail]);

  const handlePay = useCallback((purchase: PurchaseRecord | PurchasePaymentQueueItem | PurchaseDetail) => {
    setPayDialog({ open: true, purchase });
  }, []);

  const handleIssue = useCallback((purchase: PurchaseRecord | PurchasePaymentQueueItem | PurchaseDetail) => {
    setIssueDialog({ open: true, purchase });
  }, []);

  const handleResolve = useCallback((purchase: PurchaseRecord | PurchasePaymentQueueItem | PurchaseDetail) => {
    setResolveDialog({ open: true, purchase });
  }, []);

  const handlePaySubmit = async (amount: number, note?: string) => {
    if (!payDialog.purchase) return;
    const success = await performAction(payDialog.purchase.id, 'pay', { amount, note }, { successMessage: '打款已记录' });
    if (success) {
      setPayDialog({ open: false, purchase: null });
    }
  };

  const handleIssueSubmit = async (reason: string) => {
    if (!issueDialog.purchase) return;
    const success = await performAction(issueDialog.purchase.id, 'issue', { comment: reason }, { successMessage: '已标记付款异常' });
    if (success) {
      setIssueDialog({ open: false, purchase: null });
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolveDialog.purchase) return;
    const success = await performAction(resolveDialog.purchase.id, 'resolve_issue', {}, { successMessage: '已解除付款异常' });
    if (success) {
      setResolveDialog({ open: false, purchase: null });
    }
  };

  const toggleSelect = (purchaseId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(purchaseId);
      } else {
        next.delete(purchaseId);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    const next = new Set(records.map((item) => item.id));
    setSelectedIds(next);
  };

  const selectedRecords = records.filter((item) => selectedIds.has(item.id));
  const selectedCount = selectedRecords.length;
  const eligiblePayRecords = selectedRecords.filter(
    (item) => item.status === 'approved' && item.remainingAmount > 0 && !item.paymentIssueOpen
  );
  const eligibleIssueRecords = selectedRecords.filter(
    (item) => item.status === 'approved' && !item.paymentIssueOpen
  );
  const eligibleResolveRecords = selectedRecords.filter(
    (item) => item.status === 'approved' && item.paymentIssueOpen
  );
  const selectedRemainingAmount = eligiblePayRecords.reduce((sum, item) => sum + (item.remainingAmount ?? 0), 0);

  const handleBatchIssue = async (reason: string) => {
    if (!eligibleIssueRecords.length) return;
    let successCount = 0;
    for (const item of eligibleIssueRecords) {
      const ok = await performAction(item.id, 'issue', { comment: reason });
      if (ok) successCount += 1;
    }
    toast.success(`已标记 ${successCount} 条异常`);
    setSelectedIds(new Set());
  };

  const handleBatchPay = async () => {
    if (!eligiblePayRecords.length) return;
    let successCount = 0;
    for (const item of eligiblePayRecords) {
      const amount = Number(item.remainingAmount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const ok = await performAction(item.id, 'pay', { amount }, { successMessage: '批量打款已提交' });
      if (ok) successCount += 1;
    }
    toast.success(`批量打款完成：${successCount} 条`);
    setSelectedIds(new Set());
    setBatchPayOpen(false);
  };

  const handleBatchResolve = async () => {
    if (!eligibleResolveRecords.length) return;
    let successCount = 0;
    for (const item of eligibleResolveRecords) {
      const ok = await performAction(item.id, 'resolve_issue', {});
      if (ok) successCount += 1;
    }
    toast.success(`已解除 ${successCount} 条异常`);
    setSelectedIds(new Set());
    setBatchResolveOpen(false);
  };

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ status });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const response = await fetch(`/api/finance/payments/export?${params.toString()}`, {
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
      link.download = `payments-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('付款队列已导出');
    } catch (error) {
      console.error('导出付款队列失败', error);
      toast.error(error instanceof Error ? error.message : '导出失败，请稍后再试');
    } finally {
      setExporting(false);
    }
  }, [exporting, status, debouncedSearch]);

  const handleExportSelected = useCallback(async () => {
    if (exporting || selectedIds.size === 0) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ ids: Array.from(selectedIds).join(',') });
      const response = await fetch(`/api/finance/payments/export?${params.toString()}`, {
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
      link.download = `payments-selected-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('选中记录已导出');
    } catch (error) {
      console.error('导出选中付款记录失败', error);
      toast.error(error instanceof Error ? error.message : '导出失败，请稍后再试');
    } finally {
      setExporting(false);
    }
  }, [exporting, selectedIds]);

  const permissions = useMemo(
    () => ({
      canEdit: false,
      canDelete: false,
      canDuplicate: false,
      canSubmit: false,
      canApprove: false,
      canTransfer: false,
      canReject: false,
      canPay,
      canSubmitReimbursement: false,
      canWithdraw: false,
    }),
    [canPay]
  );

  const renderActions = (purchase: PurchasePaymentQueueItem) => {
    const busy = mutatingId === purchase.id;
    const canPayNow = canPay && purchase.status === 'approved' && purchase.remainingAmount > 0 && !purchase.paymentIssueOpen;
    const canMarkIssue = canPay && purchase.status === 'approved' && !purchase.paymentIssueOpen;
    const canResolveIssue = canPay && purchase.status === 'approved' && purchase.paymentIssueOpen;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => handleView(purchase)}>
          查看
        </Button>
        {canPayNow ? (
          <Button size="sm" onClick={() => handlePay(purchase)} disabled={busy}>
            办理付款
          </Button>
        ) : null}
        {canMarkIssue ? (
          <Button variant="destructive" size="sm" onClick={() => handleIssue(purchase)} disabled={busy}>
            标记异常
          </Button>
        ) : null}
        {canResolveIssue ? (
          <Button variant="outline" size="sm" onClick={() => handleResolve(purchase)} disabled={busy}>
            解除异常
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">财务中心</p>
          <h1 className="text-2xl font-semibold text-foreground">付款任务队列</h1>
          <p className="mt-1 text-sm text-muted-foreground">集中处理已审批采购的付款记录与异常标记。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? '导出中...' : '导出 CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSelected}
            disabled={exporting || selectedIds.size === 0}
          >
            导出选中
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            打印
          </Button>
        </div>
      </div>

      <div className="surface-panel">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option.key}
                type="button"
                variant={status === option.key ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatus(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="ml-auto w-full max-w-xs">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索单号 / 物品 / 供应商"
            />
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              已选择 {selectedCount} 条，可打款 {eligiblePayRecords.length} 条，待付合计 {currencyFormatter.format(selectedRemainingAmount)}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setBatchPayOpen(true)} disabled={!canPay || eligiblePayRecords.length === 0}>
                批量打款（按剩余）
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIssueDialog({ open: true, purchase: null })}
                disabled={!canPay || eligibleIssueRecords.length === 0}
              >
                批量标记异常
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchResolveOpen(true)}
                disabled={!canPay || eligibleResolveRecords.length === 0}
              >
                批量解除异常
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                清空选择
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="p-6">
            <DataState variant="loading" title="正在加载付款队列" description="请稍候，系统正在同步付款信息" />
          </div>
        ) : error ? (
          <div className="p-6">
            <DataState variant="empty" title="加载失败" description={error} />
          </div>
        ) : records.length === 0 ? (
          <div className="p-6">
            <DataState variant="empty" title="暂无付款任务" description="当前筛选条件下没有需要处理的付款记录" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="md:hidden space-y-3 px-4 py-4">
              {records.map((purchase) => {
                const statusBadge = getPaymentStatusLabel(purchase);
                const busy = mutatingId === purchase.id;
                return (
                  <div key={purchase.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{purchase.itemName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">单号：{purchase.purchaseNumber}</div>
                        <div className="mt-1 text-xs text-muted-foreground">供应商：{purchase.supplierName ?? '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedIds.has(purchase.id)}
                          onCheckedChange={(checked) => toggleSelect(purchase.id, Boolean(checked))}
                        />
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>总金额</span>
                        <span className="text-foreground">{currencyFormatter.format(purchase.totalAmount + (purchase.feeAmount ?? 0))}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>已付款</span>
                        <span className="text-foreground">{currencyFormatter.format(purchase.paidAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>待付款</span>
                        <span className="text-foreground">{currencyFormatter.format(purchase.remainingAmount)}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2 text-xs">
                      <Button variant="outline" size="sm" onClick={() => handleView(purchase)}>
                        查看
                      </Button>
                      {canPay && purchase.status === 'approved' && purchase.remainingAmount > 0 && !purchase.paymentIssueOpen ? (
                        <Button size="sm" onClick={() => handlePay(purchase)} disabled={busy}>
                          办理付款
                        </Button>
                      ) : null}
                      {canPay && purchase.status === 'approved' && !purchase.paymentIssueOpen ? (
                        <Button variant="destructive" size="sm" onClick={() => handleIssue(purchase)} disabled={busy}>
                          标记异常
                        </Button>
                      ) : null}
                      {canPay && purchase.status === 'approved' && purchase.paymentIssueOpen ? (
                        <Button variant="outline" size="sm" onClick={() => handleResolve(purchase)} disabled={busy}>
                          解除异常
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[48px]">
                      <Checkbox
                        checked={selectedCount > 0 && selectedCount === records.length}
                        onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      />
                    </TableHead>
                    <TableHead>采购信息</TableHead>
                    <TableHead>供应商</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>付款进度</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((purchase) => {
                    const statusBadge = getPaymentStatusLabel(purchase);
                    return (
                      <TableRow key={purchase.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(purchase.id)}
                            onCheckedChange={(checked) => toggleSelect(purchase.id, Boolean(checked))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">{purchase.itemName}</div>
                            <div className="text-xs text-muted-foreground">单号：{purchase.purchaseNumber}</div>
                            <div className="text-xs text-muted-foreground">采购日期：{formatDateOnly(purchase.purchaseDate) ?? purchase.purchaseDate}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{purchase.supplierName ?? '—'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{currencyFormatter.format(purchase.totalAmount + (purchase.feeAmount ?? 0))}</div>
                          <div className="text-xs text-muted-foreground">已付 {currencyFormatter.format(purchase.paidAmount)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">待付 {currencyFormatter.format(purchase.remainingAmount)}</div>
                          {purchase.paymentIssueOpen ? (
                            <div className="text-xs text-rose-500">{purchase.paymentIssueReason ?? '异常处理中'}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                        </TableCell>
                        <TableCell>{renderActions(purchase)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
              <p className="text-xs text-muted-foreground">共 {total} 条付款记录</p>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>

      {selectedPurchase ? (
        <PurchaseDetailModal
          purchase={selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          permissions={permissions}
          busy={mutatingId === selectedPurchase.id}
          detailLoading={detailLoading}
          detailError={detailError}
          onReloadDetail={() => loadPurchaseDetail(selectedPurchase.id)}
          onPay={(purchase) => handlePay(purchase)}
        />
      ) : null}

      <PurchasePayDialog
        open={payDialog.open}
        purchase={payDialog.purchase}
        onOpenChange={(open) => setPayDialog({ open, purchase: open ? payDialog.purchase : null })}
        onSubmit={handlePaySubmit}
        busy={Boolean(payDialog.purchase && mutatingId === payDialog.purchase.id)}
      />

      <PaymentIssueDialog
        open={issueDialog.open}
        onClose={() => setIssueDialog({ open: false, purchase: null })}
        onSubmit={(reason) => {
          if (issueDialog.purchase) {
            return handleIssueSubmit(reason);
          }
          return handleBatchIssue(reason);
        }}
        submitting={Boolean(issueDialog.purchase && mutatingId === issueDialog.purchase.id)}
      />

      <Dialog open={batchPayOpen} onOpenChange={setBatchPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量打款确认</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>即将对 {eligiblePayRecords.length} 条记录按剩余金额打款。</p>
            <p>合计金额：{currencyFormatter.format(selectedRemainingAmount)}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBatchPayOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchPay} disabled={!canPay || eligiblePayRecords.length === 0}>
              确认批量打款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchResolveOpen} onOpenChange={setBatchResolveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量解除异常</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>即将解除 {eligibleResolveRecords.length} 条付款异常。</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBatchResolveOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchResolve} disabled={!canPay || eligibleResolveRecords.length === 0}>
              确认解除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveDialog.open} onOpenChange={(open) => setResolveDialog({ open, purchase: open ? resolveDialog.purchase : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>解除付款异常</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            确认解除付款异常标记？解除后该记录将恢复为可付款状态。
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResolveDialog({ open: false, purchase: null })}>
              取消
            </Button>
            <Button onClick={handleResolveSubmit}>
              确认解除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
