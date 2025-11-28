'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CalendarDays, ClipboardCopy, FileText, Link2, Loader2, RefreshCw, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/components/ui/sonner';
import {
	milestoneStatusLabels,
	projectPriorityBadgeClasses,
	projectPriorityLabels,
	projectStatusBadgeClasses,
	projectStatusLabels,
	riskLevelLabels,
} from './constants';
import type { ProjectMilestone, ProjectRecord } from '@/types/project';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

function formatDate(value: string | null) {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return dateFormatter.format(date);
}

type ProjectResponse = {
	success: boolean;
	data?: ProjectRecord;
	error?: string;
};

type Props = {
	projectId: string | null;
	onClose: () => void;
	onUpdated?: () => void;
};

function MilestoneItem({ milestone }: { milestone: ProjectMilestone }) {
	return (
		<div className="rounded-xl border border-border/60 bg-muted/30 p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="text-sm font-medium text-foreground">{milestone.title}</div>
				<Badge variant="outline" className="text-xs font-normal">
					{milestoneStatusLabels[milestone.status]}
				</Badge>
			</div>
			{milestone.description && <p className="mt-2 text-xs text-muted-foreground">{milestone.description}</p>}
			<div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
				<span>截止：{formatDate(milestone.dueDate)}</span>
				{milestone.amount != null && <span>金额：¥{milestone.amount.toLocaleString('zh-CN')}</span>}
			</div>
		</div>
	);
}

