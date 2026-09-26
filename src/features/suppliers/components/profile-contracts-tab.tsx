// Contracts tab on the supplier profile: all contracts for the supplier, with
// a renewal warning banner for those inside the 90-day window.
import { AlertTriangle } from 'lucide-react';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { useContractLookup, useContracts } from '@/lib/db/hooks/use-contracts';
import type { Contract } from '@/data/types';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';

type ContractRow = Contract & Record<string, unknown>;

const columns: Column<ContractRow>[] = [
  {
    key: 'title',
    label: 'Title',
    sortable: true,
    render: (c) => <span className="font-medium text-ink">{c.title as string}</span>,
  },
  {
    key: 'value',
    label: 'Value',
    sortable: true,
    className: 'text-right',
    render: (c) => <span className="text-sm">{formatCurrency(c.value as number)}</span>,
  },
  {
    key: 'startDate',
    label: 'Start Date',
    sortable: true,
    render: (c) => <span className="text-sm">{formatDate(c.startDate as string)}</span>,
  },
  {
    key: 'endDate',
    label: 'End Date',
    sortable: true,
    render: (c) => <span className="text-sm">{formatDate(c.endDate as string)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (c) => <StatusBadge status={c.status as string} size="sm" />,
  },
  {
    key: 'utilisationPercentage',
    label: 'Utilisation',
    sortable: true,
    className: 'text-right',
    render: (c) => <span className="text-sm">{c.utilisationPercentage as number}%</span>,
  },
];

interface ProfileContractsTabProps {
  supplierId: string;
}

export function ProfileContractsTab({ supplierId }: ProfileContractsTabProps) {
  useContracts();
  const { bySupplier } = useContractLookup();
  const contracts = bySupplier(supplierId);

  const { contractExpiryBufferDays: renewalWindowDays } = usePolicyConfig();

  // Banner scope: the contracts in their renewal window — the live status, read
  // from the end date against the governed window. It used to count its own
  // 90 days.
  const expiringContracts = contracts.filter((c) => c.status === 'expiring');

  return (
    <div className="space-y-4">
      {expiringContracts.length > 0 && (
        <div className="rounded-md border-l-2 border-warn-line bg-warn-soft p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warn" />
            <span className="text-sm font-medium text-warn">
              {expiringContracts.length === 1 ? 'One contract ends' : `${expiringContracts.length} contracts end`} within the {renewalWindowDays}-day renewal window
            </span>
          </div>
          <ul className="mt-1 pl-6 text-xs text-warn">
            {expiringContracts.map((c) => (
              <li key={c.id}>
                {c.title} - expires {formatDate(c.endDate)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DataTable
        columns={columns}
        data={contracts as ContractRow[]}
        emptyMessage="No contracts found for this supplier."
      />
    </div>
  );
}
