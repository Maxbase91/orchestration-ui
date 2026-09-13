import { useState, useMemo } from 'react';
import { Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConditionCard } from './condition-card';
import type { RoutingRule, BuyingChannel } from '@/data/types';
import { toast } from 'sonner';
import { useSaveRoutingRule } from '@/lib/db/hooks/use-routing-rules';
import { useApprovalChains } from '@/lib/db/hooks/use-approval-chains';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { resolvePolicyValue, describePolicyValue } from '@/lib/procurement/policy-tokens';

// Radix Select cannot hold an empty-string item value, so the "no override"
// choice needs a sentinel. It is mapped back to '' on the way into the model —
// storing the sentinel is the bug that made prePopulateFrom: 'none' a real
// token in the form builder.
const BAND_DECIDES = '__band__';

const BUYING_CHANNEL_OPTIONS: { value: BuyingChannel; label: string }[] = [
  { value: 'procurement-led', label: 'Procurement-Led Sourcing' },
  { value: 'business-led', label: 'Business-Led' },
  { value: 'direct-po', label: 'Direct PO' },
  { value: 'framework-call-off', label: 'Framework Call-Off' },
  { value: 'catalogue', label: 'Catalogue' },
  { value: 'p-card', label: 'P-card route (eligible demands only)' },
];

// The nine hard-coded role-path strings that used to live here
// ('category-manager > finance > vp-procurement', …) were written into
// `action.approvalChain` while intake looked that field up as an
// approval_chains id. The lookup could never match, so the value band silently
// decided every time — including for the two rules written specifically to
// escalate compliance. The chains themselves are the vocabulary now.


const OPERATOR_LABELS: Record<string, string> = {
  equals: 'is',
  greater_than: 'is greater than',
  less_than: 'is less than',
  contains: 'contains',
  starts_with: 'starts with',
  in: 'is one of',
  between: 'is between',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  risk_rating: 'has risk rating',
  not_equals: 'is not',
};

const FIELD_LABELS: Record<string, string> = {
  value: 'value',
  category: 'category',
  supplierId: 'supplier',
  contractId: 'contract',
  riskRating: 'risk rating',
  material: 'material flag',
  region: 'region',
  commodityCode: 'commodity code',
  priority: 'priority',
  isUrgent: 'urgent flag',
};

const CHANNEL_LABELS: Record<string, string> = {
  'procurement-led': 'Procurement-Led Sourcing',
  'business-led': 'Business-Led',
  'direct-po': 'Direct PO',
  'framework-call-off': 'Framework Call-Off',
  'catalogue': 'Catalogue',
  'p-card': 'P-card route',
};

interface RuleEditorPanelProps {
  rule: RoutingRule | null;
  /**
   * Called after the rule is persisted, so the page can drop its edit buffer.
   *
   * Without this the page's `editedRules ?? serverRules` shadowed the refetch
   * forever: the save landed and the invalidation refetched, but the screen
   * kept rendering the local copy for the rest of the session, so a second
   * editor would have seen the new value and this one never would.
   */
  onSaved?: () => void;
}

/**
 * The editor form for one rule.
 *
 * State is initialised from the rule and NOT resynced by an effect. The caller
 * gives this a `key` of the rule id, so selecting a different rule remounts the
 * panel with fresh state — React's documented answer to "reset all state when a
 * prop changes", and the reason the effect that copied eight fields on every
 * `rule` change can go. That effect also silently discarded unsaved edits
 * whenever the rules array was replaced, since a new array identity re-ran it
 * even for the same rule.
 */
