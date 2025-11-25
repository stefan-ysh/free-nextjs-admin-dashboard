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
      color: 'text-green-600 dark:text-green-400',
      icon: '↑',
    },
    {
      title: '总支出',
      value: stats.totalExpense,
      color: 'text-red-600 dark:text-red-400',
      icon: '↓',
    },
    {
      title: '净收支',
      value: stats.balance,
      color: stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
      icon: '=',
    },
    {
      title: '记录数',
      value: stats.recordCount,
      color: 'text-purple-600 dark:text-purple-400',
      icon: '#',
      isCount: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <span className={`text-2xl ${card.color}`}>{card.icon}</span>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>
              {card.isCount ? card.value : `¥${card.value.toFixed(2)}`}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
