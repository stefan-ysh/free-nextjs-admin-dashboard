'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Loader2, MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';

import WarehouseFormDialog from '@/components/inventory/WarehouseFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';
import type { Warehouse } from '@/types/inventory';
import { formatDateTimeLocal } from '@/lib/dates';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const warehouseTypeLabels: Record<Warehouse['type'], string> = {
  main: '主仓',
  store: '备仓/门店',
  virtual: '虚拟仓',
};

const warehouseTypeBadges: Record<Warehouse['type'], string> = {
  main: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-100',
  store: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100',
  virtual: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-100',
};

export default function InventoryWarehousesPage() {
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const canManageWarehouses = useMemo(
    () => hasPermission('INVENTORY_MANAGE_WAREHOUSE'),
    [hasPermission],
  );

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchWarehouses = useCallback(async () => {
    if (!canManageWarehouses) return;
    setLoading(true);
    try {
      const response = await fetch('/api/inventory/warehouses');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '加载失败');
      }
      setWarehouses(payload.data ?? []);
    } catch (error) {
      console.error('Failed to load warehouses', error);
      toast.error('加载仓库失败', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [canManageWarehouses]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const openCreateDialog = () => {
    setEditingWarehouse(null);
    setDialogOpen(true);
  };

  const openEditDialog = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setDialogOpen(true);
  };

  const handleDelete = async (warehouse: Warehouse) => {
    const confirmed = await confirm({
      title: `确定删除仓库「${warehouse.name}」吗？`,
      description: "此操作无法撤销。",
      confirmText: "删除",
      cancelText: "取消",
    });
    if (!confirmed) return;

    setDeletingId(warehouse.id);
    try {
      const response = await fetch(`/api/inventory/warehouses/${warehouse.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '删除失败');
      }
      toast.success('仓库已删除');
      fetchWarehouses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const [search, setSearch] = useState('');

  const filteredWarehouses = useMemo(() => {
    if (!search.trim()) return warehouses;
    const lower = search.toLowerCase();
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(lower) ||
        w.code.toLowerCase().includes(lower) ||
        w.manager?.toLowerCase().includes(lower)
    );
  }, [warehouses, search]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredWarehouses.length / pageSize)), [filteredWarehouses.length, pageSize]);

  const visibleWarehouses = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWarehouses.slice(start, start + pageSize);
  }, [filteredWarehouses, page, pageSize]);

  useEffect(() => {
    setPage((prev) => {
      if (prev > totalPages) {
        return totalPages;
      }
      return prev;
    });
  }, [totalPages]);

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPage((prev) => {
      if (direction === 'prev') {
        return Math.max(1, prev - 1);
      }
      return Math.min(totalPages, prev + 1);
    });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  if (permissionLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          正在校验权限...
        </div>
      </div>
    );
  }

  if (!canManageWarehouses) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow dark:border-rose-500/40 dark:bg-gray-900 dark:text-rose-300">
          当前账户无权管理仓库。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          <span className="font-medium text-foreground">仓库总数</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{warehouses.length}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Input
              placeholder="搜索仓库名称/编号/负责人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <Button onClick={openCreateDialog} size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" /> 新增仓库
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table
            stickyHeader
            scrollAreaClassName="max-h-[calc(100vh-350px)] custom-scrollbar"
            className="text-sm text-muted-foreground [&_tbody_tr]:hover:bg-muted/40"
          >
            <TableHeader className="[&_tr]:border-b border-border/40">
              <TableRow className="bg-muted/60 text-xs uppercase tracking-wide">
                <TableHead>仓库名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>容量 (㎡)</TableHead>
                <TableHead>库存情况</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr]:border-0">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> 正在加载...
                  </TableCell>
                </TableRow>
              ) : filteredWarehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {search ? '未找到匹配的仓库' : '暂无仓库数据，点击“新增仓库”以初始化仓储信息'}
                  </TableCell>
                </TableRow>
              ) : (
                visibleWarehouses.map((warehouse) => {
                  const capacity = warehouse.capacity ?? 0;
                  const stockQuantity = warehouse.stockQuantity ?? 0;
                  const usagePercent = capacity > 0 ? Math.min((stockQuantity / capacity) * 100, 100) : 0;

                  return (
                    <TableRow key={warehouse.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{warehouse.name}</div>
                        <div className="text-xs text-muted-foreground">{warehouse.code}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={warehouseTypeBadges[warehouse.type]}>
                          {warehouseTypeLabels[warehouse.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">{warehouse.manager || '—'}</div>
                        <div className="text-xs text-muted-foreground">{warehouse.address || '—'}</div>
                      </TableCell>
                      <TableCell>{capacity || '—'}</TableCell>
                      <TableCell>
                        <div className="w-32 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{stockQuantity} 件</span>
                            <span className="text-muted-foreground">{usagePercent.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTimeLocal(warehouse.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(warehouse)}>
                              <Edit2 className="mr-2 h-4 w-4" /> 编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(warehouse)}
                              className="text-rose-600 focus:text-rose-600"
                              disabled={deletingId === warehouse.id}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingId === warehouse.id ? '删除中...' : '删除'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredWarehouses.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-transparent px-2 py-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>共 {filteredWarehouses.length} 个仓库 • 第 {page} / {totalPages} 页</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Select value={String(pageSize)} onValueChange={(value) => handlePageSizeChange(Number(value))}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="每页数量" />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    每页 {size} 条
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('prev')}
                disabled={page <= 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> 上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('next')}
                disabled={page >= totalPages}
                className="gap-1"
              >
                下一页 <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <WarehouseFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingWarehouse(null);
          }
        }}
        warehouse={editingWarehouse}
        onSuccess={() => {
          setDialogOpen(false);
          setEditingWarehouse(null);
          fetchWarehouses();
        }}
      />
    </div>
  );
}
