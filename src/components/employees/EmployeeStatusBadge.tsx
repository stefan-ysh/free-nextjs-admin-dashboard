'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EMPLOYMENT_STATUS_LABELS, EmploymentStatus } from './types';

type EmployeeStatusBadgeProps = {
	status: EmploymentStatus;
};

const STATUS_STYLES: Record<EmploymentStatus, string> = {
	active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
	on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
	terminated: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
};

export default function EmployeeStatusBadge({ status }: EmployeeStatusBadgeProps) {
	return (
		<Badge
			variant="secondary"
			className={cn('min-w-[72px] justify-center border-transparent text-xs font-medium capitalize', STATUS_STYLES[status])}
		>
			{EMPLOYMENT_STATUS_LABELS[status]}
		</Badge>
	);
}
