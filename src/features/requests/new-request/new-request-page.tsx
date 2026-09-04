import { useState, useCallback, useEffect, useMemo, Component, type ReactNode, type ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useCatalogueItems } from '@/lib/db/hooks/use-catalogue-items';
import { useUsers } from '@/lib/db/hooks/use-users';
import { useAuthStore } from '@/stores/auth-store';
import { createRequest } from '@/lib/db/requests';
import { saveRequestSupplierCandidates } from '@/lib/db/request-supplier-candidates';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import { riskSlotsFor } from '@/lib/procurement/residual-question-slots';
import { descriptionComplete } from './details-sections';
import { useCostCentres } from '@/lib/db/hooks/use-cost-centres';
import { useDeliveryLocations } from '@/lib/db/hooks/use-delivery-locations';
import { initWorkflow } from '@/lib/workflow/engine';
import { queryClient } from '@/lib/query-client';
import type { RequestCategory, BuyingChannel } from '@/data/types';
import {
  INITIAL_INTAKE_DATA,
  generateRequestId,
  type IntakeFormData,
} from './intake-form-data';
import { useIntakeDetermination } from './use-intake-determination';
import { useIntakeDeepLink } from './use-intake-deep-link';
import { buildIntakeComplianceRecord } from '@/lib/procurement/intake-compliance-record';
import { StepCategory } from './step-category';
import { StepDetails } from './step-details';
import { StepChatIntake } from './step-chat-intake';
import { StepCatalogue } from './step-catalogue';
import { StepBuyRoute } from './step-buy-route';
import { StepCompliance } from './step-compliance';
import { StepRoutingPreview } from './step-routing-preview';
import { StepConfirmation } from './step-confirmation';
import { StepHeaderPanel } from './components/step-header-panel';
import {
  nextStep,
  previousStep,
  progressStepsForRoute,
  routeFromOutcome,
  stepById,
  stepDescription,
  stepGuidance,
  stepNumber,
  submitStepFor,
  type IntakeStepId,
} from './intake-steps';
import { sectionValuesOf } from '@/lib/procurement/service-description-seed';
import { useServiceDescriptionTemplate } from '@/lib/db/hooks/use-service-description-templates';
import { outstandingRequiredSlots, resolveSlots } from '@/lib/procurement/demand-conversation';
import { RequesterContextBlock } from './components/requester-context-block';
import type { Contract } from '@/data/types';
import type { CatalogueItem } from '@/data/catalogue-items';
import { getProcurementProfile } from '@/lib/db/procurement-profiles';
import { evaluateGovernedCheckout, resolveCheckoutRiskAssessment, resolveCheckoutContract } from '@/lib/procurement/governed-checkout';
import { submitGovernedCheckout } from '@/lib/procurement/submit-governed-checkout';
import { submitIntake } from '@/lib/procurement/submit-intake';
import { CatalogueOrderCheckout, type CatalogueOrderDraft } from '@/features/catalogue/catalogue-order-checkout';
import { ContractCallOffCheckout, type ContractCallOffDraft } from './contract-call-off-checkout';

class StepErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Step error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="size-8 text-amber-500 mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Something went wrong in this step</p>
          <p className="text-xs text-gray-500 mb-4 max-w-md">{this.state.error.message}</p>
          <Button size="sm" variant="outline" onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>
            Start Over
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * The intake, for every requester.
 *
 * There were two of these: a 1100-line Expert wizard and a 500-line Simple page
 * with its own phase machine, its own form shape and its own duplicated submit.
 * They shared step components and decision helpers, but each owned a journey —
 * which is exactly how they drifted, twice, into producing different governance
 * outcomes for the same demand (see `tests/integration/mode-equivalence.mjs`).
 *
 * They were unified behind one engine and one step config, with a `density`
 * prop deciding only how much evidence was on screen. That prop is gone too:
 * the switch asked the requester to choose a view before they could start, and
 * what it actually changed was some copy and whether the workings were on the
 * page at all. The evidence is now there for everyone, collapsed by default.
 */
