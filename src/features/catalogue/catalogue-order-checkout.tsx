/**
 * Shared, requester-sized catalogue checkout. It captures fulfilment context
 * that cannot be inferred from the item while leaving governance fields to the
 * request/PR service. The same component can be used by catalogue and call-off
 * detail pages without creating upstream purchasing side effects.
 */
import { useState } from 'react';
import { ChevronDown, MapPin, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ExperienceMode } from '@/lib/experience-mode';
import type { CatalogueItem } from '@/data/catalogue-items';
import { useAuthStore } from '@/stores/auth-store';
import { useProcurementProfile } from '@/lib/db/hooks/use-procurement-profile';

export interface CatalogueOrderDraft {
  itemId: string;
  quantity: number;
  needBy: string;
  deliveryLocation: string;
  recipient: string;
  businessPurpose: string;
  costCentre: string;
}

interface CatalogueOrderCheckoutProps {
  item: CatalogueItem;
  mode?: ExperienceMode;
  disabled?: boolean;
  initialValues?: Partial<CatalogueOrderDraft>;
  submitLabel?: string;
  onSubmit: (draft: CatalogueOrderDraft) => void;
}

const DELIVERY_LOCATIONS = [
  { value: 'office', label: 'My default office location' },
  { value: 'home', label: 'My approved home delivery address' },
  { value: 'beneficiary', label: 'The beneficiary’s approved location' },
];

const COST_CENTRES = [
  { value: 'CC-1001', label: 'CC-1001 Marketing' },
  { value: 'CC-2001', label: 'CC-2001 IT' },
  { value: 'CC-3001', label: 'CC-3001 Operations' },
  { value: 'CC-4001', label: 'CC-4001 Finance' },
  { value: 'CC-5001', label: 'CC-5001 HR' },
];

function dateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CatalogueOrderCheckout({
  item,
  mode = 'simple',
  disabled = false,
  initialValues,
  submitLabel = 'Review order',
  onSubmit,
}: CatalogueOrderCheckoutProps) {
  const { currentUser } = useAuthStore();
  const { data: profile } = useProcurementProfile(currentUser.id);
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? 1);
  const [needBy, setNeedBy] = useState(initialValues?.needBy ?? dateInDays(7));
  const [deliveryLocation, setDeliveryLocation] = useState(initialValues?.deliveryLocation ?? '');
  const [recipient, setRecipient] = useState(initialValues?.recipient ?? '');
  const [businessPurpose, setBusinessPurpose] = useState(initialValues?.businessPurpose ?? '');
  const [costCentre, setCostCentre] = useState(initialValues?.costCentre ?? '');
  const [showExpertDetails, setShowExpertDetails] = useState(false);

  const deliveryLocations = profile?.approvedShipToLocations.length
    ? profile.approvedShipToLocations.map((location) => ({ value: location.id, label: location.label }))
    : DELIVERY_LOCATIONS;
  const costCentres = profile?.costCentre
    ? [{ value: profile.costCentre, label: profile.costCentre }, ...COST_CENTRES.filter((centre) => centre.value !== profile.costCentre)]
    : COST_CENTRES;
  const effectiveDeliveryLocation = deliveryLocation || profile?.defaultShipToLocationId || deliveryLocations[0]?.value || 'office';
  const effectiveCostCentre = costCentre || profile?.costCentre || '';

  const total = quantity * item.unitPrice;
  const canSubmit = !disabled && quantity > 0 && Boolean(needBy && effectiveDeliveryLocation && recipient.trim() && businessPurpose.trim() && effectiveCostCentre);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ itemId: item.id, quantity, needBy, deliveryLocation: effectiveDeliveryLocation, recipient: recipient.trim(), businessPurpose: businessPurpose.trim(), costCentre: effectiveCostCentre });
  };

  return (
    <Card className="border-blue-100 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="size-4 text-blue-600" />
          Details for this order
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          We’ve filled in the product, supplier and price. Tell us where and when it is needed.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="catalogue-quantity">Quantity</Label>
            <Input id="catalogue-quantity" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catalogue-need-by">Need by</Label>
            <Input id="catalogue-need-by" type="date" value={needBy} onChange={(event) => setNeedBy(event.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="catalogue-delivery-location">Deliver to</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <select id="catalogue-delivery-location" value={effectiveDeliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)} className="h-10 w-full appearance-none rounded-md border border-input bg-background px-9 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {deliveryLocations.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          </div>
          <p className="text-xs text-muted-foreground">Only approved delivery locations are available.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="catalogue-recipient">Who is this for?</Label>
          <Input id="catalogue-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Name of the person or team receiving it" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="catalogue-purpose">What is it needed for?</Label>
          <Textarea id="catalogue-purpose" rows={3} value={businessPurpose} onChange={(event) => setBusinessPurpose(event.target.value)} placeholder="A short business reason helps us route the request correctly" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="catalogue-cost-centre">Cost centre</Label>
            <select id="catalogue-cost-centre" value={effectiveCostCentre} onChange={(event) => setCostCentre(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Select cost centre…</option>
            {costCentres.map((centre) => <option key={centre.value} value={centre.value}>{centre.label}</option>)}
          </select>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-950">Order summary</p>
              <p className="mt-1 text-xs text-blue-800">{quantity} × {item.name} · {item.supplierName}</p>
            </div>
            <p className="text-sm font-semibold text-blue-950">€{total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
          </div>
          <p className="mt-2 text-xs text-blue-800">This item is listed in an approved catalogue. Contract and supplier-risk checks will be recorded with your request.</p>
        </div>

        {mode === 'expert' && (
          <div className="rounded-lg border border-gray-200">
            <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-800" aria-expanded={showExpertDetails} onClick={() => setShowExpertDetails((open) => !open)}>
              <span>Governance and routing details</span>
              <ChevronDown className={`size-4 transition-transform ${showExpertDetails ? 'rotate-180' : ''}`} />
            </button>
            {showExpertDetails && (
              <div className="space-y-2 border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
                <p><span className="font-medium text-gray-800">Supplier:</span> {item.supplierName} ({item.supplierId})</p>
                <p><span className="font-medium text-gray-800">Catalogue:</span> {item.catalogueName}</p>
                <p><span className="font-medium text-gray-800">Route:</span> Catalogue order against the supplier’s active agreement, subject to policy and capacity checks.</p>
                <p><span className="font-medium text-gray-800">Expected lead time:</span> {item.leadTime}</p>
              </div>
            )}
          </div>
        )}

        <Button type="button" className="w-full" disabled={!canSubmit} onClick={submit}>{disabled ? 'Unavailable for ordering' : submitLabel}</Button>
        {!canSubmit && <p className="text-center text-xs text-muted-foreground">Complete the highlighted order details to continue.</p>}
      </CardContent>
    </Card>
  );
}