export default function ProjectDrawer({ projectId, onClose, onUpdated }: Props) {
	const [project, setProject] = useState<ProjectRecord | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const open = Boolean(projectId);

	useEffect(() => {
		if (!projectId) {
			setProject(null);
			setError(null);
			setLoading(false);
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		async function fetchProject() {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(`/api/projects/${projectId}`, {
					cache: 'no-store',
					signal: controller.signal,
				});
				const payload = (await response.json()) as ProjectResponse;
				if (!response.ok || !payload.success || !payload.data) {
					throw new Error(payload.error ?? '无法获取项目详情');
				}
				if (!cancelled) {
					setProject(payload.data);
				}
			} catch (err) {
				if (controller.signal.aborted || cancelled) return;
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setError(err instanceof Error ? err.message : '加载失败');
				setProject(null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		fetchProject();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [projectId]);

	const handleRefresh = () => {
		if (!projectId) return;
		setProject(null);
		setError(null);
		setLoading(true);
		fetch(`/api/projects/${projectId}`, { cache: 'no-store' })
			.then(async (response) => {
				const payload = (await response.json()) as ProjectResponse;
				if (!response.ok || !payload.success || !payload.data) {
					throw new Error(payload.error ?? '刷新失败');
				}
				setProject(payload.data);
				onUpdated?.();
				toast.success('已刷新', { description: '最新数据已同步。' });
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : '刷新失败');
				toast.error('刷新失败', { description: err instanceof Error ? err.message : '请稍后重试' });
			})
			.finally(() => setLoading(false));
	};

	const handleCopyId = async () => {
		if (!project) return;
		try {
			await navigator.clipboard.writeText(project.id);
			toast.success('项目 ID 已复制');
		} catch (err) {
			toast.error('复制失败', { description: err instanceof Error ? err.message : '请手动复制' });
		}
	};

	const teamMembers = useMemo(() => project?.teamMemberIds ?? [], [project]);
	const attachments = project?.attachments ?? [];

	return (
		<Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
			<SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
				<div className="flex items-center justify-between border-b border-border px-6 py-4">
					<div>
						<SheetHeader>
							<SheetTitle>{project?.projectName ?? '项目详情'}</SheetTitle>
							<SheetDescription>项目编号：{project?.projectCode ?? '请选择一个项目'}</SheetDescription>
						</SheetHeader>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="icon" onClick={handleRefresh} disabled={!projectId || loading}>
							{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
						</Button>
						<Button variant="outline" size="icon" onClick={handleCopyId} disabled={!projectId}>
							<ClipboardCopy className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-5">
					{!projectId && !loading && !error && (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							请选择左侧列表中的项目以查看详情。
						</div>
					)}

					{loading && (
						<div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
							<Loader2 className="h-6 w-6 animate-spin" />
							正在加载项目详情...
						</div>
					)}

					{error && !loading && (
						<div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
							<div className="font-medium">加载失败</div>
							<p className="mt-1">{error}</p>
							<Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
								重试
							</Button>
						</div>
					)}

					{project && !loading && !error && (
						<div className="space-y-6">
							<section className="rounded-2xl border border-border bg-card p-4">
								<div className="flex flex-wrap items-center gap-2">
									<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${projectStatusBadgeClasses[project.status]}`}>
										{projectStatusLabels[project.status]}
									</span>
									<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${projectPriorityBadgeClasses[project.priority]}`}>
										{projectPriorityLabels[project.priority]}
									</span>
									{project.riskLevel && (
										<Badge variant="outline">{riskLevelLabels[project.riskLevel]}</Badge>
									)}
								</div>
								<div className="mt-4 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
									<div>
										<p className="text-xs uppercase tracking-wide">客户</p>
										<p className="mt-1 text-base text-foreground">{project.clientName ?? '—'}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">合同编号</p>
										<p className="mt-1 text-base text-foreground">{project.contractNumber ?? '—'}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">甲方</p>
										<p className="mt-1 text-base text-foreground">{project.partyA ?? '—'}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">乙方</p>
										<p className="mt-1 text-base text-foreground">{project.partyB ?? '—'}</p>
									</div>
								</div>
								{project.description && <p className="mt-4 text-sm text-muted-foreground">{project.description}</p>}
							</section>

							<section className="rounded-2xl border border-border bg-card p-4">
								<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
									<CalendarDays className="h-4 w-4 text-muted-foreground" />
									<span>时间线</span>
								</div>
								<div className="mt-4 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
									<div>
										<p className="text-xs uppercase tracking-wide">开始</p>
										<p className="mt-1 text-base text-foreground">{formatDate(project.startDate)}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">预期结束</p>
										<p className="mt-1 text-base text-foreground">{formatDate(project.expectedEndDate ?? project.endDate)}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">签订日期</p>
										<p className="mt-1 text-base text-foreground">{formatDate(project.signingDate)}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">生效日期</p>
										<p className="mt-1 text-base text-foreground">{formatDate(project.effectiveDate)}</p>
									</div>
								</div>
							</section>

							<section className="rounded-2xl border border-border bg-card p-4">
								<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
									<FileText className="h-4 w-4 text-muted-foreground" />
									<span>财务情况</span>
								</div>
								<div className="mt-4 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
									<div>
										<p className="text-xs uppercase tracking-wide">预算</p>
										<p className="mt-1 text-base text-foreground">{project.budget != null ? `¥${project.budget.toLocaleString('zh-CN')}` : '—'}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">合同金额</p>
										<p className="mt-1 text-base text-foreground">{project.contractAmount != null ? `¥${project.contractAmount.toLocaleString('zh-CN')}` : '—'}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">实际成本</p>
										<p className="mt-1 text-base text-foreground">¥{project.actualCost.toLocaleString('zh-CN')}</p>
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide">税率</p>
										<p className="mt-1 text-base text-foreground">{project.taxRate}%</p>
									</div>
								</div>
								{project.paymentTerms && (
									<p className="mt-4 text-sm text-muted-foreground">付款条款：{project.paymentTerms}</p>
								)}
							</section>

							<section className="rounded-2xl border border-border bg-card p-4">
								<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
									<Users className="h-4 w-4 text-muted-foreground" />
									<span>团队成员</span>
								</div>
								<div className="mt-4 flex flex-wrap gap-2">
									{teamMembers.length === 0 && <p className="text-sm text-muted-foreground">暂无成员</p>}
									{teamMembers.map((memberId) => (
										<Badge key={memberId} variant="secondary" className="font-mono text-[11px]">
											{memberId}
										</Badge>
									))}
								</div>
							</section>

							<section className="rounded-2xl border border-border bg-card p-4">
								<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
									<Link2 className="h-4 w-4 text-muted-foreground" />
									<span>附件</span>
								</div>
								{attachments.length === 0 ? (
									<p className="mt-4 text-sm text-muted-foreground">暂无附件</p>
								) : (
									<ul className="mt-4 space-y-2 text-sm text-primary">
										{attachments.map((url) => (
											<li key={url}>
												<a href={url} target="_blank" rel="noreferrer" className="hover:underline">
													{url}
												</a>
											</li>
										))}
									</ul>
								)}
							</section>

							{project.milestones.length > 0 && (
								<section className="rounded-2xl border border-border bg-card p-4">
									<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
										<CalendarCheck className="h-4 w-4 text-muted-foreground" />
										<span>里程碑</span>
									</div>
									<div className="mt-4 space-y-3">
										{project.milestones.map((milestone) => (
											<MilestoneItem key={milestone.id} milestone={milestone} />
										))}
									</div>
								</section>
							)}
						</div>
					)}
				</div>

				<SheetFooter className="border-t border-border bg-card px-6 py-4">
					<Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
						关闭
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
