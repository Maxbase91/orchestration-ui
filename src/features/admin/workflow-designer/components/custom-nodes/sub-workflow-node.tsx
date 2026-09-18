import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export type SubWorkflowNodeData = {
  label: string;
  workflowId?: string;
};
type SubWorkflowNodeType = Node<SubWorkflowNodeData, 'subWorkflow'>;

export function SubWorkflowNode({ data, selected }: NodeProps<SubWorkflowNodeType>) {
  return (
    <div
      className={`rounded-lg border-2 border-dashed bg-accent-soft px-4 py-3 shadow-sm ${
        selected ? 'border-blue-600 ring-2 ring-accent-line' : 'border-accent-line'
      }`}
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent-solid !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-accent-soft">
          <GitBranch className="h-4 w-4 text-accent-solid" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-accent-solid">Sub-workflow</div>
          <div className="text-sm font-semibold text-accent-solid">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-accent-solid !h-2.5 !w-2.5" />
    </div>
  );
}
