'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EMPLOYMENT_STATUS_LABELS, EmploymentStatus } from './types';

type EmployeeStatusBadgeProps = {
	status: EmploymentStatus;
};

const STATUS_STYLES: Record<EmploymentStatus, string> = {
	active: 'bg-chart-5/15 text-chart-5',
	on_leave: 'bg-chart-3/15 text-chart-3',
	terminated: 'bg-destructive/15 text-destructive',
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
