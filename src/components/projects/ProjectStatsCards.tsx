'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { ProjectStats } from '@/types/project';
import { formatDateTimeLocal } from '@/lib/dates';

type Props = {
	stats: ProjectStats | null;
	loading?: boolean;
};

const cards = [
	{
		key: 'totalProjects' as const,
		title: '项目总数',
		prefix: '',
		accent: 'text-blue-600 dark:text-blue-300',
		bg: 'bg-blue-50 dark:bg-blue-900/20',
	},
	{
		key: 'activeProjects' as const,
		title: '进行中',
		prefix: '',
		accent: 'text-emerald-600 dark:text-emerald-300',
		bg: 'bg-emerald-50 dark:bg-emerald-900/20',
	},
	{
		key: 'completedProjects' as const,
		title: '已完成',
		prefix: '',
		accent: 'text-indigo-600 dark:text-indigo-300',
		bg: 'bg-indigo-50 dark:bg-indigo-900/20',
	},
	{
		key: 'costUtilization' as const,
		title: '成本占用率',
		prefix: '',
		format: (value: number) => `${value.toFixed(1)}%`,
		accent: 'text-amber-600 dark:text-amber-300',
		bg: 'bg-amber-50 dark:bg-amber-900/20',
	},
];

export default function ProjectStatsCards({ stats, loading }: Props) {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
			{cards.map((card) => {
				const value = stats ? (stats[card.key] as number) : 0;
				return (
					<div key={card.key} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
						<div className="text-sm text-muted-foreground">{card.title}</div>
						<div className={`mt-3 text-3xl font-semibold ${card.accent}`}>
							{loading ? <Skeleton className="h-8 w-24" /> : card.format ? card.format(value) : `${card.prefix}${value}`}
						</div>
						<div className={`mt-4 rounded-xl px-3 py-2 text-xs text-muted-foreground ${card.bg}`}>
							更新于 {stats ? formatDateTimeLocal(new Date()) ?? '--' : '--'}
						</div>
					</div>
				);
			})}
		</div>
	);
}