import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw, UserPlus, ArrowUpRight, Ban, ShoppingCart, Loader2, Gavel } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProcurementRequest } from '@/data/types';
import { useCreatePurchaseOrder } from '@/lib/db/hooks/use-purchase-orders';
import { useCreateSourcingEvent, useSourcingEventsForRequest } from '@/lib/db/hooks/use-sourcing-events';
import { useInviteSuppliers } from '@/lib/db/hooks/use-sourcing-responses';
import { nextSourcingEventId } from '@/lib/db/sourcing-events';
import { useSupplierLookup } from '@/lib/db/hooks/use-suppliers';
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
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  // Initialised from the request rather than passed as defaultValue on a
  // controlled Input — defaultValue is inert once `value` is set.
  const [eventType, setEventType] = useState<'RFI' | 'RFP' | 'RFQ'>('RFP');
  const [eventDeadline, setEventDeadline] = useState('');

  const currentUser = useAuthStore((s) => s.currentUser);
  useApprovals();
  const { byRequest } = useApprovalLookup();
  const updateApproval = useUpdateApproval();
  const createPO = useCreatePurchaseOrder();
  const createEvent = useCreateSourcingEvent();
  const inviteSuppliers = useInviteSuppliers();
  const lookupSupplier = useSupplierLookup();
  // When an event already exists the button opens it rather than creating a
  // second one for the same demand.
  const { data: linkedEvents = [] } = useSourcingEventsForRequest(request.id);
  const existingEvent = linkedEvents[0];

  const isPOStage = request.status === 'po';
  // Gated on the stage, deliberately not on request.sourcingType: that column
  // only fills for requests created after it was added, so gating on it would
  // hide the action on every existing request — including the ones stuck here.
  const isSourcingStage = request.status === 'sourcing';

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

  /**
   * Raise a sourcing event from this request — the sourcing-stage analogue of
   * handleCreatePO. The link is stored on the child (sourcing_events.request_id),
   * matching how a PO carries its requestId.
   *
   * The id is awaited, unlike the PO's synchronous Date.now() id, because event
   * numbering comes from a Postgres sequence.
   */
  async function handleCreateSourcingEvent() {
    try {
      const id = await nextSourcingEventId();
      await createEvent.mutateAsync({
        id,
        requestId: request.id,
        title: request.title,
        description: request.description,
        // The request's category is a slug ('services'); the event's is a free
        // text label. Left blank rather than mis-mapped — the wizard's Select
        // cannot display a value outside its own list.
        category: '',
        type: eventType,
        status: 'draft',
        budget: request.value,
        currency: request.currency,
        deadline: eventDeadline || undefined,
        ownerId: currentUser.id,
        requirements: [],
        criteria: [],
      });

      // Seed the incumbent as the first invitation when the request already
      // names a supplier — they are the one party certain to be in scope.
      const supplier = lookupSupplier(request.supplierId);
      if (supplier) {
        await inviteSuppliers.mutateAsync({
          eventId: id,
          suppliers: [{ id: supplier.id, name: supplier.name }],
          actor: { id: currentUser.id, name: currentUser.name },
        });
      }

      setEventDialogOpen(false);
      toast.success(`Sourcing event ${id} created`);
      navigate(`/sourcing/${id}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create sourcing event');
    }
  }

  if (isTerminal) return null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {isSourcingStage && (
          existingEvent ? (
            <Button size="sm" variant="outline" onClick={() => navigate(`/sourcing/${existingEvent.id}`)}>
              <Gavel className="size-3.5" />
              Open sourcing event
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setEventDialogOpen(true)}
            >
              <Gavel className="size-3.5" />
              Create sourcing event
            </Button>
          )
        )}
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

      {/* Create sourcing event dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sourcing Event</DialogTitle>
            <DialogDescription>
              Pre-filled from request {request.id}. The event opens as a draft — add
              requirements, criteria and suppliers before publishing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Budget</span>
                <p className="font-medium">€{request.value.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Incumbent</span>
                <p className="font-medium">{lookupSupplier(request.supplierId)?.name ?? '—'}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-type">Event Type</Label>
              <div className="flex gap-2">
                {(['RFI', 'RFP', 'RFQ'] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={eventType === t ? 'default' : 'outline'}
                    onClick={() => setEventType(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-deadline">Response Deadline</Label>
              <Input
                id="event-deadline"
                type="date"
                value={eventDeadline}
                onChange={(e) => setEventDeadline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSourcingEvent} disabled={createEvent.isPending}>
              {createEvent.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Create event
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
