// Workflow designer canvas node: timer/wait step with an on-expiry action
// (escalate, skip, or notify). Configured in the node config panel.

import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Clock } from 'lucide-react';

export type TimerNodeData = {
  label: string;
  duration?: number;
  unit?: 'hours' | 'days';
  actionOnExpiry?: 'escalate' | 'skip' | 'notify';
};
type TimerNodeType = Node<TimerNodeData, 'timer'>;

export function TimerNode({ data, selected }: NodeProps<TimerNodeType>) {
  return (
    <div
      className={`rounded-lg border-2 bg-card-2 px-4 py-3 shadow-sm ${
        selected ? 'border-line ring-2 ring-line' : 'border-line'
      }`}
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-idle !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-line">
          <Clock className="h-4 w-4 text-ink-2" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-ink-3">Timer</div>
          <div className="text-sm font-semibold text-ink">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-idle !h-2.5 !w-2.5" />
    </div>
  );
}
