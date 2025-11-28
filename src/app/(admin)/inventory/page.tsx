'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Package, PackagePlus, PackageMinus, Warehouse } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import InventoryInboundForm from '@/components/inventory/InventoryInboundForm';
import InventoryOutboundForm from '@/components/inventory/InventoryOutboundForm';

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
  const [inboundDrawerOpen, setInboundDrawerOpen] = useState(false);
  const [outboundDrawerOpen, setOutboundDrawerOpen] = useState(false);

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
            <p className="font-semibold mb-4">快速操作</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 bg-white/60 hover:bg-white border-blue-200 text-blue-700 hover:text-blue-800 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                onClick={() => setInboundDrawerOpen(true)}
              >
                <PackagePlus className="h-6 w-6" />
                <span>入库作业</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 bg-white/60 hover:bg-white border-blue-200 text-blue-700 hover:text-blue-800 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                onClick={() => setOutboundDrawerOpen(true)}
              >
                <PackageMinus className="h-6 w-6" />
                <span>出库作业</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 bg-white/60 hover:bg-white border-blue-200 text-blue-700 hover:text-blue-800 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                asChild
              >
                <Link href="/inventory/items">
                  <Package className="h-6 w-6" />
                  <span>商品管理</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 bg-white/60 hover:bg-white border-blue-200 text-blue-700 hover:text-blue-800 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                asChild
              >
                <Link href="/inventory/warehouses">
                  <Warehouse className="h-6 w-6" />
                  <span>仓库管理</span>
                </Link>
              </Button>
            </div>
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

      {/* Inbound Drawer */}
      <Sheet open={inboundDrawerOpen} onOpenChange={setInboundDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>创建入库单</SheetTitle>
            <SheetDescription>
              填写入库信息，提交后将同步更新库存数据。
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <InventoryInboundForm
              onSuccess={() => setInboundDrawerOpen(false)}
              onCancel={() => setInboundDrawerOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Outbound Drawer */}
      <Sheet open={outboundDrawerOpen} onOpenChange={setOutboundDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>创建出库单</SheetTitle>
            <SheetDescription>
              选择商品和客户信息，提交后将同步更新库存数据。
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <InventoryOutboundForm
              onSuccess={() => setOutboundDrawerOpen(false)}
              onCancel={() => setOutboundDrawerOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
