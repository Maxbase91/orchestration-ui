import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePolicyConfigStore } from '@/stores/policy-config-store';
import {
  type PolicyConfig, DEFAULT_POLICY_CONFIG, resolvePolicyConfig,
} from '@/lib/procurement/policy-config';
import { determineMateriality } from '@/lib/procurement/materiality';
import { determineInherentRisk, type RiskTier } from '@/lib/procurement/risk-segmentation';
import { determineApprovalToSource } from '@/lib/procurement/approval-to-source';
import { formatCurrency } from '@/lib/format';

interface FieldMeta {
  key: keyof PolicyConfig;
  label: string;
  help: string;
  unit?: '€' | '%' | '/100' | 'days' | '';
}

const FIELDS: FieldMeta[] = [
  { key: 'approvalFullThreshold', label: 'Full approval-to-source threshold', help: 'At/above this value the full approval gate applies', unit: '€' },
  { key: 'materialityValueThreshold', label: 'Materiality value threshold', help: 'At/above this value a demand is material on size alone', unit: '€' },
  { key: 'criticalServiceThreshold', label: 'Critical-service question threshold', help: 'At/above this value the critical-service question is asked', unit: '€' },
  { key: 'continuityThreshold', label: 'Business-continuity threshold', help: 'At/above this value continuity dependence is non-trivial', unit: '€' },
  { key: 'riskHighValue', label: 'Inherent-risk band — high', help: 'Value contributing to a high inherent tier', unit: '€' },
  { key: 'riskMediumValue', label: 'Inherent-risk band — medium', help: 'Value contributing to a medium inherent tier', unit: '€' },
  { key: 'competitiveSourcingThreshold', label: 'Competitive-sourcing threshold', help: 'At/above this value competitive sourcing applies', unit: '€' },
  { key: 'minCompetitiveQuotes', label: 'Minimum competitive quotes', help: 'Quotes required above the threshold', unit: '' },
  { key: 'preferredMinPerformance', label: 'Preferred-supplier performance bar', help: 'Min performance score to qualify as preferred', unit: '/100' },
  { key: 'contractUtilisationHeadroom', label: 'Contract utilisation headroom', help: 'Below this %, an active contract is transactable', unit: '%' },
  { key: 'contractExpiryBufferDays', label: 'Contract expiry buffer', help: 'Days-to-expiry that flag a contract as expiring', unit: 'days' },
];

const RISK_TIERS: RiskTier[] = ['low', 'medium', 'high', 'critical'];

export function PolicyConfigPage() {
  const { overrides, setOverrides, reset } = usePolicyConfigStore();
  const [draft, setDraft] = useState<PolicyConfig>(() => resolvePolicyConfig(overrides));
  const [sim, setSim] = useState({ value: 300_000, riskRating: 'medium' as RiskTier, criticalService: false });

  const dirty = useMemo(
    () => FIELDS.some((f) => draft[f.key] !== resolvePolicyConfig(overrides)[f.key]),
    [draft, overrides],
  );
  const changedFromDefault = (key: keyof PolicyConfig) => draft[key] !== DEFAULT_POLICY_CONFIG[key];

  const handleSave = () => {
    const next: Partial<PolicyConfig> = {};
    for (const f of FIELDS) {
      if (draft[f.key] !== DEFAULT_POLICY_CONFIG[f.key]) next[f.key] = draft[f.key];
    }
    setOverrides(next);
    toast.success('Decisioning thresholds saved — applied to the live front door.');
  };

  const handleReset = () => {
    reset();
    setDraft({ ...DEFAULT_POLICY_CONFIG });
    toast.success('Thresholds reset to the shipped defaults.');
  };

  // Live simulation under the *edited* (possibly unsaved) thresholds.
  const outcome = useMemo(() => {
    const materiality = determineMateriality(
      { value: sim.value, riskRating: sim.riskRating, criticalService: sim.criticalService },
      draft,
    );
    const inherentRisk = determineInherentRisk(
      { value: sim.value, supplierRiskRating: sim.riskRating, criticalService: sim.criticalService },
      draft,
    );
    const approval = determineApprovalToSource(
      { estimatedValue: sim.value, material: materiality.material, inherentTier: inherentRisk.tier },
      draft,
    );
    return { materiality, inherentRisk, approval };
  }, [sim, draft]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Decisioning Thresholds</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          The governed thresholds the front-door determination runs against. Saving applies them to the
          live front door; the simulation below previews the effect on a sample demand before you save.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Editor */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Thresholds</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleReset}>Reset to defaults</Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty}>Save</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor={`cfg-${f.key}`} className="text-sm text-gray-800">
                    {f.label}
                    {changedFromDefault(f.key) && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">edited</span>
                    )}
                  </Label>
                  <p className="text-xs text-gray-400">{f.help} · default {DEFAULT_POLICY_CONFIG[f.key].toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Input
                    id={`cfg-${f.key}`}
                    type="number"
                    className="h-8 w-32 text-right"
                    value={draft[f.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: Number(e.target.value) }))}
                  />
                  {f.unit && <span className="w-8 text-xs text-gray-400">{f.unit}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Simulation */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Simulation</CardTitle>
            <p className="text-xs text-muted-foreground">Outcomes for a sample demand under the edited thresholds.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sim-value" className="text-xs text-gray-600">Estimated value</Label>
              <Input id="sim-value" type="number" className="h-8" value={sim.value}
                onChange={(e) => setSim((s) => ({ ...s, value: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Supplier risk rating</Label>
              <Select value={sim.riskRating} onValueChange={(v) => setSim((s) => ({ ...s, riskRating: v as RiskTier }))}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RISK_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sim-critical" className="text-xs text-gray-600">Critical service</Label>
              <Switch id="sim-critical" checked={sim.criticalService}
                onCheckedChange={(v) => setSim((s) => ({ ...s, criticalService: v }))} />
            </div>

            <div className="mt-2 space-y-2 rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
              <p className="flex justify-between"><span className="text-gray-500">Value</span><span className="font-medium">{formatCurrency(sim.value)}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Materiality</span>
                <span className={outcome.materiality.material ? 'font-semibold text-amber-700' : 'font-medium text-gray-600'}>
                  {outcome.materiality.material ? `Material — ${outcome.materiality.criticality}` : 'Not material'}
                </span></p>
              <p className="flex justify-between"><span className="text-gray-500">Inherent risk</span>
                <span className="font-medium text-gray-900">{outcome.inherentRisk.tier}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Approval gate</span>
                <span className={`font-semibold ${outcome.approval.tier === 'full' ? 'text-amber-700' : 'text-gray-700'}`}>
                  {outcome.approval.tier}
                </span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
