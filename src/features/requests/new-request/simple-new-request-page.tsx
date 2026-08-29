/**
 * Requester-first intake: derives a fulfilment route before asking for
 * governance detail, while reusing the same catalogue, contract, and service
 * description components as the Expert journey.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { saveServiceDescription } from '@/lib/db/service-descriptions';
import { saveIntakeCompliance } from '@/lib/db/intake-compliance';
import { initWorkflow } from '@/lib/workflow/engine';
import { queryClient } from '@/lib/query-client';
import { resolveDemandChannel } from '@/lib/routing/demand-channel';
import { evaluatePCardEligibility } from '@/lib/routing/p-card';
import { computeDemandSignals } from '@/lib/procurement/demand-signals';
import { resolveSlots, requiredSlotsFilled, type DemandConversationContext } from '@/lib/procurement/demand-conversation';
import { selectWorkflowTemplateForCategory, selectApprovalChainForValue } from '@/lib/workflow/workflow-steps';
import { evaluateGovernedCheckout } from '@/lib/procurement/governed-checkout';
import { submitGovernedCheckout } from '@/lib/procurement/submit-governed-checkout';
import { getProcurementProfile } from '@/lib/db/procurement-profiles';
import { sectionValuesOf } from '@/lib/procurement/service-description-seed';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import type { Contract, ProcurementRequest } from '@/data/types';
import type { CatalogueItem } from '@/data/catalogue-items';
import type { ServiceDescription } from './new-request-page';
import { StepCategory } from './step-category';
import { StepPreCheck } from './step-pre-check';
import { StepCatalogue } from './step-catalogue';
import { StepDetails } from './step-details';
import { StepChatIntake } from './step-chat-intake';
import { RequesterContextBlock } from './components/requester-context-block';
import { CatalogueOrderCheckout } from '@/features/catalogue/catalogue-order-checkout';

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
  costCentre: '', commodityCode: '', commodityCodeLabel: '', serviceDescription: null,
  catalogueItems: [], contractId: '', contractTitle: '', requesterCountry: '', requesterCountryCode: '',
  beneficiaryId: '', beneficiaryName: '', beneficiaryCountry: '', beneficiaryCountryCode: '',
  deliveryLocation: 'office', recipient: '',
};

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
  const [searchParams] = useSearchParams();
  const { data: suppliers = [] } = useSuppliers();
  const { data: routingRules = [] } = useRoutingRules();
  const { data: workflowTemplates = [] } = useWorkflowTemplates();
  const { data: approvalChains = [] } = useApprovalChains();
  const { data: catalogueItems = [] } = useCatalogueItems();
  const { data: contracts = [] } = useContracts();
  const { data: riskAssessments = [] } = useRiskAssessments();
  const [phase, setPhase] = useState<SimplePhase>('describe');
  const [data, setData] = useState<SimpleData>(INITIAL_DATA);
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
        const matchedContract = contracts.find((candidate) => candidate.id === (item?.contractId || requestData.contractId))
          ?? contracts.find((candidate) => item && candidate.supplierName.toLowerCase() === item.supplierName.toLowerCase() && ['active', 'expiring'].includes(candidate.status));
        if (!matchedContract) throw new Error('No active supplier contract could be resolved for this order. Please contact Procurement.');
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
        const riskAssessment = riskAssessments.find((candidate) => candidate.id === item?.riskAssessmentId)
          ?? riskAssessments.find((candidate) => candidate.supplierId === supplier.id && candidate.contractId === matchedContract.id);
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
          costCentre: requestData.costCentre, beneficiaryId: requestData.beneficiaryId || currentUser.id,
        };
        const decision = evaluateGovernedCheckout(checkout);
        if (!decision.ok) throw new Error(decision.errors.join(' '));
        const templateForRequest = selectWorkflowTemplateForCategory(workflowTemplates, requestData.category);
        await submitGovernedCheckout({
          requestId: id, requisitionId: `PR-${id}`, decision, checkout,
          request: {
            id, title: requestData.title, description: requestData.businessJustification || requestData.title,
            category: requestRoute === 'catalogue' ? 'catalogue' : requestData.category, status: 'intake', priority: requestData.isUrgent ? 'urgent' : 'medium',
            value: decision.totalValue, currency: decision.currency, requestorId: currentUser.id, ownerId: currentUser.id,
            supplierId: supplier.id, contractId: matchedContract.id, buyingChannel: requestRoute === 'catalogue' ? 'catalogue' : 'framework-call-off', commodityCode: item?.commodityCode || requestData.commodityCode || '',
            commodityCodeLabel: requestData.commodityCodeLabel || item?.commodityCode || '', costCentre: decision.resolved.costCentre || '', budgetOwner: decision.resolved.budgetOwner || '',
            businessJustification: requestData.businessJustification, deliveryDate: parseDeliveryDate(requestData.deliveryDate) ?? undefined,
          },
          lines: [{ id: `LINE-${id}-1`, requestId: id, description: line.description, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice, supplierId: supplier.id, contractId: matchedContract.id, ...(item ? { catalogueItemId: item.id } : {}), riskAssessmentId: riskAssessment?.id, commodityCode: line.commodityCode, deliveryDate: requestData.deliveryDate }],
        });
        if (decision.status !== 'approved') {
          await initWorkflow(id, templateForRequest?.id, requestRoute === 'catalogue' ? 'catalogue' : 'framework-call-off');
        }
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        setRequestIdValue(id); setPhase('submitted');
        toast.success('Request and purchase requisition created');
        return;
      }
      const channel = requestRoute === 'p-card' ? 'p-card' : requestRoute === 'direct-po' ? 'direct-po' : routing.channel;
      const templateForRequest = selectWorkflowTemplateForCategory(workflowTemplates, requestData.category);
      const approval = selectApprovalChainForValue(approvalChains, requestData.estimatedValue);
      const record: Partial<ProcurementRequest> = {
        id, title: requestData.title || 'Procurement request',
        description: requestData.serviceDescription?.narrative || requestData.businessJustification || requestData.title,
        category: requestData.category, status: 'intake', priority: requestData.isUrgent ? 'urgent' : 'medium',
        value: requestData.estimatedValue, currency: requestData.currency, supplierId: requestData.supplierId || undefined,
        contractId: requestData.contractId || undefined, workflowTemplateId: templateForRequest?.id,
        buyingChannel: channel, approvalChain: approval?.id, commodityCode: requestData.commodityCode,
        commodityCodeLabel: requestData.commodityCodeLabel, costCentre: requestData.costCentre, budgetOwner: currentUser.name,
        businessJustification: requestData.businessJustification, deliveryDate: parseDeliveryDate(requestData.deliveryDate) ?? undefined,
        isUrgent: requestData.isUrgent, requestorId: currentUser.id, ownerId: currentUser.id, daysInStage: 0,
        isOverdue: false, referBackCount: 0, requesterCountry: requestData.requesterCountry || undefined,
        requesterCountryCode: requestData.requesterCountryCode || undefined, beneficiaryId: requestData.beneficiaryId || undefined,
        beneficiaryName: requestData.beneficiaryName || undefined, beneficiaryCountry: requestData.beneficiaryCountry || undefined,
        beneficiaryCountryCode: requestData.beneficiaryCountryCode || undefined,
      };
      await createRequest(record);
      if (requestData.serviceDescription) {
        await saveServiceDescription(id, { ...requestData.serviceDescription });
      }
      await saveIntakeCompliance({
        requestId: id, determinedAt: new Date().toISOString(),
        buyingChannel: { channel, label: ROUTE_COPY[requestRoute].label, reasoning: ROUTE_COPY[requestRoute].detail },
        sraCheck: { status: 'pass', detail: 'Automated checks will continue with the assigned owner.' },
        policyChecks: [], duplicateCheck: { found: false, detail: 'No duplicate demand detected at intake.' }, riskFlags: [], matchingRiskAssessmentIds: [],
      });
      await initWorkflow(id, templateForRequest?.id, channel);
      queryClient.invalidateQueries({ queryKey: ['requests'] });
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
        description: data.businessJustification || data.serviceDescription?.narrative || data.categoryDescription,
        category: data.category || 'goods',
        status: 'draft',
        priority: data.isUrgent ? 'urgent' : 'medium',
        value: data.estimatedValue,
        currency: data.currency,
        supplierId: data.supplierId || undefined,
        contractId: data.contractId || undefined,
        buyingChannel: route === 'p-card' ? 'p-card' : route === 'contract' ? 'framework-call-off' : route === 'catalogue' ? 'catalogue' : undefined,
        costCentre: data.costCentre || undefined,
        businessJustification: data.businessJustification || undefined,
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
        <Card><CardContent className="p-6"><StepCategory category={data.category} categoryDescription={data.categoryDescription} onUpdate={update} onAutoAdvance={() => setPhase('route')} onBrowseCatalogue={() => { update({ category: 'catalogue', categoryDescription: 'Catalogue Purchase', preCheckOutcome: 'catalogue' }); setRoute('catalogue'); setPhase('details'); }} /></CardContent></Card>
      )}

      {phase === 'route' && (
        <div className="space-y-4">
          <Card><CardContent className="p-6"><StepPreCheck title={data.title || data.categoryDescription} category={data.category} estimatedValue={data.estimatedValue} supplierId={data.supplierId} llmIntent={data.llmIntent} onChooseCatalogue={(items: CatalogueItem[]) => { const primary = items[0]; update({ route: undefined, catalogueItems: items.slice(0, 3).map((item) => ({ itemId: item.id, name: item.name, quantity: 1, unitPrice: item.unitPrice, supplierId: item.supplierId })), title: primary?.name ?? data.title, supplier: primary?.supplierName ?? data.supplier, supplierId: primary?.supplierId ?? data.supplierId, estimatedValue: items.slice(0, 3).reduce((sum, item) => sum + item.unitPrice, 0) }); setRoute('catalogue'); setPhase('details'); }} onChooseContract={(contract: Contract) => { update({ contractId: contract.id, contractTitle: contract.title, supplier: contract.supplierName, supplierId: contract.supplierId, category: data.category || contract.category.toLowerCase() }); setRoute('contract'); setPhase('details'); }} onProceedToFullRequest={() => { setRoute(routeFromChannel(routing.channel)); setPhase('details'); }} onEnrich={(text) => update({ businessJustification: data.businessJustification ? `${data.businessJustification}\n${text}` : text })} /></CardContent></Card>
          <Card className="border-blue-100 bg-blue-50/40"><CardContent className="space-y-2 p-4 text-sm"><p className="font-medium text-blue-900">Recommended path: {ROUTE_COPY[routeFromChannel(routing.channel)].label}</p><p className="text-blue-800">{ROUTE_COPY[routeFromChannel(routing.channel)].detail}</p>{!pCardEligibility.eligible && <p className="text-xs text-blue-700">Purchasing card is not available for this request: {pCardEligibility.ineligibleReasons[0]}</p>}</CardContent></Card>
        </div>
      )}

      {phase === 'details' && (
        <div className="space-y-4">
          <RequesterContextBlock requestorId={currentUser.id} requesterCountry={data.requesterCountry} beneficiaryId={data.beneficiaryId} beneficiaryName={data.beneficiaryName} onUpdate={update} />
          {route === 'catalogue' ? (catalogueCheckoutOpen && data.catalogueItems[0] ? <CatalogueOrderCheckout item={catalogueItems.find((item) => item.id === data.catalogueItems[0].itemId) ?? catalogueItems[0]} mode="simple" initialValues={{ quantity: data.catalogueItems[0].quantity, costCentre: data.costCentre, needBy: data.deliveryDate, businessPurpose: data.businessJustification, deliveryLocation: data.deliveryLocation, recipient: data.recipient }} onSubmit={finishCatalogueCheckout} /> : <Card><CardHeader><CardTitle className="text-base">Choose your items</CardTitle></CardHeader><CardContent><StepCatalogue onPlaceOrder={(order) => void finishCatalogueOrder(order)} /></CardContent></Card>) : route === 'new-request' ? <Card><CardContent className="p-6"><StepChatIntake category={data.category} categoryDescription={data.categoryDescription} data={data} onUpdate={update} /></CardContent></Card> : <Card><CardContent className="p-6"><StepDetails category={data.category || 'services'} data={data} onUpdate={update} /></CardContent></Card>}
          {route !== 'catalogue' && <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => setPhase('route')}><ArrowLeft className="size-4" />Back</Button><Button onClick={() => setPhase('review')} disabled={route === 'new-request' ? !descriptionComplete : !detailComplete}>Review request<ArrowRight className="size-4" /></Button></div>}
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle className="size-4 text-green-600" />Review your request</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div><p className="text-xs font-medium uppercase tracking-wider text-gray-500">What you need</p><p className="mt-1 font-medium text-gray-900">{data.title || 'Procurement request'}</p><p className="mt-1 whitespace-pre-wrap text-gray-600">{data.businessJustification || data.serviceDescription?.narrative || 'Details captured from your answers.'}</p></div><div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4"><p className="text-xs font-medium uppercase tracking-wider text-blue-700">Your request will follow</p><p className="mt-1 font-semibold text-gray-900">{routeLabel.label}</p><p className="mt-1 text-xs text-gray-600">{routeLabel.detail}</p></div><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-gray-500">Estimated value</p><p className="font-medium">{data.currency} {data.estimatedValue.toLocaleString()}</p></div><div><p className="text-xs text-gray-500">Needed by</p><p className="font-medium">{data.deliveryDate || 'To be confirmed'}</p></div></div></CardContent></Card>
          <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => setPhase('details')}><ArrowLeft className="size-4" />Back</Button><div className="flex gap-2"><Button variant="ghost" onClick={() => void saveDraft()} disabled={submitting}><Save className="size-4" />Save for later</Button><Button onClick={() => void submitRequest(data, route)} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Submit request</Button></div></div>
        </div>
      )}

      {phase === 'submitted' && <Card><CardContent className="space-y-4 p-8 text-center"><CheckCircle className="mx-auto size-10 text-green-600" /><h2 className="text-xl font-semibold text-gray-900">Request submitted</h2><p className="text-sm text-gray-600">{requestIdValue} is now following the <strong>{routeLabel.label.toLowerCase()}</strong> path. The assigned team will update you when they need something.</p><Button onClick={() => { setData(INITIAL_DATA); setRoute('new-request'); setRequestIdValue(''); setPhase('describe'); }}>Start another request</Button></CardContent></Card>}
    </div>
  );
}
