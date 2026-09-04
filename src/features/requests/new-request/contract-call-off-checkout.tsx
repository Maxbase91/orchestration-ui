// Shared contract call-off checkout for Simple and Expert request journeys.
// It captures only requester-owned fields before the governed server submission.
import { useState } from 'react';
import { CalendarDays, ChevronDown, FileCheck2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ExperienceMode } from '@/lib/experience-mode';
import type { Contract, ProcurementProfile } from '@/data/types';
import { useAuthStore } from '@/stores/auth-store';
import { useProcurementProfile } from '@/lib/db/hooks/use-procurement-profile';
import { cn } from '@/lib/utils';

export interface ContractCallOffDraft {
  title: string;
  value: number;
  needBy: string;
  serviceStartDate: string;
  serviceEndDate: string;
  deliveryLocation: string;
  recipient: string;
  purpose: string;
  costCentre: string;
}

interface ContractCallOffCheckoutProps {
  contract?: Contract;
  mode?: ExperienceMode;
  initialValues?: Partial<ContractCallOffDraft>;
  onSubmit: (draft: ContractCallOffDraft) => void;
}

function dateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultProfile(): ProcurementProfile {
  return {
    userId: '',
    defaultCurrency: 'EUR',
    approvedShipToLocations: [{ id: 'office', label: 'Default location' }],
    defaultShipToLocationId: 'office',
  };
}

