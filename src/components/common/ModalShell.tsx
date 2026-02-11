import type { ReactNode } from 'react';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function renderTitle(title?: ReactNode) {
  if (title == null) return null;
  if (typeof title === 'string' || typeof title === 'number') {
    return <DialogTitle>{title}</DialogTitle>;
  }
  return title;
}

function renderDescription(description?: ReactNode) {
  if (description == null) return null;
  if (typeof description === 'string' || typeof description === 'number') {
    return <DialogDescription>{description}</DialogDescription>;
  }
  return description;
}

export type ModalShellProps = {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  bodyClassName?: string;
  className?: string;
};

export function ModalShell({
  title,
  description,
  children,
  footer,
  headerActions,
  bodyClassName,
  className,
}: ModalShellProps) {
  return (
    <div className={cn('flex min-h-0 max-h-[85vh] flex-col', className)}>
      {(title || description || headerActions) && (
        <div className="border-b border-border/60 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className={cn('flex gap-4', headerActions ? 'items-start justify-between' : '')}>
            <DialogHeader className="space-y-1.5">
              {renderTitle(title)}
              {renderDescription(description)}
            </DialogHeader>
            {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
          </div>
        </div>
      )}
      <div className={cn('flex-1 overflow-y-auto px-6 py-4', bodyClassName)}>{children}</div>
      {footer ? (
        <div className="border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export default ModalShell;
