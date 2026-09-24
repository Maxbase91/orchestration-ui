import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { resolveCategoryCode } from '@/lib/procurement/category-code';
import { useCommodityCodeBook } from '@/lib/db/hooks/use-procurement-categories';
import { UrgencyChannelNote } from './components/urgency-channel-note';

// Every category got the same placeholder title from a per-category map, so a
// category added in Admin → Categories got none. One default, for all of them.
const DEFAULT_TITLE = 'Procurement request';

interface StepDetailsData {
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
}

interface StepDetailsProps {
  category: string;
  data: StepDetailsData;
  onUpdate: (data: Partial<StepDetailsData>) => void;
}

export function StepDetails({ category, data, onUpdate }: StepDetailsProps) {
  const codeBook = useCommodityCodeBook();
  // The suggestion is stored WITH the input it was computed for, so "is this
  // still relevant?" is answered by comparing it to what is typed now rather
  // than by clearing state from inside the debounce effect. That clear was a
  // synchronous setState in an effect body, and it also left a window where a
  // suggestion for older text was shown against newer text.
  const [commoditySuggestion, setCommoditySuggestion] = useState<{
    code: string;
    label: string;
    confidence: number;
    forInput: string;
  } | null>(null);
  const [commodityInput, setCommodityInput] = useState(data.commodityCodeLabel);
  const [commodityAccepted, setCommodityAccepted] = useState(!!data.commodityCode);

  // Auto-suggest title based on category
  useEffect(() => {
    if (!data.title && category) {
      onUpdate({ title: DEFAULT_TITLE });
    }
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search commodity code as the user types. The effect only ever PRODUCES a
  // suggestion; whether one is still applicable is derived below.
  useEffect(() => {
    if (commodityInput.length < 3) return;
    const timer = setTimeout(() => {
      const result = resolveCategoryCode({ text: commodityInput, category }, codeBook);
      if (result && !commodityAccepted) {
        setCommoditySuggestion({ ...result, forInput: commodityInput });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [commodityInput, commodityAccepted, category, codeBook]);

  // Shown only while it still matches what is typed.
  const activeSuggestion =
    commoditySuggestion && commoditySuggestion.forInput === commodityInput
      ? commoditySuggestion
      : null;

  const handleCommodityAccept = () => {
    if (activeSuggestion) {
      onUpdate({
        commodityCode: activeSuggestion.code,
        commodityCodeLabel: activeSuggestion.label,
      });
      setCommodityInput(activeSuggestion.label);
      setCommodityAccepted(true);
      setCommoditySuggestion(null);
    }
  };

  const handleCommodityDismiss = () => {
    setCommoditySuggestion(null);
    setCommodityAccepted(false);
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Request Title</Label>
        <Input
          id="title"
          value={data.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Brief title for your request"
        />
      </div>


      {/* Supplier is NOT chosen here. It is chosen once, on the determination
          step, where PSL status, screening, risk tier and master-data
          completeness are all computed — this screen offered a bare directory
          picker and the determination then showed recommendations the requester
          could not act on. What is shown here is what has been captured so far. */}
      <div className="space-y-1.5">
        <Label>Supplier</Label>
        <div className="rounded-md border border-line bg-card-2 px-3 py-2">
          <p className="text-sm text-ink">
            {data.supplier || 'Not identified yet'}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            {data.supplier
              ? 'Confirm or change this at the determination step, where risk and screening are shown.'
              : 'Suppliers are identified at the determination step, alongside risk and screening.'}
          </p>
        </div>
      </div>

      {/* Value + Currency */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="value">Estimated Value</Label>
          <Input
            id="value"
            type="number"
            min={0}
            value={data.estimatedValue || ''}
            onChange={(e) => onUpdate({ estimatedValue: Number(e.target.value) })}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={data.currency} onValueChange={(v) => onUpdate({ currency: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rationale is intentionally not a separate requester field. The
          confirmed intake/service description is the source of truth for why
          the request exists; this form only captures missing transaction data. */}

      {/* Delivery + Urgent */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="delivery-date">Need-by date</Label>
          <Input
            id="delivery-date"
            type="date"
            value={data.deliveryDate}
            onChange={(e) => onUpdate({ deliveryDate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 pb-1">
          <div className="flex items-end gap-3">
            <Switch
              id="urgent"
              checked={data.isUrgent}
              onCheckedChange={(checked) => onUpdate({ isUrgent: checked })}
            />
            <Label htmlFor="urgent" className="cursor-pointer text-sm">
              Mark as urgent
            </Label>
          </div>
          {/* Same note as the chat path — urgency is the one input that can
              still move the channel after the pre-check has shown it. */}
          <UrgencyChannelNote
            category={category}
            estimatedValue={data.estimatedValue}
            supplierId={data.supplierId}
            isUrgent={data.isUrgent}
          />
        </div>
      </div>

      {/* No cost-centre field. It is derived from the requester's profile and
          shown once, in the requester-context block at the top of this step —
          this was the THIRD copy of the same five invented cost centres. */}

      {/* Commodity Code */}
      <div className="space-y-1.5">
        <Label htmlFor="commodity">Commodity or service family</Label>
        <Input
          id="commodity"
          value={commodityInput}
          onChange={(e) => {
            setCommodityInput(e.target.value);
            setCommodityAccepted(false);
            onUpdate({ commodityCode: '', commodityCodeLabel: '' });
          }}
          placeholder="Start typing to search (e.g. cloud, laptop, consulting)..."
        />
        {activeSuggestion && (
          <AISuggestionCard
            confidence={Math.round(activeSuggestion.confidence * 100)}
            onAccept={handleCommodityAccept}
            onDismiss={handleCommodityDismiss}
          >
            <p>
              We think this is{' '}
              <span className="font-semibold">
                {activeSuggestion.label} &mdash; {activeSuggestion.code}
              </span>
              . Is this correct?
            </p>
          </AISuggestionCard>
        )}
      </div>
    </div>
  );
}
