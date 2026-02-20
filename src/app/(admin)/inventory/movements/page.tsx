'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import InventoryMovementsTable, {
  type InventoryMovementRow,
} from '@/components/inventory/InventoryMovementsTable';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/tables/Pagination';

type RangeFilter = 'all' | '7d' | '30d';

const rangeOptions: { value: RangeFilter; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
];

export default function InventoryMovementsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { hasPermission, loading: permissionLoading } = usePermissions();
  const canView = useMemo(() => hasPermission('INVENTORY_VIEW_ALL'), [hasPermission]);

  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '50', 10);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [itemFilter, setItemFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');

  // Currently, the backend API `/api/inventory/movements` accepts `page`, `limit`, `direction`, `itemId`, and `warehouseId`.
  // Note: Local range filtering logic will still apply post-fetch on this iteration unless API handles dates.
  // For safety and compatibility without a heavy backend refactor, we still filter the returned page contents locally for Date fields temporarily if needed, 
  // but to properly support full page size counts without custom endpoints, we apply basic filters globally.

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

  const fetchData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);

    const query = new URLSearchParams({
      page: page.toString(),
      limit: pageSize.toString(),
    });

    if (directionFilter !== 'all') query.set('direction', directionFilter);
    if (itemFilter !== 'all') query.set('itemId', itemFilter);
    if (warehouseFilter !== 'all') query.set('warehouseId', warehouseFilter);

    try {
      const res = await fetch(`/api/inventory/movements?${query.toString()}`);
      if (!res.ok) throw new Error('API request failed');
      const payload = await res.json();
      setMovements(payload.data ?? []);
      setTotal(payload.total ?? 0);
    } catch (error) {
      console.error('Failed to load movements', error);
      setMovements([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, page, pageSize, directionFilter, itemFilter, warehouseFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const uniqueItems = useMemo(() => {
    const map = new Map<string, string>();
    movements.forEach((movement) => {
      map.set(movement.itemId, movement.itemName ?? movement.itemId);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [movements]);

  const uniqueWarehouses = useMemo(() => {
    const map = new Map<string, string>();
    movements.forEach((movement) => {
      map.set(movement.warehouseId, movement.warehouseName ?? movement.warehouseId);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const rangeThreshold = (() => {
      if (rangeFilter === '7d') {
        return Date.now() - 7 * 24 * 60 * 60 * 1000;
      }
      if (rangeFilter === '30d') {
        return Date.now() - 30 * 24 * 60 * 60 * 1000;
      }
      return null;
    })();

    if (!rangeThreshold) return movements;

    return movements.filter((movement) => {
      const occurredAt = new Date(movement.occurredAt).getTime();
      return !(Number.isFinite(occurredAt) && occurredAt < rangeThreshold);
    });
  }, [movements, rangeFilter]);

  const summary = useMemo(() => {
    return filteredMovements.reduce(
      (acc, movement) => {
        const amount = movement.amount ?? (movement.unitCost ? movement.unitCost * movement.quantity : 0);
        if (movement.direction === 'inbound') {
          acc.inbound.quantity += movement.quantity;
          acc.inbound.amount += amount;
        } else {
          acc.outbound.quantity += movement.quantity;
          acc.outbound.amount += amount;
        }
        acc.net.quantity = acc.inbound.quantity - acc.outbound.quantity;
        acc.net.amount = acc.inbound.amount - acc.outbound.amount;
        return acc;
      },
      {
        inbound: { quantity: 0, amount: 0 },
        outbound: { quantity: 0, amount: 0 },
        net: { quantity: 0, amount: 0 },
      }
    );
  }, [filteredMovements]);

  const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const handleExport = () => {
    alert('CSV 导出功能将于下一阶段提供');
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    syncUrl(newPage, pageSize);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    syncUrl(1, newPageSize);
  };

  if (permissionLoading) {
    return (
      <div className="space-y-6">
        <div className="panel-frame p-6 text-sm text-muted-foreground">
          正在校验权限...
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <div className="alert-box alert-danger">
          当前账户无权查看库存流水。
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Stats Section */}
      <div className="grid gap-4 md:grid-cols-3">
        {([
          { label: '入库合计', value: summary.inbound, tone: 'text-chart-5 bg-chart-5/10' },
          { label: '出库合计', value: summary.outbound, tone: 'text-destructive bg-destructive/10' },
          { label: '净变化', value: summary.net, tone: 'text-primary bg-primary/10' },
        ] as const).map((card) => (
          <div key={card.label} className="surface-panel p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{card.label}</span>
              <Badge variant="outline" className={card.tone + ' border-transparent'}>
                {filteredMovements.length ? `${filteredMovements.length} 条记录` : '暂无记录'}
              </Badge>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatNumber(card.value.quantity)}
              <span className="ml-1 text-sm text-muted-foreground">件</span>
            </p>
            <p className="text-sm text-muted-foreground">金额 ¥{formatNumber(card.value.amount)}</p>
          </div>
        ))}
      </div>

      {/* Filters & Actions Bar */}
      <div className="surface-toolbar p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <Select value={directionFilter} onValueChange={(value) => setDirectionFilter(value as typeof directionFilter)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="方向" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方向</SelectItem>
                <SelectItem value="inbound">仅入库</SelectItem>
                <SelectItem value="outbound">仅出库</SelectItem>
              </SelectContent>
            </Select>

            <Select value={itemFilter} onValueChange={(value) => setItemFilter(value)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="SKU" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部商品</SelectItem>
                {uniqueItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={warehouseFilter} onValueChange={(value) => setWarehouseFilter(value)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="仓库" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部仓库</SelectItem>
                {uniqueWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.value} value={warehouse.value}>
                    {warehouse.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={rangeFilter} onValueChange={(value) => setRangeFilter(value as RangeFilter)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="时间范围" />
              </SelectTrigger>
              <SelectContent>
                {rangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center pt-1 lg:pt-0">
            <Button variant="outline" onClick={handleExport} size="sm" className="h-10 w-full lg:w-auto">
              导出 CSV（规划中）
            </Button>
          </div>
        </div>
      </div>

      <div className="surface-table flex-1 min-h-0 flex flex-col">
        <InventoryMovementsTable
          movements={filteredMovements}
          loading={loading}
          emptyHint="暂无流水数据"
        />
        {totalPages > 1 && (
          <div className="mt-4 shrink-0 px-4 pb-4">
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
    </div>
  );
}
