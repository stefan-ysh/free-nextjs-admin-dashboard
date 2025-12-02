'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Package, PackagePlus, PackageMinus, Warehouse } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
  const inboundFormId = 'inventory-inbound-form';
  const outboundFormId = 'inventory-outbound-form';

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
        {/* Quick Actions - 1/3 width */}
        <div className="lg:col-span-1">
          <div className="h-full rounded-2xl border border-border/60 bg-card p-5 text-sm shadow-sm">
            <p className="font-semibold mb-4 text-foreground">快速操作</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 border-border/60 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                onClick={() => setInboundDrawerOpen(true)}
              >
                <PackagePlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <span>入库作业</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 border-border/60 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                onClick={() => setOutboundDrawerOpen(true)}
              >
                <PackageMinus className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                <span>出库作业</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 border-border/60 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                asChild
              >
                <Link href="/inventory/items">
                  <Package className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  <span>商品管理</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 border-border/60 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                asChild
              >
                <Link href="/inventory/warehouses">
                  <Warehouse className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  <span>仓库管理</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Low Stock List - 2/3 width */}
        <div className="lg:col-span-2">
          <InventoryLowStockList
            items={stats?.lowStockItems ?? []}
            loading={statsLoading}
          />
        </div>
      </div>

      {/* Movements Table - Full Width */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">最近库存流水</h3>
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

      {/* Inbound Drawer */}
      <Drawer open={inboundDrawerOpen} onOpenChange={setInboundDrawerOpen} direction="right">
        <DrawerContent side="right" className="w-full sm:max-w-2xl">
          <div className="flex h-full flex-col">
            <DrawerHeader className="border-b px-6 py-4">
              <DrawerTitle>创建入库单</DrawerTitle>
              <DrawerDescription>
                填写入库信息，提交后将同步更新库存数据。
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <InventoryInboundForm
                onSuccess={() => setInboundDrawerOpen(false)}
                onCancel={() => setInboundDrawerOpen(false)}
                formId={inboundFormId}
                hideActions
              />
            </div>
            <DrawerFooter className="border-t px-6 py-4">
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInboundDrawerOpen(false)}
                >
                  取消
                </Button>
              </DrawerClose>
              <Button type="submit" form={inboundFormId}>
                创建入库单
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Outbound Drawer */}
      <Drawer open={outboundDrawerOpen} onOpenChange={setOutboundDrawerOpen} direction="right">
        <DrawerContent side="right" className="w-full sm:max-w-2xl">
          <div className="flex h-full flex-col">
            <DrawerHeader className="border-b px-6 py-4">
              <DrawerTitle>创建出库单</DrawerTitle>
              <DrawerDescription>
                选择商品和客户信息，提交后将同步更新库存数据。
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <InventoryOutboundForm
                onSuccess={() => setOutboundDrawerOpen(false)}
                onCancel={() => setOutboundDrawerOpen(false)}
                formId={outboundFormId}
                hideActions
              />
            </div>
            <DrawerFooter className="border-t px-6 py-4">
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOutboundDrawerOpen(false)}
                >
                  取消
                </Button>
              </DrawerClose>
              <Button type="submit" form={outboundFormId}>
                创建出库单
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
