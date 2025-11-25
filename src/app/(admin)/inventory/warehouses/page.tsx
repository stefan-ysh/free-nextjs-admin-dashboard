'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import WarehouseFormDialog from '@/components/inventory/WarehouseFormDialog';
import DataState from '@/components/common/DataState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';
import type { Warehouse } from '@/types/inventory';
import { formatDateTimeLocal } from '@/lib/dates';

const warehouseTypeLabels: Record<Warehouse['type'], string> = {
  main: '主仓',
  store: '备仓/门店',
  virtual: '虚拟仓',
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

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={openCreateDialog} disabled={!canManageWarehouses}>
            新增仓库
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {loading ? (
            <DataState
              variant="loading"
              title="正在加载仓库"
              description="请稍候，正在同步库存占用数据"
              className="col-span-full"
            />
          ) : warehouses.length ? (
            warehouses.map((warehouse) => {
              const capacity = warehouse.capacity ?? 0;
              const stockQuantity = warehouse.stockQuantity ?? 0;
              const stockReserved = warehouse.stockReserved ?? 0;
              const usagePercent =
                capacity > 0 ? Math.min((stockQuantity / capacity) * 100, 999) : null;
              const formattedUsage =
                usagePercent != null
                  ? `${usagePercent >= 100 ? '100+' : usagePercent.toFixed(1)}%`
                  : '无容量信息';

              return (
                <div
                  key={warehouse.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {warehouse.name}
                        </h3>
                        <Badge variant="secondary">
                          {warehouseTypeLabels[warehouse.type]}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">编码：{warehouse.code}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {warehouse.address?.trim() || '（未填写地址）'}
                    </p>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <div>
                      <dt className="text-xs text-gray-400">负责人</dt>
                      <dd className="mt-1 font-medium">{warehouse.manager ?? '待分配'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">容量</dt>
                      <dd className="mt-1 font-medium">{capacity || '—'} ㎡</dd>
                    </div>
                  </dl>

                  <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-4 text-sm dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>库存占用</span>
                      <span>{formattedUsage}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${Math.min(usagePercent ?? 0, 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      库存 {stockQuantity.toLocaleString()} 件 · 预留{' '}
                      {stockReserved.toLocaleString()} 件
                      {capacity ? ` · 容量 ${capacity.toLocaleString()} ㎡` : ''}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <p>最近更新：{formatDateTimeLocal(warehouse.updatedAt) ?? warehouse.updatedAt}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(warehouse)}
                        disabled={!canManageWarehouses}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(warehouse)}
                        disabled={!canManageWarehouses || deletingId === warehouse.id}
                      >
                        {deletingId === warehouse.id ? '删除中…' : '删除'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <DataState
              variant="empty"
              title="暂无仓库数据"
              description="点击右上角“新增仓库”以初始化仓储信息"
              className="col-span-full"
            />
          )}
        </div>
      </div>

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
