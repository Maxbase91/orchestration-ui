import { AlertTriangle } from 'lucide-react';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { useContractLookup, useContracts } from '@/lib/db/hooks/use-contracts';
import type { Contract } from '@/data/types';

type ContractRow = Contract & Record<string, unknown>;

const columns: Column<ContractRow>[] = [
  {
    key: 'title',
    label: 'Title',
    sortable: true,
    render: (c) => <span className="font-medium text-gray-900">{c.title as string}</span>,
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

  const expiringContracts = contracts.filter((c) => {
    if (c.status !== 'active' && c.status !== 'expiring') return false;
    const endDate = new Date(c.endDate);
    const daysUntilEnd = (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilEnd < 90 && daysUntilEnd > 0;
  });

  return (
    <div className="space-y-4">
      {expiringContracts.length > 0 && (
        <div className="rounded-md border-l-2 border-amber-400 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {expiringContracts.length} contract(s) expiring within 90 days
            </span>
          </div>
          <ul className="mt-1 pl-6 text-xs text-amber-700">
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
