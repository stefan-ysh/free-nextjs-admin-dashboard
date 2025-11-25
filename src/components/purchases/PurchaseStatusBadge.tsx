'use client';

import { getPurchaseStatusText, type PurchaseStatus } from '@/types/purchase';

const STATUS_STYLES: Record<PurchaseStatus, string> = {
	draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
	pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
	approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
	rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
	paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
	cancelled: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
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
