import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CheckCircle } from 'lucide-react';

export type ApprovalNodeData = {
  label: string;
  approver?: string;
  approvalType?: 'single' | 'majority' | 'unanimous';
  timeout?: number;
  autoApproveConditions?: string;
  allowDelegation?: boolean;
};
type ApprovalNodeType = Node<ApprovalNodeData, 'approval'>;

export function ApprovalNode({ data, selected }: NodeProps<ApprovalNodeType>) {
  return (
    <div
      className={`rounded-lg border-2 bg-amber-50 px-4 py-3 shadow-sm ${
        selected ? 'border-amber-600 ring-2 ring-amber-300' : 'border-amber-300'
      }`}
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-100">
          <CheckCircle className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-amber-400">Approval</div>
          <div className="text-sm font-semibold text-amber-900">{data.label}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="approved"
        className="!bg-green-500 !h-2.5 !w-2.5"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="rejected"
        className="!bg-red-500 !h-2.5 !w-2.5"
        style={{ left: '70%' }}
      />
    </div>
  );
}
