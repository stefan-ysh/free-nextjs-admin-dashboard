'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ProjectStats } from '@/types/project';

type StatsResponse = {
	success: boolean;
	data?: ProjectStats;
	error?: string;
};

export function useProjectStats() {
	const [stats, setStats] = useState<ProjectStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchStats = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch('/api/projects/stats', { cache: 'no-store' });
			const payload: StatsResponse = await response.json();
			if (!response.ok || !payload.success || !payload.data) {
				throw new Error(payload.error ?? '获取项目统计失败');
			}
			setStats(payload.data);
		} catch (err) {
			console.error('加载项目统计失败', err);
			setError(err instanceof Error ? err.message : '加载失败');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStats();
	}, [fetchStats]);

	return {
		stats,
		loading,
		error,
		refresh: fetchStats,
	};
}