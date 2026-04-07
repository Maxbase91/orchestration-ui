import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';
import type { Supplier } from '@/data/types';
import { countryFlags, riskColors } from './supplier-card';

type SupplierRow = Supplier & Record<string, unknown>;

const columns: Column<SupplierRow>[] = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    render: (s) => <span className="font-medium text-gray-900">{s.name}</span>,
  },
  {
    key: 'country',
    label: 'Country',
    sortable: true,
    render: (s) => (
      <span className="text-sm">
        {countryFlags[s.countryCode as string] ?? ''} {s.country as string}
      </span>
    ),
  },
  {
    key: 'riskRating',
    label: 'Risk',
    sortable: true,
    render: (s) => {
      const risk = s.riskRating as string;
      return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskColors[risk] ?? ''}`}>
          {risk.charAt(0).toUpperCase() + risk.slice(1)}
        </span>
      );
    },
  },
  {
    key: 'activeContracts',
    label: 'Active Contracts',
    sortable: true,
    className: 'text-right',
    render: (s) => <span className="text-sm">{s.activeContracts as number}</span>,
  },
  {
    key: 'totalSpend12m',
    label: 'Spend (12M)',
    sortable: true,
    className: 'text-right',
    render: (s) => <span className="text-sm">{formatCurrency(s.totalSpend12m as number)}</span>,
  },
  {
    key: 'sraStatus',
    label: 'SRA Status',
    sortable: true,
    render: (s) => <StatusBadge status={s.sraStatus as string} size="sm" />,
  },
  {
    key: 'onboardingStatus',
    label: 'Onboarding',
    sortable: true,
    render: (s) => <StatusBadge status={s.onboardingStatus as string} size="sm" />,
  },
  {
    key: 'tier',
    label: 'Tier',
    sortable: true,
    render: (s) => <span className="text-sm">Tier {s.tier as number}</span>,
  },
  {
    key: 'performanceScore',
    label: 'Performance',
    sortable: true,
    className: 'text-right',
    render: (s) => {
      const score = s.performanceScore as number;
      return (
        <span className={`text-sm font-medium ${score >= 80 ? 'text-green-700' : score >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
          {score > 0 ? `${score}/100` : '--'}
        </span>
      );
    },
  },
];

interface SupplierTableProps {
  suppliers: Supplier[];
}

export function SupplierTable({ suppliers }: SupplierTableProps) {
  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={suppliers as SupplierRow[]}
      onRowClick={(s) => navigate(`/suppliers/${s.id as string}`)}
      emptyMessage="No suppliers match your filters."
    />
  );
}
