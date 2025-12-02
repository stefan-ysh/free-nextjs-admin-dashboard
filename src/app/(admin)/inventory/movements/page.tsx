'use client';

import { useEffect, useMemo, useState } from 'react';

import InventoryMovementsTable, {
  type InventoryMovementRow,
} from '@/components/inventory/InventoryMovementsTable';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type RangeFilter = 'all' | '7d' | '30d';

const rangeOptions: { value: RangeFilter; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
];

export default function InventoryMovementsPage() {
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const canView = useMemo(() => hasPermission('INVENTORY_VIEW_ALL'), [hasPermission]);

  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [itemFilter, setItemFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    fetch('/api/inventory/movements')
      .then((res) => res.json())
      .then((payload) => setMovements(payload.data ?? []))
      .catch((error) => console.error('Failed to load movements', error))
      .finally(() => setLoading(false));
  }, [canView]);

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

    return movements.filter((movement) => {
      if (directionFilter !== 'all' && movement.direction !== directionFilter) {
        return false;
      }
      if (itemFilter !== 'all' && movement.itemId !== itemFilter) {
        return false;
      }
      if (warehouseFilter !== 'all' && movement.warehouseId !== warehouseFilter) {
        return false;
      }
      if (rangeThreshold) {
        const occurredAt = new Date(movement.occurredAt).getTime();
        if (Number.isFinite(occurredAt) && occurredAt < rangeThreshold) {
          return false;
        }
      }
      return true;
    });
  }, [movements, directionFilter, itemFilter, warehouseFilter, rangeFilter]);

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

  if (permissionLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          正在校验权限...
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow dark:border-rose-500/40 dark:bg-gray-900 dark:text-rose-300">
          当前账户无权查看库存流水。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Section */}
      <div className="grid gap-4 md:grid-cols-3">
        {([
          { label: '入库合计', value: summary.inbound, tone: 'text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-500/10' },
          { label: '出库合计', value: summary.outbound, tone: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10' },
          { label: '净变化', value: summary.net, tone: 'text-indigo-600 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-500/10' },
        ] as const).map((card) => (
          <div key={card.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
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
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
            <Select value={directionFilter} onValueChange={(value) => setDirectionFilter(value as typeof directionFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="方向" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方向</SelectItem>
                <SelectItem value="inbound">仅入库</SelectItem>
                <SelectItem value="outbound">仅出库</SelectItem>
              </SelectContent>
            </Select>

            <Select value={itemFilter} onValueChange={(value) => setItemFilter(value)}>
              <SelectTrigger className="h-9">
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
              <SelectTrigger className="h-9">
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
              <SelectTrigger className="h-9">
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
            <Button variant="outline" onClick={handleExport} size="sm" className="h-9 w-full lg:w-auto">
              导出 CSV（规划中）
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <InventoryMovementsTable
          movements={filteredMovements}
          loading={loading}
          emptyHint="暂无流水数据"
        />
      </div>
    </div>
  );
}
