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
	planning: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
	active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100',
	on_hold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100',
	completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100',
	archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300',
	cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-100',
};

export const projectPriorityBadgeClasses: Record<ProjectPriority, string> = {
	low: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300',
	medium: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-100',
	high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-100',
	urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-100',
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
