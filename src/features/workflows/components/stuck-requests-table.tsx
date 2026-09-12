// Table of requests that have overrun their stage's SLA target — "stuck" is
// defined purely by daysInStage vs. the admin-configured SLA, not a status flag.
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { formatDate } from '@/lib/format';
import type { ProcurementRequest } from '@/data/types';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Send, AlertTriangle, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { daysPastDeadline } from '@/lib/workflow/business-days';
import { stageSlaDays } from '@/lib/workflow/stage-sla';
import { useStageSlas } from '@/lib/db/hooks/use-stage-slas';

interface StuckRequestsTableProps {
  requests: ProcurementRequest[];
}

export function StuckRequestsTable({ requests }: StuckRequestsTableProps) {
  useUsers();
  const lookupUser = useUserLookup();
  const { data: stageSlas } = useStageSlas();

  // Was `daysInStage > resolveSla(...)`, which never matched: `days_in_stage`
  // is written 0 and never incremented, so this table showed its empty state
  // whatever was actually stuck. Overdue is derived from the stage deadline,
  // and the worst offender leads.
  const overdueBy = (r: ProcurementRequest) => daysPastDeadline(r.slaDeadline) ?? 0;
  const stuckRequests = requests
    .filter((r) => r.isOverdue)
    .sort((a, b) => overdueBy(b) - overdueBy(a));

  if (stuckRequests.length === 0) {
    return (
      <div className="rounded-md border bg-white p-6 text-center text-sm text-muted-foreground">
        No stuck requests at the moment.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Stuck Requests ({stuckRequests.length})
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Requests exceeding their stage SLA threshold, sorted by days in stage
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Request ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="text-center">Days in Stage</TableHead>
            <TableHead className="text-center">SLA Days</TableHead>
            <TableHead className="text-center">Days Overdue</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stuckRequests.map((req) => {
            const owner = lookupUser(req.ownerId);
            // Days past the stage deadline. `daysInStage` is not usable here —
            // it is written 0 and never incremented.
            const daysOverdue = overdueBy(req);
            const sla = stageSlaDays(stageSlas, req.status, req.workflowTemplateId) ?? '—';

            return (
              <TableRow key={req.id}>
                <TableCell className="font-mono text-xs">
                  {req.id}
                </TableCell>
                <TableCell className="text-sm font-medium max-w-[200px] truncate">
                  {req.title}
                </TableCell>
                <TableCell>
                  <StatusBadge status={req.status} size="sm" />
                </TableCell>
                <TableCell className="text-sm">
                  {owner?.name ?? '—'}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      daysOverdue > 10
                        ? 'text-red-600'
                        : 'text-amber-600',
                    )}
                  >
                    {daysOverdue}
                  </span>
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {sla}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm font-semibold text-red-600">
                    +{daysOverdue}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(req.updatedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" title="Send Reminder">
                      <Send className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Escalate">
                      <AlertTriangle className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Reassign">
                      <UserPlus className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
