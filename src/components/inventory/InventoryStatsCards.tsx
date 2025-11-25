import type { InventoryStats } from '@/types/inventory';

interface InventoryStatsCardsProps {
  stats: InventoryStats | null;
  loading?: boolean;
}

const metricConfig: Array<{
  key: keyof Pick<InventoryStats, 'totalItems' | 'totalWarehouses' | 'totalQuantity' | 'todaysInbound' | 'todaysOutbound'>;
  label: string;
  helper?: string;
  emphasis?: 'positive' | 'negative';
}> = [
  { key: 'totalItems', label: 'SKU 总数', helper: '启用中' },
  { key: 'totalWarehouses', label: '仓库数量', helper: '可用仓库' },
  { key: 'totalQuantity', label: '当前库存', helper: '件' },
  { key: 'todaysInbound', label: '今日入库', emphasis: 'positive' },
  { key: 'todaysOutbound', label: '今日出库', emphasis: 'negative' },
];

export default function InventoryStatsCards({ stats, loading }: InventoryStatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {metricConfig.map((metric) => {
        const value = stats ? stats[metric.key] : null;
        const displayValue = value !== null && value !== undefined ? value.toLocaleString() : '--';
        const tone =
          metric.emphasis === 'positive'
            ? 'text-green-600 dark:text-green-400'
            : metric.emphasis === 'negative'
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-gray-900 dark:text-white';

        return (
          <div
            key={metric.key}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{metric.label}</p>
            <p className={`mt-3 text-2xl font-semibold ${tone}`}>
              {loading ? (
                <span className="inline-block h-6 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
              ) : (
                displayValue
              )}
            </p>
            {metric.helper && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{metric.helper}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
