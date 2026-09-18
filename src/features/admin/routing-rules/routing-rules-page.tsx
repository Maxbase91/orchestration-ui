import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { useRoutingRules, useDeleteRoutingRule } from '@/lib/db/hooks/use-routing-rules';
import type { RoutingRule } from '@/data/types';
import { RuleListPanel } from './components/rule-list-panel';
import { RuleEditorPanel } from './components/rule-editor-panel';
import { RuleTestPanel } from './components/rule-test-panel';
import { diagnoseRules, uncoveredDemand, CHANNEL_OF_LAST_RESORT } from '@/lib/routing/evaluate-routing-rules';
import { useApprovalChains } from '@/lib/db/hooks/use-approval-chains';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { toast } from 'sonner';

/** The next free RR-nnn, so a deletion cannot make a new rule reuse an id. */
function nextRuleId(existing: { id: string }[]): string {
  const highest = existing.reduce((max, rule) => {
    const n = Number(/^RR-(\d+)$/.exec(rule.id)?.[1] ?? 0);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `RR-${String(highest + 1).padStart(3, '0')}`;
}

export function RoutingRulesPage() {
  const { data: serverRules = [] } = useRoutingRules();
  // `null` until the page owns an edited copy: before the first edit the server
  // list shows live, and from the first edit onwards local state owns it so a
  // refetch cannot discard in-session work. Replaces a seed-once effect, which
  // cost an extra render and showed an empty list until the copy landed.
  //
  // The buffer is released on a successful save (onSaved below). Without that
  // it shadowed the refetch permanently: the save persisted, the invalidation
  // refetched, and the screen kept showing the stale local row for the rest of
  // the session. /admin/approvals already worked this way; these three pages
  // did not.
  const [editedRules, setEditedRules] = useState<RoutingRule[] | null>(null);
  // The rule the confirmation is about, so it can be named in the dialog.
  const [pendingDelete, setPendingDelete] = useState<RoutingRule | null>(null);
  const removeRule = useDeleteRoutingRule();
  const rules = editedRules ?? serverRules;

  const [pickedRuleId, setPickedRuleId] = useState<string | null>(null);
  // Same idea for the selection: an explicit pick wins, otherwise the first
  // rule. Derived rather than written into state once the rules arrive.
  const selectedRuleId = pickedRuleId ?? rules[0]?.id ?? null;
  const selectedRule = rules.find((r) => r.id === selectedRuleId) ?? null;

  // Active rules that can never fire. Surfaced at the top of the page because
  // the failure is otherwise invisible: an unrecognised field or operator used
  // to return false and silently kill the whole rule, so a broken rule looked
  // exactly like one that merely had not matched yet.
  // Chain ids are passed so a rule naming an approval chain that does not
  // exist is reported here. Every seeded rule named a role path rather than an
  // id, so the intake lookup never matched one and the value band silently
  // decided instead — a rule that looked configured and was not.
  const policyConfig = usePolicyConfig();
  const { data: approvalChains = [] } = useApprovalChains();
  const broken = diagnoseRules(rules, {
    config: policyConfig,
    chainIds: approvalChains.map((c) => c.id),
  });

  // The catch-alls (RR-900…RR-905) are ordinary editable rules, so the rule set
  // can be left with a hole. Production still routes — resolveRouting has a
  // code floor — but silently, which is the failure mode this page exists to
  // make visible.
  const uncovered = uncoveredDemand(rules, policyConfig);

  // Plain function, not useCallback. The React compiler memoizes it, and the
  // manual version could not be preserved — it depended on an array the
  // compiler cannot prove is unmutated, so the whole component fell out of
  // optimization to keep a memo that was buying nothing.
  const handleAddRule = () => {
    const newRule: RoutingRule = {
      // Highest existing number + 1, not the count. `rules.length + 1` reused
      // an id after any deletion, and saveRoutingRule upserts on id — so a new
      // rule silently overwrote a live one.
      id: nextRuleId(rules),
      name: 'New Rule',
      status: 'draft',
      conditions: [{ field: 'value', operator: 'greater_than', value: '' }],
      action: { buyingChannel: 'procurement-led', approvalChain: 'line-manager' },
      description: '',
      lastModified: new Date().toISOString(),
      category: 'All',
    };
    // `prev` is null until the first edit — fall back to what is on screen.
    setEditedRules((prev) => [...(prev ?? serverRules), newRule]);
    setPickedRuleId(newRule.id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <PageHeader
          title="Routing Rules Engine"
          subtitle="Define and test rules that automatically route procurement requests to the correct buying channel."
          actions={selectedRule && (
            <Button
              variant="outline"
              size="sm"
              className="text-stop hover:text-stop"
              onClick={() => setPendingDelete(selectedRule)}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete rule
            </Button>
          )}
        />
      </div>
      {broken.length > 0 && (
        <div className="mx-6 mb-4 rounded-md border border-stop-line bg-stop-soft p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-stop">
            <AlertTriangle className="size-4 shrink-0" />
            {broken.length} active rule{broken.length === 1 ? '' : 's'} cannot fire
          </p>
          <ul className="mt-1.5 space-y-1 pl-6 text-xs text-stop">
            {broken.map((d) => (
              <li key={d.ruleId}>
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => setPickedRuleId(d.ruleId)}
                >
                  {d.ruleId} {d.ruleName}
                </button>
                {' — '}{d.problems.join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {uncovered.length > 0 && (
        <div className="mx-6 mb-4 rounded-md border border-warn-line bg-warn-soft p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-warn">
            <AlertTriangle className="size-4 shrink-0" />
            Some demand matches no rule
          </p>
          <p className="mt-1.5 pl-6 text-xs text-warn">
            {uncovered.length === 1 ? 'One example gets' : `${uncovered.length} examples get`}
            {' '}no answer from the rule set — for instance{' '}
            <span className="font-medium">
              {uncovered[0].category} at €{uncovered[0].value.toLocaleString()}
            </span>
            . Such a request is still routed, to{' '}
            <span className="font-medium">{CHANNEL_OF_LAST_RESORT}</span>, by a fallback in code that
            nobody can configure. Re-activate the catch-all rules, or add one of your own that
            always matches.
          </p>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden border-t border-line">
        {/* Left panel - 25% */}
        <div className="w-1/4 min-w-[240px]">
          <RuleListPanel
            rules={rules}
            selectedRuleId={selectedRuleId}
            onSelectRule={setPickedRuleId}
            onAddRule={handleAddRule}
          />
        </div>
        {/* Center panel - 50% */}
        <div className="w-1/2">
          {/* Keyed by rule id: selecting a different rule remounts the editor
              with that rule's values, instead of an effect copying eight
              fields across on every change. */}
          <RuleEditorPanel key={selectedRule?.id ?? 'none'} rule={selectedRule} onSaved={() => setEditedRules(null)} />
        </div>
        {/* Right panel - 25% */}
        <div className="w-1/4 min-w-[240px]">
          <RuleTestPanel rules={rules} />
        </div>
      </div>

      {/* Nothing references routing_rules, so a delete always succeeds — which
          is precisely why the consequence has to be stated. Removing the rule
          that routes a category does not stop those requests being routed; they
          fall to whatever matches next, and if nothing does, to the
          unconfigurable CHANNEL_OF_LAST_RESORT. A silently rerouted category is
          harder to notice than a refused delete. */}
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        noun="routing rule"
        label={pendingDelete ? `${pendingDelete.id} — ${pendingDelete.name}` : ''}
        consequence={`Demand this rule matched will be routed by the next rule that matches, or by ${CHANNEL_OF_LAST_RESORT} if none does. Requests already routed keep their channel.`}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await removeRule.mutateAsync(pendingDelete.id);
          setEditedRules(null);
          if (pickedRuleId === pendingDelete.id) setPickedRuleId(null);
          toast.success(`Routing rule "${pendingDelete.name}" deleted`);
        }}
      />
    </div>
  );
}
