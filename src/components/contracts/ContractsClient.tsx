'use client';

import { useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';

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

type ContractsFilter = {
	search?: string;
	status?: ProjectStatus | 'all';
	priority?: ProjectPriority;
};

export default function ContractsClient() {
	const { hasPermission } = usePermissions();
	const canCreate = hasPermission('PROJECT_CREATE');
	const [filters, setFilters] = useState<ContractsFilter>({
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

	const handleFilterChange = (nextFilters: ContractsFilter) => {
		setFilters(nextFilters);
	};

	return (
		<div className="space-y-6">

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
							<FileText className="h-3.5 w-3.5" />
							合同台账
						</div>
						<h3 className="mt-3 text-lg font-semibold text-foreground">集中管理合同、项目与收支数据</h3>
						<p className="mt-1 text-sm text-muted-foreground">
							该页基于项目数据自动输出合同编号、金额、风险等级等关键字段，可直接用于财务审核、采购对齐或风险复盘。
						</p>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" onClick={handleRefresh} disabled={statsLoading || listLoading}>
							<RefreshCw className="mr-2 h-4 w-4" />刷新
						</Button>
						{canManage && (
							<Button size="sm" onClick={() => setShowForm(true)}>
								<FileText className="mr-2 h-4 w-4" />新建合同 / 项目
							</Button>
						)}
					</div>
				</div>
				<ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
					<li>自动拉通合同编号、甲乙方、金额、税率、负责人等字段，方便核对。</li>
					<li>与采购、报销模块共享项目/合同 ID，后续审批链统一。</li>
					<li>支持权限内快速编辑或导出，无需额外表格。</li>
				</ul>
			</div>

			<ProjectStatsCards stats={stats} loading={statsLoading} />

			<ProjectFilters value={filters} onChange={handleFilterChange} disabled={listLoading} />

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
