import { useState } from 'react';
import type { ProcurementRequest } from '@/data/types';
import { useStageHistoryByRequest } from '@/lib/db/hooks/use-stage-history';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
// format used directly via date-fns below
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download } from 'lucide-react';
import { getStatusLabel } from '@/lib/status';
import { format, parseISO } from 'date-fns';

interface TabAuditProps {
  request: ProcurementRequest;
}

export function TabAudit({ request }: TabAuditProps) {
  useUsers();
  const lookupUser = useUserLookup();
  const { data: history = [] } = useStageHistoryByRequest(request.id);
  const [actionFilter, setActionFilter] = useState<string>('all');

  const auditEntries = history.map((entry, index) => {
    const user = lookupUser(entry.ownerId);
    return {
      id: `${entry.requestId}-${index}`,
      timestamp: entry.enteredAt,
      userName: user?.name ?? 'Unknown',
      action: entry.action ?? 'stage-entered',
      detail: `${getStatusLabel(entry.stage)}${entry.notes ? ` - ${entry.notes}` : ''}`,
    };
  });

  const uniqueActions = Array.from(new Set(auditEntries.map((e) => e.action)));

  const filtered = actionFilter === 'all'
    ? auditEntries
    : auditEntries.filter((e) => e.action === actionFilter);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Audit Log ({filtered.length} entries)</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {getStatusLabel(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Audit export ships with the reporting phase."
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[150px]">User</TableHead>
              <TableHead className="w-[120px]">Action</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {format(parseISO(entry.timestamp), 'dd MMM yyyy HH:mm')}
                </TableCell>
                <TableCell className="text-sm">{entry.userName}</TableCell>
                <TableCell>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {getStatusLabel(entry.action)}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-gray-700">{entry.detail}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  No audit entries match the selected filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