export function NewRequestPage() {
  const navigate = useNavigate();
  const [stepId, setStepId] = useState<IntakeStepId>('describe');
  const [formData, setFormData] = useState<IntakeFormData>(INITIAL_INTAKE_DATA);
  const [requestId, setRequestId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalogueOrder, setCatalogueOrder] = useState<{
    title: string;
    estimatedValue: number;
    supplier: string;
    supplierId: string;
    catalogueItems: { itemId: string; name: string; quantity: number; unitPrice: number; supplierId: string }[];
  } | null>(null);
  const [catalogueCheckoutOpen, setCatalogueCheckoutOpen] = useState(false);
  /** The profile default, so the context block can say where the value came from. */
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
  const { data: catalogueItems = [] } = useCatalogueItems();
  const { data: users = [] } = useUsers();

  // One determination for the whole wizard. It used to be computed inside the
  // compliance step and mirrored back into form state through `onUpdate`; the
  // screen and the record it wrote were then two copies of one answer, free to
  // fall out of step. The steps that show conclusions and the submit that
  // records them now read the same object.
  const { determination, derivedWorkflowTemplateId } = useIntakeDetermination({
    category: formData.category,
    estimatedValue: formData.estimatedValue,
    supplierId: formData.supplierId,
    isUrgent: formData.isUrgent,
    requestTitle: formData.title,
    serviceDescription: formData.serviceDescription,
    miniIrq: formData.miniIrq,
    contractId: formData.contractId || undefined,
  });

  // The template the category implies, until the requester picks one. This used
  // to be an effect inside the compliance step writing back through `onUpdate`.
  useEffect(() => {
    if (formData.workflowTemplateId || !derivedWorkflowTemplateId) return;
    setFormData((prev) => ({ ...prev, workflowTemplateId: derivedWorkflowTemplateId }));
  }, [formData.workflowTemplateId, derivedWorkflowTemplateId]);

  // Accounting defaults from the requester's stored profile, so a call-off does
  // not ask for a cost centre they have used every time. Never overwrites a
  // value already entered. Simple intake had this and Expert did not, which is
  // the kind of divergence one engine removes by construction.
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
      // The form stays usable when the additive profile table is unavailable.
    });
    return () => { cancelled = true; };
  }, [currentUser.id]);

  // Auto-derive the requester's country from their profile (read-only). Runs
  // once the directory loads; the user never sets or edits this. It can drive
  // country-based workflows in future.
  useEffect(() => {
    if (formData.requesterCountry) return;
    const me = users.find((u) => u.id === currentUser.id);
    if (me?.country) {
      setFormData((prev) => ({
        ...prev,
        requesterCountry: me.country ?? '',
        requesterCountryCode: me.countryCode ?? '',
      }));
    }
  }, [users, currentUser.id, formData.requesterCountry]);

  // Deep links — the home box, the command bar's legacy `step=2` link, and the
  // return trip from a catalogue item's detail page. Parsing is pure and lives
  // in `intake-deep-link.ts`; this only applies the result once its data has
  // loaded and clears the params so a refresh does not replay it.
  const { prefill: categoryPrefill } = useIntakeDeepLink({
    suppliers,
    catalogueItems,
    onDemand: (link) => {
      setFormData((prev) => ({ ...prev, ...link.patch }));
      setStepId(link.step);
    },
    onCatalogueOrder: (link) => {
      setFormData((prev) => ({ ...prev, ...link.patch }));
      setCatalogueOrder(link.order);
      setCatalogueCheckoutOpen(true);
      setStepId('details');
    },
  });

  const updateFormData = useCallback((updates: Partial<IntakeFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Catalogue fast track — drives the reduced stepper and the Step-3 "Create
  // order" action that skips risk/determination/routing.
  // The fulfilment route is settled by the pre-check outcome, not by the
  // broad commodity value. A user can explicitly reject a catalogue result
  // and continue as a full request; retaining the category-only fallback here
  // would silently put that choice back into the reduced catalogue wizard.
  // The journey is keyed off the ROUTE the buy-route step settled, never off
  // the category: a classifier answering "catalogue" for a paper-and-toner
  // demand used to put the whole wizard on the fast track before the funnel
  // had run.
  const route = routeFromOutcome(formData.preCheckOutcome);
  const isCatalogue = route === 'catalogue';

  // Step 3's floor. The chat path is the only one that captures the service
  // description through the conversation; the catalogue, contract and
  // form-based paths have their own completeness rules below.
  const { data: sdTemplate } = useServiceDescriptionTemplate(formData.category);
  const conversationSlots = useMemo(() => resolveSlots(sdTemplate?.slots), [sdTemplate]);
  const isChatIntakePath =
    formData.preCheckOutcome === 'full-request' &&
    !['catalogue', 'contract-renewal', 'supplier-onboarding'].includes(formData.category);
  const conversationCtx = useMemo(
    () => ({
      category: formData.category,
      title: formData.title || undefined,
      estimatedValue: formData.estimatedValue || undefined,
      deliveryDate: formData.deliveryDate || undefined,
      // Text sections only: the description also carries capture flags, which
      // are not answers and must not be walked as if they were.
      sow: sectionValuesOf(formData.serviceDescription),
      risk: formData.miniIrq,
    }),
    [formData.category, formData.title, formData.estimatedValue, formData.deliveryDate, formData.serviceDescription, formData.miniIrq],
  );
  // The risk questions are part of the same agenda, so the step gate counts
  // them: Next used to open with a triggered question still unanswered,
  // because the switches lived outside the conversation the gate read.
  const riskSlots = useMemo(
    () => riskSlotsFor(determination?.residualQuestions ?? []),
    [determination],
  );
  // Reveal the supplier section only once the conversation (and its risk-question
  // tail) is done: the Details step used to put the chat, a card of risk
  // switches and supplier selection on screen at once, before the requester had
  // answered anything.
  const detailsDescriptionDone = useMemo(
    () => descriptionComplete({
      isChatIntakePath,
      conversationCtx,
      conversationSlots: [...conversationSlots, ...riskSlots],
    }),
    [isChatIntakePath, conversationCtx, conversationSlots, riskSlots],
  );
  const outstanding = useMemo(
    () => (isChatIntakePath
      ? outstandingRequiredSlots(conversationCtx, [...conversationSlots, ...riskSlots])
      : []),
    [isChatIntakePath, conversationCtx, conversationSlots, riskSlots],
  );
  // Named, not counted: the gate is `title && estimatedValue > 0` on the form
  // paths, and a requester staring at a disabled button needs to know which.
  const missingDetailFields = [
    !formData.title ? 'a title' : null,
    !(formData.estimatedValue > 0) ? 'an estimated value' : null,
  ].filter((field): field is string => Boolean(field));

  const wizardSteps = progressStepsForRoute(route);
  const submitStepId = submitStepFor(route);

  // One gate per step, defined beside the step it guards. This was a
  // `switch (currentStep)` that had to be renumbered by hand whenever the step
  // order changed.
  const canProceed = (): boolean =>
    stepById(stepId).canProceed({
      data: formData,
      isChatIntakePath,
      conversationCtx,
      conversationSlots: [...conversationSlots, ...riskSlots],
      hasDetermination: determination !== null,
    });

  // Catalogue orders use the same governed endpoint as Simple mode. The
  // browser can collect a cart, but it must not create a PO directly or claim
  // that approval is unnecessary before the server checks current policy.
  const submitCatalogueOrder = async (order: {
    title: string;
    estimatedValue: number;
    supplier: string;
    supplierId: string;
    catalogueItems: { itemId: string; name: string; quantity: number; unitPrice: number; supplierId: string }[];
  }, draft?: CatalogueOrderDraft) => {
    if (!draft) {
      // The shared checkout collects only fulfilment details that cannot be
      // inferred from the catalogue/profile. Governance is evaluated after
      // those fields are present, so the browser never bypasses that seam.
      setCatalogueOrder(order);
      updateFormData(order);
      setCatalogueCheckoutOpen(true);
      return;
    }
    const id = generateRequestId();
    const submittedOrder = {
      ...order,
      estimatedValue: draft.quantity * (order.catalogueItems[0]?.unitPrice ?? 0),
      catalogueItems: order.catalogueItems.map((line, index) => index === 0 ? { ...line, quantity: draft.quantity } : line),
    };
    updateFormData({ ...submittedOrder, deliveryDate: draft.needBy, costCentre: draft.costCentre });
    setIsSubmitting(true);
    try {
      const primary = submittedOrder.catalogueItems[0];
      const item = primary ? catalogueItems.find((candidate) => candidate.id === primary.itemId) : undefined;
      if (!item) throw new Error('The selected catalogue item is no longer available.');
      const supplier = suppliers.find((candidate) => candidate.id === item.supplierId);
      if (!supplier) throw new Error('The catalogue supplier could not be resolved.');
      const resolved = resolveCheckoutContract(item, contracts);
      if (!resolved.contract) throw new Error(resolved.error ?? 'No active contract covers this catalogue item.');
      const storedProfile = await getProcurementProfile(currentUser.id).catch(() => null);
      const profile = storedProfile ?? {
        userId: currentUser.id, defaultCurrency: formData.currency, costCentre: formData.costCentre,
        budgetOwner: currentUser.name, accountType: 'expense', beneficiaryId: formData.beneficiaryId || currentUser.id,
        // No invented approved list, and no invented default location. This
        // said `[{ id: 'office' }]` and the server fell back to it when no
        // profile row existed, so the delivery-location check approved a
        // location that existed nowhere. `delivery_locations` is the authority.
        approvedShipToLocations: [], defaultCommodityCode: item.commodityCode,
      };
      const riskAssessment = resolveCheckoutRiskAssessment(riskAssessments, supplier.id, resolved.contract.id);
      const checkout = {
        route: 'catalogue' as const,
        lines: submittedOrder.catalogueItems.map((line) => ({ item, description: line.name, quantity: line.quantity, unit: item.unit, unitPrice: item.unitPrice, supplierId: supplier.id, contractId: resolved.contract!.id, riskAssessmentId: riskAssessment?.id, commodityCode: item.commodityCode })),
        supplier, contract: resolved.contract, riskAssessment, profile,
        currency: formData.currency, needByDate: draft.needBy,
        purpose: draft.businessPurpose || submittedOrder.title, costCentre: draft.costCentre,
        shipToLocationId: draft.deliveryLocation,
        beneficiaryId: formData.beneficiaryId || currentUser.id, idempotencyKey: `checkout-${id}`,
        activeCostCentreIds, activeDeliveryLocationIds,
      };
      const decision = evaluateGovernedCheckout(checkout);
      if (!decision.ok) throw new Error(decision.errors.join(' '));
      const request = {
        id, title: submittedOrder.title || 'Catalogue order', description: submittedOrder.title || 'Catalogue order',
        category: 'catalogue' as RequestCategory, status: 'intake' as const,
        priority: formData.isUrgent ? ('urgent' as const) : ('medium' as const), value: decision.totalValue, currency: formData.currency,
        supplierId: supplier.id, contractId: resolved.contract.id, buyingChannel: 'catalogue' as BuyingChannel,
        commodityCode: item.commodityCode, commodityCodeLabel: item.commodityCode,
        commodityCandidates: formData.commodityCandidates, commodityClassificationConfirmed: formData.commodityClassificationConfirmed,
        attachments: formData.attachments, costCentre: formData.costCentre, budgetOwner: currentUser.name,
        businessJustification: '', deliveryDate: parseDeliveryDate(formData.deliveryDate) ?? undefined,
        isUrgent: formData.isUrgent, requestorId: currentUser.id, ownerId: currentUser.id,
        daysInStage: 0, isOverdue: false, referBackCount: 0,
        requesterCountry: formData.requesterCountry || undefined, requesterCountryCode: formData.requesterCountryCode || undefined,
        beneficiaryId: formData.beneficiaryId || undefined, beneficiaryName: formData.beneficiaryName || undefined,
        beneficiaryCountry: formData.beneficiaryCountry || undefined, beneficiaryCountryCode: formData.beneficiaryCountryCode || undefined,
      };
      const lines = submittedOrder.catalogueItems.map((line) => ({ id: `LINE-${id}-${line.itemId}`, requestId: id, description: line.name, quantity: line.quantity, unit: item.unit, unitPrice: item.unitPrice, supplierId: supplier.id, contractId: resolved.contract!.id, catalogueItemId: line.itemId, riskAssessmentId: riskAssessment?.id, commodityCode: item.commodityCode, deliveryDate: draft.needBy }));
      await submitGovernedCheckout({ requestId: id, requisitionId: `PR-${id}`, decision, checkout, request, lines });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success('Catalogue request submitted');
      setCatalogueCheckoutOpen(false);
      setRequestId(id);
      setStepId('confirmation');
    } catch (e) {
      console.error('Failed to place catalogue order:', e);
      toast.error('Failed to place the order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Contract call-offs use the same governed persistence seam as catalogue
  // orders. Keeping this path here prevents Expert mode from falling back to
  // the generic request writer and losing the PR/PO audit links.
  const submitContractCallOff = async (draft: ContractCallOffDraft) => {
    const contract = contracts.find((candidate) => candidate.id === formData.contractId);
    if (!contract) { toast.error('The selected contract is no longer available.'); return; }
    const supplier = suppliers.find((candidate) => candidate.id === contract.supplierId);
    if (!supplier) { toast.error('The contract supplier could not be resolved.'); return; }
    setIsSubmitting(true);
    const id = generateRequestId();
    try {
      const storedProfile = await getProcurementProfile(currentUser.id).catch(() => null);
      const profile = storedProfile ?? {
        userId: currentUser.id, defaultCurrency: formData.currency, costCentre: draft.costCentre,
        budgetOwner: currentUser.name, accountType: 'expense', beneficiaryId: formData.beneficiaryId || currentUser.id,
        // This was strictly worse: it approved whatever the requester had
        // chosen, by building the approved list out of that same choice.
        approvedShipToLocations: [],
      };
      const riskAssessment = resolveCheckoutRiskAssessment(riskAssessments, supplier.id, contract.id);
      const line = { description: draft.title, quantity: 1, unit: 'service', unitPrice: draft.value, supplierId: supplier.id, contractId: contract.id, riskAssessmentId: riskAssessment?.id, commodityCode: formData.commodityCode || profile.defaultCommodityCode };
      const checkout = {
        route: 'contract-call-off' as const, lines: [line], supplier, contract, riskAssessment, profile,
        currency: formData.currency, needByDate: draft.needBy, serviceStartDate: draft.serviceStartDate || undefined,
        serviceEndDate: draft.serviceEndDate || undefined, purpose: draft.purpose, costCentre: draft.costCentre,
        shipToLocationId: draft.deliveryLocation, beneficiaryId: formData.beneficiaryId || currentUser.id,
        idempotencyKey: `checkout-${id}`,
        activeCostCentreIds, activeDeliveryLocationIds,
      };
      const decision = evaluateGovernedCheckout(checkout);
      if (!decision.ok) throw new Error(decision.errors.join(' '));
      const request = {
        id, title: draft.title, description: draft.purpose, category: (formData.category || contract.category || 'services') as RequestCategory,
        status: 'intake' as const, priority: formData.isUrgent ? ('urgent' as const) : ('medium' as const), value: decision.totalValue,
        currency: formData.currency, supplierId: supplier.id, contractId: contract.id, buyingChannel: 'framework-call-off' as BuyingChannel,
        commodityCode: line.commodityCode, commodityCodeLabel: formData.commodityCodeLabel || line.commodityCode, costCentre: draft.costCentre,
        budgetOwner: currentUser.name, businessJustification: '', deliveryDate: parseDeliveryDate(draft.needBy) ?? undefined,
        requestorId: currentUser.id, ownerId: currentUser.id, daysInStage: 0, isOverdue: false, referBackCount: 0,
        beneficiaryId: formData.beneficiaryId || undefined, beneficiaryName: formData.beneficiaryName || undefined,
      };
      const lines = [{ id: `LINE-${id}-1`, requestId: id, description: draft.title, quantity: 1, unit: 'service', unitPrice: draft.value,
        supplierId: supplier.id, contractId: contract.id, riskAssessmentId: riskAssessment?.id, commodityCode: line.commodityCode, deliveryDate: draft.needBy }];
      await submitGovernedCheckout({ requestId: id, requisitionId: `PR-${id}`, decision, checkout, request, lines });
      if (decision.status !== 'approved') await initWorkflow(id, formData.workflowTemplateId, 'framework-call-off');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success('Contract call-off submitted');
      setRequestId(id); setStepId('confirmation');
    } catch (error) {
      toast.error(`Could not submit contract call-off: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally { setIsSubmitting(false); }
  };

  const handleNext = async () => {
    if (stepId === submitStepId) {
      // Submit
      const id = generateRequestId();
      setIsSubmitting(true);
      try {
        const sow = formData.serviceDescription ?? null;
        if (!determination) {
          // Never submit a governed record with no determination behind it:
          // the compliance row would claim checks that never ran.
          toast.error('The compliance checks are still running. Please try again in a moment.');
          return;
        }
        const parsedDeliveryDate = parseDeliveryDate(formData.deliveryDate);
        if (formData.deliveryDate && !parsedDeliveryDate) {
          toast.error('Please provide a specific need-by date before submitting.');
          return;
        }
        await submitIntake({
          request: {
            id, title: formData.title, description: sow?.narrative ?? formData.title,
            category: formData.category as RequestCategory, status: 'intake',
            priority: formData.isUrgent ? 'urgent' : 'medium', value: formData.estimatedValue,
            currency: formData.currency, supplierId: formData.supplierId, contractId: formData.contractId || undefined,
            workflowTemplateId: formData.workflowTemplateId || undefined,
            buyingChannel: (determination?.buyingChannelSlug ?? 'procurement-led') as BuyingChannel,
            approvalChain: determination?.approvalChain, sourcingType: determination?.sourcingType.type,
            sourcingTypeReason: determination?.sourcingType.reason, inherentRiskTier: determination?.inherentRisk.tier,
            materialityTier: determination?.materiality.criticality, riskAssessmentRequired: determination?.riskAssessmentRequired,
            screeningOutcome: determination?.screening.status, referralDisposition: determination?.referral.outcome,
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
            ...(formData.sowRequiredSections ? { requiredSections: formData.sowRequiredSections } : {}),
            ...(sow.captureFlags ? { captureFlags: sow.captureFlags } : {}),
          } : undefined,
          // One builder, both densities. It derives the record from the
          // determination's structured fields rather than from the sentences
          // this screen displays — the SRA outcome used to be read out of a
          // rendered label, so a never-assessed supplier recorded a pass.
          compliance: buildIntakeComplianceRecord(determination, { determinedAt: new Date().toISOString() }),
          workflowTemplateId: formData.workflowTemplateId,
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
          // Say so rather than pretending: the request IS submitted, and a
          // silent failure here would leave sourcing to discover an empty
          // candidate list with no explanation.
          console.error('Failed to record supplier candidates:', error);
          toast.warning('Request submitted, but the supplier shortlist could not be saved.');
        }

        queryClient.invalidateQueries({ queryKey: ['requests'] });
        toast.success('Request submitted successfully');
        setRequestId(id);
        setStepId('confirmation');
      } catch (e) {
        console.error('Failed to persist request:', e);
        // The dispatcher returns safe field-level validation text; surface it
        // instead of masking actionable date/accounting errors behind a generic toast.
        toast.error(e instanceof Error ? e.message : 'Failed to submit request. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    const next = nextStep(stepId, route);
    if (next !== 'submit') setStepId(next);
  };

  const handleBack = () => {
    const previous = previousStep(stepId, route);
    if (previous) setStepId(previous);
  };

  const handleSaveDraft = async () => {
    if (!formData.title) {
      toast.error('Cannot save draft without a title.');
      return;
    }
    const id = generateRequestId();
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
        workflowTemplateId: formData.workflowTemplateId || undefined,
        // The slug, not the label. `buyingChannelResult` is the display form
        // ("Procurement-Led Sourcing") and every consumer of this column keys
        // on the slug, so a draft saved here routed as an unknown channel.
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
        // A draft is saved from whatever is on screen, so this can still be
        // blank or half-typed. Normalise it the way the three submit paths do
        // rather than handing the raw field to a DATE column.
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
    setStepId('describe');
    setRequestId('');
  };

  return (
    <div
      // The chat step is two panes, so it earns the width; every other step is a
      // single column and reads better narrow. This condition used to re-inline
      // the chat-path predicate a third time rather than reuse the memo.
      className={cn('mx-auto space-y-6', stepId === 'details' && isChatIntakePath ? 'max-w-6xl' : 'max-w-3xl')}
    >
      {/* One header. This used to say "Simple requester view" / "New Request" /
          "Create a new procurement request in N steps" depending on a mode the
          requester had to pick first — three framings of one journey. */}
      <div>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Start a request</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {isCatalogue
            ? 'Catalogue request — governed checkout'
            : 'Tell us what you need. We will find the simplest compliant way to handle it.'}
        </p>
      </div>

      {/* Progress Bar */}
      {stepId !== 'confirmation' && (
        <div className="flex items-center gap-1">
          {wizardSteps.map((step, index) => {
            const position = index + 1;
            const current = stepNumber(stepId, route);
            return (
            <div key={step.id} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    position < current
                      ? 'bg-green-600 text-white'
                      : position === current
                        ? 'bg-blue-600 text-white'
                        : 'border-2 border-gray-200 bg-white text-gray-400'
                  )}
                >
                  {position < current ? (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    position
                  )}
                </div>
                {position < wizardSteps.length && (
                  <div
                    className={cn(
                      'mx-1 h-0.5 flex-1',
                      position < current ? 'bg-green-600' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-xs text-center',
                  position === current
                    ? 'font-semibold text-blue-600'
                    : position < current
                      ? 'font-medium text-green-700'
                      : 'text-gray-400'
                )}
              >
                {step.label}
              </span>
              {/* Only the current step's description. Rendering all of them put
                  two labels per step across the top of every screen — wayfinding
                  turned into a wall of text. The titles still show the whole
                  path; the detail belongs to where you actually are. */}
              {position === current && (
                <span className="hidden text-center text-[10px] leading-tight text-gray-500 sm:block">
                  {stepDescription(step.id, route)}
                </span>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* No step heading: the stepper directly above already renders this step's
          title and description, so an `h2` repeating "Describe: What do you
          need?" was the same words twice within one screen height. */}

      {/* Step Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {/* What this step is for, what it needs, and what follows from it. The
            confirmation step carries its own version of this and is excluded in
            the guidance map. */}
        <StepHeaderPanel guidance={stepGuidance(stepId, route) ?? null} />
        <StepErrorBoundary onReset={handleReset}>
        {stepId === 'describe' && (
          <StepCategory
            prefill={categoryPrefill}
            onUpdate={(d) => updateFormData(d)}
            onAutoAdvance={() => setStepId('buy-route')}
            onBrowseCatalogue={() => {
              // Direct catalogue entry — the user already knows it's an
              // off-the-shelf item, so skip the funnel and go to the catalogue.
              updateFormData({
                category: 'catalogue',
                categoryDescription: 'Catalogue Purchase',
                preCheckOutcome: 'catalogue',
                buyingChannelResult: 'catalogue',
              });
              setStepId('details');
            }}
          />
        )}
        {stepId === 'buy-route' && (
          <StepBuyRoute
            title={formData.title || formData.categoryDescription}
            demandDetail={formData.demandDetail}
            category={formData.category}
            estimatedValue={formData.estimatedValue}
            supplierId={formData.supplierId}
            llmIntent={formData.llmIntent}
            onChooseCatalogue={(items: CatalogueItem[]) => {
              const primary = items[0];
              if (!primary) return;
              // A matched catalogue result is a specific buyable item. Keep
              // that context in the URL so checkout starts on its detail page.
              navigate(`/catalogue/items/${encodeURIComponent(primary.id)}`);
            }}
            onChooseContract={(contract: Contract) => {
              updateFormData({
                preCheckOutcome: 'contract',
                contractId: contract.id,
                contractTitle: contract.title,
                supplier: contract.supplierName,
                supplierId: contract.supplierId,
                supplierProvenance: 'named',
                category: formData.category || contract.category.toLowerCase(),
                buyingChannelResult: 'framework-call-off',
              });
              setStepId('details');
            }}
            onProceedToFullRequest={() => {
              updateFormData({ preCheckOutcome: 'full-request' });
              setStepId('details');
            }}
            onEnrich={(text) => {
              // Into its own field, never appended to the title. It still
              // reaches the matcher (passed below), the service description and
              // the second contract check — without renaming the request.
              updateFormData({
                demandDetail: formData.demandDetail ? `${formData.demandDetail} ${text}` : text,
              });
            }}
          />
        )}
        {/* Requester context — who / where — established before the per-path
            capture so catalogue / contract / SOW all inherit it. */}
        {stepId === 'details' && (
          <RequesterContextBlock
            requestorId={currentUser.id}
            requesterCountry={formData.requesterCountry}
            beneficiaryId={formData.beneficiaryId}
            beneficiaryName={formData.beneficiaryName}
            costCentre={formData.costCentre}
            profileCostCentre={profileCostCentre}
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {stepId === 'details' && formData.preCheckOutcome === 'catalogue' && (
          catalogueCheckoutOpen && catalogueOrder ? (
            <CatalogueOrderCheckout
              item={catalogueItems.find((candidate) => candidate.id === catalogueOrder.catalogueItems[0]?.itemId) ?? catalogueItems[0]!}
              initialValues={{ quantity: catalogueOrder.catalogueItems[0]?.quantity, needBy: formData.deliveryDate, deliveryLocation: formData.deliveryLocation, recipient: formData.beneficiaryName, businessPurpose: formData.businessJustification, costCentre: formData.costCentre }}
              onSubmit={(draft) => void submitCatalogueOrder(catalogueOrder, draft)}
            />
          ) : <StepCatalogue onPlaceOrder={(order) => void submitCatalogueOrder(order)} />
        )}
        {stepId === 'details' && formData.preCheckOutcome === 'contract' && (
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4 text-sm">
            <p className="font-medium text-blue-900">Contract call-off</p>
            <p className="mt-0.5 text-blue-800">
              Confirm the value and timing for this purchase against{' '}
              {formData.contractTitle || 'the selected contract'}. The contract ceiling is not
              the value of this individual call-off.
            </p>
          </div>
        )}
        {stepId === 'details' && formData.preCheckOutcome === 'contract' && (
          <ContractCallOffCheckout
            contract={contracts.find((candidate) => candidate.id === formData.contractId)}
            initialValues={{ title: formData.title || formData.contractTitle, value: formData.estimatedValue, needBy: formData.deliveryDate, recipient: formData.beneficiaryName, purpose: formData.businessJustification, costCentre: formData.costCentre }}
            onSubmit={(draft) => void submitContractCallOff(draft)}
          />
        )}
        {/* There is no `full-request && category === 'catalogue'` branch.
            It rendered the same checkout as the catalogue route above and could
            never fire: the only action that sets `category: 'catalogue'`
            (Browse the catalogue) sets `preCheckOutcome: 'catalogue'` in the
            same call, and ROUTE_LIKE_CATEGORY stops a classifier producing it.
            A fifth capture variant nobody could reach. */}
        {stepId === 'details' && formData.preCheckOutcome === 'full-request' && ['contract-renewal', 'supplier-onboarding'].includes(formData.category) && (
          <StepDetails
            category={formData.category}
            data={{
              title: formData.title,
              supplier: formData.supplier,
              supplierId: formData.supplierId,
              estimatedValue: formData.estimatedValue,
              currency: formData.currency,
              businessJustification: formData.businessJustification,
              deliveryDate: formData.deliveryDate,
              isUrgent: formData.isUrgent,
              costCentre: formData.costCentre,
              commodityCode: formData.commodityCode,
              commodityCodeLabel: formData.commodityCodeLabel,
            }}
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {stepId === 'details' && formData.preCheckOutcome === 'full-request' && !['catalogue', 'contract-renewal', 'supplier-onboarding'].includes(formData.category) && (
          <StepChatIntake
            category={formData.category}
            categoryDescription={formData.categoryDescription}
            data={{
              title: formData.title,
              supplier: formData.supplier,
              supplierId: formData.supplierId,
              estimatedValue: formData.estimatedValue,
              currency: formData.currency,
              // The detail added at the buy-route step is context the
              // conversation should not ask for again.
              businessJustification: [formData.businessJustification, formData.demandDetail]
                .filter(Boolean).join(' ').trim(),
              deliveryDate: formData.deliveryDate,
              isUrgent: formData.isUrgent,
              costCentre: formData.costCentre,
              commodityCode: formData.commodityCode,
              commodityCodeLabel: formData.commodityCodeLabel,
              serviceDescription: formData.serviceDescription,
            }}
            onUpdate={(d) => updateFormData(d)}
            // The risk questions are asked as the tail of this conversation
            // rather than as a card of switches below it. The determination
            // still decides WHICH are asked; this only carries them in.
            riskQuestions={determination?.residualQuestions}
            riskAnswers={formData.miniIrq}
          />
        )}
        {(stepId === 'details' || stepId === 'review') && formData.preCheckOutcome === 'full-request' && (
          <StepCompliance
            section={stepId === 'details' ? 'inputs' : 'conclusions'}
            // On the chat path the conversation asks them; the card would be a
            // second place to answer the same question.
            askRiskQuestions={!isChatIntakePath}
            revealSupplier={!isChatIntakePath || detailsDescriptionDone}
            requiredSections={formData.sowRequiredSections}
            qualityScore={formData.sowQualityScore}
            supplierProvenance={formData.supplierProvenance}
            onSelectSupplier={(sup) =>
              updateFormData({
                supplier: sup.name,
                supplierId: sup.id,
                supplierProvenance: 'chosen',
                // Choosing a supplier is itself the answer to "do you have one
                // in mind", so it clears an earlier "go out to market".
                supplierIntent: 'named',
                supplierCandidateIds: formData.supplierCandidateIds.filter((id) => id !== sup.id),
              })
            }
            supplierCandidateIds={formData.supplierCandidateIds}
            onToggleSupplierCandidate={(sup) =>
              updateFormData({
                supplierIntent: 'named',
                supplierCandidateIds: formData.supplierCandidateIds.includes(sup.id)
                  ? formData.supplierCandidateIds.filter((id) => id !== sup.id)
                  : [...formData.supplierCandidateIds, sup.id],
              })
            }
            supplierIntent={formData.supplierIntent}
            onSupplierIntentChange={(intent) =>
              updateFormData(intent === 'to-be-sourced'
                // An explicit "no supplier" clears any earlier selection, so the
                // screen and the record cannot disagree about what was decided.
                ? { supplierIntent: intent, supplier: '', supplierId: '', supplierCandidateIds: [] }
                : { supplierIntent: intent })
            }
            category={formData.category}
            estimatedValue={formData.estimatedValue}
            supplierId={formData.supplierId}
            supplier={formData.supplier}
            serviceDescription={formData.serviceDescription}
            requestTitle={formData.title}
            miniIrq={formData.miniIrq}
            determination={determination}
            onMiniIrqChange={(m) => updateFormData({ miniIrq: m })}
          />
        )}
        {stepId === 'review' && (
          <StepRoutingPreview
            category={formData.category}
            estimatedValue={formData.estimatedValue}
            workflowTemplateId={formData.workflowTemplateId}
            riskAssessmentRequired={determination?.riskAssessmentRequired ?? false}
            supplierOnboardingRequired={determination?.supplierOnboardingRequired ?? false}
            additionalReviewers={formData.additionalReviewers}
            notes={formData.notes}
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {stepId === 'confirmation' && (
          <StepConfirmation
            requestId={requestId}
            // The same handoff steps the Review step showed, so the two screens
            // cannot disagree about what happens next.
            nextSteps={determination?.handoffSteps ?? []}
            data={{
              title: formData.title,
              category: formData.category,
              supplier: formData.supplier,
              estimatedValue: formData.estimatedValue,
              currency: formData.currency,
              costCentre: formData.costCentre,
              deliveryDate: formData.deliveryDate,
              isUrgent: formData.isUrgent,
              buyingChannelResult: determination?.buyingChannelResult ?? '',
              commodityCodeLabel: formData.commodityCodeLabel,
              catalogueItems: formData.catalogueItems,
            }}
            onReset={handleReset}
          />
        )}
        </StepErrorBoundary>
      </div>

      {/* Navigation */}
      {stepId !== 'confirmation' && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={stepId === 'describe'}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {/* A disabled Next that does not say why is a dead end. Name what is
                still outstanding, in the requester's terms. */}
            {stepId === 'details' && isChatIntakePath && outstanding.length > 0 && (
              <p className="mr-1 max-w-md text-right text-xs text-gray-500">
                Still needed:{' '}
                {outstanding
                  .map((slot) => slot.target.field.replace(/([A-Z])/g, ' $1').toLowerCase())
                  .join(', ')}
                {' — '}keep answering the assistant.
              </p>
            )}
            {/* The form paths need the same courtesy: a disabled Next that does
                not say why is a dead end wherever it appears. */}
            {stepId === 'details' && !isChatIntakePath && missingDetailFields.length > 0 && (
              <p className="mr-1 max-w-md text-right text-xs text-gray-500">
                To review this request, add {missingDetailFields.join(', ')}.
              </p>
            )}
            {(stepId === 'details' || stepId === 'review') && (
              <Button variant="ghost" onClick={handleSaveDraft} disabled={isSubmitting}>
                <Save className="size-4" />
                Save as Draft
              </Button>
            )}
            {/* Catalogue places the order from the cart itself (single click),
                so the footer shows no primary action on that step. */}
            {!(isCatalogue && stepId === 'details') && !(stepId === 'details' && formData.preCheckOutcome === 'contract') && (
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isSubmitting}
              >
                {stepId === submitStepId ? (
                  isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Submit Request
                    </>
                  )
                ) : (
                  <>
                    Next
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
