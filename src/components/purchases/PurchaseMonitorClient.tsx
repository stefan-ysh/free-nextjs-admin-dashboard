'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import DataState from '@/components/common/DataState';
import PurchaseStatusBadge from '@/components/purchases/PurchaseStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import {
  type PurchaseMonitorData,
  type PurchaseMonitorStatusSummary,
  getPurchaseStatusText,
} from '@/types/purchase';

const amountFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

const hourFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type MonitorResponse = {
  success: boolean;
  data?: PurchaseMonitorData;
  error?: string;
};

function statusSortValue(item: PurchaseMonitorStatusSummary): number {
  const orderMap: Record<PurchaseMonitorStatusSummary['status'], number> = {
    pending_approval: 0,
    approved: 1,
    paid: 2,
    rejected: 3,
    draft: 4,
    cancelled: 5,
  };
  return orderMap[item.status] ?? 99;
}

export default function PurchaseMonitorClient() {
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const [monitor, setMonitor] = useState<PurchaseMonitorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overdueHours, setOverdueHours] = useState('48');
  const [reloadToken, setReloadToken] = useState(0);

  const canAccess = useMemo(
    () =>
      hasPermission('PURCHASE_VIEW_ALL') ||
      hasPermission('PURCHASE_VIEW_DEPARTMENT') ||
      hasPermission('PURCHASE_APPROVE') ||
      hasPermission('PURCHASE_REJECT') ||
      hasPermission('PURCHASE_PAY'),
    [hasPermission]
  );

  const loadMonitor = useCallback(async () => {
    if (!canAccess || permissionLoading) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ overdueHours });
      const response = await fetch(`/api/purchases/monitor?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('监控数据加载失败');
      const payload: MonitorResponse = await response.json();
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || '获取流程监控失败');
      }
      setMonitor(payload.data);
    } catch (loadError) {
      console.error('加载流程监控失败', loadError);
      setError(loadError instanceof Error ? loadError.message : '加载失败');
      setMonitor(null);
    } finally {
      setLoading(false);
    }
  }, [canAccess, overdueHours, permissionLoading]);

  useEffect(() => {
    if (permissionLoading || !canAccess) return;
    void loadMonitor();
  }, [permissionLoading, canAccess, loadMonitor, reloadToken]);

  if (permissionLoading) {
    return (
      <DataState
        variant="loading"
        title="正在加载权限"
        description="正在校验当前账号的采购监控访问权限"
        className="min-h-[220px]"
      />
    );
  }

  if (!canAccess) {
    return (
      <DataState
        variant="error"
        title="无权访问采购流程监控"
        description="需要采购查看、审批或打款权限，请联系管理员开通"
        className="min-h-[220px]"
      />
    );
  }

  const statusSummary = [...(monitor?.statusSummary ?? [])].sort((a, b) => statusSortValue(a) - statusSortValue(b));

  return (
    <div className="space-y-5">
      <div className="surface-toolbar p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">采购流程监控</h2>
            <p className="text-xs text-muted-foreground">监控审批节点停留时长、超时风险和审批人负载</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={overdueHours} onValueChange={setOverdueHours}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="超时阈值" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">超时阈值 24h</SelectItem>
                <SelectItem value="48">超时阈值 48h</SelectItem>
                <SelectItem value="72">超时阈值 72h</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setReloadToken((v) => v + 1)} disabled={loading}>
              刷新
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <DataState
          variant="error"
          title="流程监控加载失败"
          description={error}
          className="min-h-[180px]"
          action={<Button size="sm" onClick={() => setReloadToken((v) => v + 1)}>重试</Button>}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">进行中</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{loading ? '--' : monitor?.activeCount ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">待审批 + 待付款</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">待审批</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{loading ? '--' : monitor?.pendingApprovalCount ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">平均停留 {hourFormatter.format(monitor?.avgPendingHours ?? 0)}h</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">待付款</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{loading ? '--' : monitor?.pendingPaymentCount ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">审批通过待财务处理</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">超时审批</p>
          <p className="mt-1 text-xl font-semibold text-rose-600 dark:text-rose-300">{loading ? '--' : monitor?.overdueApprovalCount ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">阈值 {monitor?.overdueHours ?? Number(overdueHours)}h</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <section className="surface-card p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold text-foreground">节点分布</h3>
          <div className="mt-3 space-y-2">
            {statusSummary.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无流程数据</p>
            ) : (
              statusSummary.map((item) => (
                <div key={item.status} className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <PurchaseStatusBadge status={item.status} />
                    <span className="text-xs text-muted-foreground">{getPurchaseStatusText(item.status)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{item.count}</div>
                    <div className="text-xs text-muted-foreground">{amountFormatter.format(item.amount)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="surface-card p-4 xl:col-span-3">
          <h3 className="text-sm font-semibold text-foreground">审批停留分布</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {(monitor?.agingBuckets ?? []).map((bucket) => (
              <div key={bucket.label} className="rounded-md border border-border/60 bg-card/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">{bucket.label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{bucket.count}</p>
              </div>
            ))}
          </div>
          {(monitor?.agingBuckets?.length ?? 0) === 0 ? <p className="mt-3 text-xs text-muted-foreground">暂无待审批记录</p> : null}
        </section>
      </div>

      <section className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">审批人负载</h3>
          <Badge variant="outline" className="text-xs">Top 10</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">审批人</th>
                <th className="px-2 py-2 font-medium">待审批数</th>
                <th className="px-2 py-2 font-medium">待处理金额</th>
                <th className="px-2 py-2 font-medium">平均停留(h)</th>
                <th className="px-2 py-2 font-medium">最长停留(h)</th>
              </tr>
            </thead>
            <tbody>
              {(monitor?.approverLoad ?? []).map((item) => (
                <tr key={`${item.approverId ?? 'unassigned'}-${item.approverName}`} className="border-b border-border/40">
                  <td className="px-2 py-2">{item.approverName}</td>
                  <td className="px-2 py-2">{item.pendingCount}</td>
                  <td className="px-2 py-2">{amountFormatter.format(item.totalPendingAmount)}</td>
                  <td className="px-2 py-2">{hourFormatter.format(item.avgPendingHours)}</td>
                  <td className="px-2 py-2">{hourFormatter.format(item.maxPendingHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(monitor?.approverLoad?.length ?? 0) === 0 ? <p className="py-4 text-xs text-muted-foreground">暂无待审批负载</p> : null}
        </div>
      </section>

      <section className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">卡点单据</h3>
          <Badge variant="outline" className="text-xs">按停留时长排序</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">单号</th>
                <th className="px-2 py-2 font-medium">物品</th>
                <th className="px-2 py-2 font-medium">申请人</th>
                <th className="px-2 py-2 font-medium">当前审批人</th>
                <th className="px-2 py-2 font-medium">停留时长(h)</th>
                <th className="px-2 py-2 font-medium">应付金额</th>
              </tr>
            </thead>
            <tbody>
              {(monitor?.stuckRecords ?? []).map((item) => (
                <tr key={item.id} className="border-b border-border/40">
                  <td className="px-2 py-2">{item.purchaseNumber}</td>
                  <td className="px-2 py-2">{item.itemName}</td>
                  <td className="px-2 py-2">{item.purchaserName}</td>
                  <td className="px-2 py-2">{item.pendingApproverName}</td>
                  <td className="px-2 py-2">{item.pendingHours}</td>
                  <td className="px-2 py-2">{amountFormatter.format(item.dueAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(monitor?.stuckRecords?.length ?? 0) === 0 ? <p className="py-4 text-xs text-muted-foreground">暂无卡点单据</p> : null}
        </div>
      </section>
    </div>
  );
}
