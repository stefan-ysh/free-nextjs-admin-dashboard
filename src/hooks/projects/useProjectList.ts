'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ProjectRecord, ProjectPriority, ProjectStatus } from '@/types/project';

type Filters = {
	search?: string;
	status?: ProjectStatus | 'all';
	priority?: ProjectPriority;
	managerId?: string;
};

type ListResponse = {
	success: boolean;
	data?: {
		items: ProjectRecord[];
		total: number;
		page: number;
		pageSize: number;
	};
	error?: string;
};

type Options = {
	filters?: Filters;
	pageSize?: number;
};

export function useProjectList({ filters = {}, pageSize = 20 }: Options = {}) {
	const [projects, setProjects] = useState<ProjectRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [pageSizeState, setPageSizeState] = useState(pageSize);
	const [refreshKey, setRefreshKey] = useState(0);
	const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

	useEffect(() => {
		setPage(1);
	}, [filtersKey]);

	useEffect(() => {
		let cancelled = false;
		const parsedFilters: Filters = JSON.parse(filtersKey);

		const loadProjects = async () => {
			const params = new URLSearchParams();
			params.set('page', String(page));
			params.set('pageSize', String(pageSizeState));
			params.set('sortBy', 'updatedAt');
			params.set('sortOrder', 'desc');
			if (parsedFilters.search) params.set('search', parsedFilters.search.trim());
			if (parsedFilters.status && parsedFilters.status !== 'all') params.set('status', parsedFilters.status);
			if (parsedFilters.priority) params.set('priority', parsedFilters.priority);
			if (parsedFilters.managerId) params.set('projectManagerId', parsedFilters.managerId);

			setLoading(true);
			setError(null);
			try {
				const response = await fetch(`/api/projects?${params.toString()}`, { cache: 'no-store' });
				const payload: ListResponse = await response.json();
				if (!response.ok || !payload.success || !payload.data) {
					throw new Error(payload.error ?? '加载项目列表失败');
				}
				if (cancelled) return;
				setProjects(payload.data.items);
				setTotal(payload.data.total);
				setPageSizeState(payload.data.pageSize);
			} catch (err) {
				if (cancelled) return;
				console.error('加载项目列表失败', err);
				setError(err instanceof Error ? err.message : '加载失败');
			} finally {
				if (cancelled) return;
				setLoading(false);
			}
		};

		loadProjects();
		return () => {
			cancelled = true;
		};
	}, [page, pageSizeState, filtersKey, refreshKey]);

	const pagination = useMemo(
		() => ({ page, pageSize: pageSizeState, total, totalPages: Math.max(1, Math.ceil(total / pageSizeState)) }),
		[page, pageSizeState, total]
	);

	return {
		projects,
		loading,
		error,
		refresh: () => setRefreshKey((key) => key + 1),
		pagination,
		setPage,
	};
}