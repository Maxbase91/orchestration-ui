import { useMemo } from 'react';
import { MessageSquare, GitBranch, CheckCircle2, Cog, Star, type LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/auth-store';
import { roles } from '@/config/roles';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useLiveKpis } from '../use-live-kpis';

// ── Welcome context (real user + role + date) ──────────────────────────────
export function useWelcome() {
  const { currentUser, currentRole } = useAuthStore();
  const roleLabel = roles.find((r) => r.id === currentRole)?.label ?? currentRole;
  return { name: currentUser.name, roleLabel, today: format(new Date(), 'EEEE, d MMMM yyyy') };
}

// ── Live demand pipeline (real stage counts off useRequests) ────────────────
export interface PipelineNode {
  key: string;
  label: string;
  sub: string;
  count: number;
  Icon: LucideIcon;
}

const PIPELINE: { key: string; statuses: string[]; label: string; sub: string; Icon: LucideIcon }[] = [
  { key: 'intake', statuses: ['intake'], label: 'Intake', sub: 'Slack · email · portal', Icon: MessageSquare },
  { key: 'routing', statuses: ['validation'], label: 'Routing', sub: 'Right team, instantly', Icon: GitBranch },
  { key: 'approvals', statuses: ['approval'], label: 'Approvals', sub: 'Policy-aware', Icon: CheckCircle2 },
  { key: 'automation', statuses: ['sourcing', 'contracting'], label: 'Automation', sub: 'No more busywork', Icon: Cog },
  { key: 'fulfilled', statuses: ['po', 'receipt', 'invoice', 'payment', 'completed'], label: 'Fulfilled', sub: 'Tracked to close', Icon: Star },
];

export function useDemandPipeline(): PipelineNode[] {
  const { data: requests = [] } = useRequests();
  return useMemo(
    () =>
      PIPELINE.map((n) => ({
        key: n.key,
        label: n.label,
        sub: n.sub,
        Icon: n.Icon,
        count: requests.filter((r) => n.statuses.includes(r.status)).length,
      })),
    [requests],
  );
}

// ── Live KPI tiles (real values from useLiveKpis) ───────────────────────────
export interface HomeKpi { key: string; label: string; value: string; sub: string }

export function useHomeKpis(): HomeKpi[] {
  const k = useLiveKpis();
  return [
    { key: 'demand', label: 'Open demand', value: String(k.openDemandCount), sub: 'requests in flight' },
    { key: 'cycle', label: 'Avg cycle time', value: `${k.avgCycleTime}d`, sub: 'intake to close' },
    { key: 'compliance', label: 'Compliance', value: `${k.complianceRate}%`, sub: 'first-time-right' },
    { key: 'sourcing', label: 'Active sourcing', value: String(k.activeSourcing), sub: 'live events' },
  ];
}
