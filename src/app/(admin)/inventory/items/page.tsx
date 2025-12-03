'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckSquare, ChevronLeft, ChevronRight, Square } from 'lucide-react';

import InventorySpecSummary from '@/components/inventory/InventorySpecSummary';
import InventoryItemFormDialog from '@/components/inventory/InventoryItemFormDialog';
import QuoteGeneratorDialog from '@/components/inventory/QuoteGeneratorDialog';
import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import type { InventoryItem } from '@/types/inventory';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';
import { formatDateTimeLocal } from '@/lib/dates';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function InventoryItemsPage() {
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const canManageItems = useMemo(
    () => hasPermission('INVENTORY_MANAGE_ITEMS'),
    [hasPermission]
  );

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const confirm = useConfirm();

  const fetchItems = useCallback(async () => {
    if (!canManageItems) return;
    setLoading(true);
    try {
      const response = await fetch('/api/inventory/items');
      const payload = await response.json();
      setItems(payload.data ?? []);
    } catch (error) {
      console.error('Failed to load items', error);
      toast.error('加载商品失败', { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [canManageItems]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (item: InventoryItem) => {
    const confirmed = await confirm({
      title: `确定要删除「${item.name}」吗？`,
      description: "此操作无法撤销。",
      confirmText: "删除",
      cancelText: "取消",
    });
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      const response = await fetch(`/api/inventory/items/${item.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '删除失败');
      }
      toast.success('商品已删除');
      await fetchItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / pageSize)), [items.length, pageSize]);

  const visibleItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  useEffect(() => {
    setPage((prev) => {
      if (prev > totalPages) {
        return totalPages;
      }
      return prev;
    });
  }, [totalPages]);

  const isAllSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        visibleItems.forEach((item) => next.delete(item.id));
      } else {
        visibleItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectedItems = items.filter(i => selectedIds.has(i.id));

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

  if (!canManageItems) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow dark:border-rose-500/40 dark:bg-gray-900 dark:text-rose-300">
          当前账户无权管理商品，请联系管理员。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <span>SKU 列表</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[11px] font-medium">
                {items.length} 条
              </Badge>
              {selectedIds.size > 0 && (
                <Badge variant="outline" className="ml-2 text-blue-600 border-blue-200 bg-blue-50">
                  已选 {selectedIds.size} 项
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">当前使用中的商品信息，支持快速编辑</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 && (
              <QuoteGeneratorDialog
                selectedItems={selectedItems}
                onOpenChange={(open) => !open && setSelectedIds(new Set())}
              />
            )}
            <Button onClick={fetchItems} variant="outline">
              刷新
            </Button>
            <Button onClick={openCreateDialog} className="min-w-[110px]">
              新建商品
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <Table
              stickyHeader
              scrollAreaClassName="max-h-[calc(100vh-350px)] custom-scrollbar"
              className="min-w-[1100px] text-sm text-muted-foreground"
            >
              <TableHeader>
                <TableRow className="bg-muted/60 text-[11px] uppercase tracking-wide">
                  <TableHead className="w-10 px-3 py-3">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
                      {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  </TableHead>
                  <TableHead className="px-3 py-3">SKU</TableHead>
                  <TableHead className="px-3 py-3">名称</TableHead>
                  <TableHead className="px-3 py-3">类别</TableHead>
                  <TableHead className="px-3 py-3">单位</TableHead>
                  <TableHead className="px-3 py-3">采购单价</TableHead>
                  <TableHead className="px-3 py-3">建议售价</TableHead>
                  <TableHead className="px-3 py-3">规格参数</TableHead>
                  <TableHead className="px-3 py-3">安全库存</TableHead>
                  <TableHead className="px-3 py-3">创建时间</TableHead>
                  <TableHead className="px-3 py-3 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`loading-${idx}`} className="animate-pulse bg-muted/40">
                      {Array.from({ length: 11 }).map((__, cellIdx) => (
                        <TableCell key={cellIdx} className="px-4 py-3">
                          <span className="inline-block h-4 w-full rounded bg-muted/80" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length ? (
                  visibleItems.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <TableRow key={item.id} className={isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                        <TableCell className="px-3 py-2.5">
                          <button
                            onClick={() => toggleSelect(item.id)}
                            className={`flex items-center justify-center ${isSelected ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                        <TableCell className="px-3 py-2.5 text-foreground">{item.name}</TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground">
                          {item.category ? <Badge variant="secondary">{item.category}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground">{item.unit}</TableCell>
                        <TableCell className="px-3 py-2.5 text-foreground">
                          ¥{item.unitPrice.toLocaleString()} / {item.unit}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-foreground">
                          ¥{item.salePrice.toLocaleString()} / {item.unit}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 whitespace-normal">
                          <InventorySpecSummary item={item} />
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground">{item.safetyStock}</TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground">
                          {formatDateTimeLocal(item.createdAt) ?? item.createdAt}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="secondary" className="h-8 px-3" onClick={() => openEditDialog(item)}>
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 px-3"
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item.id}
                            >
                              {deletingId === item.id ? '删除中...' : '删除'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="px-3 py-6">
                      <DataState
                        variant="empty"
                        title="暂无商品数据"
                        description="点击右上角“新建商品”添加第一条 SKU"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-transparent px-2 py-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div>共 {items.length} 个商品 • 第 {page} / {totalPages} 页</div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Select value={String(pageSize)} onValueChange={(value) => handlePageSizeChange(Number(value))}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="每页数量" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
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

      </div>

      <InventoryItemFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        onSuccess={fetchItems}
      />
    </div>
  );
}
