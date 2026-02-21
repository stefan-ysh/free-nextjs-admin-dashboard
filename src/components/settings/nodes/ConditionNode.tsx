import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { WorkflowNodeData } from './ApprovalNode';

function ConditionNode({ data, selected }: { data: WorkflowNodeData, selected: boolean }) {
  const conditionField = (data as Record<string, unknown>).conditionField as string | undefined;
  const conditionOp = (data as Record<string, unknown>).conditionOp as string | undefined;
  const conditionValue = (data as Record<string, unknown>).conditionValue as string | undefined;

  const hasCondition = conditionField && conditionOp;
  const opLabel: Record<string, string> = {
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    eq: '=',
    neq: '≠',
  };

  return (
    <div className={`
      px-3 py-1.5 shadow-sm rounded-md bg-card text-card-foreground border
      ${selected ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'}
      min-w-[120px] max-w-[180px]
    `}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-violet-500" />
      <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-border">
        <div className="w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
          <GitBranch size={10} />
        </div>
        <div className="text-xs font-semibold truncate">{data.label || '条件分支'}</div>
      </div>
      <div className="text-[10px] text-muted-foreground leading-tight">
        {hasCondition
          ? `${conditionField} ${opLabel[conditionOp] || conditionOp} ${conditionValue || ''}`
          : '未配置条件'
        }
      </div>
      {/* 条件分支有两个输出：满足 (true) 和不满足 (false) */}
      <Handle type="source" position={Position.Bottom} id="true" className="!w-2 !h-2 !bg-green-500 !left-[30%]" />
      <Handle type="source" position={Position.Bottom} id="false" className="!w-2 !h-2 !bg-rose-500 !left-[70%]" />
    </div>
  );
}

export default memo(ConditionNode);
