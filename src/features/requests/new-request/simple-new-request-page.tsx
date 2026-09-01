/**
 * Requester-first intake: derives a fulfilment route before asking for
 * governance detail, while reusing the same catalogue, contract, and service
 * description components as the Expert journey.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useServiceDescriptionTemplate } from '@/lib/db/hooks/use-service-description-templates';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { useApprovalChains } from '@/lib/db/hooks/use-approval-chains';
import { useCatalogueItems } from '@/lib/db/hooks/use-catalogue-items';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { createRequest } from '@/lib/db/requests';
import { initWorkflow } from '@/lib/workflow/engine';
import { queryClient } from '@/lib/query-client';
import { resolveDemandChannel } from '@/lib/routing/demand-channel';
import { evaluatePCardEligibility } from '@/lib/routing/p-card';
import { computeDemandSignals } from '@/lib/procurement/demand-signals';
import { resolveSlots, requiredSlotsFilled, type DemandConversationContext } from '@/lib/procurement/demand-conversation';
import { selectWorkflowTemplateForCategory, selectApprovalChainForValue } from '@/lib/workflow/workflow-steps';
import { evaluateGovernedCheckout, resolveCheckoutContract, resolveCheckoutRiskAssessment } from '@/lib/procurement/governed-checkout';
import { submitGovernedCheckout } from '@/lib/procurement/submit-governed-checkout';
import { submitIntake } from '@/lib/procurement/submit-intake';
import { getProcurementProfile } from '@/lib/db/procurement-profiles';
import { sectionValuesOf } from '@/lib/procurement/service-description-seed';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import { classifyCommodityCategory } from '@/lib/procurement/classify';
import type { Contract, ProcurementRequest, CommodityClassificationCandidate, IntakeAttachment } from '@/data/types';
import type { CatalogueItem } from '@/data/catalogue-items';
import type { ServiceDescription } from './new-request-page';
import { StepCategory } from './step-category';
import { StepPreCheck } from './step-pre-check';
import { StepCatalogue } from './step-catalogue';
import { StepChatIntake } from './step-chat-intake';
import { RequesterContextBlock } from './components/requester-context-block';
import { CatalogueOrderCheckout } from '@/features/catalogue/catalogue-order-checkout';
import { ContractCallOffCheckout } from './contract-call-off-checkout';
import { IntakeGuidanceCard } from './components/intake-guidance-card';

type SimplePhase = 'describe' | 'route' | 'details' | 'review' | 'submitted';
type SimpleRoute = 'catalogue' | 'contract' | 'p-card' | 'direct-po' | 'new-request';

interface SimpleData {
  category: string;
  categoryDescription: string;
  llmIntent: string;
  title: string;
  supplier: string;
  supplierId: string;
  estimatedValue: number;
  currency: string;
  businessJustification: string;
  deliveryDate: string;
  isUrgent: boolean;
  costCentre: string;
  commodityCode: string;
  commodityCodeLabel: string;
  commodityCandidates?: CommodityClassificationCandidate[];
  commodityClassificationConfirmed?: boolean;
  attachments?: IntakeAttachment[];
  serviceDescription: ServiceDescription | null;
  catalogueItems: { itemId: string; name: string; quantity: number; unitPrice: number; supplierId: string }[];
  contractId: string;
  contractTitle: string;
  requesterCountry: string;
  requesterCountryCode: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  beneficiaryCountryCode: string;
  deliveryLocation: string;
  recipient: string;
}

const INITIAL_DATA: SimpleData = {
  category: '', categoryDescription: '', llmIntent: '', title: '', supplier: '', supplierId: '',
  estimatedValue: 0, currency: 'EUR', businessJustification: '', deliveryDate: '', isUrgent: false,
  costCentre: '', commodityCode: '', commodityCodeLabel: '', commodityCandidates: [], commodityClassificationConfirmed: false, attachments: [], serviceDescription: null,
  catalogueItems: [], contractId: '', contractTitle: '', requesterCountry: '', requesterCountryCode: '',
  beneficiaryId: '', beneficiaryName: '', beneficiaryCountry: '', beneficiaryCountryCode: '',
  deliveryLocation: 'office', recipient: '',
};

const CATEGORY_LABELS: Record<string, string> = {
  goods: 'Goods',
  services: 'Services',
  software: 'Software / IT',
  consulting: 'Consulting',
  'contingent-labour': 'Contingent Labour',
  'contract-renewal': 'Contract Renewal',
  'supplier-onboarding': 'Supplier Onboarding',
};

/**
 * Seed the route stage from a demand entered on the home page. The home page
 * already collected the user's intent, so showing the same describe/classify
 * screen again adds friction and previously caused the text to be discarded.
 * The deterministic category is only a routing hint; the pre-check and server
 * remain authoritative for catalogue, contract, and governance decisions.
 */
