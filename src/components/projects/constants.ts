import type { ContractRiskLevel, MilestoneStatus, ProjectPriority, ProjectStatus } from '@/types/project';

export const projectStatusLabels: Record<ProjectStatus, string> = {
	planning: '计划中',
	active: '进行中',
	on_hold: '暂停',
	completed: '已完成',
	archived: '已归档',
	cancelled: '已取消',
};

export const projectPriorityLabels: Record<ProjectPriority, string> = {
	low: '较低',
	medium: '中等',
	high: '高',
	urgent: '紧急',
};

export const projectStatusBadgeClasses: Record<ProjectStatus, string> = {
	planning: 'bg-secondary/60 text-secondary-foreground',
	active: 'bg-chart-5/15 text-chart-5',
	on_hold: 'bg-chart-3/20 text-chart-3',
	completed: 'bg-chart-1/15 text-chart-1',
	archived: 'bg-muted text-muted-foreground',
	cancelled: 'bg-destructive/15 text-destructive',
};

export const projectPriorityBadgeClasses: Record<ProjectPriority, string> = {
	low: 'bg-muted text-muted-foreground',
	medium: 'bg-chart-4/15 text-chart-4',
	high: 'bg-chart-2/15 text-chart-2',
	urgent: 'bg-destructive/15 text-destructive',
};

export const projectStatusOptions = (Object.entries(projectStatusLabels) as Array<[ProjectStatus, string]>).map(([value, label]) => ({
	value,
	label,
}));

export const projectPriorityOptions = (Object.entries(projectPriorityLabels) as Array<[ProjectPriority, string]>).map(([value, label]) => ({
	value,
	label,
}));

export const riskLevelLabels: Record<ContractRiskLevel, string> = {
	low: '低风险',
	medium: '中风险',
	high: '高风险',
};

export const milestoneStatusLabels: Record<MilestoneStatus, string> = {
	pending: '待开始',
	in_progress: '进行中',
	completed: '已完成',
	delayed: '已延期',
};
