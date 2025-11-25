'use client';

import { useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';

import ProjectStatsCards from '@/components/projects/ProjectStatsCards';
import ProjectFilters from '@/components/projects/ProjectFilters';
import ProjectTable from '@/components/projects/ProjectTable';
import ProjectDrawer from '@/components/projects/ProjectDrawer';
import ProjectFormDialog from '@/components/projects/ProjectFormDialog';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectStats } from '@/hooks/projects/useProjectStats';
import { useProjectList } from '@/hooks/projects/useProjectList';
import type { ProjectPriority, ProjectStatus } from '@/types/project';

export default function ProjectsPage() {
	const { hasPermission } = usePermissions();
	const canCreate = hasPermission('PROJECT_CREATE');
	const canViewAll = hasPermission('PROJECT_VIEW_ALL');
	const [filters, setFilters] = useState<{ search: string; status: ProjectStatus | 'all'; priority?: ProjectPriority }>({
		search: '',
		status: 'all',
		priority: undefined,
	});
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);

	const { stats, loading: statsLoading, refresh: refreshStats } = useProjectStats();
	const {
		projects,
		loading: listLoading,
		refresh: refreshList,
		pagination,
		setPage,
	} = useProjectList({
		filters,
	});

	const canManage = useMemo(() => canCreate, [canCreate]);

	const handleRefresh = () => {
		refreshStats();
		refreshList();
	};

	return (
		<div className="space-y-6">

			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<span>访问范围：</span>
					<span className={canViewAll ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
						{canViewAll ? '全部项目' : '仅个人/参与项目'}
					</span>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" onClick={handleRefresh} disabled={statsLoading || listLoading}>
						<RefreshCw className="mr-2 h-4 w-4" />刷新
					</Button>
					{canManage && (
						<Button size="sm" onClick={() => setShowForm(true)}>
							<Plus className="mr-2 h-4 w-4" />新建项目
						</Button>
					)}
				</div>
			</div>

			<ProjectStatsCards stats={stats} loading={statsLoading} />

			<ProjectFilters
				value={{ ...filters, search: filters.search }}
				onChange={(v) => setFilters({ search: v.search ?? '', status: v.status ?? 'all', priority: v.priority })}
				disabled={listLoading}
			/>

			<ProjectTable
				projects={projects}
				loading={listLoading}
				pagination={pagination}
				onPageChange={setPage}
				onSelectProject={(projectId) => setSelectedProjectId(projectId)}
				canManage={canManage}
			/>

			<ProjectFormDialog
				open={showForm}
				onOpenChange={setShowForm}
				onSuccess={() => {
					setShowForm(false);
					refreshList();
					refreshStats();
				}}
			/>

			<ProjectDrawer
				projectId={selectedProjectId}
				onClose={() => setSelectedProjectId(null)}
				onUpdated={() => {
					refreshList();
					refreshStats();
				}}
			/>
		</div>
	);
}