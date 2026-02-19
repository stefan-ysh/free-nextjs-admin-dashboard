'use client';

import { getPurchaseStatusText, type PurchaseStatus } from '@/types/purchase';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<PurchaseStatus, string> = {
	draft: 'badge-premium badge-premium-secondary',
	pending_approval: 'badge-premium badge-premium-warning',
	pending_inbound: 'badge-premium badge-premium-info',
	approved: 'badge-premium badge-premium-success',
	rejected: 'badge-premium badge-premium-error',
	paid: 'badge-premium badge-premium-success',
	cancelled: 'badge-premium badge-premium-secondary',
};

type PurchaseStatusBadgeProps = {
	status: PurchaseStatus;
	className?: string;
};

export default function PurchaseStatusBadge({ status, className }: PurchaseStatusBadgeProps) {
	const label = getPurchaseStatusText(status);
	return (
		<span className={cn(STATUS_STYLES[status], className)}>
			{label}
		</span>
	);
}

