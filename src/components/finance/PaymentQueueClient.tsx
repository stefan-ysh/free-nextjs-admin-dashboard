'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import PaymentConfirmDialog from '@/components/reimbursements/PaymentConfirmDialog';


import DataState from '@/components/common/DataState';
import Pagination from '@/components/tables/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { usePermissions } from '@/hooks/usePermissions';
import type { ReimbursementRecord, ReimbursementStatus } from '@/types/reimbursement';
import { cn } from '@/lib/utils';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

type ReimbursementListResponse = {
  success: boolean;
  data?: {
    items: ReimbursementRecord[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
};

function getReimbursementStatusConfig(status: ReimbursementStatus) {
  switch (status) {
    case 'pending_approval':
      return { label: '待打款', className: 'badge-premium badge-premium-warning' };
    case 'approved':
      return { label: '待打款', className: 'badge-premium badge-premium-info' };
    case 'paid':
      return { label: '已打款', className: 'badge-premium badge-premium-success' };
    case 'rejected':
      return { label: '已驳回', className: 'badge-premium badge-premium-error' };
    case 'draft':
      return { label: '草稿', className: 'badge-premium badge-premium-secondary' };
    default:
      return { label: status, className: 'badge-premium badge-premium-secondary' };
  }
}

function getInitials(name?: string | null) {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
}

export default function PaymentQueueClient() {
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<ReimbursementRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reimbursement State
  const [reimbursementRecords, setReimbursementRecords] = useState<ReimbursementRecord[]>([]);
  const [reimbursementPage, setReimbursementPage] = useState(1);
  const [reimbursementTotal, setReimbursementTotal] = useState(0);


  const [pageSize] = useState(20);
  const [reloadToken, setReloadToken] = useState(0);

  const canPay = hasPermission('REIMBURSEMENT_PAY');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Reset page when search changes
  useEffect(() => {
    setReimbursementPage(1);
  }, [debouncedSearch]);

  const fetchReimbursements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        scope: 'pay',
        page: String(reimbursementPage),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const response = await fetch(`/api/reimbursements?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as ReimbursementListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '加载报销列表失败');
      }
      setReimbursementRecords(payload.data.items);
      setReimbursementTotal(payload.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, reimbursementPage, pageSize]);

  useEffect(() => {
    if (permissionLoading || !canPay) return;
    void fetchReimbursements();
  }, [permissionLoading, canPay, fetchReimbursements, reloadToken]);

  const handlePayConfirm = useCallback(
    async (note: string) => {
      if (!payTarget) return;
      setSubmitting(true);
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
        setReloadToken((t) => t + 1);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '打款失败');
      } finally {
        setSubmitting(false);
      }
    },
    [payTarget]
  );

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(reimbursementTotal / pageSize));
  }, [reimbursementTotal, pageSize]);

  if (permissionLoading) {
    return (
      <section className="surface-panel p-6">
        <p className="text-sm text-muted-foreground">正在加载权限信息...</p>
      </section>
    );
  }

  if (!canPay) {
    return (
      <section className="surface-panel p-6">
        <p className="text-sm text-muted-foreground">无权访问付款处理。</p>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">财务中心</p>
          <h1 className="text-2xl font-semibold text-foreground">付款处理</h1>
          <p className="mt-1 text-sm text-muted-foreground">统一处理报销打款任务。</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      <div className="surface-panel flex-1 min-h-0 flex flex-col border-0 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-4 bg-muted/20">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索报销单号 / 标题"
              className="pl-8 bg-background"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
              <span className="flex h-6 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-bold text-primary">
                {reimbursementTotal}
              </span>
              <span className="text-xs text-muted-foreground">待处理</span>
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <DataState variant="loading" title="正在加载数据" description="请稍候..." />
          </div>
        ) : error ? (
          <div className="p-6">
            <DataState variant="empty" title="加载失败" description={error} />
          </div>
        ) : reimbursementRecords.length === 0 ? (
          <div className="p-6">
            <DataState variant="empty" title="暂无待处理任务" description="所有报销单据均已完成打款" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="hidden md:flex flex-col flex-1 min-h-0">
              <Table stickyHeader scrollAreaClassName="max-h-full custom-scrollbar" className="text-sm whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[180px] pl-6">报销单号</TableHead>
                    <TableHead className="min-w-[200px]">标题</TableHead>
                    <TableHead>申请人</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>来源 / 组织</TableHead>
                    <TableHead>提交日期</TableHead>
                    <TableHead className="text-right pr-6">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reimbursementRecords.map((item) => {
                      const statusConfig = getReimbursementStatusConfig(item.status);
                      return (
                        <TableRow 
                            key={item.id} 
                            className="group transition-colors hover:bg-muted/40 cursor-pointer"
                            onClick={() => setPayTarget(item)}
                        >
                          <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                              {item.reimbursementNumber}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                              {item.title}
                          </TableCell>
                          <TableCell>
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(item.applicantName)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm text-foreground/80">{item.applicantName || '未知用户'}</span>
                                </div>
                          </TableCell>
                          <TableCell className="font-medium tracking-tight">
                              {currencyFormatter.format(item.amount)}
                          </TableCell>
                          <TableCell>
                            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium capitalize", statusConfig.className)}>
                                {statusConfig.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                              <div className="flex flex-col gap-0.5">
                                  <span>{item.sourceType === 'purchase' ? '关联采购' : '直接报销'}</span>
                                  <span className="opacity-70">{item.organizationType === 'school' ? '学校' : '单位'}</span>
                              </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                              {item.submittedAt?.split('T')[0] ?? item.occurredAt}
                          </TableCell>
                          <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                            <Button 
                                className="h-8 gap-1.5 text-xs border-primary/20 hover:bg-primary/5 hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPayTarget(item);
                                }}
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              打款
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Mobile View */}
            <div className="md:hidden space-y-3 px-4 py-4 overflow-y-auto">
              {reimbursementRecords.map((item) => {
                  const statusConfig = getReimbursementStatusConfig(item.status);
                  return (
                    <div key={item.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm active:scale-[0.99] transition-transform" onClick={() => setPayTarget(item)}>
                      <div className="flex justify-between items-start gap-4">
                        <div>
                            <div className="font-semibold text-foreground line-clamp-1">{item.title}</div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{item.reimbursementNumber}</div>
                        </div>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize shrink-0", statusConfig.className)}>
                            {statusConfig.label}
                        </span>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">{getInitials(item.applicantName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-xs font-medium">{item.applicantName}</span>
                                <span className="text-[10px] text-muted-foreground">{item.organizationType === 'school' ? '学校' : '单位'}</span>
                            </div>
                         </div>
                         <div className="text-lg font-bold text-foreground">
                            {currencyFormatter.format(item.amount)}
                         </div>
                      </div>
                    </div>
                  );
              })}
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="surface-card px-4 py-3 border-0 shadow-sm">
          <Pagination
            currentPage={reimbursementPage}
            totalPages={totalPages}
            onPageChange={setReimbursementPage}
          />
        </div>
      ) : null}



      <PaymentConfirmDialog
        open={!!payTarget}
        onClose={() => !submitting && setPayTarget(null)}
        onSubmit={handlePayConfirm}
        submitting={submitting}
      />
    </section>
  );
}
