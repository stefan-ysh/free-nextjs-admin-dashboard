'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import ReimbursementPayConfirmDialog from '@/components/reimbursements/ReimbursementPayConfirmDialog';
import DataState from '@/components/common/DataState';
import Pagination from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermissions } from '@/hooks/usePermissions';
import type { ReimbursementRecord, ReimbursementStatus } from '@/types/reimbursement';

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

function reimbursementStatusText(status: ReimbursementStatus): string {
  switch (status) {
    case 'pending_approval':
      return '待打款';
    case 'approved':
      return '已审批待打款';
    case 'paid':
      return '已打款';
    case 'rejected':
      return '已驳回';
    case 'draft':
      return '草稿';
    default:
      return status;
  }
}

function reimbursementStatusVariant(status: ReimbursementStatus): 'secondary' | 'warning' | 'success' | 'destructive' {
  if (status === 'paid') return 'success';
  if (status === 'rejected') return 'destructive';
  if (status === 'approved') return 'warning';
  return 'secondary';
}

export default function PaymentQueueClient() {
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ReimbursementRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [activeReimbursementId, setActiveReimbursementId] = useState<string | null>(null);

  const canPay = hasPermission('REIMBURSEMENT_PAY');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchQueue = useCallback(async () => {
    if (permissionLoading || !canPay) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        scope: 'pay',
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const response = await fetch(`/api/reimbursements?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as ReimbursementListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '加载报销待处理列表失败');
      }

      setRecords(payload.data.items);
      setTotal(payload.data.total);
    } catch (err) {
      console.error('加载报销待处理列表失败', err);
      setError(err instanceof Error ? err.message : '加载失败');
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [permissionLoading, canPay, page, pageSize, debouncedSearch]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue, reloadToken]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

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
        <p className="text-sm text-muted-foreground">无权访问报销付款处理。</p>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">财务中心</p>
          <h1 className="text-2xl font-semibold text-foreground">报销付款处理</h1>
          <p className="mt-1 text-sm text-muted-foreground">统一处理报销打款任务，支持驳回补充材料。</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
          刷新
        </Button>
      </div>

      <div className="surface-panel flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="w-full max-w-sm">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索报销单号 / 标题 / 分类"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">共 {total} 条待处理</div>
        </div>

        {loading ? (
          <div className="p-6">
            <DataState variant="loading" title="正在加载报销待处理" description="请稍候，系统正在同步列表" />
          </div>
        ) : error ? (
          <div className="p-6">
            <DataState variant="empty" title="加载失败" description={error} />
          </div>
        ) : records.length === 0 ? (
          <div className="p-6">
            <DataState variant="empty" title="暂无报销待处理任务" description="当前筛选条件下没有需要打款处理的报销单" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="md:hidden space-y-3 px-4 py-4">
              {records.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.reimbursementNumber}</div>
                    </div>
                    <Badge variant={reimbursementStatusVariant(item.status)}>{reimbursementStatusText(item.status)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>组织</span>
                      <span className="text-foreground">{item.organizationType === 'school' ? '学校' : '单位'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>金额</span>
                      <span className="text-foreground">{currencyFormatter.format(item.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>发生日期</span>
                      <span className="text-foreground">{item.occurredAt}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button size="sm" onClick={() => setActiveReimbursementId(item.id)}>去处理</Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:flex md:flex-col flex-1 min-h-0">
              <Table stickyHeader scrollAreaClassName="max-h-[calc(100vh-320px)] custom-scrollbar">
                <TableHeader>
                  <TableRow>
                    <TableHead>报销单号</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>组织</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>发生日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.reimbursementNumber}</TableCell>
                      <TableCell className="font-medium text-foreground">{item.title}</TableCell>
                      <TableCell>{item.sourceType === 'purchase' ? '关联采购' : '直接报销'}</TableCell>
                      <TableCell>{item.organizationType === 'school' ? '学校' : '单位'}</TableCell>
                      <TableCell>{currencyFormatter.format(item.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={reimbursementStatusVariant(item.status)}>{reimbursementStatusText(item.status)}</Badge>
                      </TableCell>
                      <TableCell>{item.occurredAt}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setActiveReimbursementId(item.id)}>
                          去处理
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="surface-card px-4 py-3">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      <ReimbursementPayConfirmDialog
        open={Boolean(activeReimbursementId)}
        reimbursementId={activeReimbursementId}
        onOpenChange={(open) => {
          if (!open) {
            setActiveReimbursementId(null);
          }
        }}
        onPaid={() => {
          setReloadToken((token) => token + 1);
          setActiveReimbursementId(null);
        }}
        onRejected={() => {
          setReloadToken((token) => token + 1);
          setActiveReimbursementId(null);
        }}
      />
    </section>
  );
}
