import type { InventoryStats } from '@/types/inventory';

interface InventoryLowStockListProps {
  items: InventoryStats['lowStockItems'];
  loading?: boolean;
}

export default function InventoryLowStockList({ items, loading }: InventoryLowStockListProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-500/40 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-600">安全库存提醒</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">低于安全线的 SKU 列表</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {loading ? '...加载中' : `${items.length} 个`}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-6 w-full animate-pulse rounded bg-amber-50 dark:bg-amber-500/10" />
          ))
        ) : items.length ? (
          items.map((item) => {
            const gap = item.safetyStock - item.available;
            return (
              <div key={item.itemId} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-500/10">
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">{item.name}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-200">
                    可用 {item.available} / 安全线 {item.safetyStock}
                  </p>
                </div>
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-300">缺口 {gap}</span>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">库存全部正常，无需处理。</p>
        )}
      </div>
    </div>
  );
}
