import { useMemo } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatRelativeTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { RoutingRule } from '@/data/types';

interface RuleListPanelProps {
  rules: RoutingRule[];
  selectedRuleId: string | null;
  onSelectRule: (id: string) => void;
  onAddRule: () => void;
}

export function RuleListPanel({ rules, selectedRuleId, onSelectRule, onAddRule }: RuleListPanelProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, RoutingRule[]> = {};
    for (const rule of rules) {
      const cat = rule.category || 'Uncategorised';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(rule);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [rules]);

  return (
    <div className="flex h-full flex-col border-r border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900">Rules</h2>
        <Button size="sm" onClick={onAddRule}>
          <Plus className="size-3.5" />
          Add Rule
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {grouped.map(([category, categoryRules]) => (
          <div key={category}>
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {category}
              </span>
            </div>
            {categoryRules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => onSelectRule(rule.id)}
                className={cn(
                  'flex w-full items-start gap-2 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                  selectedRuleId === rule.id && 'bg-blue-50 border-l-2 border-l-blue-500'
                )}
              >
                <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-gray-300" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{rule.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={rule.status} size="sm" />
                    <span className="text-xs text-gray-500">
                      {formatNumber(rule.matchCount)} matches
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Modified {formatRelativeTime(rule.lastModified)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
