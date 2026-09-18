import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Square } from 'lucide-react';

export type EndNodeData = { label: string };
type EndNodeType = Node<EndNodeData, 'end'>;

export function EndNode({ data, selected }: NodeProps<EndNodeType>) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border-2 bg-stop-soft px-5 py-2.5 shadow-sm ${
        selected ? 'border-red-600 ring-2 ring-stop-line' : 'border-stop-line'
      }`}
      style={{ minWidth: 140 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-stop !h-2.5 !w-2.5" />
      <Square className="h-4 w-4 text-stop" />
      <span className="text-sm font-medium text-stop">{data.label}</span>
    </div>
  );
}
