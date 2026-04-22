import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useApprovals } from '@/lib/db/hooks/use-approvals';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TaskRow extends Record<string, unknown> {
  id: string;
  title: string;
  type: 'Approval' | 'Review' | 'Action';
  requestId: string;
  assignedTo: string;
  assignedToId: string;
  dueDate: string;
  priority: string;
  status: string;
  isOverdue: boolean;
  priorityOrder: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PriorityIndicator = ({ priority }: { priority: string }) => {
  const config: Record<string, { icon: typeof ArrowUp; color: string; label: string }> = {
    urgent: { icon: AlertCircle, color: 'text-red-600', label: 'Urgent' },
    high: { icon: ArrowUp, color: 'text-orange-600', label: 'High' },
    medium: { icon: ArrowRight, color: 'text-yellow-600', label: 'Medium' },
    low: { icon: ArrowDown, color: 'text-gray-500', label: 'Low' },
  };
  const c = config[priority] ?? config.medium;
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', c.color)}>
      <Icon className="size-3.5" />
      {c.label}
    </span>
  );
};

export function TeamTasksPage() {
  const navigate = useNavigate();
  const { data: users = [] } = useUsers();
  const { data: approvalEntries = [] } = useApprovals();
  const { data: requests = [] } = useRequests();
  const lookupUser = useUserLookup();
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const allTasks = useMemo<TaskRow[]>(() => {
    const result: TaskRow[] = [];
    const activeStatuses = ['intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment'];
    const seen = new Set<string>();

    // Active requests
    const activeRequests = requests.filter((r) => activeStatuses.includes(r.status));
    for (const r of activeRequests) {
      const owner = lookupUser(r.ownerId);
      result.push({
        id: `task-req-${r.id}`,
        title: r.title,
        type: 'Action',
        requestId: r.id,
        assignedTo: owner?.name ?? 'Unknown',
        assignedToId: r.ownerId,
        dueDate: r.deliveryDate,
        priority: r.priority,
        status: r.status,
        isOverdue: r.isOverdue,
        priorityOrder: PRIORITY_ORDER[r.priority] ?? 2,
      });
      seen.add(r.id);
    }

    // Pending approvals
    const pendingApprovals = approvalEntries.filter((a) => a.status === 'pending');
    for (const a of pendingApprovals) {
      const req = requests.find((r) => r.id === a.requestId);
      if (!req) continue;
      const key = `${a.approverId}-${req.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: `task-apr-${a.id}`,
        title: `Approve: ${req.title}`,
        type: 'Approval',
        requestId: req.id,
        assignedTo: a.approverName,
        assignedToId: a.approverId,
        dueDate: req.deliveryDate,
        priority: req.priority,
        status: 'pending',
        isOverdue: req.isOverdue,
        priorityOrder: PRIORITY_ORDER[req.priority] ?? 2,
      });
    }

    result.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.priorityOrder - b.priorityOrder;
    });

    return result;
  }, [lookupUser, approvalEntries, requests]);

  const filteredTasks = useMemo(() => {
    if (selectedUser === 'all') return allTasks;
    return allTasks.filter((t) => t.assignedToId === selectedUser);
  }, [allTasks, selectedUser]);

  const columns: Column<TaskRow>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.isOverdue && <AlertCircle className="size-3.5 text-red-500 shrink-0" />}
          <span className={cn('text-sm font-medium', row.isOverdue && 'text-red-700')}>{row.title as string}</span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => {
        const colors: Record<string, string> = {
          Approval: 'bg-purple-100 text-purple-700',
          Review: 'bg-blue-100 text-blue-700',
          Action: 'bg-green-100 text-green-700',
        };
        return (
          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', colors[row.type as string] ?? '')}>
            {row.type as string}
          </span>
        );
      },
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      sortable: true,
      render: (row) => <span className="text-sm">{row.assignedTo as string}</span>,
    },
    {
      key: 'requestId',
      label: 'Request ID',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.requestId as string}</span>,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      sortable: true,
      render: (row) => <span className="text-sm">{formatDate(row.dueDate as string)}</span>,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => <PriorityIndicator priority={row.priority as string} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status as string} size="sm" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Tasks"
        subtitle={`${filteredTasks.length} tasks across the team`}
        actions={
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All team members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All team members</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <DataTable
        columns={columns}
        data={filteredTasks}
        onRowClick={(row) => navigate(`/requests/${row.requestId}`)}
        searchable
        searchPlaceholder="Search tasks..."
        emptyMessage="No tasks found."
      />
    </div>
  );
}
