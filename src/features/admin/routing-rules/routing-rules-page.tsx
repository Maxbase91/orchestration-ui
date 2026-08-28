import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import type { RoutingRule } from '@/data/types';
import { RuleListPanel } from './components/rule-list-panel';
import { RuleEditorPanel } from './components/rule-editor-panel';
import { RuleTestPanel } from './components/rule-test-panel';
import { diagnoseRules } from '@/lib/routing/evaluate-routing-rules';
import { AlertTriangle } from 'lucide-react';

export function RoutingRulesPage() {
  const { data: serverRules = [] } = useRoutingRules();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  useEffect(() => {
    if (rules.length === 0 && serverRules.length > 0) {
      setRules(serverRules);
      setSelectedRuleId((prev) => prev ?? serverRules[0]?.id ?? null);
    }
  }, [rules.length, serverRules]);

  const selectedRule = rules.find((r) => r.id === selectedRuleId) ?? null;

  // Active rules that can never fire. Surfaced at the top of the page because
  // the failure is otherwise invisible: an unrecognised field or operator used
  // to return false and silently kill the whole rule, so a broken rule looked
  // exactly like one that merely had not matched yet.
  const broken = diagnoseRules(rules);

  const handleAddRule = useCallback(() => {
    const newRule: RoutingRule = {
      id: `RR-${String(rules.length + 1).padStart(3, '0')}`,
      name: 'New Rule',
      status: 'draft',
      conditions: [{ field: 'value', operator: 'greater_than', value: '' }],
      action: { buyingChannel: 'procurement-led', approvalChain: 'line-manager' },
      description: '',
      matchCount: 0,
      lastModified: new Date().toISOString(),
      category: 'All',
    };
    setRules((prev) => [...prev, newRule]);
    setSelectedRuleId(newRule.id);
  }, [rules.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <PageHeader
          title="Routing Rules Engine"
          subtitle="Define and test rules that automatically route procurement requests to the correct buying channel."
        />
      </div>
      {broken.length > 0 && (
        <div className="mx-6 mb-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-red-900">
            <AlertTriangle className="size-4 shrink-0" />
            {broken.length} active rule{broken.length === 1 ? '' : 's'} cannot fire
          </p>
          <ul className="mt-1.5 space-y-1 pl-6 text-xs text-red-800">
            {broken.map((d) => (
              <li key={d.ruleId}>
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => setSelectedRuleId(d.ruleId)}
                >
                  {d.ruleId} {d.ruleName}
                </button>
                {' — '}{d.problems.join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden border-t border-gray-200">
        {/* Left panel - 25% */}
        <div className="w-1/4 min-w-[240px]">
          <RuleListPanel
            rules={rules}
            selectedRuleId={selectedRuleId}
            onSelectRule={setSelectedRuleId}
            onAddRule={handleAddRule}
          />
        </div>
        {/* Center panel - 50% */}
        <div className="w-1/2">
          <RuleEditorPanel rule={selectedRule} />
        </div>
        {/* Right panel - 25% */}
        <div className="w-1/4 min-w-[240px]">
          <RuleTestPanel rules={rules} />
        </div>
      </div>
    </div>
  );
}
