// Supplier-owned onboarding form. It keeps the portal actionable while the
// internal vendor-manager decisions remain on the request workflow stage.
import { useEffect, useState } from 'react';
import { Check, Circle, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSupplier, useUpdateSupplier } from '@/lib/db/hooks/use-suppliers';
import { PORTAL_SUPPLIER_ID } from './portal-identity';
import { toast } from 'sonner';

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
  const { data: supplier } = useSupplier(PORTAL_SUPPLIER_ID);
  const updateSupplier = useUpdateSupplier();
  const [companyName, setCompanyName] = useState('');
  const [duns, setDuns] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (supplier && !hydrated) {
      // Supplier data arrives asynchronously; seed the editable draft exactly
      // once when it becomes available, then leave subsequent typing alone.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDuns(supplier.duns);
      setCompanyName(supplier.name);
      setContact(supplier.primaryContact);
      setEmail(supplier.primaryContactEmail);
      setHydrated(true);
    }
  }, [hydrated, supplier]);
  const save = async () => {
    if (!companyName.trim() || !duns.trim() || !contact.trim() || !email.trim() || !confirmed) {
      toast.error('Complete the company, contact and compliance confirmation fields before saving.');
      return;
    }
    try {
      await updateSupplier.mutateAsync({ id: PORTAL_SUPPLIER_ID, patch: { name: companyName.trim(), duns: duns.trim(), primaryContact: contact.trim(), primaryContactEmail: email.trim(), onboardingStatus: 'in-progress' } });
      toast.success('Onboarding information saved for review.');
    } catch {
      toast.error('Could not save onboarding information. Please try again.');
    }
  };
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Onboarding</h1>
      <p className="text-sm text-muted-foreground">
        Complete each step to become a fully qualified supplier.
      </p>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Provide your company details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="onboarding-company">Legal company name</Label><Input id="onboarding-company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Registered company name" /></div>
          <div className="space-y-1.5"><Label htmlFor="onboarding-duns">Registration or DUNS number</Label><Input id="onboarding-duns" value={duns} onChange={(event) => setDuns(event.target.value)} placeholder="Company registration number" /></div>
          <div className="space-y-1.5"><Label htmlFor="onboarding-contact">Primary contact</Label><Input id="onboarding-contact" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Contact name" /></div>
          <div className="space-y-1.5"><Label htmlFor="onboarding-email">Contact email</Label><Input id="onboarding-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.example" /></div>
          <label className="flex items-start gap-2 text-sm sm:pt-6"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" /> <span>I confirm these details and the compliance documents are accurate.</span></label>
          <Button type="button" className="sm:col-span-2 sm:w-fit" onClick={() => void save()} disabled={updateSupplier.isPending}><Save className="size-4" /> Save for review</Button>
        </CardContent>
      </Card>

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