export function RuleEditorPanel({ rule, onSaved }: RuleEditorPanelProps) {
  const policyConfig = usePolicyConfig();
  const { data: approvalChains = [] } = useApprovalChains();
  const [name, setName] = useState(rule?.name ?? '');
  const [status, setStatus] = useState<'active' | 'draft' | 'disabled'>(rule?.status ?? 'draft');
  const [conditions, setConditions] = useState<{ field: string; operator: string; value: string }[]>(
    rule ? [...rule.conditions] : [],
  );
  const [buyingChannel, setBuyingChannel] = useState<BuyingChannel>(
    rule?.action.buyingChannel ?? 'procurement-led',
  );
  const [approvalChain, setApprovalChain] = useState(rule?.action.approvalChain ?? '');

  const plainEnglish = useMemo(() => {
    if (conditions.length === 0) return 'No conditions defined.';

    const parts = conditions.map((c) => {
      const field = FIELD_LABELS[c.field] || c.field;
      const op = OPERATOR_LABELS[c.operator] || c.operator;
      // A token reads as its amount AND its name, so the summary says which
      // governed threshold the rule follows rather than a bare number.
      const resolved = resolvePolicyValue(c.value, policyConfig);
      const val = resolved.key
        ? describePolicyValue(resolved)
        : c.field === 'value' && !isNaN(Number(c.value))
          ? `\u20AC${Number(c.value).toLocaleString()}`
          : c.value;
      if (['is_empty', 'is_not_empty'].includes(c.operator)) {
        return `${field} ${op}`;
      }
      return `${field} ${op} ${val}`;
    });

    // Always AND — ruleMatches uses `every`. The preview said whatever the
    // removed toggle was set to, which could contradict the evaluator.
    const joined = parts.join(' AND ');
    const channel = CHANNEL_LABELS[buyingChannel] || buyingChannel;
    return `If ${joined}, route to ${channel}.`;
  }, [conditions, buyingChannel, policyConfig]);

  function addCondition() {
    setConditions((prev) => [...prev, { field: 'value', operator: 'equals', value: '' }]);
  }

  function updateCondition(index: number, updated: { field: string; operator: string; value: string }) {
    setConditions((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  const saveRoutingRule = useSaveRoutingRule();

  async function handleSave() {
    if (!rule) return;
    const updated: RoutingRule = {
      ...rule,
      name,
      status,
      conditions,
      action: { buyingChannel, approvalChain },
      lastModified: new Date().toISOString(),
    };
    try {
      await saveRoutingRule.mutateAsync(updated);
      // Let the page release its edit buffer so the refetched rule is what
      // renders from here on.
      onSaved?.();
      toast.success(`Rule "${name}" saved.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`Save failed: ${msg}`);
    }
  }

  if (!rule) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Select a rule to edit or create a new one.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-gray-200 p-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-lg font-semibold"
          placeholder="Rule name"
        />
        <div className="mt-3 flex items-center gap-4">
          <Label className="text-xs text-gray-500">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'draft' | 'disabled')}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-4">
        {/* Conditions */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">IF</span>
            <span className="text-sm font-medium text-gray-700">Conditions</span>
          </div>

          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div key={index}>
                {index > 0 && (
                  // A label, not a toggle. This was a button flipping between
                  // AND and OR: the evaluator is unconditionally `every`
                  // (ruleMatches), the choice was never saved, and it was
                  // discarded on remount — so it changed the preview sentence
                  // and nothing else. Conditions are ANDed; saying so is the
                  // honest version.
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-xs font-medium text-gray-500">
                      AND
                    </span>
                  </div>
                )}
                <ConditionCard
                  condition={condition}
                  onChange={(updated) => updateCondition(index, updated)}
                  onRemove={() => removeCondition(index)}
                />
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="mt-3" onClick={addCondition}>
            <Plus className="size-3.5" />
            Add Condition
          </Button>
        </div>

        {/* Actions */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">THEN</span>
            <span className="text-sm font-medium text-gray-700">Actions</span>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <Label className="text-xs text-gray-500">Route to Buying Channel</Label>
              <Select value={buyingChannel} onValueChange={(v) => setBuyingChannel(v as BuyingChannel)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUYING_CHANNEL_OPTIONS.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Set Approval Chain</Label>
              <Select value={approvalChain || BAND_DECIDES} onValueChange={(v) => setApprovalChain(v === BAND_DECIDES ? '' : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BAND_DECIDES}>Let the value band decide</SelectItem>
                  {approvalChains.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name}{ch.threshold ? ` · ${ch.threshold}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                {approvalChain
                  ? 'This rule overrides the value band and always uses the chain above.'
                  : 'The chain whose value band contains the request value approves it.'}
              </p>
            </div>

            {/* "Trigger Notification" and "Flag for Review" switches were here.
                Neither had a field on RoutingRule or a column on routing_rules,
                so nothing could have consumed them even if the save had sent
                them — which it did not. Removed rather than wired: there is no
                notification or review mechanism for a rule match to feed. */}
          </div>
        </div>

        {/* Plain English */}
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-500">Plain English Description</p>
          <p className="mt-1 text-sm text-gray-700">{plainEnglish}</p>
        </div>
      </div>

      <div className="border-t border-gray-200 p-4">
        <Button onClick={handleSave} disabled={saveRoutingRule.isPending} className="w-full">
          <Save className="size-4" />
          {saveRoutingRule.isPending ? 'Saving…' : 'Save Rule'}
        </Button>
      </div>
    </div>
  );
}
