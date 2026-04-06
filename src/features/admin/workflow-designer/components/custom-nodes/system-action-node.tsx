import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Cog } from 'lucide-react';

export type SystemActionNodeData = {
  label: string;
  actionType?: 'send-email' | 'update-status' | 'create-po';
  configuration?: string;
};
type SystemActionNodeType = Node<SystemActionNodeData, 'systemAction'>;

export function SystemActionNode({ data, selected }: NodeProps<SystemActionNodeType>) {
  return (
    <div
      className={`rounded-lg border-2 bg-gray-50 px-4 py-3 shadow-sm ${
        selected ? 'border-gray-600 ring-2 ring-gray-300' : 'border-gray-300'
      }`}
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-gray-200">
          <Cog className="h-4 w-4 text-gray-600" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">System</div>
          <div className="text-sm font-semibold text-gray-900">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !h-2.5 !w-2.5" />
    </div>
  );
}
