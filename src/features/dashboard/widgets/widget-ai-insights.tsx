import type { ProcurementRequest, Supplier } from '@/data/types';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';

interface Insight {
  key: string;
  text: string;
  dot: string;
}

/**
 * Insights derived from the live pipeline — NOT an LLM. Each line is a real
 * count off the current request/supplier data; only true signals are shown.
 */
function buildInsights(requests: ProcurementRequest[], suppliers: Supplier[]): Insight[] {
  const out: Insight[] = [];

  const stuck = requests.filter((r) => r.status === 'validation' && r.daysInStage > 5).length;
  if (stuck > 0)
    out.push({ key: 'validation', dot: 'bg-amber-400', text: `${stuck} request${stuck > 1 ? 's have' : ' has'} been in validation for over 5 days.` });

  const overdue = requests.filter((r) => r.isOverdue).length;
  if (overdue > 0)
    out.push({ key: 'overdue', dot: 'bg-red-400', text: `${overdue} request${overdue > 1 ? 's are' : ' is'} past the SLA target.` });

  const sra = suppliers.filter((s) => s.sraStatus === 'expired' || s.sraStatus === 'expiring').length;
  if (sra > 0)
    out.push({ key: 'sra', dot: 'bg-red-400', text: `${sra} supplier${sra > 1 ? 's have' : ' has'} an expiring or expired risk assessment.` });

  const referred = requests.filter((r) => r.referBackCount > 0).length;
  if (referred > 0)
    out.push({ key: 'referred', dot: 'bg-amber-400', text: `${referred} request${referred > 1 ? 's were' : ' was'} referred back for rework.` });

  const highRisk = suppliers.filter((s) => s.riskRating === 'high' || s.riskRating === 'critical').length;
  if (highRisk > 0)
    out.push({ key: 'risk', dot: 'bg-blue-400', text: `${highRisk} active supplier${highRisk > 1 ? 's are' : ' is'} rated high or critical risk.` });

  return out.slice(0, 4);
}

export function WidgetAIInsights() {
  const { data: requests = [] } = useRequests();
  const { data: suppliers = [] } = useSuppliers();
  const insights = buildInsights(requests, suppliers);

  if (insights.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Nothing needs attention right now — the pipeline is healthy.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-sm text-gray-700">
      {insights.map((i) => (
        <li key={i.key} className="flex items-start gap-2">
          <span className={`mt-1 size-1.5 shrink-0 rounded-full ${i.dot}`} />
          <span>{i.text}</span>
        </li>
      ))}
    </ul>
  );
}
