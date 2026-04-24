import { useState, useEffect, useMemo } from 'react';
import { Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

const BUYING_CHANNEL_OPTIONS: { value: BuyingChannel; label: string }[] = [
  { value: 'procurement-led', label: 'Procurement-Led Sourcing' },
  { value: 'business-led', label: 'Business-Led' },
  { value: 'direct-po', label: 'Direct PO' },
  { value: 'framework-call-off', label: 'Framework Call-Off' },
  { value: 'catalogue', label: 'Catalogue' },
];

const APPROVAL_CHAIN_OPTIONS = [
  { value: 'line-manager', label: 'Standard (Line Manager)' },
  { value: 'category-manager', label: 'Fast-Track (Category Manager)' },
  { value: 'category-manager > finance > vp-procurement', label: 'VP-Level' },
  { value: 'category-manager > finance > vp-procurement > cpo', label: 'Board-Level (incl. CPO)' },
  { value: 'line-manager > category-manager', label: 'Two-Level' },
  { value: 'category-manager > finance', label: 'Category + Finance' },
  { value: 'supplier-manager > compliance > category-manager', label: 'Compliance Chain' },
  { value: 'supplier-manager > compliance > vp-procurement > cpo', label: 'Extended Compliance' },
  { value: 'category-manager > vp-procurement', label: 'Fast-Track VP' },
];

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
};

const FIELD_LABELS: Record<string, string> = {
  value: 'value',
  category: 'category',
  supplierId: 'supplier',
  contractId: 'contract',
  riskLevel: 'risk level',
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
};

interface RuleEditorPanelProps {
  rule: RoutingRule | null;
}

export function RuleEditorPanel({ rule }: RuleEditorPanelProps) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'active' | 'draft' | 'disabled'>('draft');
  const [conditions, setConditions] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [logicMode, setLogicMode] = useState<'AND' | 'OR'>('AND');
  const [buyingChannel, setBuyingChannel] = useState<BuyingChannel>('procurement-led');
  const [approvalChain, setApprovalChain] = useState('line-manager');
  const [triggerNotification, setTriggerNotification] = useState(false);
  const [flagForReview, setFlagForReview] = useState(false);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setStatus(rule.status);
      setConditions([...rule.conditions]);
      setBuyingChannel(rule.action.buyingChannel);
      setApprovalChain(rule.action.approvalChain);
      setLogicMode('AND');
      setTriggerNotification(false);
      setFlagForReview(false);
    }
  }, [rule]);

  const plainEnglish = useMemo(() => {
    if (conditions.length === 0) return 'No conditions defined.';

    const parts = conditions.map((c) => {
      const field = FIELD_LABELS[c.field] || c.field;
      const op = OPERATOR_LABELS[c.operator] || c.operator;
      const val = c.field === 'value' && !isNaN(Number(c.value))
        ? `\u20AC${Number(c.value).toLocaleString()}`
        : c.value;
      if (['is_empty', 'is_not_empty'].includes(c.operator)) {
        return `${field} ${op}`;
      }
      return `${field} ${op} ${val}`;
    });

    const joined = parts.join(` ${logicMode} `);
    const channel = CHANNEL_LABELS[buyingChannel] || buyingChannel;
    return `If ${joined}, route to ${channel}.`;
  }, [conditions, logicMode, buyingChannel]);

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
                  <div className="my-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setLogicMode((m) => (m === 'AND' ? 'OR' : 'AND'))}
                      className="rounded-full border border-gray-200 bg-white px-3 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      {logicMode}
                    </button>
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
              <Select value={approvalChain} onValueChange={setApprovalChain}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_CHAIN_OPTIONS.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500">Trigger Notification</Label>
              <Switch checked={triggerNotification} onCheckedChange={setTriggerNotification} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500">Flag for Review</Label>
              <Switch checked={flagForReview} onCheckedChange={setFlagForReview} />
            </div>
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
