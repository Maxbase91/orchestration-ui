import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Sparkles } from 'lucide-react';

export type AIAgentNodeData = {
  label: string;
  agentId?: string;
  confidenceThreshold?: number;
  fallbackAction?: string;
};
type AIAgentNodeType = Node<AIAgentNodeData, 'aiAgent'>;

export function AIAgentNode({ data, selected }: NodeProps<AIAgentNodeType>) {
  return (
    <div
      className={`rounded-lg border-2 bg-purple-50 px-4 py-3 shadow-sm ${
        selected ? 'border-purple-600 ring-2 ring-purple-300' : 'border-purple-300'
      }`}
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-purple-100">
          <Sparkles className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-purple-400">AI Agent</div>
          <div className="text-sm font-semibold text-purple-900">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !h-2.5 !w-2.5" />
    </div>
  );
}
