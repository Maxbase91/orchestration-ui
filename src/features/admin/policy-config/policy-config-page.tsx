// Admin → Decisioning Thresholds: every number a decision compares against,
// with what reads it. The numbers live here; routing rules, approval chains,
// workflow branches and forms decide what happens and name these numbers as
// `policy:<key>` rather than restating them (ADR-0009).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePolicyConfigStore } from '@/stores/policy-config-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  type PolicyConfig, DEFAULT_POLICY_CONFIG, resolvePolicyConfig,
} from '@/lib/procurement/policy-config';
import { determineMateriality } from '@/lib/procurement/materiality';
import { determineInherentRisk, type RiskTier } from '@/lib/procurement/risk-segmentation';
import { determineApprovalToSource } from '@/lib/procurement/approval-to-source';
import { formatCurrency } from '@/lib/format';
import {
  type NumericPolicyKey, NUMERIC_POLICY_KEYS, POLICY_KEY_META,
  type CategoryListPolicyKey, CATEGORY_LIST_POLICY_META, CATEGORY_LIST_POLICY_KEYS,
} from '@/lib/procurement/policy-tokens';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { Checkbox } from '@/components/ui/checkbox';
import { policyReferences, type PolicyReference, type PolicyReferenceSources } from '@/lib/procurement/policy-references';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { useApprovalChains } from '@/lib/db/hooks/use-approval-chains';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { useFormTemplates } from '@/lib/db/hooks/use-form-templates';
import { useServiceDescriptionTemplates } from '@/lib/db/hooks/use-service-description-templates';
import { useKnowledgeBase } from '@/lib/db/hooks/use-knowledge-base';

// Every numeric threshold, derived from the shared key metadata rather than
// listed here. The hand-maintained copy omitted `delegatedAuthorityThreshold`,
// which was live in the compliance report and server-validated — so it could
// never be edited, and because handleSave rebuilds the override set from this
// list, saving any other field ERASED it. A derived list cannot drift.
const FIELDS: { key: NumericPolicyKey; label: string; help: string; unit: string; usedIn: string }[] =
  NUMERIC_POLICY_KEYS.map((key) => ({ key, ...POLICY_KEY_META[key] }));

/** The configuration that can name a threshold, read live. */
function usePolicyReferenceSources(): { sources: PolicyReferenceSources; loading: boolean; failed: boolean } {
  const rules = useRoutingRules();
  const chains = useApprovalChains();
  const templates = useWorkflowTemplates();
  const forms = useFormTemplates();
  const serviceDescriptions = useServiceDescriptionTemplates();
  const knowledge = useKnowledgeBase();
  const all = [rules, chains, templates, forms, serviceDescriptions, knowledge];
  return {
    loading: all.some((q) => q.isLoading),
    // A source that failed to load is not a source with no references: with
    // the chains unread, delegatedAuthorityThreshold would be reported as
    // driving nothing when it bounds two of them.
    failed: all.some((q) => q.isError),
    sources: {
      rules: rules.data, chains: chains.data, templates: templates.data,
      forms: forms.data, serviceDescriptions: serviceDescriptions.data, knowledge: knowledge.data,
    },
  };
}

const KIND_LABEL: Record<PolicyReference['kind'], string> = {
  'routing-rule': 'Routing rules',
  'approval-chain': 'Approval chains',
  workflow: 'Workflows',
  form: 'Forms',
  'service-description': 'Service description',
  knowledge: 'Knowledge base',
};

/**
 * What reads one threshold: where the code uses it (fixed) and the
 * configuration that names it (live). Knowledge-base articles are counted rather than listed — a figure
 * quoted in five articles would otherwise push the next threshold off screen.
 */
function UsedBy({ usedIn, references, settled }: { usedIn: string; references: PolicyReference[]; settled: boolean }) {
  const groups = new Map<PolicyReference['kind'], PolicyReference[]>();
  for (const r of references) groups.set(r.kind, [...(groups.get(r.kind) ?? []), r]);
  const unused = !usedIn && references.length === 0 && settled;
  return (
    <div className="mt-1 space-y-0.5 text-xs">
      {usedIn && <p className="text-ink-2"><span className="text-ink-3">Used in:</span> {usedIn}</p>}
      {[...groups].map(([kind, refs]) => (
        <p key={kind} className="text-ink-2">
          <span className="text-ink-3">{KIND_LABEL[kind]}:</span>{' '}
          {kind === 'knowledge' ? (
            <Link to={refs[0].href} className="underline-offset-2 hover:underline" title={refs.map((r) => r.label).join('\n')}>
              {refs.length === 1 ? '1 article quotes it' : `${refs.length} articles quote it`}
            </Link>
          ) : refs.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ' · '}
              <Link to={r.href} className="underline-offset-2 hover:underline">{r.label}</Link>
              {!r.active && <span className="text-ink-3"> (off)</span>}
            </span>
          ))}
        </p>
      ))}
      {unused && (
        <p className="text-warn">Nothing reads this value: no code uses it and no rule, chain, branch or form names it.</p>
      )}
    </div>
  );
}

