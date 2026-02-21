import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Mail } from 'lucide-react';
import type { WorkflowNodeData } from './ApprovalNode';

function CcNode({ data, selected }: { data: WorkflowNodeData, selected: boolean }) {
  return (
    <div className={`
      px-3 py-1.5 shadow-sm rounded-md bg-card text-card-foreground border
      ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-border'}
      min-w-[120px] max-w-[160px]
    `}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground" />
      <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-border">
        <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
          <Mail size={10} />
        </div>
        <div className="text-xs font-semibold truncate">{data.label || '抄送节点'}</div>
      </div>
      <div className="text-[10px] text-muted-foreground leading-tight">
        抄送至: {data.roles?.includes('applicant') ? '申请人' : (data.users?.length ? `${data.users.length} 人` : '未配置')}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground" />
    </div>
  );
}

export default memo(CcNode);
