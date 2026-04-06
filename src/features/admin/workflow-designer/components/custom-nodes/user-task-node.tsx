import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { User } from 'lucide-react';

export type UserTaskNodeData = {
  label: string;
  assignee?: string;
  instructions?: string;
  timeout?: number;
  escalateOnTimeout?: boolean;
};
type UserTaskNodeType = Node<UserTaskNodeData, 'userTask'>;

export function UserTaskNode({ data, selected }: NodeProps<UserTaskNodeType>) {
  return (
    <div
      className={`rounded-lg border-2 bg-blue-50 px-4 py-3 shadow-sm ${
        selected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-blue-300'
      }`}
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-blue-100">
          <User className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-blue-400">User Task</div>
          <div className="text-sm font-semibold text-blue-900">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !h-2.5 !w-2.5" />
    </div>
  );
}