export function ContractCallOffCheckout({ contract, mode = 'simple', initialValues, onSubmit }: ContractCallOffCheckoutProps) {
  const { currentUser } = useAuthStore();
  const { data: loadedProfile } = useProcurementProfile(currentUser.id);
  const profile = loadedProfile ?? defaultProfile();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [value, setValue] = useState(initialValues?.value ?? 0);
  const [needBy, setNeedBy] = useState(initialValues?.needBy ?? dateInDays(14));
  const [serviceStartDate, setServiceStartDate] = useState(initialValues?.serviceStartDate ?? '');
  const [serviceEndDate, setServiceEndDate] = useState(initialValues?.serviceEndDate ?? '');
  const [recipient, setRecipient] = useState(initialValues?.recipient ?? '');
  const [purpose, setPurpose] = useState(initialValues?.purpose ?? '');
  // These two hold only what the requester explicitly chose; the effective
  // value falls back to the profile on every render. Seeding them through a
  // `useState` initialiser meant a profile that resolved *after* first render
  // never reached the fields, so whether the defaults applied depended on
  // whether the query happened to be cached. Deriving removes the race, and
  // `||` rather than `??` because these fields arrive as '' rather than
  // undefined — `'' ?? profile.costCentre` is the empty string, so the profile
  // fallback never fired and the screen asked for what it already knew.
  const [chosenLocation, setDeliveryLocation] = useState(initialValues?.deliveryLocation || '');
  const [chosenCostCentre, setCostCentre] = useState(initialValues?.costCentre || '');
  const deliveryLocation = chosenLocation || profile.defaultShipToLocationId || '';
  const costCentre = chosenCostCentre || profile.costCentre || '';
  const locations = profile.approvedShipToLocations;

  const needsServiceDates = (contract?.category ?? '').toLowerCase().includes('service') || (contract?.category ?? '').toLowerCase().includes('consult');
  const validDates = !serviceStartDate || !serviceEndDate || serviceEndDate >= serviceStartDate;
  // The gate has to be able to say what it wants. It used to be one opaque
  // boolean under the words "complete the highlighted details", with nothing
  // highlighted — so a call-off blocked by a field the screen was not showing
  // (a cost centre inherited as empty, or a delivery location whose stored id
  // is not in the approved list) looked complete and simply would not submit.
  const missing = [
    !title.trim() && 'a description',
    !(value > 0) && 'a call-off value',
    !needBy && 'a need-by date',
    !deliveryLocation && 'a delivery location',
    !recipient.trim() && 'who it is for',
    !purpose.trim() && 'a business purpose',
    // The call-off creates a requisition, so it needs an account to charge, and
    // this agrees with `evaluateGovernedCheckout`.
    !costCentre && 'a cost centre',
  ].filter((entry): entry is string => typeof entry === 'string');
  const canSubmit = missing.length === 0 && validDates;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ title: title.trim(), value, needBy, serviceStartDate, serviceEndDate, deliveryLocation, recipient: recipient.trim(), purpose: purpose.trim(), costCentre });
  };

  if (!contract) {
    return <Card><CardContent className="p-6 text-sm text-red-700">No active contract is available for this call-off. Return to the route step and choose another path.</CardContent></Card>;
  }

  return (
    <Card className="border-blue-100 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="size-4 text-blue-600" />Details for this contract call-off</CardTitle>
        <p className="text-sm text-muted-foreground">We’ve selected {contract.title}. Add only the details needed for this call-off.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm">
          <p className="font-medium text-blue-950">Covered by the approved contract</p>
          <p className="mt-1 text-blue-800">{contract.title} · {contract.supplierName}</p>
          {contract.scopeNarrative && <p className="mt-2 text-xs text-blue-800">{contract.scopeNarrative}</p>}
        </div>
        <div className="space-y-1.5"><Label htmlFor="calloff-title">What is being ordered?</Label><Input id="calloff-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short description of this call-off" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="calloff-value">Call-off value (EUR)</Label><Input id="calloff-value" type="number" min={0.01} step="0.01" value={value || ''} onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))} /></div>
          {/* The browser date control emits its committed value through
              input in the deployed WebKit runner; keeping this handler on
              input prevents a valid date from being visually present while
              the controlled state still blocks Review. */}
          <div className="space-y-1.5"><Label htmlFor="calloff-need-by">Need by</Label><Input id="calloff-need-by" type="date" value={needBy} onInput={(e) => setNeedBy(e.currentTarget.value)} /></div>
        </div>
        {needsServiceDates && <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="calloff-start">Service start</Label><Input id="calloff-start" type="date" value={serviceStartDate} onInput={(e) => setServiceStartDate(e.currentTarget.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="calloff-end">Service end</Label><Input id="calloff-end" type="date" value={serviceEndDate} onInput={(e) => setServiceEndDate(e.currentTarget.value)} /></div>
        </div>}
        {!validDates && <p className="text-xs text-red-600">Service end must be on or after service start.</p>}
        <div className="space-y-1.5"><Label htmlFor="calloff-location">Deliver to</Label><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" /><select id="calloff-location" value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} aria-invalid={!deliveryLocation} className={cn('h-10 w-full appearance-none rounded-md border bg-background px-9 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', deliveryLocation ? 'border-input' : 'border-red-300')}>
          {/* Without an option matching the current value, the browser displays
              the FIRST option's label while the value stays empty — the screen
              names a location that was never selected and the gate blocks with
              no visible reason. An explicit placeholder makes the empty state
              look empty. */}
          {!locations.some((location) => location.id === deliveryLocation) && <option value="">Select a delivery location…</option>}
          {locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
        </select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" /></div><p className="text-xs text-muted-foreground">{locations.length === 0 ? 'No delivery locations are available on your profile — ask an administrator to add one.' : 'Only approved delivery locations are available.'}</p></div>
        {/* Gated on the PROFILE, not on the current value: keyed on `!costCentre`
            the field unmounted on the first character typed into it. */}
        {!profile.costCentre && (
          <div className="space-y-1.5">
            <Label htmlFor="calloff-cost-centre">Cost centre</Label>
            <Input id="calloff-cost-centre" value={costCentre} onChange={(e) => setCostCentre(e.target.value)} aria-invalid={!costCentre} className={cn(!costCentre && 'border-red-300')} placeholder="The account this is charged to" />
            <p className="text-[11px] text-gray-500">Your profile has no default cost centre, so this call-off needs one.</p>
          </div>
        )}
        <div className="space-y-1.5"><Label htmlFor="calloff-recipient">Who is this for?</Label><Input id="calloff-recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Person or team receiving the service" /></div>
        <div className="space-y-1.5"><Label htmlFor="calloff-purpose">Business purpose</Label><Textarea id="calloff-purpose" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What outcome is this call-off needed for?" /></div>

        {mode === 'expert' && <details className="rounded-lg border border-gray-200"><summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium"><CalendarDays className="size-4 text-gray-500" />Contract and governance details</summary><div className="space-y-1 border-t px-4 py-3 text-xs text-gray-600"><p>Supplier: {contract.supplierName} ({contract.supplierId})</p><p>Contract period: {contract.startDate} to {contract.endDate}</p><p>Coverage status: {contract.coverageStatus ?? 'not provided'}</p><p>Governance is rechecked by the server when you submit.</p></div></details>}
        <Button type="button" className="w-full" disabled={!canSubmit} onClick={submit}>Review request</Button>
        {!canSubmit && (
          <p className="text-center text-xs text-muted-foreground">
            {missing.length > 0
              ? `Still needed: ${missing.join(', ')}.`
              : 'Service end must be on or after service start.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
