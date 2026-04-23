import { useMemo } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { formatCurrency } from '@/lib/format';

interface Anomaly {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

// A request is "off-contract" if contractId is missing AND the value is
// above the catalogue threshold. Those are the ones procurement cares
// about because they should have been routed through sourcing/contracting.
const OFF_CONTRACT_THRESHOLD = 25000;

export function SpendAnomaliesCard() {
  const { data: agent } = useAiAgent('AI-004');
  const { data: requests = [] } = useRequests();
  const { data: suppliers = [] } = useSuppliers();
  const active = agent?.status === 'active';

  const anomalies = useMemo<Anomaly[]>(() => {
    if (!active) return [];
    const out: Anomaly[] = [];
    const supplierNameById = new Map(suppliers.map((s) => [s.id, s.name]));

    // 1. Off-contract spend above threshold
    for (const r of requests) {
      if (r.contractId) continue;
      if ((r.value ?? 0) < OFF_CONTRACT_THRESHOLD) continue;
      if (r.status === 'cancelled' || r.status === 'draft') continue;
      out.push({
        id: `off-contract-${r.id}`,
        severity: (r.value ?? 0) > 100_000 ? 'high' : 'medium',
        title: `Off-contract spend: ${r.title}`,
        detail: `${r.id} · ${formatCurrency(r.value ?? 0)} · no linked contract. Consider sourcing via framework.`,
      });
    }

    // 2. Supplier-concentration: any single supplier with >3 active
    // high-value requests currently in flight
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
      if (count >= 3 && total > 100_000) {
        out.push({
          id: `concentration-${supplierId}`,
          severity: 'medium',
          title: `Supplier concentration: ${name}`,
          detail: `${count} active requests totalling ${formatCurrency(total)}. Review for sourcing diversification.`,
        });
      }
    }

    // 3. Urgent requests without compliance check — they skip standard
    // approvals per RR-010, so they deserve visibility
    const urgent = requests.filter((r) => r.isUrgent && !['completed', 'cancelled'].includes(r.status));
    if (urgent.length > 0) {
      out.push({
        id: 'urgent-inflight',
        severity: 'low',
        title: `${urgent.length} urgent request${urgent.length === 1 ? '' : 's'} in flight`,
        detail: `Urgent-priority routing skips finance approval. Verify post-hoc.`,
      });
    }

    return out.slice(0, 10);
  }, [active, requests, suppliers]);

  if (!agent) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          Spend Anomalies
        </CardTitle>
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <Sparkles className="size-3" />
          {active
            ? `${agent.name} (AI-004) · accuracy ${agent.accuracy}%`
            : `${agent.name} is ${agent.status}`}
        </span>
      </CardHeader>
      <CardContent>
        {!active ? (
          <p className="text-sm text-gray-500">
            Anomaly detection is off. Enable {agent.name} in Admin → AI Agents to surface
            off-contract spend, supplier concentration, and urgent-request outliers here.
          </p>
        ) : anomalies.length === 0 ? (
          <p className="text-sm text-gray-500">
            No anomalies detected in current spend data.
          </p>
        ) : (
          <ul className="space-y-2">
            {anomalies.map((a) => (
              <li
                key={a.id}
                className={`rounded-md border p-3 ${
                  a.severity === 'high'
                    ? 'border-red-200 bg-red-50'
                    : a.severity === 'medium'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                <p className={`text-sm font-medium ${
                  a.severity === 'high' ? 'text-red-800' : a.severity === 'medium' ? 'text-amber-800' : 'text-gray-800'
                }`}>
                  {a.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
