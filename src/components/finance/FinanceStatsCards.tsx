'use client';

import DataState from '@/components/common/DataState';
import { FinanceStats } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FinanceStatsCardsProps {
  stats: FinanceStats | null;
  loading?: boolean;
}

export default function FinanceStatsCards({ stats, loading = false }: FinanceStatsCardsProps) {
  if (loading) {
    return (
      <DataState
        variant="loading"
        title="统计概览加载中"
        description="我们正在刷新收入与支出指标"
        className="min-h-[200px]"
      />
    );
  }

  if (!stats) {
    return (
      <DataState
        variant="empty"
        title="暂无可用统计"
        description="点击“立即刷新”获取最新的财务指标"
        className="min-h-[200px]"
      />
    );
  }

  const cards = [
    {
      title: '总收入',
      value: stats.totalIncome,
      color: 'text-chart-5',
      icon: '↑',
    },
    {
      title: '总支出',
      value: stats.totalExpense,
      color: 'text-destructive',
      icon: '↓',
    },
    {
      title: '净收支',
      value: stats.balance,
      color: stats.balance >= 0 ? 'text-primary' : 'text-chart-3',
      icon: '=',
    },
    {
      title: '记录数',
      value: stats.recordCount,
      color: 'text-chart-4',
      icon: '#',
      isCount: true,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {cards.map((card) => (
        <div
          key={card.title}
          className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm"
        >
          <span className="text-base">{card.icon}</span>
          <span className="font-medium text-foreground">{card.title}</span>
          <span className={`font-semibold ${card.color}`}>
            {card.isCount ? card.value : `¥${card.value.toFixed(2)}`}
          </span>
        </div>
      ))}
    </div>
  );
}
