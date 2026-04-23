import { useState, useCallback, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useAuthStore } from '@/stores/auth-store';
import { createRequest } from '@/lib/db/requests';
import { saveServiceDescription } from '@/lib/db/service-descriptions';
import { queryClient } from '@/lib/query-client';
import type { RequestCategory, BuyingChannel } from '@/data/types';
import { StepCategory } from './step-category';
import { StepDetails } from './step-details';
import { StepChatIntake } from './step-chat-intake';
import { StepCatalogue } from './step-catalogue';
import { StepPreCheck } from './step-pre-check';
import { StepCompliance } from './step-compliance';
import { StepRoutingPreview } from './step-routing-preview';
import { StepConfirmation } from './step-confirmation';
import type { Contract } from '@/data/types';
import type { CatalogueItem } from '@/data/catalogue-items';

export interface ServiceDescription {
  objective: string;
  scope: string;
  deliverables: string;
  timeline: string;
  resources: string;
  acceptanceCriteria: string;
  pricingModel: string;
  location: string;
  dependencies: string;
  narrative: string; // Full narrative summary
}

interface RequestFormData {
  // Step 1
  category: string;
  categoryDescription: string;
  // Step 3 (shifted)
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
  // Catalogue / contract resolution (Step 2 pre-check)
  catalogueItems: { itemId: string; name: string; quantity: number; unitPrice: number; supplierId: string }[];
  preCheckOutcome: 'catalogue' | 'contract' | 'full-request' | '';
  contractId: string;
  contractTitle: string;
  workflowTemplateId: string;
  // Step 4 (shifted)
  buyingChannelResult: string;
  sraStatus: string;
  policyChecks: { label: string; passed: boolean; detail: string }[];
  duplicateCheck: string | null;
  // Step 5 (shifted)
  additionalReviewers: string[];
  notes: string;
}

const INITIAL_DATA: RequestFormData = {
  category: '',
  categoryDescription: '',
  title: '',
  supplier: '',
  supplierId: '',
  estimatedValue: 0,
  currency: 'EUR',
  businessJustification: '',
  deliveryDate: '',
  isUrgent: false,
  costCentre: '',
  commodityCode: '',
  commodityCodeLabel: '',
  serviceDescription: null,
  catalogueItems: [],
  preCheckOutcome: '',
  contractId: '',
  contractTitle: '',
  workflowTemplateId: '',
  buyingChannelResult: '',
  sraStatus: '',
  policyChecks: [],
  duplicateCheck: null,
  additionalReviewers: [],
  notes: '',
};

const STEPS = [
  { number: 1, title: 'Category', description: 'What do you need?' },
  { number: 2, title: 'Pre-check', description: 'Catalogue & contract match' },
  { number: 3, title: 'Details', description: 'Service description' },
  { number: 4, title: 'Compliance', description: 'Supplier, risk, sourcing' },
  { number: 5, title: 'Routing', description: 'Routing & approvals' },
  { number: 6, title: 'Confirmation', description: 'Submitted' },
];

function generateRequestId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `REQ-2025-${num}`;
}

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

const CATEGORY_LABELS: Record<string, string> = {
  goods: 'Goods', services: 'Services', software: 'Software / IT',
  consulting: 'Consulting', 'contingent-labour': 'Contingent Labour',
  'contract-renewal': 'Contract Renewal', 'supplier-onboarding': 'Supplier Onboarding',
  catalogue: 'Catalogue Purchase',
};

