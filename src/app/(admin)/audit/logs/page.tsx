'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Pagination from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeLocal } from '@/lib/dates';
import { usePermissions } from '@/hooks/usePermissions';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
type AuditEntityType = 
  | 'PURCHASE'
  | 'INVENTORY_ITEM'
  | 'INVENTORY_MOVEMENT'
  | 'FINANCE_RECORD'
  | 'BUDGET_ADJUSTMENT'
  | 'REIMBURSEMENT'
  | 'EMPLOYEE'
  | 'VENDOR'
  | 'WAREHOUSE';

interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const entityTypeLabels: Record<AuditEntityType, string> = {
  PURCHASE: '采购单',
  INVENTORY_ITEM: '库存商品',
  INVENTORY_MOVEMENT: '库存流水',
  FINANCE_RECORD: '财务记录',
  BUDGET_ADJUSTMENT: '预算调整',
  REIMBURSEMENT: '报销',
  EMPLOYEE: '员工',
  VENDOR: '供应商',
  WAREHOUSE: '仓库',
};

const actionLabels: Record<AuditAction, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  DELETE: '删除',
};

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { hasPermission, loading: permissionLoading } = usePermissions();
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const initialAction = searchParams.get('action') || 'all';
  const initialEntityType = searchParams.get('entityType') || 'all';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';
  
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [actionFilter, setActionFilter] = useState(initialAction);
  const [entityTypeFilter, setEntityTypeFilter] = useState(initialEntityType);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const canAccess = hasPermission('USER_VIEW_ALL');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (entityTypeFilter !== 'all') params.set('entityType', entityTypeFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      
      const res = await fetch(`/api/audit/logs?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.items);
        setTotal(data.data.total);
      } else {
        toast.error(data.error || '加载失败');
      }
    } catch (error) {
      console.error('Failed to load audit logs', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, entityTypeFilter, startDate, endDate]);

  useEffect(() => {
    if (!canAccess) return;
    fetchLogs();
  }, [canAccess, fetchLogs]);

  const syncUrl = useCallback((newPage: number, newPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    if (newPageSize !== 20) {
      params.set('pageSize', newPageSize.toString());
    } else {
      params.delete('pageSize');
    }
    router.replace(`/audit/logs?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    syncUrl(newPage, pageSize);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    syncUrl(1, newPageSize);
  };

  const handleFilterChange = () => {
    setPage(1);
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', pageSize.toString());
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (entityTypeFilter !== 'all') params.set('entityType', entityTypeFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    router.replace(`/audit/logs?${params.toString()}`, { scroll: false });
  };

  if (permissionLoading) {
    return <div className="p-4">正在校验权限...</div>;
  }

  if (!canAccess) {
    return <div className="p-4 text-red-500">无权访问</div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="surface-card p-4">
        <h1 className="text-lg font-semibold mb-4">操作日志</h1>
        
        <div className="flex flex-wrap gap-4">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="操作类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="CREATE">新增</SelectItem>
              <SelectItem value="UPDATE">修改</SelectItem>
              <SelectItem value="DELETE">删除</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="业务类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {Object.entries(entityTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="w-[150px]"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="开始日期"
          />
          <Input
            type="date"
            className="w-[150px]"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="结束日期"
          />
          <Button onClick={handleFilterChange}>查询</Button>
        </div>
      </div>

      <div className="surface-card p-4 flex-1 min-h-0 flex flex-col">
        <div className="mb-3 flex items-center justify-between shrink-0">
          <span className="text-sm text-muted-foreground">共 {total} 条记录</span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/60">
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>业务类型</TableHead>
                <TableHead>业务名称</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    暂无记录
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeLocal(log.createdAt) ?? log.createdAt}
                    </TableCell>
                    <TableCell>{log.userName}</TableCell>
                    <TableCell>
                      <Badge variant={log.action === 'CREATE' ? 'default' : log.action === 'DELETE' ? 'destructive' : 'secondary'}>
                        {actionLabels[log.action]}
                      </Badge>
                    </TableCell>
                    <TableCell>{entityTypeLabels[log.entityType]}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={log.entityName || log.entityId}>
                      {log.entityName || log.entityId}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.ipAddress || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 shrink-0">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
