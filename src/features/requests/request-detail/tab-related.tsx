import type { ProcurementRequest } from '@/data/types';
import { useSupplierLookup, useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContractLookup, useContracts } from '@/lib/db/hooks/use-contracts';
import { useRequestLookup, useRequests } from '@/lib/db/hooks/use-requests';
import { StatusBadge } from '@/components/shared/status-badge';
import { useSourcingEventsForRequest } from '@/lib/db/hooks/use-sourcing-events';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface TabRelatedProps {
  request: ProcurementRequest;
}

export function TabRelated({ request }: TabRelatedProps) {
  useSuppliers();
  useContracts();
  useRequests();
  const lookupSupplier = useSupplierLookup();
  const { byId: lookupContract, bySupplier: contractsBySupplier } = useContractLookup();
  const { bySupplier: requestsBySupplier } = useRequestLookup();
  const { data: sourcingEvents = [] } = useSourcingEventsForRequest(request.id);
  const supplier = lookupSupplier(request.supplierId);
  const contract = lookupContract(request.contractId);

  // Other contracts for same supplier
  const supplierContracts = request.supplierId
    ? contractsBySupplier(request.supplierId).filter((c) => c.id !== request.contractId)
    : [];

  // Previous requests for same supplier
  const relatedRequests = requestsBySupplier(request.supplierId).filter((r) => r.id !== request.id);

  return (
    <div className="space-y-6">
      {/* Linked Contract */}
      {contract && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked Contract</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{contract.title}</p>
                  <p className="text-xs text-muted-foreground">{contract.id}</p>
                </div>
                <StatusBadge status={contract.status} size="sm" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Value</span>
                  <p className="font-medium">{formatCurrency(contract.value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Period</span>
                  <p className="font-medium">{formatDate(contract.startDate)} - {formatDate(contract.endDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Utilisation</span>
                  <p className="font-medium">{contract.utilisationPercentage}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Owner</span>
                  <p className="font-medium">{contract.ownerName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked PO */}
      {sourcingEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sourcing Events ({sourcingEvents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sourcingEvents.map((e) => (
              <Link
                key={e.id}
                to={`/sourcing/${e.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.id} &middot; {e.type}
                    {e.deadline ? ` · closes ${formatDate(e.deadline)}` : ''}
                  </p>
                </div>
                <StatusBadge status={e.status} size="sm" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {request.poId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked Purchase Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4 flex items-center gap-3">
              <ExternalLink className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-gray-900">{request.poId}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(request.value, request.currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous Requests for Same Supplier */}
      {relatedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Other Requests -{' '}
              {supplier ? (
                <Link to={`/suppliers/${supplier.id}`} className="text-blue-600 hover:underline">
                  {supplier.name}
                </Link>
              ) : (
                'Same Supplier'
              )}{' '}
              ({relatedRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relatedRequests.slice(0, 5).map((req) => (
                <Link
                  key={req.id}
                  to={`/requests/${req.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                    <p className="text-xs text-muted-foreground">{req.id} &middot; {formatCurrency(req.value)}</p>
                  </div>
                  <StatusBadge status={req.status} size="sm" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Contracts for Same Supplier */}
      {supplierContracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Other Contracts -{' '}
              {supplier && (
                <Link to={`/suppliers/${supplier.id}`} className="text-blue-600 hover:underline">
                  {supplier.name}
                </Link>
              )}{' '}
              ({supplierContracts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {supplierContracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.id} &middot; {formatCurrency(c.value)}</p>
                  </div>
                  <StatusBadge status={c.status} size="sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supplier risk/SRA/screening status lives on the Compliance tab now —
          one home for every risk signal, not split across two tabs. */}

      {!contract && !request.poId && relatedRequests.length === 0 && supplierContracts.length === 0 && sourcingEvents.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No related items found for this request.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
