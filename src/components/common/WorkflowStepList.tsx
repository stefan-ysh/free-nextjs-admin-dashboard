
import { formatDateTimeLocal } from '@/lib/dates';
import { ReimbursementLog } from '@/types/reimbursement';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Circle, 
  FileEdit, 
  FileText, 
  XCircle, 
  Wallet, 
  ArrowLeftCircle 
} from 'lucide-react';

const ACTION_LABELS: Record<ReimbursementLog['action'], string> = {
  create: '创建草稿',
  submit: '提交审批',
  approve: '审批通过',
  reject: '驳回',
  withdraw: '撤回',
  pay: '打款',
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已审批',
  rejected: '已驳回',
  paid: '已打款',
};

const ACTION_ICONS: Record<ReimbursementLog['action'], React.ElementType> = {
  create: FileEdit,
  submit: FileText,
  approve: CheckCircle2,
  reject: XCircle,
  withdraw: ArrowLeftCircle,
  pay: Wallet,
};

const ACTION_COLORS: Record<ReimbursementLog['action'], string> = {
  create: 'text-muted-foreground',
  submit: 'text-blue-500',
  approve: 'text-green-500',
  reject: 'text-red-500',
  withdraw: 'text-orange-500',
  pay: 'text-purple-500',
};

export default function WorkflowStepList({ logs }: { logs: ReimbursementLog[] }) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无流程记录</p>;
  }

  return (
    <div className="relative space-y-0 pl-2">
      {logs.map((log, index) => {
        const isLast = index === logs.length - 1;
        const Icon = ACTION_ICONS[log.action] || Circle;
        const colorClass = ACTION_COLORS[log.action] || 'text-muted-foreground';

        return (
          <div key={log.id} className={cn("relative pl-8 pb-8", isLast ? "pb-0" : "")}>
            {/* Timeline Line */}
            {!isLast && (
              <div 
                className="absolute left-[11px] top-6 h-full w-[2px] bg-border/40" 
                aria-hidden="true" 
              />
            )}
            
            {/* Icon/Dot */}
            <div 
              className={cn(
                "absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background ring-1 ring-border shadow-sm",
                colorClass
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="text-sm font-medium text-foreground">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTimeLocal(log.createdAt)}
                </span>
              </div>
              
              <div className="text-xs text-muted-foreground">
                <span className={cn(
                   "inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80",
                )}>
                  {STATUS_LABELS[log.fromStatus] ?? log.fromStatus} 
                  <span className="mx-1 text-muted-foreground/50">→</span> 
                  {STATUS_LABELS[log.toStatus] ?? log.toStatus}
                </span>
              </div>

              {log.comment && (
                <div className="mt-1 rounded-md bg-muted/30 px-3 py-2 text-xs text-foreground/90 border border-border/40">
                  {log.comment}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
