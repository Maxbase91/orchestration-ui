import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw, UserPlus, ArrowUpRight, Ban, ShoppingCart, Loader2, Gavel, ArrowRight } from 'lucide-react';
import { canActOnApproval } from '@/lib/procurement/approval-derivation';
import { useIsCategoryManager } from '@/lib/db/hooks/use-category-managers';
import { useFormTemplates } from '@/lib/db/hooks/use-form-templates';
import { useFormSubmissions } from '@/lib/db/hooks/use-form-submissions';
import { useRequestSupplierCandidates } from '@/lib/db/hooks/use-request-supplier-candidates';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProcurementRequest } from '@/data/types';
import { useCreatePurchaseOrder } from '@/lib/db/hooks/use-purchase-orders';
import { useCreateSourcingEvent, useSourcingEventsForRequest } from '@/lib/db/hooks/use-sourcing-events';
import { useInviteSuppliers } from '@/lib/db/hooks/use-sourcing-responses';
import { nextSourcingEventId } from '@/lib/db/sourcing-events';
import { useServiceDescription } from '@/lib/db/hooks/use-service-descriptions';
import { useServiceDescriptionTemplate } from '@/lib/db/hooks/use-service-description-templates';
import {
  seedCriteriaFromTemplate,
  seedRequirementsFromDescription,
  sectionValuesOf,
} from '@/lib/procurement/service-description-seed';
import { useSupplierLookup } from '@/lib/db/hooks/use-suppliers';
import { invalidateRequestViews, queryClient } from '@/lib/query-client';
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
import { useWorkflowTemplate } from '@/lib/db/hooks/use-workflow-templates';
import { getWorkflowInstanceForRequest } from '@/lib/db/workflow-instances';
import { transitionStage } from '@/lib/workflow/transition';
import { gateActionLabel, isGatedStage, isTerminalStatus, nodeToStatus, type TemplateNode } from '@/lib/workflow/node-config';
import { DEFAULT_TEMPLATE } from '@/lib/procurement/service-description-defaults';
import { nextStageAfter } from '@/lib/workflow/channel-stages';
import { useChannelStageMap } from '@/lib/db/hooks/use-channel-stage-map';
import { canEnterSourcing, supplierReadyForRiskCompletion } from '@/lib/workflow/onboarding-stage';
import { getSupplier } from '@/lib/db/suppliers';
import { outstandingBlockingForms } from '@/lib/forms/form-triggers';
import { useFormTriggerContext } from '@/lib/forms/use-form-trigger-context';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';

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
  const currentRole = useAuthStore((s) => s.currentRole);
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
  // The service description this demand already produced, and the admin config
  // saying which of its sections become sourcing requirements.
  const { data: serviceDescription } = useServiceDescription(request.id);
  const { data: sdTemplate } = useServiceDescriptionTemplate(request.category);
  const existingEvent = linkedEvents[0];

  const [advancing, setAdvancing] = useState(false);

  // The stage gate. `node` is the template node the request is sitting on, which
  // carries the role that owns it and whether leaving it needs a human.
  const { data: template } = useWorkflowTemplate(request.workflowTemplateId);
  const { data: shortlist = [] } = useRequestSupplierCandidates(request.id);
  const currentNode: TemplateNode | undefined = template?.nodes.find(
    (n) => (n as TemplateNode).type === 'stage' && nodeToStatus(n.label) === request.status,
  );
  // Who may leave each gated stage.
  //
  // Approval and sourcing have their own dedicated actions below, so the generic
  // gate action would duplicate them. `po` is absent on purpose: a request
  // leaves it when goods are actually received, not when somebody presses a
  // button saying they were — see createGoodsReceipt.
  //
  // contracting, receipt, invoice and payment were all missing, so the advance
  // button never rendered for any role including admin and every request that
  // reached `po` stopped there permanently. gateActionLabel has carried the
  // wording for these four the whole time ("Goods received", "Invoice matched",
  // "Payment released"); there was simply no role allowed to use it.
  const STAGE_ADVANCERS: Record<string, string[]> = {
    risk: ['vendor-manager', 'admin'],
    // `validation` is deliberately absent: it is owned by the category manager
    // assigned to this request's category, not by a system role. See
    // canAdvanceValidation below.
    onboarding: ['vendor-manager', 'procurement-manager', 'admin'],
    contracting: ['procurement-manager', 'admin'],
    // Receipting and payment are operations work, not category work.
    receipt: ['operations-lead', 'procurement-manager', 'admin'],
    invoice: ['operations-lead', 'admin'],
    payment: ['operations-lead', 'admin'],
  };
  // Validation asks the category manager whether the demand is complete and
  // correctly routed, and WF-001's n3 names "Category Manager" as its role.
  // There is no such system role — it is an assignment in `category_managers`
  // — so the gate read a hardcoded list of operations-lead/procurement-manager
  // /admin instead. The screen therefore named a role that could not act, the
  // person actually accountable for the category had no button, and REQ-2025-9362
  // sat in validation for seven days against a three-day SLA with nobody able
  // to see why. Admin keeps a way through so a request cannot strand when a
  // category has no manager assigned.
  const isCategoryManager = useIsCategoryManager(currentUser.id, request.category);
  const canAdvanceValidation = request.status === 'validation'
    && (isCategoryManager || currentRole === 'admin');
  const roleCanAdvanceStage = canAdvanceValidation
    || (STAGE_ADVANCERS[request.status] ?? []).includes(currentRole);
  // Evidence the stage cannot be left without.
  //
  // A form marked `blocking` for this stage must be submitted before the stage
  // advances. Until now forms were decorative — they rendered on the current
  // stage and nothing read `form_submissions`, so completing one changed
  // nothing and that table was empty for every request in the store. A form
  // nobody has to fill in is a form nobody fills in.
  //
  // Admin is exempt, for the same reason admin can advance validation with no
  // category manager: a misconfigured form must not be able to strand a
  // request with no way out.
  const { data: allFormTemplates = [] } = useFormTemplates();
  const { data: allSubmissions = [] } = useFormSubmissions();
  const triggerContext = useFormTriggerContext(request);
  const policyConfig = usePolicyConfig();
  const { data: channelStageMap } = useChannelStageMap();

  // The same predicate the request detail renders from — see
  // src/lib/forms/form-triggers.ts. This filtered on status, blocking and
  // trigger stage but never evaluated `triggerConditions`, while the renderer
  // did. A template that was conditional AND blocking therefore stranded every
  // request in its stage: the form never rendered, so it could not be
  // submitted, so the button never unlocked.
  const outstandingForms = useMemo(() => {
    if (currentRole === 'admin') return [];
    const submitted = new Set(
      allSubmissions.filter((s) => s.requestId === request.id).map((s) => s.formTemplateId),
    );
    return outstandingBlockingForms(
      allFormTemplates, submitted, request.status, triggerContext, policyConfig,
    );
  }, [allFormTemplates, allSubmissions, request.id, request.status, currentRole, triggerContext, policyConfig]);

  const showGateAction =
    !isTerminalStatus(request.status) &&
    request.status !== 'approval' &&
    request.status !== 'sourcing' &&
    isGatedStage(currentNode, request.status) && roleCanAdvanceStage;

  const isPOStage = request.status === 'po' && ['procurement-manager', 'admin'].includes(currentRole);
  // Gated on the stage, deliberately not on request.sourcingType: that column
  // only fills for requests created after it was added, so gating on it would
  // hide the action on every existing request — including the ones stuck here.
  const isSourcingStage = request.status === 'sourcing' && ['procurement-manager', 'admin'].includes(currentRole);

  const isTerminal = request.status === 'completed' || request.status === 'cancelled';
  const isApprovalStage = request.status === 'approval';
  // The entry this user may actually act on — their own, one delegated to them,
  // or one open to a role they hold. Steps run in order, so only the earliest
  // outstanding one is live.
  //
  // This used to be `isApprovalStage || …`, which offered Approve to every
  // persona whenever a request sat in the approval stage. Clicking it stamped
  // nothing (there was no matching entry), advanced nothing (approvals were
  // still outstanding), and reported success anyway — the reported case of
  // approving as Anna Müller while Dr. Katrin Bauer was the one asked.
  const myPendingApproval = byRequest(request.id)
    .filter((a) => a.status === 'pending')
    .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
    .find((a) => canActOnApproval(
      { assignmentMode: a.assignmentMode, approverId: a.approverId, delegatedTo: a.delegatedTo, role: a.approverRole, status: a.status },
      { id: currentUser.id, role: currentRole },
    ));
  const canApprove = Boolean(myPendingApproval);
  const canManageRequest = ['procurement-manager', 'vendor-manager', 'operations-lead', 'admin'].includes(currentRole)
    || (currentRole === 'service-owner' && request.requestorId === currentUser.id);

  async function handleConfirm() {
    if (!confirmAction) return;

    const actionMap = {
      approve: { newStatus: 'sourcing', action: 'approved', successMsg: 'Request approved successfully' },
      reject: { newStatus: 'cancelled', action: 'rejected', successMsg: 'Request rejected' },
      cancel: { newStatus: 'cancelled', action: 'cancelled', successMsg: 'Request cancelled' },
    } as const;

    const config = actionMap[confirmAction];
    // Whether the request actually moved. An approval that is not the last one
    // stamps an entry and leaves the request where it is, and saying
    // "Request approved successfully" for that is how a click that changed
    // nothing came to look like one that did.
    let advanced = confirmAction !== 'approve';

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
            // Who responded is not always who was asked: a delegate acting for
            // someone out of office, or any holder of a role-assigned step.
            decidedBy: currentUser.id,
            decidedByName: currentUser.name,
          },
        });
      }

      // For rejections and cancellations always advance the engine immediately.
      // For approvals: only advance when ALL parallel approval entries are done.
      if (confirmAction === 'reject' || confirmAction === 'cancel') {
        await advanceWorkflow(request.id, config.action);
      } else if (confirmAction === 'approve' && isApprovalStage) {
        const allDone = await areAllApprovalsComplete(request.id);
        advanced = allDone;
        if (allDone) {
          // Governed call-offs can be created without a workflow instance.
          // In that fallback path `advanceWorkflow` has nothing to advance,
          // so move directly to the channel's next stage while preserving the
          // same stage-history semantics used by Complete stage.
          const instance = await getWorkflowInstanceForRequest(request.id);
          if (instance) {
            await advanceWorkflow(request.id, 'approved');
          } else {
            const nextStage = nextStageAfter(channelStageMap, request.buyingChannel, request.status);
            if (!nextStage) throw new Error('No next stage is configured for this request.');
            await transitionStage({
              requestId: request.id,
              toStage: nextStage,
              action: 'approved',
              actor: { id: currentUser.id, name: currentUser.name },
            });
          }
        }
        // else: other approvers still pending — engine stays suspended
      }

      // Refetch so the request header, lifecycle stepper, workflow tab and
      // audit tab all reflect the new status without requiring a page reload.
      invalidateRequestViews(queryClient);

      if (confirmAction === 'approve') {
        if (advanced) {
          toast.success(config.successMsg);
        } else {
          const outstanding = byRequest(request.id).filter((a) => a.status === 'pending').length;
          toast.success(outstanding === 1
            ? 'Your approval is recorded. One more approver to go.'
            : `Your approval is recorded. ${outstanding} approvers still to go.`);
        }
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

  /**
   * Leave a gated stage.
   *
   * Two paths, because most requests have no workflow instance: only those
   * created since the engine started instantiating one do. advanceWorkflow
   * returns early for the rest, so without the fallback this button would
   * appear to do nothing on 93 of 101 requests.
   */
  async function handleCompleteStage() {
    setAdvancing(true);
    try {
      // Two onboarding gates, checked before the stage moves rather than
      // discovered downstream. Light onboarding (record exists + screened) is
      // what the risk assessment hangs off and what a sourcing invitation
      // needs; full onboarding is checked at award, in applyAwardToRequest.
      const supplier = request.supplierId
        ? await getSupplier(request.supplierId).catch(() => null)
        : null;

      if (request.status === 'risk') {
        const gate = supplierReadyForRiskCompletion(supplier);
        if (!gate.allowed) {
          toast.error(gate.reason);
          return;
        }
      }
      const nextStage = nextStageAfter(channelStageMap, request.buyingChannel, request.status);
      if (nextStage === 'sourcing') {
        const gate = canEnterSourcing(supplier);
        if (!gate.allowed) {
          toast.error(gate.reason);
          return;
        }
      }

      const instance = await getWorkflowInstanceForRequest(request.id);
      if (instance) {
        await advanceWorkflow(request.id, 'completed');
      } else {
        if (!nextStage) {
          toast.error('No next stage is configured for this request.');
          return;
        }
        await transitionStage({
          requestId: request.id,
          toStage: nextStage,
          action: 'advanced',
          actor: { id: currentUser.id, name: currentUser.name },
        });
      }

      invalidateRequestViews(queryClient);
      toast.success(`${request.id} moved on from ${request.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not advance the request');
    } finally {
      setAdvancing(false);
    }
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
      const template = sdTemplate ?? DEFAULT_TEMPLATE;
      const seededRequirements = serviceDescription
        ? // Narrowed rather than cast: the record also carries non-string
          // members (score, checks, signals, capture flags).
          seedRequirementsFromDescription(sectionValuesOf(serviceDescription), template)
        : [];
      const { criteria: seededCriteria, weightsValid } = seedCriteriaFromTemplate(template);
      if (!weightsValid) {
        // Publishing is blocked when weights do not total 100, so say so now
        // rather than letting the user discover it at the end of the wizard.
        toast.warning('Seeded evaluation criteria do not total 100% — adjust them on the event.');
      }
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
        // Seeded from the service description rather than left empty. The
        // requester was already asked for scope, deliverables and acceptance
        // criteria; starting the event from `[]` made the buyer retype them.
        // Everything stays editable in the event.
        requirements: seededRequirements,
        criteria: seededCriteria,
      });

      // Invite the shortlist the requester actually named, not just the
      // incumbent. request_supplier_candidates was written at submission and
      // read by nothing, so every supplier chosen beyond the first was captured
      // and then lost — the buyer re-keyed them into the event by hand.
      //
      // The named supplier is included because the determination screened
      // against them; the rest come from the shortlist. Deduplicated, because a
      // requester can name the same supplier both ways.
      const invitees = new Map<string, { id: string; name: string }>();
      const named = lookupSupplier(request.supplierId);
      if (named) invitees.set(named.id, { id: named.id, name: named.name });
      for (const candidate of shortlist) {
        const supplier = lookupSupplier(candidate.supplierId);
        if (supplier) invitees.set(supplier.id, { id: supplier.id, name: supplier.name });
      }
      if (invitees.size > 0) {
        await inviteSuppliers.mutateAsync({
          eventId: id,
          suppliers: [...invitees.values()],
          actor: { id: currentUser.id, name: currentUser.name },
        });
      }

      setEventDialogOpen(false);
      toast.success(invitees.size > 1
        ? `Sourcing event ${id} created — ${invitees.size} suppliers invited from the shortlist`
        : `Sourcing event ${id} created`);
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
        {showGateAction && (
          <Button
            size="sm"
            className="bg-accent-solid hover:bg-accent-solid text-paper"
            onClick={handleCompleteStage}
            // Disabled, not hidden, with the reason on the button: a control
            // that vanishes leaves the user hunting for why.
            disabled={advancing || outstandingForms.length > 0}
            title={outstandingForms.length > 0
              ? `Complete ${outstandingForms.map((f) => f.name).join(' and ')} first`
              : undefined}
          >
            {advancing ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
            {gateActionLabel(request.status)}
          </Button>
        )}
        {showGateAction && outstandingForms.length > 0 && (
          <span className="text-xs text-warn">
            Needs {outstandingForms.map((f) => f.name).join(' and ')} before this stage can close
          </span>
        )}
        {isSourcingStage && (
          existingEvent ? (
            <Button size="sm" variant="outline" onClick={() => navigate(`/sourcing/${existingEvent.id}`)}>
              <Gavel className="size-3.5" />
              Open sourcing event
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-accent-solid hover:bg-accent-solid text-paper"
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
            className="bg-accent-solid hover:bg-accent-solid text-paper"
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
              className="bg-ok hover:bg-ok text-paper"
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
        {canManageRequest && <Button size="sm" variant="outline" className="text-warn border-warn-line hover:bg-warn-soft" onClick={() => setReferBackOpen(true)}>
          <RotateCcw className="size-3.5" />
          Refer Back
        </Button>}
        {['procurement-manager', 'operations-lead', 'admin'].includes(currentRole) && <Button size="sm" variant="outline" onClick={() => setReassignOpen(true)}>
          <UserPlus className="size-3.5" />
          Reassign
        </Button>}
        {['procurement-manager', 'operations-lead', 'admin'].includes(currentRole) && <Button size="sm" variant="outline" onClick={() => setEscalateOpen(true)}>
          <ArrowUpRight className="size-3.5" />
          Escalate
        </Button>}
        {canManageRequest && <Button size="sm" variant="outline" className="text-stop border-stop-line hover:bg-stop-soft" onClick={() => setConfirmAction('cancel')}>
          <Ban className="size-3.5" />
          Cancel
        </Button>}
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