function dataFromHomeDemand(text: string): SimpleData {
  const category = classifyCommodityCategory(text);
  return {
    ...INITIAL_DATA,
    category,
    categoryDescription: CATEGORY_LABELS[category] ?? category,
    title: text,
  };
}

const ROUTE_COPY: Record<SimpleRoute, { label: string; detail: string }> = {
  catalogue: { label: 'Order from the catalogue', detail: 'Pre-approved items can be ordered without a new sourcing exercise.' },
  contract: { label: 'Use an existing contract', detail: 'The matched agreement can cover this need without starting a new sourcing event.' },
  'p-card': { label: 'Use a purchasing card', detail: 'This request is eligible for the governed purchasing-card route.' },
  'direct-po': { label: 'Raise a direct purchase order', detail: 'This low-complexity request can follow the direct purchase-order route.' },
  'new-request': { label: 'Start a procurement review', detail: 'We will use the service description and checks to route this request.' },
};

function requestId(): string {
  return `REQ-2025-${Math.floor(1000 + Math.random() * 9000)}`;
}

function routeFromChannel(channel: string): SimpleRoute {
  if (channel === 'catalogue') return 'catalogue';
  if (channel === 'p-card') return 'p-card';
  if (channel === 'direct-po' || channel === 'business-led') return 'direct-po';
  return 'new-request';
}

