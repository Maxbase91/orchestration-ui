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
import type { CatalogueItem } from '@/data/catalogue-items';
import { useAuthStore } from '@/stores/auth-store';
import { useProcurementProfile } from '@/lib/db/hooks/use-procurement-profile';
import { useCostCentres } from '@/lib/db/hooks/use-cost-centres';
import { useDeliveryLocations } from '@/lib/db/hooks/use-delivery-locations';

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
  disabled?: boolean;
  initialValues?: Partial<CatalogueOrderDraft>;
  submitLabel?: string;
  onSubmit: (draft: CatalogueOrderDraft) => void;
}

// Cost centre and delivery location are administered reference data.
//
// This screen once offered five invented cost centres ("CC-1001 Marketing", …)
// and three invented delivery options, presented with the authority of a picker
// while nothing backed either list. Deleting them was right; replacing them with
// free text was not — a requester could still type anything, and the governed
// checkout could only check the field was non-empty. Both now come from
// `cost_centres` and `delivery_locations`, which the server validates against,
// so what the picker offers is exactly what will be accepted.

function dateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CatalogueOrderCheckout({
  item,
  disabled = false,
  initialValues,
  submitLabel = 'Review order',
  onSubmit,
}: CatalogueOrderCheckoutProps) {
  const { currentUser } = useAuthStore();
  const { data: profile } = useProcurementProfile(currentUser.id);
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? 1);
  // An empty parent draft means "not hydrated yet", not an intentional empty
  // date. Keep the governed checkout usable while still requiring a real date.
  const [needBy, setNeedBy] = useState(initialValues?.needBy?.trim() || dateInDays(7));
  const [deliveryLocation, setDeliveryLocation] = useState(initialValues?.deliveryLocation ?? '');
  const [recipient, setRecipient] = useState(initialValues?.recipient ?? '');
  const [businessPurpose, setBusinessPurpose] = useState(initialValues?.businessPurpose ?? '');
  const [costCentre, setCostCentre] = useState(initialValues?.costCentre ?? '');
  const [showExpertDetails, setShowExpertDetails] = useState(false);

  const { data: allCostCentres = [] } = useCostCentres();
  const { data: allLocations = [] } = useDeliveryLocations();
  const deliveryLocations = allLocations.filter((location) => location.active);
  const costCentres = allCostCentres.filter((centre) => centre.active);
  // No silent fallback to the first row: defaulting to whatever happened to be
  // top of the list submitted a location the requester never chose.
  const effectiveDeliveryLocation = deliveryLocation || profile?.defaultShipToLocationId || '';
  const effectiveCostCentre = costCentre || profile?.costCentre || '';

  const total = quantity * item.unitPrice;
  // Name what is missing rather than referring to a highlight that does not
  // exist. "Complete the highlighted order details" left a requester with a
  // dead button and nothing to act on when the blocking field was one the
  // screen had derived rather than asked for.
  const missing = [
    !(quantity > 0) && 'a quantity',
    !needBy && 'a need-by date',
    !effectiveDeliveryLocation && 'a delivery location',
    !recipient.trim() && 'who it is for',
    !businessPurpose.trim() && 'a business purpose',
    // A governed order charges to an account, so `evaluateGovernedCheckout`
    // genuinely requires a cost centre — the client gate must agree with it, or
    // the button invites a submit that fails.
    !effectiveCostCentre && 'a cost centre',
  ].filter((entry): entry is string => typeof entry === 'string');
  const canSubmit = !disabled && missing.length === 0;

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
              {/* An explicit placeholder when nothing matches: a `<select>`
                  whose value is not among its options displays the FIRST
                  option's label, so the screen would name a location the
                  requester never picked. */}
              {!deliveryLocations.some((location) => location.id === effectiveDeliveryLocation) && <option value="">Select a delivery location…</option>}
              {deliveryLocations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          </div>
          <p className="text-xs text-muted-foreground">{deliveryLocations.length === 0 ? 'No delivery locations are configured — ask an administrator to add one.' : 'Only active delivery locations can be chosen.'}</p>
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
          <Label htmlFor="catalogue-cost-centre">Charged to</Label>
          <select
            id="catalogue-cost-centre"
            value={effectiveCostCentre}
            onChange={(event) => setCostCentre(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {!costCentres.some((centre) => centre.id === effectiveCostCentre) && <option value="">Select a cost centre…</option>}
            {costCentres.map((centre) => <option key={centre.id} value={centre.id}>{centre.id} · {centre.label}</option>)}
          </select>
          <p className="text-[11px] text-gray-500">
            {profile?.costCentre ? 'From your profile — change it for this order if needed.' : 'Your profile has no default cost centre, so this order needs one.'}
          </p>
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

        {(
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
        {!canSubmit && !disabled && <p className="text-center text-xs text-muted-foreground">Still needed: {missing.join(', ')}.</p>}
      </CardContent>
    </Card>
  );
}
