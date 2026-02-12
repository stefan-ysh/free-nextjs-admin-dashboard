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
		accent: 'text-chart-1',
		bg: 'bg-chart-1/10',
	},
	{
		key: 'activeProjects' as const,
		title: '进行中',
		prefix: '',
		accent: 'text-chart-5',
		bg: 'bg-chart-5/10',
	},
	{
		key: 'completedProjects' as const,
		title: '已完成',
		prefix: '',
		accent: 'text-chart-4',
		bg: 'bg-chart-4/10',
	},
	{
		key: 'costUtilization' as const,
		title: '成本占用率',
		prefix: '',
		format: (value: number) => `${value.toFixed(1)}%`,
		accent: 'text-chart-3',
		bg: 'bg-chart-3/10',
	},
];

export default function ProjectStatsCards({ stats, loading }: Props) {
	return (
		<div className="flex flex-wrap gap-2">
			{cards.map((card) => {
				const value = stats ? (stats[card.key] as number) : 0;
				return (
					<div
						key={card.key}
						className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm"
					>
						<span className="font-medium text-foreground">{card.title}</span>
						<span className={`font-semibold ${card.accent}`}>
							{loading ? <Skeleton className="h-3 w-12" /> : card.format ? card.format(value) : `${card.prefix}${value}`}
						</span>
					</div>
				);
			})}
		</div>
	);
}
