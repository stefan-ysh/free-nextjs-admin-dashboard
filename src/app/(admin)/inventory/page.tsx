'use client';

import { useEffect, useMemo, useState } from 'react';

import InventoryStatsCards from '@/components/inventory/InventoryStatsCards';
import InventoryLowStockList from '@/components/inventory/InventoryLowStockList';
import InventoryMovementsTable, {
  type InventoryMovementRow,
} from '@/components/inventory/InventoryMovementsTable';
import type { InventoryStats } from '@/types/inventory';
import { usePermissions } from '@/hooks/usePermissions';

export default function InventoryOverviewPage() {
  const { hasPermission, loading: permissionLoading } = usePermissions();

  const canViewDashboard = useMemo(
    () => hasPermission('INVENTORY_VIEW_DASHBOARD'),
    [hasPermission]
  );
  const canViewMovements = useMemo(
    () => hasPermission('INVENTORY_VIEW_ALL'),
    [hasPermission]
  );

  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);

  useEffect(() => {
    if (!canViewDashboard) return;
    setStatsLoading(true);
    fetch('/api/inventory/stats')
      .then((res) => res.json())
      .then((payload) => {
        setStats(payload.data ?? null);
      })
      .catch((error) => {
        console.error('Failed to load inventory stats', error);
      })
      .finally(() => setStatsLoading(false));
  }, [canViewDashboard]);

  useEffect(() => {
    if (!canViewMovements) return;
    setMovementsLoading(true);
    fetch('/api/inventory/movements')
      .then((res) => res.json())
      .then((payload) => {
        setMovements(payload.data ?? []);
      })
      .catch((error) => {
        console.error('Failed to load inventory movements', error);
      })
      .finally(() => setMovementsLoading(false));
  }, [canViewMovements]);

  if (permissionLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          正在校验权限...
        </div>
      </div>
    );
  }

  if (!canViewDashboard) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow dark:border-rose-500/40 dark:bg-gray-900 dark:text-rose-300">
          当前账户无权访问进销存总览，请联系管理员配置权限。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <InventoryStatsCards stats={stats} loading={statsLoading} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <InventoryLowStockList
            items={stats?.lowStockItems ?? []}
            loading={statsLoading}
          />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
            <p className="font-semibold">快速操作</p>
            <p className="mt-1 text-xs opacity-80">
              使用左侧导航进入商品、仓库、入库、出库等页面完成日常任务。
            </p>
          </div>
          {canViewMovements ? (
            <InventoryMovementsTable
              movements={movements}
              loading={movementsLoading}
              emptyHint="暂无库存流水，可通过入库/出库功能创建"
            />
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              当前账户无权查看库存流水。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
