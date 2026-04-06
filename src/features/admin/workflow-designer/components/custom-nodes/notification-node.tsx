import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Bell } from 'lucide-react';

export type NotificationNodeData = {
  label: string;
  channels?: ('email' | 'in-app' | 'sms')[];
  recipient?: string;
  template?: string;
};
type NotificationNodeType = Node<NotificationNodeData, 'notification'>;

export function NotificationNode({ data, selected }: NodeProps<NotificationNodeType>) {
  return (
    <div
      className={`rounded-lg border-2 bg-sky-50 px-4 py-3 shadow-sm ${
        selected ? 'border-sky-600 ring-2 ring-sky-300' : 'border-sky-300'
      }`}
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-sky-500 !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-sky-100">
          <Bell className="h-4 w-4 text-sky-600" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-sky-400">Notification</div>
          <div className="text-sm font-semibold text-sky-900">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500 !h-2.5 !w-2.5" />
    </div>
  );
}
