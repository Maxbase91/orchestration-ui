import { Check, Circle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  label: string;
  status: 'complete' | 'in-progress' | 'pending';
  description: string;
}

const steps: OnboardingStep[] = [
  {
    id: 'company-info',
    label: 'Company Information',
    status: 'complete',
    description: 'Basic company details, legal entity, and registration information have been submitted and verified.',
  },
  {
    id: 'compliance',
    label: 'Compliance Documents',
    status: 'complete',
    description: 'Insurance certificates, anti-bribery declarations, and code of conduct acknowledgements uploaded.',
  },
  {
    id: 'bank',
    label: 'Bank Verification',
    status: 'complete',
    description: 'Banking details submitted and verified via micro-deposit confirmation.',
  },
  {
    id: 'screening',
    label: 'Screening',
    status: 'in-progress',
    description: 'Sanctions screening, adverse media check, and PEP screening are currently in progress.',
  },
  {
    id: 'qualification',
    label: 'Qualification',
    status: 'pending',
    description: 'Category qualification and capability assessment will be scheduled after screening completes.',
  },
  {
    id: 'review',
    label: 'Review & Approval',
    status: 'pending',
    description: 'Final review by the supplier management team to approve onboarding.',
  },
];

function StepIcon({ status }: { status: OnboardingStep['status'] }) {
  if (status === 'complete') {
    return (
      <div className="flex size-8 items-center justify-center rounded-full bg-green-100">
        <Check className="size-4 text-green-700" />
      </div>
    );
  }
  if (status === 'in-progress') {
    return (
      <div className="flex size-8 items-center justify-center rounded-full bg-blue-100">
        <Loader2 className="size-4 text-blue-700 animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex size-8 items-center justify-center rounded-full bg-gray-100">
      <Circle className="size-4 text-gray-400" />
    </div>
  );
}

export function PortalOnboarding() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Onboarding</h1>
      <p className="text-sm text-muted-foreground">
        Complete each step to become a fully qualified supplier.
      </p>

      <div className="space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <div key={step.id} className="relative flex gap-4 pb-2">
              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute left-[15px] top-9 h-[calc(100%-12px)] w-px',
                    step.status === 'complete' ? 'bg-green-300' : 'bg-border'
                  )}
                />
              )}
              <div className="shrink-0 pt-1">
                <StepIcon status={step.status} />
              </div>
              <Card className={cn(
                'flex-1 py-3 mb-3',
                step.status === 'in-progress' && 'border-blue-200 bg-blue-50/30',
              )}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {step.label}
                    {step.status === 'in-progress' && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-normal">
                        In Progress
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