const RISK_TIERS: RiskTier[] = ['low', 'medium', 'high', 'critical'];

// Every on/off key, from the defaults by type — saving once named its one
// switch by hand, and a second switch would have been the one it forgot.
const BOOLEAN_KEYS = (Object.keys(DEFAULT_POLICY_CONFIG) as (keyof PolicyConfig)[])
  .filter((key): key is { [K in keyof PolicyConfig]: PolicyConfig[K] extends boolean ? K : never }[keyof PolicyConfig] =>
    typeof DEFAULT_POLICY_CONFIG[key] === 'boolean');

const sameList = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/**
 * A category-list threshold as a checklist of the configured categories. These
 * were comma-separated ids typed into a text box, so a typo saved cleanly and
 * matched nothing. An id stored here that no longer names a category is still
 * listed, flagged, so it can be removed rather than lingering unseen.
 */
function CategoryChecklist({ policyKey, value, onChange }: {
  policyKey: CategoryListPolicyKey;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { data: categories = [] } = useProcurementCategories();
  const meta = CATEGORY_LIST_POLICY_META[policyKey];
  const known = new Set(categories.map((c) => c.id));
  const unknown = value.filter((id) => !known.has(id));
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id));
  return (
    <fieldset>
      <legend className="text-sm text-ink">
        {meta.label}
        {!sameList(value, DEFAULT_POLICY_CONFIG[policyKey]) && (
          <span className="ml-1.5 rounded bg-warn-soft px-1 text-[10px] font-medium text-warn">edited</span>
        )}
      </legend>
      <p className="text-xs text-ink-3">{meta.help}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {categories.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <Checkbox
              aria-label={`${meta.label}: ${c.label}`}
              checked={value.includes(c.id)}
              onCheckedChange={(on) => toggle(c.id, on === true)}
            />
            {c.label}
          </label>
        ))}
        {unknown.map((id) => (
          <label key={id} className="flex cursor-pointer items-center gap-2 text-sm text-warn">
            <Checkbox aria-label={`${meta.label}: ${id}`} checked onCheckedChange={() => toggle(id, false)} />
            {id} <span className="text-xs">(no such category)</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PolicyConfigPage() {
  const { overrides, persistOverrides, persistReset } = usePolicyConfigStore();
  const { currentUser } = useAuthStore();
  const [draft, setDraft] = useState<PolicyConfig>(() => resolvePolicyConfig(overrides));
  const [sim, setSim] = useState({ value: 300_000, riskRating: 'medium' as RiskTier, criticalService: false });
  const { sources, loading: referencesLoading, failed: referencesFailed } = usePolicyReferenceSources();

  const dirty = useMemo(() => {
    const saved = resolvePolicyConfig(overrides);
    return FIELDS.some((f) => draft[f.key] !== saved[f.key])
      || BOOLEAN_KEYS.some((key) => draft[key] !== saved[key])
      || CATEGORY_LIST_POLICY_KEYS.some((key) => !sameList(draft[key], saved[key]));
  }, [draft, overrides]);
  const changedFromDefault = (key: NumericPolicyKey) => draft[key] !== DEFAULT_POLICY_CONFIG[key];

  const handleSave = async () => {
    const next: Partial<PolicyConfig> = {};
    for (const f of FIELDS) {
      if (draft[f.key] !== DEFAULT_POLICY_CONFIG[f.key]) next[f.key] = draft[f.key];
    }
    for (const key of BOOLEAN_KEYS) {
      if (draft[key] !== DEFAULT_POLICY_CONFIG[key]) next[key] = draft[key];
    }
    // Derived from the key metadata, like FIELDS: a list key named here by
    // hand would be the next one saving forgot.
    for (const key of CATEGORY_LIST_POLICY_KEYS) {
      if (!sameList(draft[key], DEFAULT_POLICY_CONFIG[key])) next[key] = draft[key];
    }
    try {
      await persistOverrides(next, currentUser?.id);
      toast.success('Decisioning thresholds saved — applied to the live front door.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the live policy.');
    }
  };

  const handleReset = async () => {
    try {
      await persistReset(currentUser?.id);
      setDraft({ ...DEFAULT_POLICY_CONFIG });
      toast.success('Thresholds reset to the shipped defaults.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reset the live policy.');
    }
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
        <h1 className="text-xl font-semibold text-ink">Decisioning Thresholds</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-ink-3">
          The numbers every decision compares against. Routing rules, approval chains, workflow branches and
          forms decide <em>what happens</em>, and name these numbers instead of restating them — so each one is
          changed here, once. Under each threshold: where it is used, and the configuration that names it.
          Saving applies them to the live front door; the simulation previews the effect before you save.
        </p>
      </div>

      {/* Settings on the left, the simulation beside them. Each card spanned
          three of five columns on its own, so they wrapped and left the right
          two fifths empty beside every card but the last. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Thresholds</CardTitle>
              {referencesFailed && (
                <p className="text-xs text-warn">
                  The rules, chains, workflows, forms and articles that name these could not be loaded, so they are not listed.
                </p>
              )}
            </CardHeader>
            <CardContent className="divide-y divide-line-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Label htmlFor={`cfg-${f.key}`} className="text-sm text-ink">
                      {f.label}
                      {changedFromDefault(f.key) && (
                        <span className="ml-1.5 rounded bg-warn-soft px-1 text-[10px] font-medium text-warn">edited</span>
                      )}
                    </Label>
                    <p className="text-xs text-ink-3">{f.help} · default {DEFAULT_POLICY_CONFIG[f.key].toLocaleString()}</p>
                    <UsedBy usedIn={f.usedIn} references={policyReferences(f.key, sources)} settled={!referencesLoading && !referencesFailed} />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Input
                      id={`cfg-${f.key}`}
                      type="number"
                      className="h-8 w-32 text-right tabular-nums"
                      value={draft[f.key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: Number(e.target.value) }))}
                    />
                    {/* Always rendered, so a unitless input lines up with the rest. */}
                    <span className="w-8 text-xs text-ink-3">{f.unit}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Supplier choice</CardTitle>
              <p className="text-xs text-ink-3">
                Above the competitive-sourcing threshold a demand needs competitive quotes, unless it goes
                to a preferred supplier or its category is exempt. A supplier outside the category&apos;s
                preferred list always needs a reason from the requester.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="cfg-preferredSupplierOverrideNeedsApproval" className="text-sm text-ink">
                    Category manager approves a non-preferred supplier
                  </Label>
                  <p className="text-xs text-ink-3">
                    Adds the category manager to the approvals when the chosen supplier is outside the
                    category&apos;s preferred list, unless the chain already asks them.
                  </p>
                </div>
                <Switch
                  id="cfg-preferredSupplierOverrideNeedsApproval"
                  checked={draft.preferredSupplierOverrideNeedsApproval}
                  onCheckedChange={(value) => setDraft((d) => ({ ...d, preferredSupplierOverrideNeedsApproval: value }))}
                />
              </div>
              <CategoryChecklist
                policyKey="competitiveSourcingExemptCategories"
                value={draft.competitiveSourcingExemptCategories}
                onChange={(next) => setDraft((d) => ({ ...d, competitiveSourcingExemptCategories: next }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Risk questions</CardTitle>
              <p className="text-xs text-ink-3">
                Intake asks only the risk questions a demand&apos;s description leaves open. These decide
                when it asks about privileged access; the critical-service question follows the
                critical-service threshold above.
              </p>
            </CardHeader>
            <CardContent>
              <CategoryChecklist
                policyKey="privilegedAccessCategories"
                value={draft.privilegedAccessCategories}
                onChange={(next) => setDraft((d) => ({ ...d, privilegedAccessCategories: next }))}
              />
            </CardContent>
          </Card>


        </div>

        {/* Save sits with the simulation, which stays in view: in the first
            card's header it was out of sight while the lists further down were
            being edited. */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:col-span-2">
          <div className="flex items-center justify-end gap-2">
            {dirty && <span className="mr-auto text-xs font-medium text-warn">Unsaved changes</span>}
            <Button size="sm" variant="ghost" onClick={handleReset}>Reset to defaults</Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty}>Save</Button>
          </div>
          {/* Simulation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Simulation</CardTitle>
              <p className="text-xs text-muted-foreground">Outcomes for a sample demand under the edited thresholds.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="sim-value" className="text-xs text-ink-2">Estimated value</Label>
                <Input id="sim-value" type="number" className="h-8" value={sim.value}
                  onChange={(e) => setSim((s) => ({ ...s, value: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-ink-2">Supplier risk rating</Label>
                <Select value={sim.riskRating} onValueChange={(v) => setSim((s) => ({ ...s, riskRating: v as RiskTier }))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sim-critical" className="text-xs text-ink-2">Critical service</Label>
                <Switch id="sim-critical" checked={sim.criticalService}
                  onCheckedChange={(v) => setSim((s) => ({ ...s, criticalService: v }))} />
              </div>

              <div className="mt-2 space-y-2 rounded-md border border-line-2 bg-card-2 p-3 text-sm">
                <p className="flex justify-between"><span className="text-ink-3">Value</span><span className="font-medium">{formatCurrency(sim.value)}</span></p>
                <p className="flex justify-between"><span className="text-ink-3">Materiality</span>
                  <span className={outcome.materiality.material ? 'font-semibold text-warn' : 'font-medium text-ink-2'}>
                    {outcome.materiality.material ? `Material — ${outcome.materiality.criticality}` : 'Not material'}
                  </span></p>
                <p className="flex justify-between"><span className="text-ink-3">Inherent risk</span>
                  <span className="font-medium text-ink">{outcome.inherentRisk.tier}</span></p>
                <p className="flex justify-between"><span className="text-ink-3">Approval gate</span>
                  <span className={`font-semibold ${outcome.approval.tier === 'full' ? 'text-warn' : 'text-ink-2'}`}>
                    {outcome.approval.tier}
                  </span></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
