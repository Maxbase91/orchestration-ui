import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { GoodsReceiptForm } from '@/features/purchasing/components/goods-receipt-form';
import { usePurchaseOrders } from '@/lib/db/hooks/use-purchase-orders';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { PurchaseOrder } from '@/data/types';

interface PORow extends Record<string, unknown> {
  id: string;
  supplierName: string;
  value: number;
  status: string;
  deliveryDate: string;
  itemsPending: number;
  po: PurchaseOrder;
}

const RECEIVABLE_STATUSES = ['submitted', 'acknowledged', 'partially-received'];

export function GoodsReceiptPage() {
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const { data: purchaseOrders = [] } = usePurchaseOrders();

  const rows = useMemo<PORow[]>(() => {
    return purchaseOrders
      .filter((po) => RECEIVABLE_STATUSES.includes(po.status))
      .map((po) => {
        const itemsPending = po.lineItems.reduce((count, li) => {
          return count + (li.quantity - li.received > 0 ? 1 : 0);
        }, 0);
        return {
          id: po.id,
          supplierName: po.supplierName,
          value: po.value,
          status: po.status,
          deliveryDate: po.deliveryDate,
          itemsPending,
          po,
        };
      });
  }, [purchaseOrders]);

  const columns: Column<PORow>[] = [
    {
      key: 'id',
      label: 'PO ID',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.id as string}</span>,
    },
    {
      key: 'supplierName',
      label: 'Supplier',
      sortable: true,
      render: (row) => <span className="text-sm font-medium">{row.supplierName as string}</span>,
    },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      render: (row) => <span className="text-sm">{formatCurrency(row.value as number)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status as string} size="sm" />,
    },
    {
      key: 'deliveryDate',
      label: 'Delivery Date',
      sortable: true,
      render: (row) => <span className="text-sm">{formatDate(row.deliveryDate as string)}</span>,
    },
    {
      key: 'itemsPending',
      label: 'Items Pending',
      render: (row) => {
        const pending = row.itemsPending as number;
        return (
          <span className={pending > 0 ? 'text-sm font-semibold text-amber-600' : 'text-sm text-green-600'}>
            {pending > 0 ? `${pending} pending` : 'All received'}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receipt"
        subtitle="Record receipt of goods and services against purchase orders"
      />

      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => setSelectedPO(row.po as PurchaseOrder)}
        searchable
        searchPlaceholder="Search purchase orders..."
        emptyMessage="No purchase orders awaiting receipt."
      />

      {selectedPO && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Goods Receipt for {selectedPO.id} - {selectedPO.supplierName}
            </h3>
            <button
              className="text-xs text-muted-foreground hover:text-gray-700"
              onClick={() => setSelectedPO(null)}
            >
              Close
            </button>
          </div>
          <GoodsReceiptForm
            lineItems={selectedPO.lineItems}
            onConfirm={(quantities) => {
              const allReceived = quantities.every((q, i) => q >= selectedPO.lineItems[i].quantity);
              toast.success(
                allReceived
                  ? `Full receipt confirmed for ${selectedPO.id}`
                  : `Partial receipt recorded for ${selectedPO.id}`
              );
              setSelectedPO(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
