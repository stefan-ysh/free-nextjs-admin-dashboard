'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProjectPriority, ProjectStatus } from '@/types/project';
import { projectPriorityOptions, projectStatusOptions } from './constants';

type FilterValue = {
	search?: string;
	status?: ProjectStatus | 'all';
	priority?: ProjectPriority;
	managerId?: string;
};

type Props = {
	value: FilterValue;
	onChange: (value: FilterValue) => void;
	disabled?: boolean;
};

const statusOptions: Array<{ value: ProjectStatus | 'all'; label: string }> = [
	{ value: 'all', label: '全部状态' },
	...projectStatusOptions,
];

const priorityOptions: Array<{ value: ProjectPriority | 'all'; label: string }> = [
	{ value: 'all', label: '全部优先级' },
	...projectPriorityOptions,
];

export default function ProjectFilters({ value, onChange, disabled }: Props) {
	const [search, setSearch] = useState(value.search ?? '');

	useEffect(() => {
		setSearch(value.search ?? '');
	}, [value.search]);

	useEffect(() => {
		const trimmed = search.trim();
		const currentSearch = value.search ?? '';
		if (trimmed === currentSearch) {
			return;
		}

		const timer = window.setTimeout(() => {
			onChange({ ...value, search: trimmed });
		}, 300);
		return () => window.clearTimeout(timer);
	}, [search, value, onChange]);

	const selectedStatus = useMemo(() => value.status ?? 'all', [value.status]);
	const selectedPriority = useMemo(() => value.priority ?? 'all', [value.priority]);

	return (
		<div className="rounded-xl border border-border bg-card p-3 shadow-sm">
			<div className="flex flex-wrap gap-2">
				<label className="flex-1 min-w-[200px]">
					<span className="sr-only">搜索</span>
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							placeholder="搜索项目名称、编号、客户..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="h-9 pl-9 text-sm"
							disabled={disabled}
						/>
					</div>
				</label>

				<div className="w-[140px]">
					<Select
						value={selectedStatus}
						onValueChange={(next) => onChange({ ...value, status: next as FilterValue['status'] })}
						disabled={disabled}
					>
						<SelectTrigger className="h-9 text-sm">
							<SelectValue placeholder="状态" />
						</SelectTrigger>
						<SelectContent>
							{statusOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="w-[140px]">
					<Select
						value={selectedPriority}
						onValueChange={(next) => onChange({ ...value, priority: next === 'all' ? undefined : (next as ProjectPriority) })}
						disabled={disabled}
					>
						<SelectTrigger className="h-9 text-sm">
							<SelectValue placeholder="优先级" />
						</SelectTrigger>
						<SelectContent>
							{priorityOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}