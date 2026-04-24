import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw, UserPlus, ArrowUpRight, Ban } from 'lucide-react';
import type { ProcurementRequest } from '@/data/types';
import { apiWorkflowAction } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { ReferBackDialog } from './refer-back-dialog';
import { ReassignDialog } from './reassign-dialog';
import { EscalateDialog } from './escalate-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useApprovalLookup, useApprovals, useUpdateApproval } from '@/lib/db/hooks/use-approvals';
import { useAuthStore } from '@/stores/auth-store';

interface ActionButtonsProps {
  request: ProcurementRequest;
}

export function ActionButtons({ request }: ActionButtonsProps) {
  const [referBackOpen, setReferBackOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'cancel' | null>(null);

  const currentUser = useAuthStore((s) => s.currentUser);
  useApprovals();
  const { byRequest } = useApprovalLookup();
  const updateApproval = useUpdateApproval();

  const isTerminal = request.status === 'completed' || request.status === 'cancelled';
  const isApprovalStage = request.status === 'approval';
  // Current user's own pending approval entry on this request, if any.
  const myPendingApproval = byRequest(request.id).find(
    (a) => a.approverId === currentUser.id && a.status === 'pending',
  );
  const canApprove = isApprovalStage || Boolean(myPendingApproval);

  async function handleConfirm() {
    if (!confirmAction) return;

    const actionMap = {
      approve: { newStatus: 'sourcing', action: 'approved', successMsg: 'Request approved successfully' },
      reject: { newStatus: 'cancelled', action: 'rejected', successMsg: 'Request rejected' },
      cancel: { newStatus: 'cancelled', action: 'cancelled', successMsg: 'Request cancelled' },
    } as const;

    const config = actionMap[confirmAction];

    try {
      // If the user has a pending approval entry, stamp it first so
      // respondedAt is captured — this keeps the per-approver ledger
      // aligned with the workflow-level action.
      if (myPendingApproval && (confirmAction === 'approve' || confirmAction === 'reject')) {
        await updateApproval.mutateAsync({
          id: myPendingApproval.id,
          patch: {
            status: confirmAction === 'approve' ? 'approved' : 'rejected',
            respondedAt: new Date().toISOString(),
          },
        });
      }

      // Only progress the request via workflow-action if it's in the
      // approval stage. If the user is approving a late-stage leftover
      // approval entry (e.g. status=sourcing), just stamping their
      // entry is the right outcome.
      if (isApprovalStage) {
        await apiWorkflowAction({
          requestId: request.id,
          action: config.action,
          newStatus: config.newStatus,
        });
      }

      // Refetch so the request header, lifecycle stepper, workflow tab and
      // audit tab all reflect the new status without requiring a page reload.
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['stage-history'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });

      if (confirmAction === 'approve') {
        toast.success(config.successMsg);
      } else if (confirmAction === 'reject') {
        toast.error(config.successMsg);
      } else {
        toast.warning(config.successMsg);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      toast.error(`Action failed: ${message}`);
    }

    setConfirmAction(null);
  }

  if (isTerminal) return null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {canApprove && (
          <>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setConfirmAction('approve')}
            >
              <Check className="size-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmAction('reject')}
            >
              <X className="size-3.5" />
              Reject
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setReferBackOpen(true)}>
          <RotateCcw className="size-3.5" />
          Refer Back
        </Button>
        <Button size="sm" variant="outline" onClick={() => setReassignOpen(true)}>
          <UserPlus className="size-3.5" />
          Reassign
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEscalateOpen(true)}>
          <ArrowUpRight className="size-3.5" />
          Escalate
        </Button>
        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmAction('cancel')}>
          <Ban className="size-3.5" />
          Cancel
        </Button>
      </div>

      <ReferBackDialog open={referBackOpen} onOpenChange={setReferBackOpen} request={request} />
      <ReassignDialog open={reassignOpen} onOpenChange={setReassignOpen} request={request} />
      <EscalateDialog open={escalateOpen} onOpenChange={setEscalateOpen} request={request} />

      <Dialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'approve' && 'Approve Request'}
              {confirmAction === 'reject' && 'Reject Request'}
              {confirmAction === 'cancel' && 'Cancel Request'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'approve' && `Are you sure you want to approve ${request.id}?`}
              {confirmAction === 'reject' && `Are you sure you want to reject ${request.id}? This action cannot be undone.`}
              {confirmAction === 'cancel' && `Are you sure you want to cancel ${request.id}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Go Back
            </Button>
            <Button
              variant={confirmAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleConfirm}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
