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
    <div className="flex flex-wrap gap-2">
      {metricConfig.map((metric) => {
        const value = stats ? stats[metric.key] : null;
        const displayValue = value !== null && value !== undefined ? value.toLocaleString() : '--';
        const tone =
          metric.emphasis === 'positive'
            ? 'text-chart-5'
            : metric.emphasis === 'negative'
              ? 'text-destructive'
              : 'text-foreground';

        return (
          <div
            key={metric.key}
            className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm"
          >
            <span className="font-medium text-foreground">{metric.label}</span>
            <span className={`font-semibold ${tone}`}>
              {loading ? (
                <span className="inline-block h-3 w-12 animate-pulse rounded bg-muted" />
              ) : (
                displayValue
              )}
            </span>
            {metric.helper && (
              <span className="text-[10px] text-muted-foreground/80">{metric.helper}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
