'use client';

import { FinanceStats } from '@/types/finance';

interface FinanceStatsCardsProps {
  stats: FinanceStats | null;
  loading?: boolean;
}

export default function FinanceStatsCards({ stats, loading = false }: FinanceStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="h-4 w-24 rounded bg-gray-300 dark:bg-gray-600"></div>
            <div className="mt-3 h-8 w-32 rounded bg-gray-300 dark:bg-gray-600"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      title: '总收入',
      value: stats.totalIncome,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      icon: '↑',
    },
    {
      title: '总支出',
      value: stats.totalExpense,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      icon: '↓',
    },
    {
      title: '净收支',
      value: stats.balance,
      color: stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
      bgColor: stats.balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20',
      icon: '=',
    },
    {
      title: '记录数',
      value: stats.recordCount,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      icon: '#',
      isCount: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</p>
              <p className={`mt-2 text-3xl font-bold ${card.color}`}>
                {card.isCount ? card.value : `¥${card.value.toFixed(2)}`}
              </p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.bgColor} text-2xl ${card.color}`}>
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
