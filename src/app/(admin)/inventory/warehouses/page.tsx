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
  main: 'bg-primary/10 text-primary',
  store: 'bg-chart-5/10 text-chart-5',
  virtual: 'bg-chart-3/10 text-chart-3',
};

export default function InventoryWarehousesPage() {
  const isFixedWarehouseMode = true;
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
        <div className="panel-frame p-6 text-sm text-muted-foreground">
          正在校验权限...
        </div>
      </div>
    );
  }

  if (!canManageWarehouses) {
    return (
      <div className="space-y-6">
        <div className="alert-box alert-danger">
          当前账户无权管理仓库。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-toolbar p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Input
              placeholder="搜索仓库名称/编号/负责人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
          {isFixedWarehouseMode ? (
            <div className="text-xs text-muted-foreground">仓库已固定为“学校 / 单位”，不支持新增或删除。</div>
          ) : (
            <Button onClick={openCreateDialog} size="sm" className="h-10 gap-2">
              <PlusCircle className="h-4 w-4" /> 新增仓库
            </Button>
          )}
        </div>
      </div>

      <Card className="border-none shadow-none">
        <CardContent className="p-0">
          <div className="md:hidden">
            <div className="space-y-3 p-4">
              {loading ? (
                <div className="surface-panel p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> 正在加载...
                </div>
              ) : filteredWarehouses.length === 0 ? (
                <div className="surface-panel border-dashed p-6 text-center text-sm text-muted-foreground">
                  {search ? '未找到匹配的仓库' : '暂无仓库数据'}
                </div>
              ) : (
                visibleWarehouses.map((warehouse) => {
                  const capacity = warehouse.capacity ?? 0;
                  const stockQuantity = warehouse.stockQuantity ?? 0;
                  const usagePercent = capacity > 0 ? Math.min((stockQuantity / capacity) * 100, 100) : 0;
                  return (
                    <div key={warehouse.id} className="surface-panel p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{warehouse.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">编号：{warehouse.code}</div>
                        </div>
                        <Badge variant="secondary" className={warehouseTypeBadges[warehouse.type]}>
                          {warehouseTypeLabels[warehouse.type]}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span>负责人</span>
                          <span className="text-foreground">{warehouse.manager || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>容量</span>
                          <span className="text-foreground">{capacity || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>库存</span>
                          <span className="text-foreground">{stockQuantity} 件</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>使用率</span>
                          <span>{usagePercent.toFixed(0)}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePercent}%` }} />
                        </div>
                      </div>
                      {!isFixedWarehouseMode ? (
                        <div className="mt-4 flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 px-3">
                                <MoreHorizontal className="mr-2 h-4 w-4" /> 操作
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(warehouse)}>
                                <Edit2 className="mr-2 h-4 w-4" /> 编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(warehouse)}
                                className="text-destructive focus:text-destructive"
                                disabled={deletingId === warehouse.id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deletingId === warehouse.id ? '删除中...' : '删除'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="hidden md:block">
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
                    {search ? '未找到匹配的仓库' : '暂无仓库数据'}
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
                        {isFixedWarehouseMode ? <span className="text-xs text-muted-foreground">固定仓库</span> : (
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
                                className="text-destructive focus:text-destructive"
                                disabled={deletingId === warehouse.id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deletingId === warehouse.id ? '删除中...' : '删除'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
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

      {!isFixedWarehouseMode ? (
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
      ) : null}
    </div>
  );
}
