import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { purchaseOrders } from '@/data/purchase-orders';
import { formatCurrency, formatDate } from '@/lib/format';
import type { PurchaseOrder } from '@/data/types';

const columns: Column<PurchaseOrder & Record<string, unknown>>[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'supplierName', label: 'Supplier', sortable: true },
  {
    key: 'value',
    label: 'Value',
    sortable: true,
    render: (item) => formatCurrency(item.value as number),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (item) => <StatusBadge status={item.status as string} />,
  },
  {
    key: 'createdAt',
    label: 'Created',
    sortable: true,
    render: (item) => formatDate(item.createdAt as string),
  },
  {
    key: 'deliveryDate',
    label: 'Delivery Date',
    sortable: true,
    render: (item) => formatDate(item.deliveryDate as string),
  },
];

export function POListPage() {
  const navigate = useNavigate();
  const tableData = purchaseOrders.map((po) => ({ ...po } as PurchaseOrder & Record<string, unknown>));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${purchaseOrders.length} orders`}
      />

      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={(item) => navigate(`/purchasing/orders/${item.id}`)}
        searchable
        searchPlaceholder="Search purchase orders..."
        emptyMessage="No purchase orders found."
      />
    </div>
  );
}
