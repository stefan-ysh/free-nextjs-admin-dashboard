import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import type { WorkflowNodeData } from './ApprovalNode';

function ConditionWaitNode({ data, selected }: { data: WorkflowNodeData, selected: boolean }) {
  return (
    <div className={`
      px-3 py-1.5 shadow-sm rounded-md bg-card text-card-foreground border border-dashed
      ${selected ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-border'}
      min-w-[120px] max-w-[160px]
    `}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-amber-400" />
      <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-border">
        <div className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <Clock size={10} />
        </div>
        <div className="text-xs font-semibold truncate">{data.label || '等待节点'}</div>
      </div>
      <div className="text-[10px] text-muted-foreground leading-tight">
        条件: {data.waitCondition ? (data.waitCondition === 'PURCHASE_ALL_INBOUND' ? '全部入库' : '财务打款') : '未配置'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-amber-400" />
    </div>
  );
}

export default memo(ConditionWaitNode);
