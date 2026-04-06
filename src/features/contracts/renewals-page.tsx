import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { contracts } from '@/data/contracts';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, parseISO } from 'date-fns';

type TabFilter = 'all' | 'expiring' | 'expired';

interface ContractRow extends Record<string, unknown> {
  id: string;
  title: string;
  supplierName: string;
  value: number;
  endDate: string;
  daysUntilExpiry: number;
  status: string;
}

const today = new Date();

export function RenewalsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const rows = useMemo<ContractRow[]>(() => {
    return contracts.map((c) => {
      const endDate = parseISO(c.endDate);
      const daysUntilExpiry = differenceInDays(endDate, today);
      return {
        id: c.id,
        title: c.title,
        supplierName: c.supplierName,
        value: c.value,
        endDate: c.endDate,
        daysUntilExpiry,
        status: c.status,
      };
    });
  }, []);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'expiring':
        return rows.filter((r) => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 90);
      case 'expired':
        return rows.filter((r) => r.daysUntilExpiry <= 0);
      default:
        return rows;
    }
  }, [rows, activeTab]);

  const expiring30 = rows.filter((r) => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 30).length;
  const expiring90 = rows.filter((r) => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 90).length;
  const expired = rows.filter((r) => r.daysUntilExpiry <= 0).length;
  const renewalValue = rows
    .filter((r) => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 90)
    .reduce((sum, r) => sum + r.value, 0);

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'expiring', label: 'Expiring (<90 days)', count: expiring90 },
    { key: 'expired', label: 'Expired', count: expired },
  ];

  const columns: Column<ContractRow>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (row) => <span className="text-sm font-medium">{row.title as string}</span>,
    },
    {
      key: 'supplierName',
      label: 'Supplier',
      sortable: true,
    },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      render: (row) => <span className="text-sm">{formatCurrency(row.value as number)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      sortable: true,
      render: (row) => <span className="text-sm">{formatDate(row.endDate as string)}</span>,
    },
    {
      key: 'daysUntilExpiry',
      label: 'Days Until Expiry',
      sortable: true,
      render: (row) => {
        const days = row.daysUntilExpiry as number;
        return (
          <span className={cn(
            'text-sm font-semibold',
            days <= 0 ? 'text-red-700' : days <= 30 ? 'text-red-600' : days <= 90 ? 'text-amber-600' : 'text-gray-700',
          )}>
            {days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status as string} size="sm" />,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            toast.success(`Renewal initiated for ${row.title}`);
          }}
        >
          <RefreshCw className="size-3.5 mr-1" />
          Initiate Renewal
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Renewals & Expiries" subtitle="Monitor contract end dates and initiate renewals" />

      <div className="grid gap-4 sm:grid-cols-4">
        <KPICard label="Expiring <30 days" value={expiring30} trend={{ direction: 'up', percentage: 15 }} />
        <KPICard label="Expiring <90 days" value={expiring90} />
        <KPICard label="Expired" value={expired} trend={{ direction: 'up', percentage: 5 }} />
        <KPICard label="Total Renewal Value" value={renewalValue} format="currency" />
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-muted-foreground hover:text-gray-700',
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="ml-1.5 inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => navigate(`/contracts/${row.id}`)}
        searchable
        searchPlaceholder="Search contracts..."
        emptyMessage="No contracts match the current filter."
      />
    </div>
  );
}
