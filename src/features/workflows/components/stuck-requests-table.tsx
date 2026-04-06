import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { getUserById } from '@/data/users';
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

const SLA_DAYS = 5;

interface StuckRequestsTableProps {
  requests: ProcurementRequest[];
}

export function StuckRequestsTable({ requests }: StuckRequestsTableProps) {
  const stuckRequests = requests
    .filter((r) => r.daysInStage > SLA_DAYS)
    .sort((a, b) => b.daysInStage - a.daysInStage);

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
          Requests exceeding {SLA_DAYS}-day SLA threshold, sorted by days in
          stage
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
            const owner = getUserById(req.ownerId);
            const daysOverdue = req.daysInStage - SLA_DAYS;

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
                    {req.daysInStage}
                  </span>
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {SLA_DAYS}
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
