import { useMemo } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { formatCurrency } from '@/lib/format';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';

interface Anomaly {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}


export function SpendAnomaliesCard() {
  const { data: agent } = useAiAgent('AI-004');
  const { data: requests = [] } = useRequests();
  const { data: suppliers = [] } = useSuppliers();
  const active = agent?.status === 'active';
  // Off-contract means at or above the value that needs an executed contract
  // (Decisioning thresholds); "high" above the budget-approval threshold. Both
  // were literals here — 25,000 and 100,000 — beside the governed figures.
  const policy = usePolicyConfig();

  const anomalies = useMemo<Anomaly[]>(() => {
    if (!active) return [];
    const out: Anomaly[] = [];
    const supplierNameById = new Map(suppliers.map((s) => [s.id, s.name]));

    // 1. Off-contract spend above threshold
    for (const r of requests) {
      if (r.contractId) continue;
      if ((r.value ?? 0) < policy.contractRequiredThreshold) continue;
      if (r.status === 'cancelled' || r.status === 'draft') continue;
      out.push({
        id: `off-contract-${r.id}`,
        severity: (r.value ?? 0) > policy.budgetApprovalThreshold ? 'high' : 'medium',
        title: `Off-contract spend: ${r.title}`,
        detail: `${r.id} · ${formatCurrency(r.value ?? 0)} · no linked contract. Consider sourcing via framework.`,
      });
    }

    // 2. Supplier concentration: three or more requests in flight with one
    // supplier whose combined value is above the budget-approval threshold.
    const perSupplier = new Map<string, { name: string; count: number; total: number }>();
    for (const r of requests) {
      if (!r.supplierId) continue;
      if (['completed', 'cancelled', 'draft'].includes(r.status)) continue;
      const name = supplierNameById.get(r.supplierId) ?? r.supplierId;
      const b = perSupplier.get(r.supplierId) ?? { name, count: 0, total: 0 };
      b.count += 1;
      b.total += r.value ?? 0;
      perSupplier.set(r.supplierId, b);
    }
    for (const [supplierId, { name, count, total }] of perSupplier) {
      if (count >= 3 && total > policy.budgetApprovalThreshold) {
        out.push({
          id: `concentration-${supplierId}`,
          severity: 'medium',
          title: `Supplier concentration: ${name}`,
          detail: `${count} active requests totalling ${formatCurrency(total)}. Review for sourcing diversification.`,
        });
      }
    }

    // A third rule said urgent routing "skips finance approval" — it does not:
    // RR-010 sends an urgent request procurement-led. Removed rather than kept
    // as a warning about something that never happens.

    return out.slice(0, 10);
  }, [active, requests, suppliers, policy]);

  if (!agent) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 text-warn" />
          Spend Anomalies
        </CardTitle>
        <span className="flex items-center gap-1 text-[11px] text-ink-3">
          <Sparkles className="size-3" />
          {active ? `${agent.name} (AI-004)` : `${agent.name} is ${agent.status}`}
        </span>
      </CardHeader>
      <CardContent>
        {!active ? (
          <p className="text-sm text-ink-3">
            Anomaly detection is off. Enable {agent.name} in Admin → AI Agents to surface
            off-contract spend, supplier concentration, and urgent-request outliers here.
          </p>
        ) : anomalies.length === 0 ? (
          <p className="text-sm text-ink-3">
            No anomalies detected in current spend data.
          </p>
        ) : (
          <ul className="space-y-2">
            {anomalies.map((a) => (
              <li
                key={a.id}
                className={`rounded-md border p-3 ${
                  a.severity === 'high'
                    ? 'border-stop-line bg-stop-soft'
                    : a.severity === 'medium'
                      ? 'border-warn-line bg-warn-soft'
                      : 'border-line bg-card-2'
                }`}
              >
                <p className={`text-sm font-medium ${
                  a.severity === 'high' ? 'text-stop' : a.severity === 'medium' ? 'text-warn' : 'text-ink'
                }`}>
                  {a.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-2">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
