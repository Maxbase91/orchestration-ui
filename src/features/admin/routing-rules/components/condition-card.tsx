// Routing-rules editor — single condition row (field / operator / value).
// The value control adapts to the chosen field so admins pick from the same
// enumerations the front door's rule evaluation matches against, instead of
// free-typing values that would never match.

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CURRENCY_POLICY_KEYS, POLICY_KEY_META, isPolicyToken, policyToken,
  resolvePolicyValue, policyKeyHolding,
} from '@/lib/procurement/policy-tokens';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { formatCurrency } from '@/lib/format';

// Every entry here MUST exist in SUPPORTED_FIELDS in evaluate-routing-rules.ts.
// `riskLevel` used to sit in this list while the evaluator read `riskRating`,
// so the obvious rule a procurement admin would write — route on risk — was
// dead on a name mismatch, silently.
const FIELD_OPTIONS = [
  { value: 'value', label: 'Value' },
  { value: 'category', label: 'Category' },
  { value: 'supplierId', label: 'Supplier Status' },
  { value: 'contractId', label: 'Contract Exists' },
  { value: 'riskRating', label: 'Risk Rating' },
  { value: 'material', label: 'Material / Regulatory Flag' },
  { value: 'region', label: 'Region' },
  { value: 'commodityCode', label: 'Commodity Code' },
  { value: 'priority', label: 'Priority' },
  { value: 'isUrgent', label: 'Is Urgent' },
];

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'in', label: 'is in' },
  { value: 'between', label: 'between' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'risk_rating', label: 'risk rating is' },
];

const CATEGORY_VALUES = [
  'goods', 'services', 'software', 'consulting',
  'contingent-labour', 'contract-renewal', 'supplier-onboarding',
];

const RISK_VALUES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'];

interface ConditionCardProps {
  condition: { field: string; operator: string; value: string };
  onChange: (condition: { field: string; operator: string; value: string }) => void;
  onRemove: () => void;
}

export function ConditionCard({ condition, onChange, onRemove }: ConditionCardProps) {
  const policyConfig = usePolicyConfig();
  // Presence checks are unary — hide the value control entirely.
  const needsValueInput = !['is_empty', 'is_not_empty'].includes(condition.operator);

  function getValueInput() {
    if (!needsValueInput) return null;

    if (condition.field === 'category') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_VALUES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (condition.field === 'riskRating' || condition.operator === 'risk_rating') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select risk level" />
          </SelectTrigger>
          <SelectContent>
            {RISK_VALUES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (condition.field === 'priority') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_VALUES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // contractId conditions test existence (has a contract: yes/no), not a
    // specific id — hence the boolean select rather than a text input.
    if (condition.field === 'isUrgent' || condition.field === 'contractId') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // A money condition may reference a governed threshold instead of restating
    // it. Restating is how €25,000 came to be written in four places, and how
    // RR-001 sat dead for months while the hard-coded fallback happened to
    // agree with it — the duplication hid the outage rather than surviving it.
    if (condition.field === 'value') {
      const tokened = isPolicyToken(condition.value);
      const resolved = resolvePolicyValue(condition.value, policyConfig);
      // Only offer the nudge for a plain literal, and only when a governed key
      // holds exactly that amount. Two controls sharing a number today are not
      // necessarily the same fact, so this suggests and never rewrites.
      const literalMatch = !tokened && condition.value !== ''
        ? policyKeyHolding(Number(condition.value), policyConfig)
        : null;
      return (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={tokened ? 'default' : 'outline'}
              className="h-7 flex-1 text-xs"
              onClick={() => onChange({ ...condition, value: policyToken(CURRENCY_POLICY_KEYS[0]) })}
            >
              Governed
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tokened ? 'outline' : 'default'}
              className="h-7 flex-1 text-xs"
              onClick={() => onChange({ ...condition, value: tokened ? resolved.value : condition.value })}
            >
              Amount
            </Button>
          </div>
          {tokened ? (
            <>
              <Select
                value={condition.value}
                onValueChange={(v) => onChange({ ...condition, value: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a threshold" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_POLICY_KEYS.map((k) => (
                    <SelectItem key={k} value={policyToken(k)}>{POLICY_KEY_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {resolved.unresolved
                  ? 'This threshold no longer exists — the condition can never be true.'
                  : `Currently ${formatCurrency(Number(resolved.value))}. Changing it in Decisioning Thresholds moves this rule too.`}
              </p>
            </>
          ) : (
            <>
              <Input
                value={condition.value}
                onChange={(e) => onChange({ ...condition, value: e.target.value })}
                placeholder="Enter amount"
                className="w-full"
              />
              {literalMatch && (
                <p className="text-xs text-amber-700">
                  {formatCurrency(Number(condition.value))} is the {POLICY_KEY_META[literalMatch].label.toLowerCase()}.{' '}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-amber-900"
                    onClick={() => onChange({ ...condition, value: policyToken(literalMatch) })}
                  >
                    Reference it instead
                  </button>{' '}
                  so this rule follows a policy change.
                </p>
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <Input
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="Enter value"
        className="w-full"
      />
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_1.5fr]">
        <Select
          value={condition.field}
          onValueChange={(v) => onChange({ ...condition, field: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Field" />
          </SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={condition.operator}
          onValueChange={(v) => onChange({ ...condition, operator: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            {OPERATOR_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {getValueInput()}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="mt-0.5 shrink-0 text-gray-400 hover:text-red-500"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
