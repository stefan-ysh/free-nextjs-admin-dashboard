import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type DataStateVariant = 'loading' | 'empty';

interface DataStateProps {
  variant: DataStateVariant;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const defaultCopy: Record<DataStateVariant, { title: string; description: string }> = {
  loading: {
    title: '正在加载',
    description: '请稍候片刻，数据正在准备中…',
  },
  empty: {
    title: '暂无数据',
    description: '当前筛选条件下没有内容',
  },
};

export default function DataState({
  variant,
  title,
  description,
  icon,
  action,
  className,
}: DataStateProps) {
  const copy = defaultCopy[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/60 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400',
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        {icon ?? (variant === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : '∅')}
      </div>
      <p className="text-base font-semibold text-gray-900 dark:text-white">
        {title ?? copy.title}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {description ?? copy.description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
