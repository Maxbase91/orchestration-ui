import { useNavigate } from 'react-router-dom';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIndicator } from '@/components/shared/priority-indicator';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
const CATEGORY_LABELS: Record<string, string> = {
  goods: 'Goods',
  services: 'Services',
  software: 'Software',
  consulting: 'Consulting',
  'contingent-labour': 'Contingent Labour',
  'contract-renewal': 'Contract Renewal',
  'supplier-onboarding': 'Supplier Onboarding',
};

interface RequestListPageProps {
  title: string;
  filterMine?: boolean;
}

export function RequestListPage({ title, filterMine = false }: RequestListPageProps) {
  const navigate = useNavigate();
  useUsers();
  const lookupUser = useUserLookup();
  const { data: requests = [], isLoading: loading } = useRequests();

  // For "My Requests" we show a subset; for demo we just show all
  const displayRequests = filterMine
    ? requests.filter((r) => r.ownerId === 'u1' || r.requestorId === 'u1')
    : requests;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      {loading && (
        <p className="text-sm text-muted-foreground">Loading requests...</p>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-[130px]">Category</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[110px] text-right">Value</TableHead>
                <TableHead className="w-[140px]">Owner</TableHead>
                <TableHead className="w-[80px] text-center">Days</TableHead>
                <TableHead className="w-[70px] text-center">Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRequests.map((req) => {
                const owner = lookupUser(req.ownerId);
                return (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/requests/${req.id}`)}
                  >
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {req.id}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-900 max-w-[300px] truncate">
                      {req.title}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[req.category] ?? req.category}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={req.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {formatCurrency(req.value, req.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {owner?.name ?? '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-medium ${req.isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                        {req.daysInStage}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <PriorityIndicator priority={req.priority} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
