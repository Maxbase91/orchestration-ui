import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';
import { getUserById } from '@/data/users';
import { getStatusLabel } from '@/lib/status';
import type { ProcurementRequest } from '@/data/types';
import { cn } from '@/lib/utils';
import { getIntegrationsForRequest } from '@/data/system-integrations';
import { systemColors } from '@/data/system-integrations';

type Row = ProcurementRequest & Record<string, unknown>;

const DEUBA_LABELS: Record<string, string> = {
  'gp-led': 'GP-Led',
  'business-led': 'Business-Led',
  'direct-po': 'Direct PO',
  'framework-call-off': 'Framework',
  catalogue: 'Catalogue',
};

interface TableViewProps {
  requests: ProcurementRequest[];
}

export function TableView({ requests }: TableViewProps) {
  const navigate = useNavigate();

  const columns: Column<Row>[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      className: 'w-[120px]',
      render: (item) => (
        <span className="font-mono text-xs">{item.id}</span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (item) => (
        <span className="text-sm font-medium">{item.title}</span>
      ),
    },
    {
      key: 'requestorId',
      label: 'Requestor',
      render: (item) => {
        const user = getUserById(item.requestorId as string);
        return <span className="text-sm">{user?.name ?? '—'}</span>;
      },
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (item) => (
        <span className="text-sm capitalize">
          {getStatusLabel(item.category as string)}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      className: 'text-right',
      render: (item) => (
        <span className="text-sm font-medium">
          {formatCurrency(item.value as number, item.currency as string)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Stage',
      sortable: true,
      render: (item) => <StatusBadge status={item.status as string} size="sm" />,
    },
    {
      key: 'ownerId',
      label: 'Owner',
      render: (item) => {
        const user = getUserById(item.ownerId as string);
        return <span className="text-sm">{user?.name ?? '—'}</span>;
      },
    },
    {
      key: 'systemIntegration',
      label: 'System',
      render: (item) => {
        const integrations = getIntegrationsForRequest(item.id);
        const active = integrations.find((i) => i.status !== 'completed');
        if (!active) return <span className="text-sm text-muted-foreground">—</span>;
        const colors = systemColors[active.system];
        return (
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', colors)}>
            <span className="size-1.5 rounded-full bg-current" />
            {active.systemLabel}
          </span>
        );
      },
    },
    {
      key: 'daysInStage',
      label: 'Days in Stage',
      sortable: true,
      className: 'text-center',
      render: (item) => {
        const days = item.daysInStage as number;
        return (
          <span
            className={cn(
              'text-sm font-medium',
              days > 10
                ? 'text-red-600'
                : days > 5
                  ? 'text-amber-600'
                  : 'text-gray-600',
            )}
          >
            {days}d
          </span>
        );
      },
    },
    {
      key: 'isOverdue',
      label: 'SLA Status',
      render: (item) => {
        const overdue = item.isOverdue as boolean;
        const days = item.daysInStage as number;
        if (overdue) {
          return (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Overdue
            </span>
          );
        }
        if (days >= 4) {
          return (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              At Risk
            </span>
          );
        }
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            On Track
          </span>
        );
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (item) => (
        <span className="text-xs capitalize font-medium">{item.priority as string}</span>
      ),
    },
    {
      key: 'deuba',
      label: 'DEUBA',
      render: (item) => (
        <span className="text-xs">
          {DEUBA_LABELS[item.deuba as string] ?? (item.deuba as string)}
        </span>
      ),
    },
  ];

  const data = requests as Row[];

  return (
    <DataTable<Row>
      columns={columns}
      data={data}
      searchable
      searchPlaceholder="Search requests..."
      onRowClick={(item) => navigate(`/requests/${item.id}`)}
    />
  );
}
