import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { routingRules } from '@/data/routing-rules';
import type { RoutingRule } from '@/data/types';
import { RuleListPanel } from './components/rule-list-panel';
import { RuleEditorPanel } from './components/rule-editor-panel';
import { RuleTestPanel } from './components/rule-test-panel';

export function RoutingRulesPage() {
  const [rules, setRules] = useState<RoutingRule[]>(routingRules);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(rules[0]?.id ?? null);

  const selectedRule = rules.find((r) => r.id === selectedRuleId) ?? null;

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
