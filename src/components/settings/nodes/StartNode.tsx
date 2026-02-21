import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

function StartNode({ selected }: { selected: boolean }) {
  return (
    <div className={`
      flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm
      bg-green-500 dark:bg-green-600 text-white border-2
      ${selected ? 'border-green-300 ring-2 ring-green-400/40' : 'border-green-600 dark:border-green-700'}
    `}>
      <Play size={10} className="fill-white" />
      <span className="text-xs font-semibold">开始</span>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-white !border-green-600" />
    </div>
  );
}

export default memo(StartNode);
