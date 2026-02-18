'use client';

import { getPurchaseStatusText, type PurchaseStatus } from '@/types/purchase';

const STATUS_STYLES: Record<PurchaseStatus, string> = {
	draft: 'bg-muted text-muted-foreground',
	pending_approval: 'bg-chart-3/20 text-chart-3',
	pending_inbound: 'bg-chart-4/20 text-chart-4',
	approved: 'bg-chart-5/15 text-chart-5',
	rejected: 'bg-destructive/15 text-destructive',
	paid: 'bg-chart-1/15 text-chart-1',
	cancelled: 'bg-secondary/70 text-secondary-foreground',
};

type PurchaseStatusBadgeProps = {
	status: PurchaseStatus;
	className?: string;
};

export default function PurchaseStatusBadge({ status, className }: PurchaseStatusBadgeProps) {
	const label = getPurchaseStatusText(status);
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]} ${className ?? ''}`.trim()}
		>
			{label}
		</span>
	);
}
