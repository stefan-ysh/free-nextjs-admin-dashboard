'use client';

import { useEffect, useMemo, useState } from 'react';

import {
	projectPriorityBadgeClasses,
	projectPriorityLabels,
	projectStatusBadgeClasses,
	projectStatusLabels,
} from '@/components/projects/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProjectRecord } from '@/types/project';

type ProjectsResponse = {
	success: boolean;
	data: {
		items: ProjectRecord[];
		total: number;
		page: number;
		pageSize: number;
	};
	error?: string;
};

type ProjectDetailResponse = {
	success: boolean;
	data?: ProjectRecord;
	error?: string;
};

type ProjectSelectorProps = {
	value: string;
	onChange: (projectId: string, project?: ProjectRecord | null) => void;
	disabled?: boolean;
	helperText?: string;
};

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export default function ProjectSelector({ value, onChange, disabled = false, helperText }: ProjectSelectorProps) {
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [projects, setProjects] = useState<ProjectRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
	const [resolvingSelection, setResolvingSelection] = useState(false);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setDebouncedSearch(search.trim());
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timer);
		};
	}, [search]);

	useEffect(() => {
		let aborted = false;

		async function loadProjects() {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams();
				params.set('page', '1');
				params.set('pageSize', String(PAGE_SIZE));
				params.set('sortBy', 'updatedAt');
				params.set('sortOrder', 'desc');
				if (debouncedSearch) {
					params.set('search', debouncedSearch);
				}
				const response = await fetch(`/api/projects?${params.toString()}`, {
					cache: 'no-store',
				});
				const payload = (await response.json()) as ProjectsResponse;
				if (!response.ok || !payload.success) {
					throw new Error(payload.error || '加载项目失败');
				}
				if (aborted) return;
				setProjects(payload.data.items);
			} catch (projectError) {
				if (aborted) return;
				setError(projectError instanceof Error ? projectError.message : '加载项目失败');
				setProjects([]);
			} finally {
				if (!aborted) setLoading(false);
			}
		}

		loadProjects();
		return () => {
			aborted = true;
		};
	}, [debouncedSearch, refreshKey]);

	useEffect(() => {
		if (!value) {
			setSelectedProject(null);
			setResolvingSelection(false);
			return;
		}

		const matched = projects.find((project) => project.id === value);
		if (matched) {
			setSelectedProject(matched);
			setResolvingSelection(false);
			return;
		}

		let aborted = false;
		setResolvingSelection(true);

		async function loadProjectById(projectId: string) {
			try {
				const response = await fetch(`/api/projects/${projectId}`, {
					cache: 'no-store',
				});
				const payload = (await response.json()) as ProjectDetailResponse;
				if (!response.ok || !payload.success || !payload.data) {
					throw new Error(payload.error || '无法加载项目');
				}
				if (aborted) return;
				setSelectedProject(payload.data);
			} catch (detailError) {
				if (aborted) return;
				console.warn('Failed to resolve project id', detailError);
				setSelectedProject(null);
			} finally {
				if (!aborted) setResolvingSelection(false);
			}
		}

		loadProjectById(value);
		return () => {
			aborted = true;
		};
	}, [value, projects]);

	const handleSelect = (project: ProjectRecord) => {
		if (disabled) return;
		setSelectedProject(project);
		onChange(project.id, project);
	};

	const handleClear = () => {
		if (disabled) return;
		setSelectedProject(null);
		onChange('', null);
	};

	const helper = helperText ?? '仅展示最近更新的 20 个项目，可通过关键词搜索名称/编号';

	const emptyStateText = useMemo(() => {
		if (error) return error;
		if (debouncedSearch) return '未找到匹配的项目，尝试调整搜索关键字';
		return '暂无可选项目或您暂未加入任何项目';
	}, [debouncedSearch, error]);

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-3 md:flex-row md:items-center">
				<Input
					type="search"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					disabled={disabled}
					placeholder="搜索项目名称、编号或客户"
					className="h-10"
				/>
				<div className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setRefreshKey((prev) => prev + 1)}
						disabled={disabled || loading}
					>
						刷新列表
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleClear}
						disabled={disabled || !value}
					>
						清除关联
					</Button>
				</div>
			</div>

			<div className="surface-card">
				{loading && (
					<div className="px-4 py-3 text-sm text-muted-foreground">正在加载项目...</div>
				)}
				{!loading && projects.length === 0 && (
					<div className="px-4 py-3 text-sm text-muted-foreground">{emptyStateText}</div>
				)}
				<div className="divide-y divide-border/70">
					{projects.map((project) => {
						const isSelected = project.id === value;
						return (
							<button
								key={project.id}
								type="button"
								onClick={() => handleSelect(project)}
								disabled={disabled}
								className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-muted/50 disabled:opacity-50 ${isSelected ? 'bg-primary/10 hover:bg-primary/10' : ''
									}`}
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="text-sm font-medium text-foreground">{project.projectName}</div>
									<span className={`rounded-full px-2 py-0.5 text-xs ${projectStatusBadgeClasses[project.status]}`}>
										{projectStatusLabels[project.status]}
									</span>
								</div>
								<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
									<span>编号：{project.projectCode}</span>
									{project.clientName && <span>客户：{project.clientName}</span>}
									<span className={`rounded-full px-2 py-0.5 ${projectPriorityBadgeClasses[project.priority]}`}>
										{projectPriorityLabels[project.priority]}
									</span>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			{value && resolvingSelection && (
				<div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
					正在同步已选项目...
				</div>
			)}

			{selectedProject && (
				<div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="font-semibold">{selectedProject.projectName}</div>
						<div className="flex items-center gap-2 text-xs font-medium">
							<span className={`rounded-full px-2 py-0.5 ${projectStatusBadgeClasses[selectedProject.status]}`}>
								{projectStatusLabels[selectedProject.status]}
							</span>
							<span className={`rounded-full px-2 py-0.5 ${projectPriorityBadgeClasses[selectedProject.priority]}`}>
								{projectPriorityLabels[selectedProject.priority]}
							</span>
						</div>
					</div>
					<div className="mt-2 space-y-1 text-xs">
						<p>项目编号：{selectedProject.projectCode}</p>
						{selectedProject.clientName && <p>客户：{selectedProject.clientName}</p>}
						{selectedProject.budget != null && (
							<p>
								预算：¥{selectedProject.budget.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}
							</p>
						)}
						{selectedProject.actualCost != null && selectedProject.actualCost > 0 && (
							<p>
								累计成本：¥{selectedProject.actualCost.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}
							</p>
						)}
					</div>
				</div>
			)}

			<p className="text-xs text-muted-foreground">{helper}</p>
		</div>
	);
}
