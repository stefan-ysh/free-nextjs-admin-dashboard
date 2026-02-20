'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import InventoryInboundForm from '@/components/inventory/InventoryInboundForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Pagination from '@/components/tables/Pagination';
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
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '50', 10);
  const router = useRouter();
  const pathname = usePathname();

  const { hasPermission, loading } = usePermissions();
  const [inboundDrawerOpen, setInboundDrawerOpen] = useState(false);
  const [inboundMovements, setInboundMovements] = useState<InboundMovementRow[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const inboundFormId = 'inventory-inbound-page-form';

  const canAccess = useMemo(
    () =>
      hasPermission('INVENTORY_OPERATE_INBOUND') ||
      hasPermission('INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY'),
    [hasPermission]
  );

  const syncUrl = useCallback(
    (newPage: number, newPageSize: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', newPage.toString());
      if (newPageSize !== 50) {
        params.set('pageSize', newPageSize.toString());
      } else {
        params.delete('pageSize');
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  const fetchInboundMovements = useCallback(async () => {
    setMovementsLoading(true);
    try {
      const [movementsResponse, purchasesResponse] = await Promise.all([
        fetch(`/api/inventory/movements?direction=inbound&page=${page}&limit=${pageSize}`, { headers: { Accept: 'application/json' } }),
        fetch('/api/purchases?page=1&pageSize=500&sortBy=updatedAt&sortOrder=desc', { headers: { Accept: 'application/json' } }),
      ]);
      const movementPayload = (await movementsResponse.json()) as { data?: InboundMovementRow[], total?: number };
      const purchasePayload = (await purchasesResponse.json()) as { data?: { items?: PurchaseRecord[] } };
      const purchaseMap = new Map((purchasePayload.data?.items ?? []).map((item) => [item.id, item.purchaseNumber]));

      const rows = (movementPayload.data ?? []).map((movement) => ({
        ...movement,
        relatedPurchaseNumber: movement.relatedPurchaseId ? purchaseMap.get(movement.relatedPurchaseId) : undefined,
      }));
      setInboundMovements(rows);
      setTotal(movementPayload.total ?? 0);
    } catch (error) {
      console.error('Failed to load inbound movements', error);
      setInboundMovements([]);
      setTotal(0);
    } finally {
      setMovementsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    if (!canAccess) return;
    void fetchInboundMovements();
  }, [canAccess, fetchInboundMovements]);

  useEffect(() => {
    if (!canAccess) return;
    if (!initialPurchaseId) return;
    setInboundDrawerOpen(true);
  }, [canAccess, initialPurchaseId]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    syncUrl(newPage, pageSize);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    syncUrl(1, newPageSize);
  };

  if (loading) {
    return <div className="alert-box alert-info">正在校验权限...</div>;
  }

  if (!canAccess) {
    return <div className="alert-box alert-danger">当前账户无权访问入库功能。</div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="surface-card p-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">到货入库</h1>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void fetchInboundMovements()} disabled={movementsLoading}>
              刷新
            </Button>
            <Button size="sm" onClick={() => setInboundDrawerOpen(true)}>创建入库</Button>
          </div>
        </div>
      </div>

      <div className="surface-card p-4 flex-1 min-h-0 flex flex-col">
        <div className="mb-3 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold">入库历史</h2>
          <span className="text-xs text-muted-foreground">共 {total} 条</span>
        </div>

        <div className="surface-table flex-1 min-h-0 flex flex-col">
          <div className="max-h-[calc(100vh-320px)] overflow-auto custom-scrollbar">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/60 text-xs uppercase text-muted-foreground">
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>采购单号</TableHead>
                  <TableHead>物品</TableHead>
                  <TableHead>仓库</TableHead>
                  <TableHead>入库数量</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : inboundMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      暂无入库记录
                    </TableCell>
                  </TableRow>
                ) : (
                  inboundMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{formatDateTimeLocal(movement.occurredAt) ?? movement.occurredAt}</TableCell>
                      <TableCell>{movement.relatedPurchaseNumber ?? movement.relatedOrderId ?? '—'}</TableCell>
                      <TableCell>{movement.itemName ?? movement.itemId}</TableCell>
                      <TableCell>{movement.warehouseName ?? movement.warehouseId}</TableCell>
                      <TableCell>{movement.quantity}</TableCell>
                      <TableCell>{movement.operatorName ?? '未知用户'}</TableCell>
                      <TableCell>{movement.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 shrink-0">
            <Pagination 
              currentPage={page} 
              totalPages={totalPages} 
              onPageChange={handlePageChange} 
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
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
                <Button type="button" size="sm" variant="outline" onClick={() => setInboundDrawerOpen(false)}>
                  取消
                </Button>
              </DrawerClose>
              <Button type="submit" size="sm" form={inboundFormId}>
                确认入库
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
