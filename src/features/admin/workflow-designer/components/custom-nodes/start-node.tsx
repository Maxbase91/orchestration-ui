import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Play } from 'lucide-react';

export type StartNodeData = { label: string };
type StartNodeType = Node<StartNodeData, 'start'>;

export function StartNode({ data, selected }: NodeProps<StartNodeType>) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border-2 bg-green-50 px-5 py-2.5 shadow-sm ${
        selected ? 'border-green-600 ring-2 ring-green-300' : 'border-green-400'
      }`}
      style={{ minWidth: 140 }}
    >
      <Play className="h-4 w-4 text-green-600" />
      <span className="text-sm font-medium text-green-800">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !h-2.5 !w-2.5" />
    </div>
  );
}
