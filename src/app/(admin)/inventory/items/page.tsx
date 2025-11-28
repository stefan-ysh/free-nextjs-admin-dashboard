'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckSquare, Square } from 'lucide-react';

import InventorySpecSummary from '@/components/inventory/InventorySpecSummary';
import InventoryItemFormDialog from '@/components/inventory/InventoryItemFormDialog';
import QuoteGeneratorDialog from '@/components/inventory/QuoteGeneratorDialog';
import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import type { InventoryItem } from '@/types/inventory';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';
import { formatDateTimeLocal } from '@/lib/dates';

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

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
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
            <Button
              onClick={fetchItems}
              variant="outline"
              size="sm"
              className="h-9 border-gray-300 px-3 text-gray-700 dark:border-gray-600 dark:text-gray-200"
              disabled={loading}
            >
              刷新
            </Button>
            <Button onClick={openCreateDialog} size="sm" className="h-9 rounded-lg bg-brand-500 px-4 text-white hover:bg-brand-600">
              + 新建商品
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2.5 w-10">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center text-gray-400 hover:text-gray-600">
                    {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left">SKU</th>
                <th className="px-3 py-2.5 text-left">名称</th>
                <th className="px-3 py-2.5 text-left">类别</th>
                <th className="px-3 py-2.5 text-left">单位</th>
                <th className="px-3 py-2.5 text-left">采购单价</th>
                <th className="px-3 py-2.5 text-left">建议售价</th>
                <th className="px-3 py-2.5 text-left">规格参数</th>
                <th className="px-3 py-2.5 text-left">安全库存</th>
                <th className="px-3 py-2.5 text-left">创建时间</th>
                <th className="px-3 py-2.5 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse bg-gray-50/80 dark:bg-gray-800/40">
                    {Array.from({ length: 11 }).map((__, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3">
                        <span className="inline-block h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length ? (
                items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr key={item.id} className={isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className={`flex items-center justify-center ${isSelected ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}
                        >
                          {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{item.sku}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-white">{item.name}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                        {item.category ? <Badge variant="secondary">{item.category}</Badge> : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{item.unit}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-white">
                        ¥{item.unitPrice.toLocaleString()} / {item.unit}
                      </td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-white">
                        ¥{item.salePrice.toLocaleString()} / {item.unit}
                      </td>
                      <td className="px-3 py-2.5">
                        <InventorySpecSummary item={item} />
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{item.safetyStock}</td>
                      <td className="px-3 py-2.5 text-gray-500">
                        {formatDateTimeLocal(item.createdAt) ?? item.createdAt}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-2">
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
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-3 py-6">
                    <DataState
                      variant="empty"
                      title="暂无商品数据"
                      description="点击右上角“新建商品”添加第一条 SKU"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
