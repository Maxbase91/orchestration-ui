import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw, UserPlus, ArrowUpRight, Ban } from 'lucide-react';
import type { ProcurementRequest } from '@/data/types';
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

interface ActionButtonsProps {
  request: ProcurementRequest;
}

export function ActionButtons({ request }: ActionButtonsProps) {
  const [referBackOpen, setReferBackOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'cancel' | null>(null);

  const isTerminal = request.status === 'completed' || request.status === 'cancelled';
  const isApprovalStage = request.status === 'approval';

  function handleConfirm() {
    if (confirmAction === 'approve') {
      toast.success('Request approved successfully');
    } else if (confirmAction === 'reject') {
      toast.error('Request rejected');
    } else if (confirmAction === 'cancel') {
      toast.warning('Request cancelled');
    }
    setConfirmAction(null);
  }

  if (isTerminal) return null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {isApprovalStage && (
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
      <ReassignDialog open={reassignOpen} onOpenChange={setReassignOpen} />
      <EscalateDialog open={escalateOpen} onOpenChange={setEscalateOpen} />

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
