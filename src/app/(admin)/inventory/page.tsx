'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PackagePlus, PackageMinus, List } from 'lucide-react';

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
import InventoryMovementsTable, {
  type InventoryMovementRow,
} from '@/components/inventory/InventoryMovementsTable';
import type { InventoryStats } from '@/types/inventory';
import { usePermissions } from '@/hooks/usePermissions';
import { FORM_DRAWER_WIDTH_COMPACT } from '@/components/common/form-drawer-width';

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
        <div className="alert-box alert-info">
          正在校验权限...
        </div>
      </div>
    );
  }

  if (!canViewDashboard) {
    return (
      <div className="space-y-6">
        <div className="alert-box alert-danger">
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
          <div className="surface-card h-full p-5 text-sm">
            <p className="font-semibold mb-4 text-foreground">快速操作</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 border-border/60 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                onClick={() => setInboundDrawerOpen(true)}
              >
                <PackagePlus className="h-6 w-6 text-chart-2" />
                <span>入库作业</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 border-border/60 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                onClick={() => setOutboundDrawerOpen(true)}
              >
                <PackageMinus className="h-6 w-6 text-chart-3" />
                <span>出库作业</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 border-border/60 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                asChild
              >
                <Link href="/inventory/movements">
                  <List className="h-6 w-6 text-chart-5" />
                  <span>库存流水</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Low Stock List - 2/3 width, max height with scroll */}
        <div className="lg:col-span-2">
          <div className="surface-card h-full p-5 flex flex-col" style={{ maxHeight: '320px' }}>
            <div className="flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">安全库存提醒</p>
                <p className="text-xs text-muted-foreground">低于安全线的 SKU 列表</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                {statsLoading ? '...' : `${(stats?.lowStockItems ?? []).length} 个`}
              </span>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto -mr-2 pr-2">
              {statsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-10 w-full animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : (stats?.lowStockItems ?? []).length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(stats?.lowStockItems ?? []).map((item) => {
                    const gap = item.safetyStock - item.available;
                    return (
                      <div key={item.itemId} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900/30 dark:bg-amber-900/10">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            可用 {item.available} / 安全线 {item.safetyStock}
                          </p>
                        </div>
                        <span className="ml-2 shrink-0 text-xs font-semibold text-rose-600 dark:text-rose-400">缺口 {gap}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-center">
                  <p className="text-sm text-muted-foreground">库存全部正常</p>
                  <p className="text-xs text-muted-foreground/60">无需补货</p>
                </div>
              )}
            </div>
          </div>
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
          <div className="alert-box alert-info">
            当前账户无权查看库存流水。
          </div>
        )}
      </div>

      {/* Inbound Drawer */}
      <Drawer open={inboundDrawerOpen} onOpenChange={setInboundDrawerOpen} direction="right">
        <DrawerContent side="right" className={FORM_DRAWER_WIDTH_COMPACT}>
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
        <DrawerContent side="right" className={FORM_DRAWER_WIDTH_COMPACT}>
          <div className="flex h-full flex-col">
            <DrawerHeader className="border-b px-6 py-4">
              <DrawerTitle>创建出库单</DrawerTitle>
              <DrawerDescription>
                选择商品与数量，提交后将同步更新库存数据。
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
