'use client';

import { EMPLOYMENT_STATUS_LABELS, EmploymentStatus } from './types';

type EmployeeStatusBadgeProps = {
	status: EmploymentStatus;
};

const STATUS_STYLES: Record<EmploymentStatus, string> = {
	active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
	on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200',
	terminated: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200',
};

export default function EmployeeStatusBadge({ status }: EmployeeStatusBadgeProps) {
	return (
		<span
			className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
		>
			{EMPLOYMENT_STATUS_LABELS[status]}
		</span>
	);
}