export function SimpleNewRequestPage() {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: suppliers = [] } = useSuppliers();
  const { data: routingRules = [] } = useRoutingRules();
  const { data: workflowTemplates = [] } = useWorkflowTemplates();
  const { data: approvalChains = [] } = useApprovalChains();
  const { data: catalogueItems = [] } = useCatalogueItems();
  const { data: contracts = [] } = useContracts();
  const { data: riskAssessments = [] } = useRiskAssessments();
  const homeDemand = (searchParams.get('q') ?? '').trim();
  // A demand typed on Simple Home is already a valid intake starting point.
  // Open on route evaluation so the requester sees the catalogue/contract
  // decision directly, while a blank /requests/new link keeps the normal
  // describe screen for users who intentionally opened the full intake.
  const [phase, setPhase] = useState<SimplePhase>(() => homeDemand ? 'route' : 'describe');
  const [data, setData] = useState<SimpleData>(() => homeDemand ? dataFromHomeDemand(homeDemand) : INITIAL_DATA);
  const [route, setRoute] = useState<SimpleRoute>('new-request');
  const [requestIdValue, setRequestIdValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [catalogueCheckoutOpen, setCatalogueCheckoutOpen] = useState(false);

  // Catalogue item detail hands a completed fulfilment context back to the
  // request entry point. Hydrate it once so the user reviews the same data
  // instead of being sent through the catalogue picker a second time.
  useEffect(() => {
    const itemId = searchParams.get('catalogueItem');
    if (!itemId || data.catalogueItems.length > 0) return;
    const item = catalogueItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const quantity = Number(searchParams.get('quantity') ?? '1');
    const needBy = searchParams.get('needBy') ?? '';
    const purpose = searchParams.get('purpose') ?? '';
    const location = searchParams.get('deliveryLocation') ?? 'office';
    const recipient = searchParams.get('recipient') ?? '';
    const costCentre = searchParams.get('costCentre') ?? '';
    update({
      category: 'catalogue', categoryDescription: 'Catalogue Purchase', title: item.name,
      supplier: item.supplierName, supplierId: item.supplierId,
      estimatedValue: Math.max(1, quantity) * item.unitPrice,
      deliveryDate: needBy, businessJustification: purpose, costCentre,
      deliveryLocation: location, recipient,
      catalogueItems: [{ itemId: item.id, name: item.name, quantity: Math.max(1, quantity), unitPrice: item.unitPrice, supplierId: item.supplierId }],
    });
    setRoute('catalogue');
    setPhase('review');
  // `data.catalogueItems.length` intentionally gates this hydration to one pass.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogueItems, searchParams]);

  const update = (patch: Record<string, unknown>) => {
    setData((previous) => ({ ...previous, ...patch } as SimpleData));
  };

  // Profile defaults remove accounting friction from call-offs, but never
  // overwrite a value the requester has already entered or confirmed.
  useEffect(() => {
    let cancelled = false;
    void getProcurementProfile(currentUser.id).then((profile) => {
      if (cancelled || !profile) return;
      setData((previous) => ({
        ...previous,
        costCentre: previous.costCentre || profile.costCentre || '',
        beneficiaryId: previous.beneficiaryId || profile.beneficiaryId || '',
      }));
    }).catch(() => {
      // The form remains usable when the additive profile table is unavailable.
    });
    return () => { cancelled = true; };
  }, [currentUser.id]);

  const { data: template } = useServiceDescriptionTemplate(data.category || undefined);
  const slots = useMemo(() => resolveSlots(template?.slots), [template]);
  const context = useMemo<DemandConversationContext>(() => ({
    category: data.category,
    title: data.title || undefined,
    estimatedValue: data.estimatedValue || undefined,
    deliveryDate: data.deliveryDate || undefined,
    sow: sectionValuesOf(data.serviceDescription),
  }), [data]);
  const descriptionComplete = requiredSlotsFilled(context, slots);
  const detailComplete = Boolean(data.title && data.estimatedValue > 0 && data.deliveryDate && data.costCentre);
  const missingDetailFields = [
    !data.title ? 'a title' : null,
    !(data.estimatedValue > 0) ? 'an order value' : null,
    !data.deliveryDate ? 'a need-by/service date' : null,
    !data.costCentre ? 'a cost centre' : null,
  ].filter((field): field is string => Boolean(field));
  const signals = useMemo(() => computeDemandSignals({
    category: data.category,
    value: data.estimatedValue,
    supplier: suppliers.find((supplier) => supplier.id === data.supplierId) ?? null,
    sow: sectionValuesOf(data.serviceDescription),
  }), [data.category, data.estimatedValue, data.serviceDescription, data.supplierId, suppliers]);
  const pCardEligibility = useMemo(() => evaluatePCardEligibility({
    category: data.category,
    value: data.estimatedValue,
    isUrgent: data.isUrgent,
    material: signals.material,
    riskRating: signals.inherentRiskTier,
  }), [data.category, data.estimatedValue, data.isUrgent, signals.inherentRiskTier, signals.material]);
  const routing = useMemo(() => resolveDemandChannel(routingRules, {
    category: data.category,
    value: data.estimatedValue,
    supplierId: data.supplierId,
    riskRating: signals.inherentRiskTier,
    material: signals.material,
    isUrgent: data.isUrgent,
    pCardEligible: pCardEligibility.eligible,
  }), [data.category, data.estimatedValue, data.isUrgent, data.supplierId, pCardEligibility.eligible, routingRules, signals]);

  const finishCatalogueOrder = async (order: {
    title: string;
    estimatedValue: number;
    supplier: string;
    supplierId: string;
    catalogueItems: { itemId: string; name: string; quantity: number; unitPrice: number; supplierId: string }[];
  }) => {
    update(order);
    setCatalogueCheckoutOpen(true);
  };

  const finishCatalogueCheckout = (draft: { quantity: number; needBy: string; deliveryLocation: string; recipient: string; businessPurpose: string; costCentre: string }) => {
    const selected = data.catalogueItems[0];
    const item = selected ? catalogueItems.find((candidate) => candidate.id === selected.itemId) : undefined;
    update({ deliveryDate: draft.needBy, deliveryLocation: draft.deliveryLocation, recipient: draft.recipient, businessJustification: draft.businessPurpose, costCentre: draft.costCentre,
      estimatedValue: item ? draft.quantity * item.unitPrice : data.estimatedValue,
      catalogueItems: selected ? [{ ...selected, quantity: draft.quantity }] : data.catalogueItems });
    setPhase('review');
  };

  async function submitRequest(requestData: SimpleData, requestRoute: SimpleRoute) {
    const id = requestId();
    setSubmitting(true);
    try {
      if (requestRoute === 'catalogue' || requestRoute === 'contract') {
        const item = requestRoute === 'catalogue'
          ? catalogueItems.find((candidate) => candidate.id === requestData.catalogueItems[0]?.itemId)
          : undefined;
        if (requestRoute === 'catalogue' && !item) throw new Error('The selected catalogue item is no longer available.');
        // Resolved by the same helpers Expert mode uses. Simple had its own
        // matcher that fell back to comparing supplier *names* and picked the
        // latest end date, so where Expert refused an ambiguous item and sent it
        // to Procurement, Simple silently chose one — a different governance
        // outcome for the same demand, decided by which screen you were on.
        const now = new Date();
        const matchedContract = item
          ? resolveCheckoutContract(item, contracts, now).contract
          : contracts.find((candidate) => candidate.id === requestData.contractId
            && candidate.status !== 'expired' && candidate.status !== 'terminated'
            && new Date(candidate.startDate) <= now && new Date(candidate.endDate) >= now);
        if (!matchedContract) {
          const reason = item ? resolveCheckoutContract(item, contracts, now).error : undefined;
          throw new Error(reason ?? 'No active supplier contract could be resolved for this order. Please contact Procurement.');
        }
        const supplier = suppliers.find((candidate) => candidate.id === matchedContract.supplierId)
          ?? (item ? suppliers.find((candidate) => candidate.id === item.supplierId) : undefined);
        if (!supplier) throw new Error('The catalogue supplier could not be resolved.');
        let storedProfile;
        try {
          storedProfile = await getProcurementProfile(currentUser.id);
        } catch {
          // Older environments may not have applied the additive profile table;
          // the checkout still has a safe, explicit fallback for this prototype.
          storedProfile = null;
        }
        const profile = storedProfile ?? {
          userId: currentUser.id, defaultCurrency: requestData.currency || 'EUR', costCentre: requestData.costCentre,
          budgetOwner: currentUser.name, accountType: 'expense', beneficiaryId: requestData.beneficiaryId || currentUser.id,
          approvedShipToLocations: [{ id: requestData.deliveryLocation || 'office', label: requestData.deliveryLocation || 'Default location' }],
          defaultShipToLocationId: requestData.deliveryLocation || 'office', defaultCommodityCode: item?.commodityCode,
        };
        // Same helper as Expert: it filters to completed assessments and prefers
        // an unexpired one. Simple filtered on neither, so an expired or draft
        // assessment could be handed to the evaluator and change whether the
        // order needed a risk review at all.
        const riskAssessment = resolveCheckoutRiskAssessment(riskAssessments, supplier.id, matchedContract.id, now);
        const quantity = requestData.catalogueItems[0]?.quantity ?? 1;
        const unitPrice = item?.unitPrice ?? requestData.estimatedValue;
        const line = {
          item, description: item?.name ?? requestData.title, quantity, unit: item?.unit ?? 'service',
          unitPrice, supplierId: supplier.id, contractId: matchedContract.id,
          riskAssessmentId: riskAssessment?.id, commodityCode: item?.commodityCode || requestData.commodityCode,
        };
        const checkout = {
          route: requestRoute === 'catalogue' ? 'catalogue' as const : 'contract-call-off' as const, lines: [line], supplier, contract: matchedContract, riskAssessment, profile,
          currency: requestData.currency, needByDate: requestData.deliveryDate, purpose: requestData.businessJustification,
          costCentre: requestData.costCentre,
          // Was omitted entirely, so whenever a stored profile existed the
          // requester's chosen delivery location was shown back to them and then
          // discarded in favour of the profile default. Expert has always passed it.
          shipToLocationId: requestData.deliveryLocation || profile.defaultShipToLocationId,
          beneficiaryId: requestData.beneficiaryId || currentUser.id,
          idempotencyKey: `checkout-${id}`,
        };
        const decision = evaluateGovernedCheckout(checkout);
        if (!decision.ok) throw new Error(decision.errors.join(' '));
        const templateForRequest = selectWorkflowTemplateForCategory(workflowTemplates, requestData.category);
        const governedRequest = {
          id, title: requestData.title, description: requestData.serviceDescription?.narrative || requestData.title,
          category: requestRoute === 'catalogue' ? 'catalogue' : requestData.category, status: 'intake' as const, priority: requestData.isUrgent ? 'urgent' as const : 'medium' as const,
          value: decision.totalValue, currency: decision.currency, requestorId: currentUser.id, ownerId: currentUser.id,
          supplierId: supplier.id, contractId: matchedContract.id, buyingChannel: requestRoute === 'catalogue' ? 'catalogue' : 'framework-call-off', commodityCode: item?.commodityCode || requestData.commodityCode || '',
          commodityCodeLabel: requestData.commodityCodeLabel || item?.commodityCode || '', costCentre: decision.resolved.costCentre || '', budgetOwner: decision.resolved.budgetOwner || '',
          businessJustification: '', deliveryDate: parseDeliveryDate(requestData.deliveryDate) ?? undefined,
          commodityCandidates: requestData.commodityCandidates, commodityClassificationConfirmed: requestData.commodityClassificationConfirmed, attachments: requestData.attachments,
        };
        const governedLines = [{ id: `LINE-${id}-1`, requestId: id, description: line.description, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice, supplierId: supplier.id, contractId: matchedContract.id, ...(item ? { catalogueItemId: item.id } : {}), riskAssessmentId: riskAssessment?.id, commodityCode: line.commodityCode, deliveryDate: requestData.deliveryDate }];
        await submitGovernedCheckout({
          requestId: id, requisitionId: `PR-${id}`, decision, checkout,
          request: governedRequest,
          lines: governedLines,
        });
        if (decision.status !== 'approved') {
          await initWorkflow(id, templateForRequest?.id, requestRoute === 'catalogue' ? 'catalogue' : 'framework-call-off');
        }
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        setRequestIdValue(id); setPhase('submitted');
        toast.success('Request and purchase requisition created');
        return;
      }
      // One route value decides both the recorded channel and the copy shown for
      // it. `route` state is only ever catalogue / contract / new-request, so the
      // p-card and direct-po branches here were dead: the record was written
      // `p-card` while the recommendation card said "Use a purchasing card" and
      // the review and confirmation screens said "Start a procurement review" —
      // three surfaces, two answers, for the same request.
      const channel = routing.channel;
      // The catalogue and contract routes return above, so by here the recorded
      // channel is the only thing that decides which path this request is on.
      const effectiveRoute = routeFromChannel(channel);
      const templateForRequest = selectWorkflowTemplateForCategory(workflowTemplates, requestData.category);
      const approval = selectApprovalChainForValue(approvalChains, requestData.estimatedValue);
      const record: Partial<ProcurementRequest> & { id: string } = {
        id, title: requestData.title || 'Procurement request',
        description: requestData.serviceDescription?.narrative || requestData.businessJustification || requestData.title,
        category: requestData.category, status: 'intake', priority: requestData.isUrgent ? 'urgent' : 'medium',
        value: requestData.estimatedValue, currency: requestData.currency, supplierId: requestData.supplierId || undefined,
        contractId: requestData.contractId || undefined, workflowTemplateId: templateForRequest?.id,
        buyingChannel: channel, approvalChain: approval?.id, commodityCode: requestData.commodityCode,
        commodityCodeLabel: requestData.commodityCodeLabel, costCentre: requestData.costCentre, budgetOwner: currentUser.name,
        businessJustification: '', deliveryDate: parseDeliveryDate(requestData.deliveryDate) ?? undefined,
        commodityCandidates: requestData.commodityCandidates, commodityClassificationConfirmed: requestData.commodityClassificationConfirmed, attachments: requestData.attachments,
        isUrgent: requestData.isUrgent, requestorId: currentUser.id, ownerId: currentUser.id, daysInStage: 0,
        isOverdue: false, referBackCount: 0, requesterCountry: requestData.requesterCountry || undefined,
        requesterCountryCode: requestData.requesterCountryCode || undefined, beneficiaryId: requestData.beneficiaryId || undefined,
        beneficiaryName: requestData.beneficiaryName || undefined, beneficiaryCountry: requestData.beneficiaryCountry || undefined,
        beneficiaryCountryCode: requestData.beneficiaryCountryCode || undefined,
      };
      await submitIntake({
        request: record,
        serviceDescription: requestData.serviceDescription ? { ...requestData.serviceDescription } : undefined,
        compliance: {
          determinedAt: new Date().toISOString(),
          buyingChannel: { channel, label: ROUTE_COPY[effectiveRoute].label, reasoning: ROUTE_COPY[effectiveRoute].detail },
          // Recorded as not-run, not as passed. Simple intake does not perform a
          // supplier-risk screen or a duplicate search — it used to store
          // `pass` and "No duplicate demand detected", which a reviewer reads
          // as evidence that both ran and cleared. Expert mode fills these from
          // real evaluation; until Simple does the same, it says so.
          sraCheck: { status: 'not-run', detail: 'Not screened at intake — the assigned owner runs this check.' },
          policyChecks: [],
          duplicateCheck: { found: false, performed: false, detail: 'No duplicate search was run at intake.' },
          riskFlags: [], matchingRiskAssessmentIds: [],
        },
        workflowTemplateId: templateForRequest?.id,
        buyingChannel: channel,
        idempotencyKey: `intake-${id}`,
      });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      // So the confirmation names the path the request is actually on.
      setRoute(effectiveRoute);
      setRequestIdValue(id);
      setPhase('submitted');
      toast.success('Request submitted successfully');
    } catch (error) {
      toast.error(`Could not submit request: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDraft() {
    if (!data.title && !data.categoryDescription && !data.businessJustification) {
      toast.error('Add a short description before saving for later.');
      return;
    }
    const id = requestId();
    setSubmitting(true);
    try {
      await createRequest({
        id,
        title: data.title || data.categoryDescription || 'Procurement request',
        description: data.serviceDescription?.narrative || data.title || data.categoryDescription,
        category: data.category || 'goods',
        status: 'draft',
        priority: data.isUrgent ? 'urgent' : 'medium',
        value: data.estimatedValue,
        currency: data.currency,
        supplierId: data.supplierId || undefined,
        contractId: data.contractId || undefined,
        buyingChannel: route === 'p-card' ? 'p-card' : route === 'contract' ? 'framework-call-off' : route === 'catalogue' ? 'catalogue' : undefined,
        costCentre: data.costCentre || undefined,
        businessJustification: undefined,
        commodityCode: data.commodityCode || undefined,
        commodityCodeLabel: data.commodityCodeLabel || undefined,
        commodityCandidates: data.commodityCandidates,
        commodityClassificationConfirmed: data.commodityClassificationConfirmed,
        attachments: data.attachments,
        deliveryDate: parseDeliveryDate(data.deliveryDate) ?? undefined,
        requestorId: currentUser.id,
        ownerId: currentUser.id,
        daysInStage: 0,
        isOverdue: false,
        referBackCount: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success(`Draft ${id} saved. You can finish it from My Requests.`);
    } catch (error) {
      toast.error(`Could not save draft: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  }

  const routeLabel = ROUTE_COPY[route];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Simple requester view</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Start a request</h1>
        <p className="mt-1 text-sm text-gray-500">Tell us what you need. We will find the simplest compliant way to handle it.</p>
      </header>

      {phase !== 'submitted' && (
        <div className="flex items-center gap-2 text-xs text-gray-500" aria-label={`Request progress: ${phase}`}>
          {(['describe', 'route', 'details', 'review'] as const).map((item, index) => (
            <div key={item} className="flex flex-1 items-center gap-2">
              <span className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${phase === item ? 'bg-blue-600 text-white' : ['describe', 'route', 'details', 'review'].indexOf(phase) > index ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{index + 1}</span>
              <span className="hidden sm:inline">{['Describe', 'Route', 'Details', 'Review'][index]}</span>
              {index < 3 && <span className="h-px flex-1 bg-gray-200" />}
            </div>
          ))}
        </div>
      )}

      {phase === 'describe' && (
          <Card><CardContent className="p-6"><StepCategory category={data.category} categoryDescription={data.categoryDescription} prefill={homeDemand} onUpdate={update} onAutoAdvance={() => setPhase('route')} onBrowseCatalogue={() => { update({ category: 'catalogue', categoryDescription: 'Catalogue Purchase', preCheckOutcome: 'catalogue' }); setRoute('catalogue'); setPhase('details'); }} /></CardContent></Card>
      )}

      {phase === 'route' && (
        <div className="space-y-4">
        <Card><CardContent className="p-6"><StepPreCheck title={data.title || data.categoryDescription} category={data.category} estimatedValue={data.estimatedValue} supplierId={data.supplierId} llmIntent={data.llmIntent} onChooseCatalogue={(items: CatalogueItem[]) => { const primary = items[0]; if (primary) { navigate(`/catalogue/items/${encodeURIComponent(primary.id)}`); return; } }} onChooseContract={(contract: Contract) => { update({ contractId: contract.id, contractTitle: contract.title, supplier: contract.supplierName, supplierId: contract.supplierId, category: data.category || contract.category.toLowerCase() }); setRoute('contract'); setPhase('details'); }} onProceedToFullRequest={() => { // Explicitly selecting a full request must never inherit a catalogue/direct-PO channel from the preliminary rules preview.
          setRoute('new-request');
          setPhase('details');
        }} onEnrich={(text) => update({ title: data.title ? `${data.title} — ${text}` : text })} /></CardContent></Card>
          <Card className="border-blue-100 bg-blue-50/40"><CardContent className="space-y-2 p-4 text-sm"><p className="font-medium text-blue-900">Recommended path: {ROUTE_COPY[routeFromChannel(routing.channel)].label}</p><p className="text-blue-800">{ROUTE_COPY[routeFromChannel(routing.channel)].detail}</p>{!pCardEligibility.eligible && <p className="text-xs text-blue-700">Purchasing card is not available for this request: {pCardEligibility.ineligibleReasons[0]}</p>}</CardContent></Card>
        </div>
      )}

      {phase === 'details' && (
        <div className="space-y-4">
          <RequesterContextBlock requestorId={currentUser.id} requesterCountry={data.requesterCountry} beneficiaryId={data.beneficiaryId} beneficiaryName={data.beneficiaryName} onUpdate={update} />
          {route === 'contract' && (
            <Card className="border-blue-100 bg-blue-50/40">
              <CardContent className="space-y-1 p-4 text-sm">
                <p className="font-medium text-blue-900">Contract call-off</p>
                <p className="text-blue-800">Confirm the value and timing for this purchase against {data.contractTitle || 'the selected contract'}. The contract ceiling is not the value of this individual call-off.</p>
              </CardContent>
            </Card>
          )}
          {route === 'catalogue' ? (catalogueCheckoutOpen && data.catalogueItems[0] ? <CatalogueOrderCheckout item={catalogueItems.find((item) => item.id === data.catalogueItems[0].itemId) ?? catalogueItems[0]} mode="simple" initialValues={{ quantity: data.catalogueItems[0].quantity, costCentre: data.costCentre, needBy: data.deliveryDate, businessPurpose: data.businessJustification, deliveryLocation: data.deliveryLocation, recipient: data.recipient }} onSubmit={finishCatalogueCheckout} /> : <Card><CardHeader><CardTitle className="text-base">Choose your items</CardTitle></CardHeader><CardContent><StepCatalogue onPlaceOrder={(order) => void finishCatalogueOrder(order)} /></CardContent></Card>) : route === 'new-request' ? <Card><CardContent className="p-6"><StepChatIntake category={data.category} categoryDescription={data.categoryDescription} data={{ ...data, serviceDescription: data.serviceDescription }} onUpdate={update} /></CardContent></Card> : <ContractCallOffCheckout contract={contracts.find((candidate) => candidate.id === data.contractId) ?? contracts[0]} mode="simple" initialValues={{ title: data.title, value: data.estimatedValue, needBy: data.deliveryDate, deliveryLocation: data.deliveryLocation, recipient: data.recipient, purpose: data.businessJustification, costCentre: data.costCentre }} onSubmit={(draft) => { update({ title: draft.title, estimatedValue: draft.value, deliveryDate: draft.needBy, deliveryLocation: draft.deliveryLocation, recipient: draft.recipient, businessJustification: draft.purpose, costCentre: draft.costCentre }); setPhase('review'); }} />}
          {route !== 'catalogue' && route !== 'contract' && <div className="space-y-2"><div className="flex items-center justify-between"><Button variant="ghost" onClick={() => setPhase('route')}><ArrowLeft className="size-4" />Back</Button><Button onClick={() => setPhase('review')} disabled={route === 'new-request' ? !descriptionComplete : !detailComplete}>Review request<ArrowRight className="size-4" /></Button></div>{route !== 'new-request' && !detailComplete && <p className="text-right text-xs text-muted-foreground">To review this request, add {missingDetailFields.join(', ')}.</p>}</div>}
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <IntakeGuidanceCard
            section="review"
            category={data.category}
            text={data.title}
            onApply={(suggestion) => update({ title: data.title.trim() ? `${data.title.trim()} ${suggestion}` : suggestion })}
          />
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle className="size-4 text-green-600" />Review your request</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div><p className="text-xs font-medium uppercase tracking-wider text-gray-500">What you need</p><p className="mt-1 font-medium text-gray-900">{data.title || 'Procurement request'}</p><p className="mt-1 whitespace-pre-wrap text-gray-600">{data.serviceDescription?.narrative || data.title || 'Details captured from your answers.'}</p></div><div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4"><p className="text-xs font-medium uppercase tracking-wider text-blue-700">Your request will follow</p><p className="mt-1 font-semibold text-gray-900">{routeLabel.label}</p><p className="mt-1 text-xs text-gray-600">{routeLabel.detail}</p></div><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-gray-500">Estimated value</p><p className="font-medium">{data.currency} {data.estimatedValue.toLocaleString()}</p></div><div><p className="text-xs text-gray-500">Needed by</p><p className="font-medium">{data.deliveryDate || 'To be confirmed'}</p></div></div></CardContent></Card>
          <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => setPhase('details')}><ArrowLeft className="size-4" />Back</Button><div className="flex gap-2"><Button variant="ghost" onClick={() => void saveDraft()} disabled={submitting}><Save className="size-4" />Save for later</Button><Button onClick={() => void submitRequest(data, route)} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Submit request</Button></div></div>
        </div>
      )}

      {phase === 'submitted' && <Card><CardContent className="space-y-4 p-8 text-center"><CheckCircle className="mx-auto size-10 text-green-600" /><h2 className="text-xl font-semibold text-gray-900">Request submitted</h2><p className="text-sm text-gray-600">{requestIdValue} is now following the <strong>{routeLabel.label.toLowerCase()}</strong> path. The assigned team will update you when they need something.</p><Button onClick={() => { setData(INITIAL_DATA); setRoute('new-request'); setRequestIdValue(''); setPhase('describe'); }}>Start another request</Button></CardContent></Card>}
    </div>
  );
}
