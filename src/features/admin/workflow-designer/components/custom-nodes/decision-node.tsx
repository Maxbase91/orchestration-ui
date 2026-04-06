import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export type DecisionNodeData = {
  label: string;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
};
type DecisionNodeType = Node<DecisionNodeData, 'decision'>;

export function DecisionNode({ data, selected }: NodeProps<DecisionNodeType>) {
  return (
    <div className="relative" style={{ width: 140, height: 140 }}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !h-2.5 !w-2.5" />
      <div
        className={`absolute inset-0 flex items-center justify-center rounded-lg border-2 bg-amber-50 shadow-sm ${
          selected ? 'border-amber-600 ring-2 ring-amber-300' : 'border-amber-400'
        }`}
        style={{ transform: 'rotate(45deg)', width: 100, height: 100, top: 20, left: 20 }}
      >
        <div className="flex flex-col items-center gap-1" style={{ transform: 'rotate(-45deg)' }}>
          <GitBranch className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold text-amber-900 text-center leading-tight" style={{ maxWidth: 70 }}>
            {data.label}
          </span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Left}
        id="yes"
        className="!bg-green-500 !h-2.5 !w-2.5"
        style={{ top: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        className="!bg-red-500 !h-2.5 !w-2.5"
        style={{ top: '50%' }}
      />
    </div>
  );
}
