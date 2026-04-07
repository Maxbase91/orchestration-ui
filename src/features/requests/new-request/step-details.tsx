import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { SupplierAutocomplete } from './components/supplier-autocomplete';
import { ServiceDescriptionGenerator } from './components/service-description-generator';
import { getAICommodityCode } from '@/lib/mock-ai';
import type { Supplier } from '@/data/types';

const COST_CENTRES = [
  { value: 'CC-1001', label: 'CC-1001 Marketing' },
  { value: 'CC-2001', label: 'CC-2001 IT' },
  { value: 'CC-3001', label: 'CC-3001 Operations' },
  { value: 'CC-4001', label: 'CC-4001 Finance' },
  { value: 'CC-5001', label: 'CC-5001 HR' },
];

const CATEGORY_TITLES: Record<string, string> = {
  goods: 'Purchase of goods',
  services: 'Service engagement',
  software: 'Software / IT procurement',
  consulting: 'Consulting engagement',
  'contingent-labour': 'Contingent labour request',
  'contract-renewal': 'Contract renewal',
  'supplier-onboarding': 'Supplier onboarding',
  'catalogue': 'Catalogue purchase order',
};

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
  const [commoditySuggestion, setCommoditySuggestion] = useState<{
    code: string;
    label: string;
    confidence: number;
  } | null>(null);
  const [commodityInput, setCommodityInput] = useState(data.commodityCodeLabel);
  const [commodityAccepted, setCommodityAccepted] = useState(!!data.commodityCode);

  // Auto-suggest title based on category
  useEffect(() => {
    if (!data.title && category) {
      onUpdate({ title: CATEGORY_TITLES[category] ?? '' });
    }
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search commodity code as user types
  useEffect(() => {
    if (commodityInput.length < 3) {
      setCommoditySuggestion(null);
      return;
    }
    const timer = setTimeout(() => {
      const result = getAICommodityCode(commodityInput);
      if (result && !commodityAccepted) {
        setCommoditySuggestion(result);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [commodityInput, commodityAccepted]);

  const handleSupplierSelect = (supplier: Supplier) => {
    onUpdate({ supplier: supplier.name, supplierId: supplier.id });
  };

  const handleCommodityAccept = () => {
    if (commoditySuggestion) {
      onUpdate({
        commodityCode: commoditySuggestion.code,
        commodityCodeLabel: commoditySuggestion.label,
      });
      setCommodityInput(commoditySuggestion.label);
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

      {/* Supplier */}
      <div className="space-y-1.5">
        <Label>Supplier</Label>
        <SupplierAutocomplete
          value={data.supplier}
          supplierId={data.supplierId}
          onSelect={handleSupplierSelect}
        />
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

      {/* AI Service Description Generator — for services, consulting, contingent-labour */}
      {(['services', 'consulting', 'contingent-labour'] as string[]).includes(category) && (
        <ServiceDescriptionGenerator
          category={category}
          supplierName={data.supplier || undefined}
          onGenerated={(description) => onUpdate({ businessJustification: description })}
        />
      )}

      {/* Business Justification */}
      <div className="space-y-1.5">
        <Label htmlFor="justification">Business Justification</Label>
        <Textarea
          id="justification"
          rows={3}
          value={data.businessJustification}
          onChange={(e) => onUpdate({ businessJustification: e.target.value })}
          placeholder="Explain why this procurement is needed and the expected business impact..."
        />
      </div>

      {/* Delivery + Urgent */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="delivery-date">Delivery Timeline</Label>
          <Input
            id="delivery-date"
            type="date"
            value={data.deliveryDate}
            onChange={(e) => onUpdate({ deliveryDate: e.target.value })}
          />
        </div>
        <div className="flex items-end gap-3 pb-1">
          <Switch
            id="urgent"
            checked={data.isUrgent}
            onCheckedChange={(checked) => onUpdate({ isUrgent: checked })}
          />
          <Label htmlFor="urgent" className="cursor-pointer text-sm">
            Mark as urgent
          </Label>
        </div>
      </div>

      {/* Cost Centre */}
      <div className="space-y-1.5">
        <Label>Cost Centre</Label>
        <Select value={data.costCentre} onValueChange={(v) => onUpdate({ costCentre: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select cost centre..." />
          </SelectTrigger>
          <SelectContent>
            {COST_CENTRES.map((cc) => (
              <SelectItem key={cc.value} value={cc.value}>
                {cc.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Commodity Code */}
      <div className="space-y-1.5">
        <Label htmlFor="commodity">Commodity Code</Label>
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
        {commoditySuggestion && (
          <AISuggestionCard
            confidence={Math.round(commoditySuggestion.confidence * 100)}
            onAccept={handleCommodityAccept}
            onDismiss={handleCommodityDismiss}
          >
            <p>
              We think this is{' '}
              <span className="font-semibold">
                {commoditySuggestion.label} &mdash; {commoditySuggestion.code}
              </span>
              . Is this correct?
            </p>
          </AISuggestionCard>
        )}
      </div>
    </div>
  );
}
