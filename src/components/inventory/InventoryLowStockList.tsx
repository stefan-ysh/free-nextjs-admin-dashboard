import type { InventoryStats } from '@/types/inventory';

interface InventoryLowStockListProps {
  items: InventoryStats['lowStockItems'];
  loading?: boolean;
}

export default function InventoryLowStockList({ items, loading }: InventoryLowStockListProps) {
  return (
    <div className="h-full rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">安全库存提醒</p>
          <p className="text-xs text-muted-foreground">低于安全线的 SKU 列表</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          {loading ? '...' : `${items.length} 个`}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-12 w-full animate-pulse rounded-lg bg-muted" />
          ))
        ) : items.length ? (
          items.map((item) => {
            const gap = item.safetyStock - item.available;
            return (
              <div key={item.itemId} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900/30 dark:bg-amber-900/10">
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    可用 {item.available} / 安全线 {item.safetyStock}
                  </p>
                </div>
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">缺口 {gap}</span>
              </div>
            );
          })
        ) : (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground">库存全部正常</p>
            <p className="text-xs text-muted-foreground/60">无需补货</p>
          </div>
        )}
      </div>
    </div>
  );
}
