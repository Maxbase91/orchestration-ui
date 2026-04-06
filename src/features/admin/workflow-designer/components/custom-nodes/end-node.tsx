import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Square } from 'lucide-react';

export type EndNodeData = { label: string };
type EndNodeType = Node<EndNodeData, 'end'>;

export function EndNode({ data, selected }: NodeProps<EndNodeType>) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border-2 bg-red-50 px-5 py-2.5 shadow-sm ${
        selected ? 'border-red-600 ring-2 ring-red-300' : 'border-red-400'
      }`}
      style={{ minWidth: 140 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-red-500 !h-2.5 !w-2.5" />
      <Square className="h-4 w-4 text-red-600" />
      <span className="text-sm font-medium text-red-800">{data.label}</span>
    </div>
  );
}
