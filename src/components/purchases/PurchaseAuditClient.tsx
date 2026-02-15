'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import DatePicker from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import {
  type PurchaseAuditLogItem,
  type ReimbursementAction,
  REIMBURSEMENT_ACTIONS,
  getPurchaseStatusText,
} from '@/types/purchase';

const ACTION_LABELS: Record<ReimbursementAction, string> = {
  submit: '提交审批',
  approve: '审批通过',
  reject: '驳回',
  pay: '打款',
  cancel: '取消',
  withdraw: '撤回',
  transfer: '转审',
  issue: '标记异常',
  resolve: '解除异常',
};

type AuditResponse = {
  success: boolean;
  data?: {
    items: PurchaseAuditLogItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
};

function toDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function exportCsv(rows: PurchaseAuditLogItem[]) {
  const header = ['时间', '单号', '物品', '动作', '状态流转', '操作人', '备注'];
  const lines = rows.map((item) => [
    toDateTime(item.createdAt),
    item.purchaseNumber,
    item.itemName,
    ACTION_LABELS[item.action] ?? item.action,
    `${getPurchaseStatusText(item.fromStatus)} -> ${getPurchaseStatusText(item.toStatus)}`,
    item.operatorName,
    item.comment ?? '',
  ]);
  const csv = [header, ...lines]
    .map((line) => line.map((col) => `"${String(col).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `purchase-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function PurchaseAuditClient() {
  const { loading: permissionLoading, hasPermission } = usePermissions();

  const [search, setSearch] = useState('');
  const [action, setAction] = useState<'all' | ReimbursementAction>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PurchaseAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);

  const canAccess = useMemo(
    () =>
      hasPermission('PURCHASE_VIEW_ALL') || hasPermission('PURCHASE_APPROVE') || hasPermission('PURCHASE_PAY'),
    [hasPermission]
  );

  const fetchData = useCallback(async () => {
    if (!canAccess || permissionLoading) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) query.set('search', search.trim());
      if (action !== 'all') query.set('action', action);
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);

      const response = await fetch(`/api/purchases/audit?${query.toString()}`, { headers: { Accept: 'application/json' } });
      const payload: AuditResponse = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '审计日志加载失败');
      }

      setItems(payload.data.items);
      setTotal(payload.data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [action, canAccess, endDate, page, permissionLoading, search, startDate]);

  useEffect(() => {
    if (!permissionLoading && canAccess) {
      void fetchData();
    }
  }, [permissionLoading, canAccess, fetchData]);

  if (permissionLoading) {
    return <DataState variant="loading" title="加载中" description="正在校验权限" className="min-h-[220px]" />;
  }

  if (!canAccess) {
    return <DataState variant="error" title="无权访问" description="需要采购查看或审批权限" className="min-h-[220px]" />;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="surface-toolbar p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="按单号/物品检索"
            className="md:col-span-2"
          />
          <Select
            value={action}
            onValueChange={(value) => {
              setAction(value as 'all' | ReimbursementAction);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="动作" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部动作</SelectItem>
              {REIMBURSEMENT_ACTIONS.map((item) => (
                <SelectItem key={item} value={item}>{ACTION_LABELS[item] ?? item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="开始日期"
            className="w-full min-w-[140px]"
          />
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="结束日期"
            className="w-full min-w-[140px]"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { setPage(1); void fetchData(); }} disabled={loading}>查询</Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv(items)} disabled={items.length === 0}>导出当前页</Button>
        </div>
      </div>

      {error ? <DataState variant="error" title="加载失败" description={error} className="min-h-[120px]" /> : null}

      <div className="surface-table flex-1 min-h-0 flex flex-col">
        <div className="max-h-[calc(100vh-280px)] overflow-auto custom-scrollbar">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border/70 bg-muted/20 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">时间</th>
              <th className="px-3 py-2 font-medium">单号</th>
              <th className="px-3 py-2 font-medium">物品</th>
              <th className="px-3 py-2 font-medium">动作</th>
              <th className="px-3 py-2 font-medium">状态流转</th>
              <th className="px-3 py-2 font-medium">操作人</th>
              <th className="px-3 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/40">
                <td className="px-3 py-2">{toDateTime(item.createdAt)}</td>
                <td className="px-3 py-2">{item.purchaseNumber}</td>
                <td className="px-3 py-2">{item.itemName}</td>
                <td className="px-3 py-2">{ACTION_LABELS[item.action] ?? item.action}</td>
                <td className="px-3 py-2">{getPurchaseStatusText(item.fromStatus)} {'->'} {getPurchaseStatusText(item.toStatus)}</td>
                <td className="px-3 py-2">{item.operatorName}</td>
                <td className="px-3 py-2">{item.comment || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">暂无审计日志</p> : null}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>上一页</Button>
          <span>{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>下一页</Button>
        </div>
      </div>
    </div>
  );
}
