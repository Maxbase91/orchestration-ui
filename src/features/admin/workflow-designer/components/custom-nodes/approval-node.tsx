// Workflow designer canvas node: approval step (single/majority/unanimous,
// timeout, delegation). Configured in the node config panel.

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
      className={`rounded-lg border-2 bg-warn-soft px-4 py-3 shadow-sm ${
        selected ? 'border-amber-600 ring-2 ring-warn-line' : 'border-warn-line'
      }`}
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-warn !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-warn-soft">
          <CheckCircle className="h-4 w-4 text-warn" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-warn">Approval</div>
          <div className="text-sm font-semibold text-warn">{data.label}</div>
        </div>
      </div>
      {/* Two named outcome handles — edges bind to these ids, so renaming
          "approved"/"rejected" would silently orphan saved template edges. */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="approved"
        className="!bg-ok !h-2.5 !w-2.5"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="rejected"
        className="!bg-stop !h-2.5 !w-2.5"
        style={{ left: '70%' }}
      />
    </div>
  );
}
