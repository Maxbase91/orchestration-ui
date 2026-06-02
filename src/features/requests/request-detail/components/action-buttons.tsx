import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw, UserPlus, ArrowUpRight, Ban, ShoppingCart, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProcurementRequest } from '@/data/types';
import { useCreatePurchaseOrder } from '@/lib/db/hooks/use-purchase-orders';
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
import { advanceWorkflow, areAllApprovalsComplete } from '@/lib/workflow/engine';

interface ActionButtonsProps {
  request: ProcurementRequest;
}

export function ActionButtons({ request }: ActionButtonsProps) {
  const navigate = useNavigate();
  const [referBackOpen, setReferBackOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [poDeliveryDate, setPoDeliveryDate] = useState('');

  const currentUser = useAuthStore((s) => s.currentUser);
  useApprovals();
  const { byRequest } = useApprovalLookup();
  const updateApproval = useUpdateApproval();
  const createPO = useCreatePurchaseOrder();

  const isPOStage = request.status === 'po';

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

      // For rejections and cancellations always advance the engine immediately.
      // For approvals: only advance when ALL parallel approval entries are done.
      if (confirmAction === 'reject' || confirmAction === 'cancel') {
        await advanceWorkflow(request.id, config.action);
      } else if (confirmAction === 'approve' && isApprovalStage) {
        const allDone = await areAllApprovalsComplete(request.id);
        if (allDone) {
          await advanceWorkflow(request.id, 'approved');
        }
        // else: other approvers still pending — engine stays suspended
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

  async function handleCreatePO() {
    const poId = `PO-${Date.now().toString().slice(-6)}`;
    try {
      await createPO.mutateAsync({
        id: poId,
        supplierId: request.supplierId ?? 'SUP-001',
        supplierName: request.supplierId ?? 'Supplier',
        value: request.value,
        status: 'submitted',
        createdAt: new Date().toISOString(),
        deliveryDate: poDeliveryDate || request.deliveryDate || new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
        contractId: request.contractId,
        requestId: request.id,
        lineItems: [{ description: request.title, quantity: 1, unitPrice: request.value, received: 0 }],
      });
      setPoDialogOpen(false);
      toast.success(`PO ${poId} created`);
      navigate(`/purchasing/orders/${poId}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create PO');
    }
  }

  if (isTerminal) return null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {isPOStage && (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setPoDialogOpen(true)}
          >
            <ShoppingCart className="size-3.5" />
            Create PO
          </Button>
        )}
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

      {/* Create PO dialog */}
      <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Pre-filled from request {request.id}. Review and confirm before creating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{request.supplierId ?? '—'}</p></div>
              <div><span className="text-muted-foreground">Value</span><p className="font-medium">€{request.value.toLocaleString()}</p></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-delivery">Expected Delivery Date</Label>
              <Input
                id="po-delivery"
                type="date"
                value={poDeliveryDate}
                onChange={(e) => setPoDeliveryDate(e.target.value)}
                defaultValue={request.deliveryDate}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePO} disabled={createPO.isPending}>
              {createPO.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
