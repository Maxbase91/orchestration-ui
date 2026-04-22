import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useAuthStore } from '@/stores/auth-store';
import { requests } from '@/data/requests';
import { useApprovals } from '@/lib/db/hooks/use-approvals';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

interface TaskRow extends Record<string, unknown> {
  id: string;
  title: string;
  type: 'Approval' | 'Review' | 'Action';
  requestId: string;
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

export function MyTasksPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { data: approvalEntries = [] } = useApprovals();

  const tasks = useMemo<TaskRow[]>(() => {
    const result: TaskRow[] = [];

    // Requests owned by current user in active stages
    const activeStatuses = ['intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment'];
    const ownedRequests = requests.filter(
      (r) => r.ownerId === currentUser.id && activeStatuses.includes(r.status)
    );
    for (const r of ownedRequests) {
      result.push({
        id: `task-req-${r.id}`,
        title: r.title,
        type: 'Action',
        requestId: r.id,
        dueDate: r.deliveryDate,
        priority: r.priority,
        status: r.status,
        isOverdue: r.isOverdue,
        priorityOrder: PRIORITY_ORDER[r.priority] ?? 2,
      });
    }

    // Pending approvals assigned to current user
    const pendingApprovals = approvalEntries.filter(
      (a) => a.approverId === currentUser.id && a.status === 'pending'
    );
    for (const a of pendingApprovals) {
      const req = requests.find((r) => r.id === a.requestId);
      if (!req) continue;
      // Avoid duplicates if already in owned list
      if (result.some((t) => t.requestId === req.id && t.type === 'Approval')) continue;
      result.push({
        id: `task-apr-${a.id}`,
        title: `Approve: ${req.title}`,
        type: 'Approval',
        requestId: req.id,
        dueDate: req.deliveryDate,
        priority: req.priority,
        status: 'pending',
        isOverdue: req.isOverdue,
        priorityOrder: PRIORITY_ORDER[req.priority] ?? 2,
      });
    }

    // Sort: overdue first, then by priority
    result.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.priorityOrder - b.priorityOrder;
    });

    return result;
  }, [currentUser.id, approvalEntries]);

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
      <PageHeader title="My Tasks" subtitle={`${tasks.length} tasks assigned to you`} />
      <DataTable
        columns={columns}
        data={tasks}
        onRowClick={(row) => navigate(`/requests/${row.requestId}`)}
        searchable
        searchPlaceholder="Search tasks..."
        emptyMessage="No tasks assigned to you."
      />
    </div>
  );
}
