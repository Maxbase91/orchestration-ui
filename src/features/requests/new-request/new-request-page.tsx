import { useState, useCallback, Component, type ReactNode, type ErrorInfo } from 'react';
import { ArrowLeft, ArrowRight, Save, Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StepCategory } from './step-category';
import { StepDetails } from './step-details';
import { StepChatIntake } from './step-chat-intake';
import { StepCatalogue } from './step-catalogue';
import { StepCompliance } from './step-compliance';
import { StepRoutingPreview } from './step-routing-preview';
import { StepConfirmation } from './step-confirmation';

interface RequestFormData {
  // Step 1
  category: string;
  categoryDescription: string;
  // Step 2
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
  // Catalogue items
  catalogueItems: { itemId: string; name: string; quantity: number; unitPrice: number; supplierId: string }[];
  // Step 3
  buyingChannelResult: string;
  sraStatus: string;
  policyChecks: { label: string; passed: boolean; detail: string }[];
  duplicateCheck: string | null;
  // Step 4
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
  catalogueItems: [],
  buyingChannelResult: '',
  sraStatus: '',
  policyChecks: [],
  duplicateCheck: null,
  additionalReviewers: [],
  notes: '',
};

const STEPS = [
  { number: 1, title: 'Category', description: 'What do you need?' },
  { number: 2, title: 'Details', description: 'Request details' },
  { number: 3, title: 'Compliance', description: 'Compliance & risk check' },
  { number: 4, title: 'Routing', description: 'Routing & approvals' },
  { number: 5, title: 'Confirmation', description: 'Submitted' },
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

export function NewRequestPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_DATA);
  const [requestId, setRequestId] = useState('');

  const updateFormData = useCallback((updates: Partial<RequestFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!formData.category;
      case 2:
        if (formData.category === 'catalogue') {
          return formData.catalogueItems.length > 0;
        }
        return !!formData.title && formData.estimatedValue > 0;
      case 3:
        return !!formData.buyingChannelResult;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep === 4) {
      // Submit
      const id = generateRequestId();
      setRequestId(id);
      setCurrentStep(5);
    } else {
      setCurrentStep((s) => Math.min(s + 1, 5));
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
    <div className={cn("mx-auto space-y-6", currentStep === 2 && !['catalogue', 'contract-renewal', 'supplier-onboarding'].includes(formData.category) ? 'max-w-5xl' : 'max-w-3xl')}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New Request</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Create a new procurement request in {STEPS.length} steps
        </p>
      </div>

      {/* Progress Bar */}
      {currentStep < 5 && (
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
      {currentStep < 5 && (
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
          />
        )}
        {currentStep === 2 && formData.category === 'catalogue' && (
          <StepCatalogue
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {currentStep === 2 && ['contract-renewal', 'supplier-onboarding'].includes(formData.category) && (
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
        {currentStep === 2 && !['catalogue', 'contract-renewal', 'supplier-onboarding'].includes(formData.category) && (
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
        {currentStep === 3 && (
          <StepCompliance
            category={formData.category}
            estimatedValue={formData.estimatedValue}
            supplierId={formData.supplierId}
            supplier={formData.supplier}
            isUrgent={formData.isUrgent}
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {currentStep === 4 && (
          <StepRoutingPreview
            category={formData.category}
            estimatedValue={formData.estimatedValue}
            additionalReviewers={formData.additionalReviewers}
            notes={formData.notes}
            onUpdate={(d) => updateFormData(d)}
          />
        )}
        {currentStep === 5 && (
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
      {currentStep < 5 && (
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
            {currentStep === 4 && (
              <Button variant="ghost" onClick={() => {}}>
                <Save className="size-4" />
                Save as Draft
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
            >
              {currentStep === 4 ? (
                <>
                  <Send className="size-4" />
                  Submit Request
                </>
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
