import { useState } from 'react';
import type { ProcurementRequest } from '@/data/types';
import { Button } from '@/components/ui/button';
import {
  useAddRequestSupplierCandidate,
  useRemoveRequestSupplierCandidate,
  useRequestSupplierCandidates,
} from '@/lib/db/hooks/use-request-supplier-candidates';
import { useSupplierLookup, useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContractLookup, useContracts } from '@/lib/db/hooks/use-contracts';
import { useRequestLookup, useRequests } from '@/lib/db/hooks/use-requests';
import { StatusBadge } from '@/components/shared/status-badge';
import { useSourcingEventsForRequest } from '@/lib/db/hooks/use-sourcing-events';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency, formatDate } from '@/lib/format';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface TabRelatedProps {
  request: ProcurementRequest;
}

export function TabRelated({ request }: TabRelatedProps) {
  const currentRole = useAuthStore((state) => state.currentRole);
  const canOpenPurchaseOrders = ['procurement-manager', 'operations-lead', 'admin'].includes(currentRole);
  useSuppliers();
  useContracts();
  useRequests();
  const lookupSupplier = useSupplierLookup();
  const { byId: lookupContract, bySupplier: contractsBySupplier } = useContractLookup();
  const { bySupplier: requestsBySupplier } = useRequestLookup();
  const { data: sourcingEvents = [] } = useSourcingEventsForRequest(request.id);
  const { data: shortlist = [] } = useRequestSupplierCandidates(request.id);
  const addCandidate = useAddRequestSupplierCandidate(request.id);
  const removeCandidate = useRemoveRequestSupplierCandidate(request.id);
  const allSuppliers = useSuppliers().data ?? [];
  const [adding, setAdding] = useState('');
  // The named supplier is already shown above; the shortlist is everyone else
  // who goes to sourcing.
  const shortlisted = shortlist.filter((candidate) => candidate.supplierId !== request.supplierId);
  const addable = allSuppliers.filter((supplierRow) =>
    supplierRow.id !== request.supplierId
    && !shortlist.some((candidate) => candidate.supplierId === supplierRow.id));
  const eventPublished = sourcingEvents.some((event) => event.status !== 'draft');
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
      {/* The shortlist that goes to sourcing. Editable after submission because
          category management routinely adds suppliers the requester did not
          know about — fixing it at intake meant re-keying them into the event. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suppliers for sourcing ({shortlisted.length + (supplier ? 1 : 0)})</CardTitle>
          <p className="text-xs text-muted-foreground">
            {eventPublished
              ? 'A sourcing event has already been published — invitations are managed on the event.'
              : 'Everyone here is invited when a sourcing event is created from this request.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {supplier && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{supplier.name}</span>
              <span className="text-xs text-muted-foreground">Named on the request</span>
            </div>
          )}
          {shortlisted.map((candidate) => {
            const candidateSupplier = lookupSupplier(candidate.supplierId);
            return (
              <div key={candidate.supplierId} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">{candidateSupplier?.name ?? candidate.supplierId}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={eventPublished || removeCandidate.isPending}
                  onClick={() => removeCandidate.mutate(candidate.supplierId)}
                >
                  Remove
                </Button>
              </div>
            );
          })}
          {!supplier && shortlisted.length === 0 && (
            <p className="text-sm text-muted-foreground">No suppliers shortlisted yet.</p>
          )}
          {!eventPublished && addable.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <select
                className="h-9 flex-1 rounded-md border px-2 text-sm"
                value={adding}
                onChange={(event) => setAdding(event.target.value)}
                aria-label="Add a supplier to the shortlist"
              >
                <option value="">Add a supplier…</option>
                {addable.map((supplierRow) => (
                  <option key={supplierRow.id} value={supplierRow.id}>{supplierRow.name}</option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!adding || addCandidate.isPending}
                onClick={() => { addCandidate.mutate(adding); setAdding(''); }}
              >
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
                  {/* Deep-linked, not just named. This tab described the linked
                      contract and PO without offering a way to open either;
                      the only place a requester could actually follow them was
                      the separate Simple detail page, now removed. */}
                  <Link to={`/contracts/${contract.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                    {contract.title}
                  </Link>
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
                {/* Purchase orders stay role-gated: the entitlement came with
                    the deep link from the removed Simple detail page and is not
                    lost with it. */}
                {canOpenPurchaseOrders ? (
                  <Link to={`/purchasing/orders/${request.poId}`} className="text-sm font-medium text-blue-600 hover:underline">
                    {request.poId}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-gray-900">{request.poId}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(request.value, request.currency)}
                  {!canOpenPurchaseOrders && ' · Purchase order details are available to operations.'}
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
