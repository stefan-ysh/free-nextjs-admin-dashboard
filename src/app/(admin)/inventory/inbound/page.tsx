'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import InventoryInboundForm from '@/components/inventory/InventoryInboundForm';
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
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateTimeLocal } from '@/lib/dates';
import { FORM_DRAWER_WIDTH_COMPACT } from '@/components/common/form-drawer-width';
import type { InventoryMovement } from '@/types/inventory';
import type { PurchaseRecord } from '@/types/purchase';

type InboundMovementRow = InventoryMovement & {
  itemName?: string;
  warehouseName?: string;
  relatedPurchaseNumber?: string;
};

export default function InventoryInboundPage() {
  const searchParams = useSearchParams();
  const initialPurchaseId = searchParams.get('purchaseId')?.trim() || '';
  const { hasPermission, loading } = usePermissions();
  const [inboundDrawerOpen, setInboundDrawerOpen] = useState(false);
  const [inboundMovements, setInboundMovements] = useState<InboundMovementRow[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const inboundFormId = 'inventory-inbound-page-form';

  const canAccess = useMemo(
    () =>
      hasPermission('INVENTORY_OPERATE_INBOUND') ||
      hasPermission('INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY'),
    [hasPermission]
  );

  const fetchInboundMovements = useCallback(async () => {
    setMovementsLoading(true);
    try {
      const [movementsResponse, purchasesResponse] = await Promise.all([
        fetch('/api/inventory/movements?direction=inbound', { headers: { Accept: 'application/json' } }),
        fetch('/api/purchases?page=1&pageSize=500&sortBy=updatedAt&sortOrder=desc', { headers: { Accept: 'application/json' } }),
      ]);
      const movementPayload = (await movementsResponse.json()) as { data?: InboundMovementRow[] };
      const purchasePayload = (await purchasesResponse.json()) as { data?: { items?: PurchaseRecord[] } };
      const purchaseMap = new Map((purchasePayload.data?.items ?? []).map((item) => [item.id, item.purchaseNumber]));

      const rows = (movementPayload.data ?? []).map((movement) => ({
        ...movement,
        relatedPurchaseNumber: movement.relatedPurchaseId ? purchaseMap.get(movement.relatedPurchaseId) : undefined,
      }));
      setInboundMovements(rows);
    } catch (error) {
      console.error('Failed to load inbound movements', error);
      setInboundMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    void fetchInboundMovements();
  }, [canAccess, fetchInboundMovements]);

  useEffect(() => {
    if (!canAccess) return;
    if (!initialPurchaseId) return;
    setInboundDrawerOpen(true);
  }, [canAccess, initialPurchaseId]);

  if (loading) {
    return <div className="alert-box alert-info">正在校验权限...</div>;
  }

  if (!canAccess) {
    return <div className="alert-box alert-danger">当前账户无权访问入库功能。</div>;
  }

  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">到货入库</h1>
            <p className="text-sm text-muted-foreground">先查看历史，再点击“创建入库”发起新的采购入库。</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void fetchInboundMovements()} disabled={movementsLoading}>
              刷新
            </Button>
            <Button onClick={() => setInboundDrawerOpen(true)}>创建入库</Button>
          </div>
        </div>
      </div>

      <div className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">入库历史</h2>
          <span className="text-xs text-muted-foreground">{inboundMovements.length} 条</span>
        </div>

        <div className="surface-table">
          <div className="max-h-[calc(100vh-320px)] overflow-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-border text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">时间</th>
                  <th className="px-3 py-2 text-left">采购单号</th>
                  <th className="px-3 py-2 text-left">物品</th>
                  <th className="px-3 py-2 text-left">仓库</th>
                  <th className="px-3 py-2 text-left">入库数量</th>
                  <th className="px-3 py-2 text-left">操作人</th>
                  <th className="px-3 py-2 text-left">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {movementsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      加载中...
                    </td>
                  </tr>
                ) : inboundMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      暂无入库记录
                    </td>
                  </tr>
                ) : (
                  inboundMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-3 py-2">{formatDateTimeLocal(movement.occurredAt) ?? movement.occurredAt}</td>
                      <td className="px-3 py-2">{movement.relatedPurchaseNumber ?? movement.relatedOrderId ?? '—'}</td>
                      <td className="px-3 py-2">{movement.itemName ?? movement.itemId}</td>
                      <td className="px-3 py-2">{movement.warehouseName ?? movement.warehouseId}</td>
                      <td className="px-3 py-2">{movement.quantity}</td>
                      <td className="px-3 py-2">{movement.operatorName ?? '未知用户'}</td>
                      <td className="px-3 py-2">{movement.notes ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Drawer open={inboundDrawerOpen} onOpenChange={setInboundDrawerOpen} direction="right">
        <DrawerContent side="right" className={FORM_DRAWER_WIDTH_COMPACT}>
          <div className="flex h-full flex-col">
            <DrawerHeader className="border-b px-6 py-4">
              <DrawerTitle>创建入库单</DrawerTitle>
              <DrawerDescription>仅支持关联采购单入库，商品与仓库将自动带出。</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <InventoryInboundForm
                initialRelatedPurchaseId={initialPurchaseId}
                onSuccess={() => {
                  setInboundDrawerOpen(false);
                  void fetchInboundMovements();
                }}
                onCancel={() => setInboundDrawerOpen(false)}
                formId={inboundFormId}
                hideActions
              />
            </div>
            <DrawerFooter className="border-t px-6 py-4">
              <DrawerClose asChild>
                <Button type="button" variant="outline" onClick={() => setInboundDrawerOpen(false)}>
                  取消
                </Button>
              </DrawerClose>
              <Button type="submit" form={inboundFormId}>
                确认入库
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
