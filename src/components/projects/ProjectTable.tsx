'use client';

import { ArrowRight, CalendarDays } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Pagination from '@/components/tables/Pagination';
import {
	projectPriorityBadgeClasses,
	projectPriorityLabels,
	projectStatusBadgeClasses,
	projectStatusLabels,
	riskLevelLabels,
} from './constants';
import type { CurrencyCode, ProjectRecord } from '@/types/project';

const currencyFormatter = (currency: CurrencyCode) =>
	new Intl.NumberFormat('zh-CN', {
		style: 'currency',
		currency: currency === 'OTHER' ? 'CNY' : currency,
		maximumFractionDigits: 0,
	});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

function formatDate(value: string | null) {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return dateFormatter.format(date);
}

function formatCurrency(value: number | null | undefined, currency: CurrencyCode) {
	if (value == null) return '—';
	return currencyFormatter(currency).format(value);
}

type PaginationState = {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
};

type ProjectTableProps = {
	projects: ProjectRecord[];
	loading?: boolean;
	pagination: PaginationState;
	onPageChange: (page: number) => void;
	onSelectProject: (projectId: string) => void;
	canManage?: boolean;
};

function ProjectTableSkeleton() {
	return (
		<TableBody>
			{Array.from({ length: 5 }).map((_, index) => (
				<TableRow key={`skeleton-${index}`}>
					{Array.from({ length: 6 }).map((__, cellIndex) => (
						<TableCell key={cellIndex} className="py-6">
							<Skeleton className="h-4 w-full" />
						</TableCell>
					))}
				</TableRow>
			))}
		</TableBody>
	);
}

export default function ProjectTable({ projects, loading, pagination, onPageChange, onSelectProject, canManage }: ProjectTableProps) {
	const renderProgress = (project: ProjectRecord) => {
		if (!project.budget || project.budget <= 0) return null;
		const ratio = project.actualCost > 0 ? Math.min(100, (project.actualCost / project.budget) * 100) : 0;
		return (
			<div className="mt-3">
				<div className="flex items-center justify-between text-[11px] text-muted-foreground">
					<span>成本占比</span>
					<span>{ratio.toFixed(0)}%</span>
				</div>
				<div className="mt-1 h-1.5 rounded-full bg-muted">
					<div className="h-full rounded-full bg-primary" style={{ width: `${ratio}%` }} />
				</div>
			</div>
		);
	};

	return (
		<div className="rounded-2xl border border-border bg-card shadow-sm">
			<div className="relative w-full overflow-x-auto">
				<Table className="min-w-[1024px] text-sm">
					<TableHeader className="bg-muted/40">
						<TableRow>
							<TableHead className="w-[22%] px-4 py-3">项目</TableHead>
							<TableHead className="w-[10%] px-4 py-3">状态</TableHead>
							<TableHead className="w-[18%] px-4 py-3">时间</TableHead>
							<TableHead className="w-[20%] px-4 py-3">预算 / 成本</TableHead>
							<TableHead className="w-[18%] px-4 py-3">合同信息</TableHead>
							<TableHead className="w-[12%] px-4 py-3 text-right">操作</TableHead>
						</TableRow>
					</TableHeader>
					{loading ? (
						<ProjectTableSkeleton />
					) : (
						<TableBody>
							{projects.length === 0 && (
								<TableRow>
									<TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
										{canManage ? '暂无数据，请尝试新建项目或调整筛选条件。' : '暂无可见项目，尝试调整筛选条件。'}
									</TableCell>
								</TableRow>
							)}
							{projects.map((project) => (
								<TableRow key={project.id} className="align-top">
									<TableCell className="px-4 py-5">
										<div className="text-base font-semibold text-foreground">{project.projectName}</div>
										<div className="mt-1 text-xs text-muted-foreground">编号：{project.projectCode}</div>
										<div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
											{project.clientName && <span>客户：{project.clientName}</span>}
											<span>负责人：{project.projectManagerId || '未指定'}</span>
											<span>成员：{project.teamMemberIds.length}</span>
										</div>
									</TableCell>
									<TableCell className="px-4 py-5">
										<div className="flex flex-col gap-2">
											<span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${projectStatusBadgeClasses[project.status]}`}>
												{projectStatusLabels[project.status]}
											</span>
											<span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${projectPriorityBadgeClasses[project.priority]}`}>
												{projectPriorityLabels[project.priority]}
											</span>
											{project.riskLevel && (
												<Badge variant="outline" className="w-fit text-xs font-normal">
													{riskLevelLabels[project.riskLevel]}
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell className="px-4 py-5">
										<div className="flex items-center gap-2 text-sm text-foreground">
											<CalendarDays className="h-4 w-4 text-muted-foreground" />
											<span>
												{formatDate(project.startDate)}
												<span className="mx-1">→</span>
												{formatDate(project.expectedEndDate ?? project.endDate)}
											</span>
										</div>
										<p className="mt-2 text-xs text-muted-foreground">更新于 {formatDate(project.updatedAt)}</p>
									</TableCell>
									<TableCell className="px-4 py-5 text-sm">
										<div>
											<div className="font-semibold text-foreground">{formatCurrency(project.budget ?? project.contractAmount, project.currency)}</div>
											<p className="text-xs text-muted-foreground">预算</p>
										</div>
										<div className="mt-3">
											<div className="font-semibold text-foreground">{formatCurrency(project.actualCost, project.currency)}</div>
											<p className="text-xs text-muted-foreground">实际成本</p>
										</div>
										{renderProgress(project)}
									</TableCell>
									<TableCell className="px-4 py-5">
										<div className="text-sm font-medium text-foreground">{project.contractNumber ?? '—'}</div>
										<p className="text-xs text-muted-foreground">合同编号</p>
										<div className="mt-3 text-sm text-foreground">{project.partyA ?? '甲方未填写'}</div>
										<p className="text-xs text-muted-foreground">甲方</p>
									</TableCell>
									<TableCell className="px-4 py-5 text-right">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onSelectProject(project.id)}
										>
											查看详情
											<ArrowRight className="ml-1.5 h-3.5 w-3.5" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					)}
				</Table>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
				<div>
					共 {pagination.total} 个项目 · 第 {pagination.page}/{pagination.totalPages} 页
				</div>
				<Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={onPageChange} />
			</div>
		</div>
	);
}