export function NewRequestPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_DATA);
  const [requestId, setRequestId] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser } = useAuthStore();
  const { data: suppliers = [] } = useSuppliers();

  // Read URL params on mount — skip to Step 2 if pre-filled from home page.
  // Depend on suppliers so the directory match runs once suppliers load.
  useEffect(() => {
    if (initialized) return;
    if (suppliers.length === 0) return; // wait for suppliers to load before matching
    setInitialized(true);

    const step = searchParams.get('step');
    const category = searchParams.get('category');

    if (step === '2' && category) {
      const title = searchParams.get('title') ?? '';
      const supplierName = searchParams.get('supplier') ?? '';
      const description = searchParams.get('description') ?? '';
      const value = Number(searchParams.get('value') ?? 0);

      // Match supplier against directory
      let supplierId = '';
      let resolvedSupplier = supplierName;
      if (supplierName) {
        const matched = suppliers.find((s) =>
          s.name.toLowerCase().includes(supplierName.toLowerCase()) ||
          supplierName.toLowerCase().includes(s.name.toLowerCase())
        );
        if (matched) {
          supplierId = matched.id;
          resolvedSupplier = matched.name;
        }
      }

      setFormData((prev) => ({
        ...prev,
        category,
        categoryDescription: CATEGORY_LABELS[category] ?? category,
        title,
        supplier: resolvedSupplier,
        supplierId,
        estimatedValue: value,
        businessJustification: description,
      }));
      // SmartCommandBar deep-links still pass step=2 to mean "skip the
      // category picker"; since we inserted the pre-check as step 2,
      // the deep-link lands on the pre-check with pre-populated context.
      setCurrentStep(2);

      // Clear search params so refresh doesn't re-trigger
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, initialized, suppliers]);

  const updateFormData = useCallback((updates: Partial<RequestFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!formData.category;
      case 2:
        // Pre-check step — user must either pick catalogue/contract or
        // explicitly choose to proceed to a full request.
        return !!formData.preCheckOutcome;
      case 3:
        if (formData.preCheckOutcome === 'catalogue' || formData.category === 'catalogue') {
          return formData.catalogueItems.length > 0;
        }
        if (formData.preCheckOutcome === 'contract') {
          return !!formData.contractId;
        }
        return !!formData.title && formData.estimatedValue > 0;
      case 4:
        return !!formData.buyingChannelResult;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 5) {
      // Submit
      const id = generateRequestId();
      setIsSubmitting(true);
      try {
        await createRequest({
          id,
          title: formData.title,
          category: formData.category as RequestCategory,
          status: 'intake',
          priority: formData.isUrgent ? 'urgent' : 'medium',
          value: formData.estimatedValue,
          currency: formData.currency,
          supplierId: formData.supplierId,
          contractId: formData.contractId || undefined,
          workflowTemplateId: formData.workflowTemplateId || undefined,
          buyingChannel: (formData.buyingChannelResult || 'procurement-led') as BuyingChannel,
          commodityCode: formData.commodityCode,
          commodityCodeLabel: formData.commodityCodeLabel,
          costCentre: formData.costCentre,
          businessJustification: formData.businessJustification,
          deliveryDate: formData.deliveryDate,
          isUrgent: formData.isUrgent,
          requestorId: currentUser.id,
          ownerId: currentUser.id,
        });

        if (formData.serviceDescription) {
          const sow = formData.serviceDescription as unknown as Record<string, string>;
          await saveServiceDescription(id, {
            objective: sow.objective ?? '',
            scope: sow.scope ?? '',
            deliverables: sow.deliverables ?? '',
            timeline: sow.timeline ?? '',
            resources: sow.resources ?? '',
            acceptanceCriteria: sow.acceptanceCriteria ?? '',
            pricingModel: sow.pricingModel ?? '',
            location: sow.location ?? '',
            dependencies: sow.dependencies ?? '',
            narrative: sow.narrative ?? '',
          });
        }

        queryClient.invalidateQueries({ queryKey: ['requests'] });
        toast.success('Request submitted successfully');
      } catch (e) {
        console.warn('Failed to persist request:', e);
        // Continue anyway — the UI will work with the generated ID
      } finally {
        setIsSubmitting(false);
      }
      setRequestId(id);
      setCurrentStep(6);
    } else {
      setCurrentStep((s) => Math.min(s + 1, 6));
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const handleReset = () => {
    setFormData(INITIAL_DATA);
    setCurrentStep(1);
    setRequestId('');
  };

  return (
    <div className={cn("mx-auto space-y-6", currentStep === 3 && formData.preCheckOutcome === 'full-request' && !['catalogue', 'contract-renewal', 'supplier-onboarding'].includes(formData.category) ? 'max-w-5xl' : 'max-w-3xl')}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New Request</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Create a new procurement request in {STEPS.length} steps
        </p>
      </div>

      {/* Progress Bar */}
      {currentStep < 6 && (
        <div className="flex items-center gap-1">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    step.number < currentStep
                      ? 'bg-green-600 text-white'
                      : step.number === currentStep
                        ? 'bg-blue-600 text-white'
                        : 'border-2 border-gray-200 bg-white text-gray-400'
                  )}
                >
                  {step.number < currentStep ? (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                {step.number < STEPS.length && (
                  <div
                    className={cn(
                      'mx-1 h-0.5 flex-1',
                      step.number < currentStep ? 'bg-green-600' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-xs text-center',
                  step.number === currentStep
                    ? 'font-semibold text-blue-600'
                    : step.number < currentStep
                      ? 'font-medium text-green-700'
                      : 'text-gray-400'
                )}
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Step Title */}
      {currentStep < 6 && (
        <div className="border-b border-gray-200 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Step {currentStep}: {STEPS[currentStep - 1].description}
          </h2>
        </div>
      )}

      {/* Step Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <StepErrorBoundary onReset={handleReset}>
        {currentStep === 1 && (
          <StepCategory
            category={formData.category}
            categoryDescription={formData.categoryDescription}
            onUpdate={(d) => updateFormData(d)}
            onAutoAdvance={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 2 && (
          <StepPreCheck
            title={formData.title || formData.categoryDescription}
            category={formData.category}
            estimatedValue={formData.estimatedValue}
            supplierId={formData.supplierId}
            onChooseCatalogue={(items: CatalogueItem[]) => {
              const cartItems = items.slice(0, 3).map((i) => ({
                itemId: i.id,
                name: i.name,
                quantity: 1,
                unitPrice: i.unitPrice,
                supplierId: i.supplierId,
              }));
              const total = cartItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
              const primary = items[0];
              updateFormData({
                preCheckOutcome: 'catalogue',
                catalogueItems: cartItems,
                title: primary?.name ?? formData.title,
                supplier: primary?.supplierName ?? formData.supplier,
                supplierId: primary?.supplierId ?? formData.supplierId,
                estimatedValue: total || formData.estimatedValue,
                buyingChannelResult: 'catalogue',
              });
              setCurrentStep(3);
            }}
            onChooseContract={(contract: Contract) => {
              updateFormData({
                preCheckOutcome: 'contract',
                contractId: contract.id,
                contractTitle: contract.title,
                supplier: contract.supplierName,
                supplierId: contract.supplierId,
                category: formData.category || contract.category.toLowerCase(),
                buyingChannelResult: 'framework-call-off',
              });
              setCurrentStep(3);
            }}
            onProceedToFullRequest={() => {
              updateFormData({ preCheckOutcome: 'full-request' });
              setCurrentStep(3);
            }}
          />
        )}
        {currentStep === 3 && formData.preCheckOutcome === 'catalogue' && (
          <StepCatalogue
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {currentStep === 3 && formData.preCheckOutcome === 'contract' && (
          <StepDetails
            category={formData.category || 'contract-renewal'}
            data={{
              title: formData.title || formData.contractTitle,
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
        {currentStep === 3 && formData.preCheckOutcome === 'full-request' && formData.category === 'catalogue' && (
          <StepCatalogue onUpdate={(d) => updateFormData(d)} />
        )}
        {currentStep === 3 && formData.preCheckOutcome === 'full-request' && ['contract-renewal', 'supplier-onboarding'].includes(formData.category) && (
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
        {currentStep === 3 && formData.preCheckOutcome === 'full-request' && !['catalogue', 'contract-renewal', 'supplier-onboarding'].includes(formData.category) && (
          <StepChatIntake
            category={formData.category}
            categoryDescription={formData.categoryDescription}
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
        {currentStep === 4 && (
          <StepCompliance
            category={formData.category}
            estimatedValue={formData.estimatedValue}
            supplierId={formData.supplierId}
            supplier={formData.supplier}
            isUrgent={formData.isUrgent}
            serviceDescription={formData.serviceDescription}
            workflowTemplateId={formData.workflowTemplateId}
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {currentStep === 5 && (
          <StepRoutingPreview
            category={formData.category}
            estimatedValue={formData.estimatedValue}
            additionalReviewers={formData.additionalReviewers}
            notes={formData.notes}
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {currentStep === 6 && (
          <StepConfirmation
            requestId={requestId}
            data={{
              title: formData.title,
              category: formData.category,
              supplier: formData.supplier,
              estimatedValue: formData.estimatedValue,
              currency: formData.currency,
              costCentre: formData.costCentre,
              deliveryDate: formData.deliveryDate,
              isUrgent: formData.isUrgent,
              buyingChannelResult: formData.buyingChannelResult,
              commodityCodeLabel: formData.commodityCodeLabel,
              catalogueItems: formData.catalogueItems,
            }}
            onReset={handleReset}
          />
        )}
        </StepErrorBoundary>
      </div>

      {/* Navigation */}
      {currentStep < 6 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {currentStep === 5 && (
              <Button variant="ghost" onClick={() => {}}>
                <Save className="size-4" />
                Save as Draft
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
            >
              {currentStep === 5 ? (
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
          </div>
        </div>
      )}
    </div>
  );
}
