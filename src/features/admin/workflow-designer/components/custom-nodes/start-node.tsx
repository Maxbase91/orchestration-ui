import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Play } from 'lucide-react';

export type StartNodeData = { label: string };
type StartNodeType = Node<StartNodeData, 'start'>;

export function StartNode({ data, selected }: NodeProps<StartNodeType>) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border-2 bg-ok-soft px-5 py-2.5 shadow-sm ${
        selected ? 'border-green-600 ring-2 ring-ok-line' : 'border-ok-line'
      }`}
      style={{ minWidth: 140 }}
    >
      <Play className="h-4 w-4 text-ok" />
      <span className="text-sm font-medium text-ok">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-ok !h-2.5 !w-2.5" />
    </div>
  );
}
