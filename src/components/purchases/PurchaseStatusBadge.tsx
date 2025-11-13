'use client';

import { PurchaseStatus } from '@/types/purchase';

type PurchaseStatusBadgeProps = {
  status: PurchaseStatus;
  className?: string;
};

const STATUS_CONFIG: Record<PurchaseStatus, { label: string; color: string }> = {
  draft: {
    label: '草稿',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  pending_approval: {
    label: '待审批',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  approved: {
    label: '已批准',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  rejected: {
    label: '已驳回',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  paid: {
    label: '已打款',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  cancelled: {
    label: '已取消',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  },
};

export default function PurchaseStatusBadge({ status, className = '' }: PurchaseStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${config.color} ${className}`}
    >
      {config.label}
    </span>
  );
}
