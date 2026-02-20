'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RefreshCw, Package, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';
import InventoryItemFormDialog from '@/components/inventory/InventoryItemFormDialog';
import Pagination from '@/components/tables/Pagination';
import type { InventoryItem } from '@/types/inventory';
import { exportToExcel } from '@/lib/excel-utils';
import { useInventoryItems } from '@/hooks/useInventory';

/* ─── Main Component ─── */
export default function InventoryItemsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManage = useMemo(() => hasPermission('INVENTORY_MANAGE_ITEMS'), [hasPermission]);
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const { data, isLoading, refetch } = useInventoryItems({ page, pageSize, search });
  const items = data?.data ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams({ pageSize: '10000' });
      if (search.trim()) {
        qs.set('search', search.trim());
      }
      const res = await fetch(`/api/inventory/items?${qs.toString()}`);
      const json = await res.json();
      const allItems = json.data ?? [];
      
      exportToExcel(allItems, [
        { key: 'name', title: '商品名称' },
        { key: 'sku', title: 'SKU' },
        { key: 'category', title: '分类' },
        { key: 'unit', title: '单位' },
        { key: 'specification', title: '规格' },
        { key: 'safetyStock', title: '安全库存' },
        { key: 'stockQuantity', title: '当前库存' },
      ], '商品目录');
    } catch (error) {
      console.error('Export failed', error);
      alert('导出失败');
    }
  };

  /* ─── Dialog handlers ─── */
  const openCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async (item: InventoryItem) => {
    const ok = await confirm({
      title: '删除商品',
      description: `确定要删除「${item.name}」(${item.sku})？该操作不可撤销。`,
      confirmText: '删除',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/inventory/items/${item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '删除失败'); return; }
      toast.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    } catch {
      alert('网络错误');
    }
  };

  /* ─── Permission gate ─── */
  if (permLoading) {
    return <div className="p-6 text-sm text-muted-foreground">正在校验权限...</div>;
  }
  if (!canManage) {
    return (
      <div className="p-6">
        <div className="alert-box alert-danger">当前账户无权管理商品目录，请联系管理员。</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">商品目录</h1>
          <p className="text-xs text-muted-foreground">管理库存商品的基本信息与规格参数</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索名称 / SKU / 分类..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-48 sm:w-64"
          />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />刷新
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading}>
            <Download className="mr-1.5 h-3.5 w-3.5" />导出
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />新增商品
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="surface-card flex-1 min-h-0 overflow-hidden flex flex-col border border-border">
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">商品名称</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">分类</th>
                <th className="px-4 py-3">单位</th>
                <th className="px-4 py-3 text-right">安全库存</th>
                <th className="px-4 py-3 text-right">当前库存</th>
                <th className="px-4 py-3">规格</th>
                <th className="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    {search ? '未找到匹配的商品' : '暂无商品，点击「新增商品」创建'}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.safetyStock}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={
                        (item.stockQuantity ?? 0) < item.safetyStock
                          ? 'text-destructive font-semibold'
                          : 'text-foreground'
                      }>
                        {item.stockQuantity ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.specFields?.length ? (
                        <span className="text-xs text-muted-foreground">{item.specFields.length} 项</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="text-sm text-muted-foreground">
            共 {totalItems} 条记录
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}

      <InventoryItemFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        onSuccess={() => {
          setDialogOpen(false);
          setEditingItem(null);
          queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
        }}
      />
    </div>
  );
}
