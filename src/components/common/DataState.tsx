import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type DataStateVariant = 'loading' | 'empty' | 'error';

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
  error: {
    title: '加载失败',
    description: '数据请求失败，请稍后重试',
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
        'surface-panel flex flex-col items-center justify-center border-dashed p-6 text-center text-sm text-muted-foreground',
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? (variant === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : '∅')}
      </div>
      <p className="text-base font-semibold text-foreground">
        {title ?? copy.title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {description ?? copy.description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
