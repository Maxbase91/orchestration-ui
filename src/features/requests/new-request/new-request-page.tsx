// The New request page — Door 1 of the Intake Prototype: the conversation, the
// Channel page, then the confirmation. One form state and one determination for
// the whole journey; the views change, the demand does not.
//
// There was a stepper here — Describe, How you'll buy, Details, Your buying
// channel — with a gate per step and a footer of Back / Save / Next. The
// conversation replaced the first three (2026-09-26): it asks in the order the
// stepper did, and its "Buying channel confirmed" is the gate the Details step
// was.
import { useState, useCallback, useEffect, useMemo, useRef, Component, type ReactNode, type ErrorInfo } from 'react';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useUsers } from '@/lib/db/hooks/use-users';
import { useAuthStore } from '@/stores/auth-store';
import { createRequest, nextRequestId } from '@/lib/db/requests';
import { saveRequestSupplierCandidates } from '@/lib/db/request-supplier-candidates';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import { useCostCentres } from '@/lib/db/hooks/use-cost-centres';
import { useDeliveryLocations } from '@/lib/db/hooks/use-delivery-locations';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { templateForChannel } from '@/lib/workflow/channel-stages';
import { queryClient } from '@/lib/query-client';
import type { RequestCategory, BuyingChannel } from '@/data/types';
import { INITIAL_INTAKE_DATA, type IntakeFormData } from './intake-form-data';
import { useIntakeDetermination } from './use-intake-determination';
import { useIntakeDeepLink } from './use-intake-deep-link';
import { buildIntakeComplianceRecord } from '@/lib/procurement/intake-compliance-record';
import { StepConfirmation } from './step-confirmation';
import { StepChannelRequest } from './channel/step-channel-request';
import { StepChannelCallOff } from './channel/step-channel-call-off';
import { buildCallOff } from './call-off';
import { IntakeConversation } from './conversation/intake-conversation';
import type { ContractCallOffDraft } from './conversation/call-off-agenda';
import { useServiceDescriptionTemplate } from '@/lib/db/hooks/use-service-description-templates';
import { DEFAULT_SECTIONS } from '@/lib/procurement/service-description-defaults';
import { requiredSectionIds, resolveSlots } from '@/lib/procurement/demand-conversation';
import { conversationContext } from './conversation/conversation-rules';
import { getProcurementProfile } from '@/lib/db/procurement-profiles';
import { useProcurementProfile } from '@/lib/db/hooks/use-procurement-profile';
import { buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { submitGovernedCheckout } from '@/lib/procurement/submit-governed-checkout';
import { submitIntake } from '@/lib/procurement/submit-intake';
import { usePreferredSupplierIds } from '@/lib/db/hooks/use-category-preferred-suppliers';

class ViewErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('New request error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-3 size-8 text-warn" />
          <p className="mb-1 text-sm font-medium text-ink">Something went wrong with this request</p>
          <p className="mb-4 max-w-md text-xs text-ink-3">{this.state.error.message}</p>
          <Button size="sm" variant="outline" onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>
            Start over
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

type View = 'conversation' | 'channel' | 'confirmation';

export function NewRequestPage() {
  const [view, setView] = useState<View>('conversation');
  // A new key is a new conversation — how "Start over" and "Raise another" begin again.
  const [conversationKey, setConversationKey] = useState(0);
  const [formData, setFormData] = useState<IntakeFormData>(INITIAL_INTAKE_DATA);
  const [requestId, setRequestId] = useState('');
  // One id per submission attempt, held in a ref rather than state: a double
  // click resolves both handlers before a state update could land, and two ids
  // for one demand is the failure this exists to prevent. Nothing renders it.
  //
  // Kept on failure so a retry reuses it — the server's intake replay branch
  // and the governed checkout's idempotency key both derive from it, and a
  // fresh id on every attempt is what made those replays unreachable. Cleared
  // on success so the next demand mints its own.
  const attemptIdRef = useRef<string | null>(null);
  const claimRequestId = useCallback(async () => {
    attemptIdRef.current ??= await nextRequestId();
    return attemptIdRef.current;
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** The profile default, so the panel can say where the cost centre came from. */
  const [profileCostCentre, setProfileCostCentre] = useState('');
  const { currentUser } = useAuthStore();
  const { data: suppliers = [] } = useSuppliers();
  const { data: contracts = [] } = useContracts();
  // The same reference data the server reads when it recomputes the decision.
  // If the client evaluated against a different list the two decisions would
  // differ and every submit would come back as a governance mismatch.
  const { data: allCostCentres = [] } = useCostCentres();
  const { data: allDeliveryLocations = [] } = useDeliveryLocations();
  const activeCostCentreIds = useMemo(
    () => allCostCentres.filter((centre) => centre.active).map((centre) => centre.id), [allCostCentres]);
  const activeDeliveryLocationIds = useMemo(
    () => allDeliveryLocations.filter((location) => location.active).map((location) => location.id), [allDeliveryLocations]);
  const { data: riskAssessments = [] } = useRiskAssessments();
  const { data: users = [] } = useUsers();

  // One determination for the whole journey. The conversation asks the risk
  // questions it decides, the Channel page shows its conclusions, and submit
  // records it — three readers of one object rather than three computations.
  const { determination } = useIntakeDetermination({
    category: formData.category,
    estimatedValue: formData.estimatedValue,
    supplierId: formData.supplierId,
    commodityCode: formData.commodityCode,
    isUrgent: formData.isUrgent,
    requestTitle: formData.title,
    serviceDescription: formData.serviceDescription,
    miniIrq: formData.miniIrq,
    contractId: formData.contractId || undefined,
  });

  // The template a draft records is the one that claims the channel the
  // determination chose — the same rule submit applies.
  const { data: workflowTemplates = [] } = useWorkflowTemplates();
  const channelTemplateId = templateForChannel(workflowTemplates, determination?.buyingChannelSlug) ?? '';

  // Accounting defaults from the requester's stored profile, so nobody is asked
  // for a cost centre they have used every time. Never overwrites a value
  // already entered.
  useEffect(() => {
    let cancelled = false;
    void getProcurementProfile(currentUser.id).then((profile) => {
      if (cancelled || !profile) return;
      setProfileCostCentre(profile.costCentre ?? '');
      setFormData((prev) => ({
        ...prev,
        costCentre: prev.costCentre || profile.costCentre || '',
        beneficiaryId: prev.beneficiaryId || profile.beneficiaryId || '',
      }));
    }).catch(() => {
      // The page stays usable when the additive profile table is unavailable.
    });
    return () => { cancelled = true; };
  }, [currentUser.id, conversationKey]);

  // The requester's country, from their directory entry — read-only, never asked.
  useEffect(() => {
    if (formData.requesterCountry) return;
    const me = users.find((u) => u.id === currentUser.id);
    if (me?.country) {
      setFormData((prev) => ({ ...prev, requesterCountry: me.country ?? '', requesterCountryCode: me.countryCode ?? '' }));
    }
  }, [users, currentUser.id, formData.requesterCountry]);

  // The words from the Home box or the assistant (`?q=`), sent as the first
  // message. A catalogue order is placed on the Catalogue page, not here.
  const { prefill } = useIntakeDeepLink();

  const updateFormData = useCallback((updates: Partial<IntakeFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const isCallOff = formData.preCheckOutcome === 'contract';
  const preferredSupplierIds = usePreferredSupplierIds(formData.category);
  const { data: sdTemplate } = useServiceDescriptionTemplate(formData.category);
  // The sections this demand must cover — the set the conversation requires
  // before it confirms the channel — for the Channel page's check and the
  // record submit writes. Computed from the request as it stands, so an edit
  // after the description was written (a new value, a new section) counts.
  const requiredSections = useMemo(() => {
    const sections = sdTemplate?.sections ?? DEFAULT_SECTIONS;
    const ctx = conversationContext(formData.category, formData, formData.serviceDescription ?? {});
    return requiredSectionIds(ctx, resolveSlots(sdTemplate?.slots, sections), sections);
  }, [sdTemplate, formData]);

  // A call-off's details, held here rather than in the conversation so the
  // Channel page and submit read the same draft the conversation fills.
  const [callOffDraft, setCallOffDraft] = useState<ContractCallOffDraft | null>(null);
  const { data: storedProfile = null } = useProcurementProfile(currentUser.id);
  const callOffContract = contracts.find((candidate) => candidate.id === formData.contractId);
  const callOffSupplier = callOffContract ? suppliers.find((candidate) => candidate.id === callOffContract.supplierId) : undefined;
  const callOffInputs = useMemo(() => (callOffDraft && callOffContract && callOffSupplier ? {
    draft: callOffDraft, contract: callOffContract, supplier: callOffSupplier, riskAssessments, storedProfile,
    user: { id: currentUser.id, name: currentUser.name }, form: formData, activeCostCentreIds, activeDeliveryLocationIds,
  } : null), [callOffDraft, callOffContract, callOffSupplier, riskAssessments, storedProfile, currentUser.id, currentUser.name, formData, activeCostCentreIds, activeDeliveryLocationIds]);
  // The decision the Channel page shows — the same builder submit calls, so
  // the page and the write cannot disagree. Only the id is a placeholder.
  const callOffPreview = useMemo(
    () => (callOffInputs ? buildCallOff({ ...callOffInputs, requestId: 'preview' }) : null),
    [callOffInputs],
  );

  // Contract call-offs go through the governed checkout, like catalogue
  // orders, so the PR/PO audit links are written with them.
  const submitCallOff = async () => {
    if (!callOffInputs) { toast.error('The contract or its supplier is no longer available.'); return; }
    setIsSubmitting(true);
    const id = await claimRequestId();
    try {
      const { checkout, decision, request, lines } = buildCallOff({ ...callOffInputs, requestId: id });
      if (!decision.ok) throw new Error(decision.errors.join(' '));
      await submitGovernedCheckout({ requestId: id, requisitionId: `PR-${id}`, decision, checkout, request, lines });
      // The checkout creates the workflow instance on the call-off template.
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success('Contract call-off submitted');
      attemptIdRef.current = null; setRequestId(id); setView('confirmation');
    } catch (error) {
      toast.error(`Could not submit contract call-off: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally { setIsSubmitting(false); }
  };

  const submitRequest = async () => {
    // Never submit a governed record with no determination behind it: the
    // compliance row would claim checks that never ran.
    if (!determination) {
      toast.error('The compliance checks are still running. Please try again in a moment.');
      return;
    }
    const parsedDeliveryDate = parseDeliveryDate(formData.deliveryDate);
    if (formData.deliveryDate && !parsedDeliveryDate) {
      toast.error('Please provide a specific need-by date before submitting.');
      return;
    }
    const id = await claimRequestId();
    setIsSubmitting(true);
    try {
      const sow = formData.serviceDescription ?? null;
      await submitIntake({
        request: {
          id, title: formData.title, description: sow?.narrative ?? formData.title,
          category: formData.category as RequestCategory, status: 'intake',
          priority: formData.isUrgent ? 'urgent' : 'medium', value: formData.estimatedValue,
          currency: formData.currency, supplierId: formData.supplierId, contractId: formData.contractId || undefined,
          // Advisory: the server recomputes the override and keeps the reason only if there was one.
          supplierOverrideReason: formData.supplierOverrideReason.trim() || undefined,
          buyingChannel: determination.buyingChannelSlug as BuyingChannel,
          approvalChain: determination.approvalChain, sourcingType: determination.sourcingType.type,
          sourcingTypeReason: determination.sourcingType.reason, inherentRiskTier: determination.inherentRisk.tier,
          materialityTier: determination.materiality.criticality, riskAssessmentRequired: determination.riskAssessmentRequired,
          screeningOutcome: determination.screening.status, referralDisposition: determination.referral.outcome,
          commodityCode: formData.commodityCode, commodityCodeLabel: formData.commodityCodeLabel,
          commodityCandidates: formData.commodityCandidates, commodityClassificationConfirmed: formData.commodityClassificationConfirmed,
          attachments: formData.attachments, costCentre: formData.costCentre, budgetOwner: currentUser.name,
          businessJustification: undefined, deliveryDate: parsedDeliveryDate ?? undefined, isUrgent: formData.isUrgent,
          requestorId: currentUser.id, ownerId: currentUser.id, daysInStage: 0, isOverdue: false, referBackCount: 0,
          requesterCountry: formData.requesterCountry || undefined, requesterCountryCode: formData.requesterCountryCode || undefined,
          beneficiaryId: formData.beneficiaryId || undefined, beneficiaryName: formData.beneficiaryName || undefined,
          beneficiaryCountry: formData.beneficiaryCountry || undefined, beneficiaryCountryCode: formData.beneficiaryCountryCode || undefined,
        },
        serviceDescription: sow ? {
          objective: sow.objective ?? '', scope: sow.scope ?? '', exclusions: sow.exclusions ?? '', deliverables: sow.deliverables ?? '',
          timeline: sow.timeline ?? '', resources: sow.resources ?? '', acceptanceCriteria: sow.acceptanceCriteria ?? '',
          pricingModel: sow.pricingModel ?? '', location: sow.location ?? '', dependencies: sow.dependencies ?? '', narrative: sow.narrative ?? '',
          ...(formData.sowQualityScore != null ? { qualityScore: formData.sowQualityScore } : {}),
          ...(formData.sowQualityChecks ? { qualityChecks: formData.sowQualityChecks } : {}),
          ...(formData.sowSignals ? { signals: formData.sowSignals } : {}),
          requiredSections,
          ...(sow.captureFlags ? { captureFlags: sow.captureFlags } : {}),
        } : undefined,
        // The record is derived from the determination's structured fields,
        // never from the sentences the Channel page displays — the SRA outcome
        // used to be read out of a rendered label, so a never-assessed
        // supplier recorded a pass.
        compliance: buildIntakeComplianceRecord(determination, { determinedAt: new Date().toISOString() }),
        buyingChannel: determination.buyingChannelSlug,
        idempotencyKey: `intake-${id}`,
      });

      // The alternates, after the request exists. Deliberately not part of the
      // atomic intake write: a candidate list is a sourcing input, and failing
      // to record one must not roll back a submitted request. It is upserted
      // on (request_id, supplier_id), so a retry cannot duplicate rows.
      const candidates = [
        ...(formData.supplierId ? [{ requestId: id, supplierId: formData.supplierId, isPreferred: true }] : []),
        ...formData.supplierCandidateIds
          .filter((candidateId) => candidateId !== formData.supplierId)
          .map((candidateId) => ({ requestId: id, supplierId: candidateId, isPreferred: false })),
      ];
      try {
        await saveRequestSupplierCandidates(candidates);
      } catch (error) {
        // Say so rather than pretending: the request IS submitted, and a silent
        // failure would leave sourcing to discover an empty candidate list.
        console.error('Failed to record supplier candidates:', error);
        toast.warning('Request submitted, but the supplier shortlist could not be saved.');
      }

      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success('Request submitted successfully');
      attemptIdRef.current = null;
      setRequestId(id);
      setView('confirmation');
    } catch (e) {
      console.error('Failed to persist request:', e);
      // The dispatcher returns safe field-level validation text; surface it
      // instead of masking actionable date/accounting errors behind a generic toast.
      toast.error(e instanceof Error ? e.message : 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!formData.title) {
      toast.error('Cannot save draft without a title.');
      return;
    }
    const id = await nextRequestId();
    setIsSubmitting(true);
    try {
      await createRequest({
        id,
        title: formData.title,
        description: formData.businessJustification,
        category: (formData.category || 'goods') as RequestCategory,
        status: 'draft',
        priority: formData.isUrgent ? 'urgent' : 'medium',
        value: formData.estimatedValue,
        currency: formData.currency,
        requestorId: currentUser.id,
        ownerId: currentUser.id,
        supplierId: formData.supplierId,
        contractId: formData.contractId || undefined,
        workflowTemplateId: channelTemplateId || undefined,
        // The slug, not the label: every consumer of this column keys on the slug.
        buyingChannel: (determination?.buyingChannelSlug ?? 'procurement-led') as BuyingChannel,
        sourcingType: determination?.sourcingType.type,
        sourcingTypeReason: determination?.sourcingType.reason,
        commodityCode: formData.commodityCode,
        commodityCodeLabel: formData.commodityCodeLabel,
        commodityCandidates: formData.commodityCandidates,
        commodityClassificationConfirmed: formData.commodityClassificationConfirmed,
        attachments: formData.attachments,
        costCentre: formData.costCentre,
        budgetOwner: '',
        businessJustification: undefined,
        // Normalised the way submit does, rather than handing a half-typed
        // field to a DATE column.
        deliveryDate: parseDeliveryDate(formData.deliveryDate) ?? undefined,
        isUrgent: formData.isUrgent,
        daysInStage: 0,
        isOverdue: false,
        referBackCount: 0,
        requesterCountry: formData.requesterCountry || undefined,
        requesterCountryCode: formData.requesterCountryCode || undefined,
        beneficiaryId: formData.beneficiaryId || undefined,
        beneficiaryName: formData.beneficiaryName || undefined,
        beneficiaryCountry: formData.beneficiaryCountry || undefined,
        beneficiaryCountryCode: formData.beneficiaryCountryCode || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success(`Draft saved as ${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`Save draft failed: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_INTAKE_DATA);
    setCallOffDraft(null);
    setRequestId('');
    setView('conversation');
    setConversationKey((key) => key + 1);
  };

  // A view change starts at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [view]);

  const backToConversation = () => setView('conversation');

  return (
    <div className={cn('mx-auto', view === 'confirmation' ? 'max-w-3xl space-y-6' : 'max-w-7xl')}>
      {/* The conversation stays mounted behind the Channel page, so "Back to
          the conversation" returns to it as it was left — its transcript is
          state that no form field could rebuild. */}
      {view !== 'confirmation' && (
        <div hidden={view !== 'conversation'}>
          <ViewErrorBoundary onReset={handleReset}>
            <IntakeConversation
              key={conversationKey}
              prefill={conversationKey === 0 ? prefill : undefined}
              formData={formData}
              updateFormData={updateFormData}
              determination={determination}
              requester={{ id: currentUser.id, name: currentUser.name }}
              profileCostCentre={profileCostCentre}
              storedProfile={storedProfile}
              callOffDraft={callOffDraft}
              setCallOffDraft={setCallOffDraft}
              onSeeChannel={() => setView('channel')}
            />
          </ViewErrorBoundary>
        </div>
      )}

      {view === 'channel' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={backToConversation}>
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to the conversation
            </Button>
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <h1 className="text-heading font-semibold text-ink">Your buying channel</h1>
          </div>
          <ViewErrorBoundary onReset={handleReset}>
            {isCallOff ? (
              callOffPreview && callOffDraft && callOffContract && callOffSupplier ? (
                <StepChannelCallOff
                  callOff={callOffPreview}
                  draft={callOffDraft}
                  contract={callOffContract}
                  supplier={callOffSupplier}
                  costCentres={allCostCentres}
                  deliveryLocations={allDeliveryLocations}
                  onBack={backToConversation}
                  onSubmit={() => void submitCallOff()}
                  submitting={isSubmitting}
                />
              ) : (
                <p className="rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn">
                  The call-off details are not complete — go back to the conversation and add them.
                </p>
              )
            ) : determination ? (
              <StepChannelRequest
                formData={formData}
                determination={determination}
                suppliers={suppliers}
                preferredSupplierIds={preferredSupplierIds}
                sections={sdTemplate?.sections ?? []}
                requiredSections={requiredSections}
                costCentres={allCostCentres}
                requester={{ id: currentUser.id, name: currentUser.name }}
                onBack={backToConversation}
                onSubmit={() => void submitRequest()}
                onSaveDraft={() => void handleSaveDraft()}
                submitting={isSubmitting}
              />
            ) : (
              // A governed record is never written without a determination, so
              // the page waits for it rather than drawing stages it cannot know.
              <p className="flex items-center justify-center gap-2 py-16 text-sm text-ink-3" role="status">
                <Loader2 className="size-4 animate-spin" /> Running the checks for your request…
              </p>
            )}
          </ViewErrorBoundary>
        </div>
      )}

      {view === 'confirmation' && (
        <>
          <div>
            <h1 className="text-xl font-semibold text-ink">Request submitted</h1>
            <p className="mt-0.5 text-sm text-ink-3">{requestId} is with procurement. Track it from your dashboard.</p>
          </div>
          <div className="rounded-lg border border-line bg-card p-6">
            <StepConfirmation
              requestId={requestId}
              // The same next steps the Channel page's workings listed, so the
              // two screens cannot disagree about what happens next.
              nextSteps={determination?.handoffSteps ?? []}
              // A call-off's own details are its draft's — the words it started
              // from can differ from what was called off.
              data={{
                title: isCallOff && callOffDraft ? callOffDraft.title : formData.title,
                category: formData.category,
                supplier: formData.supplier,
                estimatedValue: isCallOff && callOffDraft ? callOffDraft.value : formData.estimatedValue,
                currency: formData.currency,
                costCentre: isCallOff && callOffDraft ? callOffDraft.costCentre : formData.costCentre,
                deliveryDate: isCallOff && callOffDraft ? callOffDraft.needBy : formData.deliveryDate,
                isUrgent: formData.isUrgent,
                // The channel the record carries: a call-off's is the one its
                // checkout records, whatever the determination would route the
                // same words to as a new demand.
                buyingChannelResult: isCallOff && callOffPreview
                  ? buyingChannelLabel(callOffPreview.request.buyingChannel as BuyingChannel)
                  : determination?.buyingChannelResult ?? '',
                commodityCodeLabel: formData.commodityCodeLabel,
              }}
              onReset={handleReset}
            />
          </div>
        </>
      )}
    </div>
  );
}
