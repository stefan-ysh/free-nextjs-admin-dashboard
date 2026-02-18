'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import ReimbursementPayConfirmDialog from '@/components/reimbursements/ReimbursementPayConfirmDialog';
import PurchasePayConfirmDialog from '@/components/finance/PurchasePayConfirmDialog';
import DataState from '@/components/common/DataState';
import Pagination from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/usePermissions';
import type { ReimbursementRecord, ReimbursementStatus } from '@/types/reimbursement';
import type { PurchaseRecord, PurchaseStatus } from '@/types/purchase';

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

function purchaseStatusText(status: PurchaseStatus): string {
    switch (status) {
      case 'approved':
        return '待打款'; // Approved but not paid
      case 'pending_inbound':
        return '待入库(可打款)'; 
      case 'paid':
        return '已打款';
      default:
        return status;
    }
}

function purchaseStatusVariant(status: PurchaseStatus): 'secondary' | 'warning' | 'success' | 'destructive' {
    if (status === 'paid') return 'success';
    if (status === 'approved') return 'warning';
    if (status === 'pending_inbound') return 'warning';
    return 'secondary';
}

export default function PaymentQueueClient() {
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('reimbursements');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reimbursement State
  const [reimbursementRecords, setReimbursementRecords] = useState<ReimbursementRecord[]>([]);
  const [reimbursementPage, setReimbursementPage] = useState(1);
  const [reimbursementTotal, setReimbursementTotal] = useState(0);
  const [activeReimbursementId, setActiveReimbursementId] = useState<string | null>(null);

  // Purchase State
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [activePurchase, setActivePurchase] = useState<PurchaseRecord | null>(null);

  const [pageSize] = useState(20);
  const [reloadToken, setReloadToken] = useState(0);

  const canPay = hasPermission('REIMBURSEMENT_PAY');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Reset page when search or tab changes
  useEffect(() => {
    setReimbursementPage(1);
    setPurchasePage(1);
  }, [debouncedSearch, activeTab]);

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

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(purchasePage),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const response = await fetch(`/api/finance/payments/purchases?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as PurchaseListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '加载采购列表失败');
      }
      setPurchaseRecords(payload.data.items);
      setPurchaseTotal(payload.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, purchasePage, pageSize]);

  useEffect(() => {
    if (permissionLoading || !canPay) return;
    if (activeTab === 'reimbursements') {
      void fetchReimbursements();
    } else {
      void fetchPurchases();
    }
  }, [permissionLoading, canPay, activeTab, fetchReimbursements, fetchPurchases, reloadToken]);

  const totalPages = useMemo(() => {
    const total = activeTab === 'reimbursements' ? reimbursementTotal : purchaseTotal;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [activeTab, reimbursementTotal, purchaseTotal, pageSize]);

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
          <p className="mt-1 text-sm text-muted-foreground">统一处理报销与采购打款任务。</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
          刷新
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <div className="mb-4">
            <TabsList>
                <TabsTrigger value="reimbursements">报销单 ({reimbursementTotal})</TabsTrigger>
                <TabsTrigger value="purchases">采购单 ({purchaseTotal})</TabsTrigger>
            </TabsList>
          </div>

          <div className="surface-panel flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-3 border-b px-5 py-4">
            <div className="w-full max-w-sm">
                <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={activeTab === 'reimbursements' ? "搜索报销单号 / 标题" : "搜索采购单号 / 物品名称"}
                />
            </div>
            <div className="ml-auto text-xs text-muted-foreground">共 {activeTab === 'reimbursements' ? reimbursementTotal : purchaseTotal} 条待处理</div>
            </div>

            {loading ? (
            <div className="p-6">
                <DataState variant="loading" title="正在加载数据" description="请稍候..." />
            </div>
            ) : error ? (
            <div className="p-6">
                <DataState variant="empty" title="加载失败" description={error} />
            </div>
            ) : (
                <>
                    <TabsContent value="reimbursements" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                         {reimbursementRecords.length === 0 ? (
                            <div className="p-6">
                                <DataState variant="empty" title="暂无报销待处理任务" description="没有需要打款的报销单" />
                            </div>
                         ) : (
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                <div className="hidden md:flex flex-col flex-1 min-h-0">
                                    <Table stickyHeader scrollAreaClassName="max-h-full custom-scrollbar">
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
                                        {reimbursementRecords.map((item) => (
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
                                <div className="md:hidden space-y-3 px-4 py-4 overflow-y-auto">
                                   {reimbursementRecords.map((item) => (
                                       <div key={item.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                                           {/* Mobile view simplified */}
                                           <div className="flex justify-between">
                                               <span className="font-semibold">{item.title}</span>
                                               <Badge variant={reimbursementStatusVariant(item.status)}>{reimbursementStatusText(item.status)}</Badge>
                                           </div>
                                            <div className="mt-2 text-sm text-muted-foreground">
                                                {currencyFormatter.format(item.amount)}
                                            </div>
                                           <Button size="sm" className="mt-3 w-full" onClick={() => setActiveReimbursementId(item.id)}>去处理</Button>
                                       </div>
                                   ))}
                                </div>
                            </div>
                         )}
                    </TabsContent>

                    <TabsContent value="purchases" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                        {purchaseRecords.length === 0 ? (
                            <div className="p-6">
                                <DataState variant="empty" title="暂无采购待处理任务" description="没有需要打款的采购单" />
                            </div>
                         ) : (
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                <div className="hidden md:flex flex-col flex-1 min-h-0">
                                    <Table stickyHeader scrollAreaClassName="max-h-full custom-scrollbar">
                                        <TableHeader>
                                        <TableRow>
                                            <TableHead>采购单号</TableHead>
                                            <TableHead>物品名称</TableHead>
                                            <TableHead>申请人</TableHead>
                                            <TableHead>组织</TableHead>
                                            <TableHead>金额</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead>采购日期</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {purchaseRecords.map((item) => (
                                            <TableRow key={item.id}>
                                            <TableCell>{item.purchaseNumber}</TableCell>
                                            <TableCell className="font-medium text-foreground">{item.itemName}</TableCell>
                                            <TableCell>{item.purchaserName || item.purchaserId}</TableCell>
                                            <TableCell>{item.organizationType === 'school' ? '学校' : '单位'}</TableCell>
                                            <TableCell>{currencyFormatter.format(item.totalAmount)}</TableCell>
                                            <TableCell>
                                                <Badge variant={purchaseStatusVariant(item.status)}>{purchaseStatusText(item.status)}</Badge>
                                            </TableCell>
                                            <TableCell>{item.purchaseDate}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => setActivePurchase(item)}>
                                                去打款
                                                </Button>
                                            </TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="md:hidden space-y-3 px-4 py-4 overflow-y-auto">
                                   {purchaseRecords.map((item) => (
                                       <div key={item.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                                           <div className="flex justify-between">
                                               <span className="font-semibold">{item.itemName}</span>
                                               <Badge variant={purchaseStatusVariant(item.status)}>{purchaseStatusText(item.status)}</Badge>
                                           </div>
                                            <div className="mt-2 text-sm text-muted-foreground">
                                                {currencyFormatter.format(item.totalAmount)}
                                            </div>
                                           <Button size="sm" className="mt-3 w-full" onClick={() => setActivePurchase(item)}>去打款</Button>
                                       </div>
                                   ))}
                                </div>
                            </div>
                         )}
                    </TabsContent>
                </>
            )}
          </div>

          {totalPages > 1 ? (
            <div className="surface-card px-4 py-3">
              <Pagination
                currentPage={activeTab === 'reimbursements' ? reimbursementPage : purchasePage}
                totalPages={totalPages}
                onPageChange={activeTab === 'reimbursements' ? setReimbursementPage : setPurchasePage}
              />
            </div>
          ) : null}
      </Tabs>

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

      <PurchasePayConfirmDialog
        open={Boolean(activePurchase)}
        purchase={activePurchase}
        onOpenChange={(open) => !open && setActivePurchase(null)}
        onPaid={() => {
            setReloadToken((token) => token + 1);
            setActivePurchase(null);
        }}
      />
    </section>
  );
}
