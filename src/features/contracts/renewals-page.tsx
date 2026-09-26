// Renewals & expiries page: contract end-date watchlist with expiry KPIs and
// a start-renewal action per row that opens Door 1 with the demand written.
// Which contracts are expiring or expired is the live status — read from the
// end date against the renewal window (Decisioning thresholds) — the same
// reading as the register, the widget and the intake's contract check. This
// page used to apply its own 90 and 30 days, with trend arrows that were
// fixed numbers.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { renewalDemandHref } from '@/features/requests/new-request/intake-deep-link';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { daysUntilEnd } from '@/lib/procurement/contract-status';

type TabFilter = 'all' | 'expiring' | 'expired';

interface ContractRow extends Record<string, unknown> {
  id: string;
  title: string;
  supplierName: string;
  value: number;
  endDate: string;
  /** Null when the contract has no readable end date. */
  daysUntilExpiry: number | null;
  status: string;
}

export function RenewalsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const { data: contracts = [] } = useContracts();
  const { contractExpiryBufferDays: renewalWindowDays } = usePolicyConfig();

  const rows = useMemo<ContractRow[]>(() => contracts.map((c) => ({
    id: c.id,
    title: c.title,
    supplierName: c.supplierName,
    value: c.value,
    endDate: c.endDate,
    daysUntilExpiry: daysUntilEnd(c.endDate),
    status: c.status,
  })), [contracts]);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'expiring':
        return rows.filter((r) => r.status === 'expiring');
      case 'expired':
        return rows.filter((r) => r.status === 'expired');
      default:
        return rows;
    }
  }, [rows, activeTab]);

  const expiring = rows.filter((r) => r.status === 'expiring');
  const expired = rows.filter((r) => r.status === 'expired').length;
  const renewalValue = expiring.reduce((sum, r) => sum + r.value, 0);
  const windowLabel = `within ${renewalWindowDays} days`;

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'expiring', label: `Expiring (${windowLabel})`, count: expiring.length },
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
        const days = row.daysUntilExpiry as number | null;
        if (days === null) return <span className="text-sm text-ink-3">No end date</span>;
        // Coloured by the status, which applies the renewal window — not by
        // day counts of its own.
        return (
          <span className={cn(
            'text-sm font-semibold',
            row.status === 'expired' ? 'text-stop' : row.status === 'expiring' ? 'text-warn' : 'text-ink-2',
          )}>
            {days < 0 ? `ended ${Math.abs(days)}d ago` : days === 0 ? 'ends today' : `${days}d`}
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
            // Keep the row's navigate-to-detail click from firing too.
            e.stopPropagation();
            // A renewal is a demand like any other (2026-09-25): it goes
            // through Door 1, where the contract check finds this contract
            // expiring and the determination says renew. This button used to
            // show a "Renewal initiated" toast and start nothing at all.
            navigate(renewalDemandHref(row));
          }}
        >
          <RefreshCw className="size-3.5 mr-1" />
          Start renewal
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Renewals & Expiries" subtitle="Monitor contract end dates and initiate renewals" />

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard label={`Expiring ${windowLabel}`} value={expiring.length} />
        <KPICard label="Expired" value={expired} />
        <KPICard label="Value up for renewal" value={renewalValue} format="currency" />
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-ink text-ink'
                : 'border-transparent text-muted-foreground hover:text-ink-2',
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="ml-1.5 inline-flex items-center rounded-full bg-idle-soft px-1.5 py-0.5 text-xs">
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
