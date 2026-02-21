import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Square } from 'lucide-react';

function EndNode({ selected }: { selected: boolean }) {
  return (
    <div className={`
      flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm
      bg-rose-500 dark:bg-rose-600 text-white border-2
      ${selected ? 'border-rose-300 ring-2 ring-rose-400/40' : 'border-rose-600 dark:border-rose-700'}
    `}>
      <Square size={8} className="fill-white" />
      <span className="text-xs font-semibold">结束</span>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-white !border-rose-600" />
    </div>
  );
}

export default memo(EndNode);
