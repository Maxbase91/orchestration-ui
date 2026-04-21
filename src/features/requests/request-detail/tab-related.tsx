import type { ProcurementRequest } from '@/data/types';
import { useSupplierLookup, useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContractLookup, useContracts } from '@/lib/db/hooks/use-contracts';
import { requests } from '@/data/requests';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { Link } from 'react-router-dom';
import { ExternalLink, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react';

interface TabRelatedProps {
  request: ProcurementRequest;
}

const sraIcons = {
  valid: ShieldCheck,
  expiring: ShieldAlert,
  expired: ShieldX,
  'not-assessed': ShieldQuestion,
};

const sraColors = {
  valid: 'text-green-600',
  expiring: 'text-amber-600',
  expired: 'text-red-600',
  'not-assessed': 'text-gray-400',
};

export function TabRelated({ request }: TabRelatedProps) {
  useSuppliers();
  useContracts();
  const lookupSupplier = useSupplierLookup();
  const { byId: lookupContract, bySupplier: contractsBySupplier } = useContractLookup();
  const supplier = lookupSupplier(request.supplierId);
  const contract = lookupContract(request.contractId);

  // Other contracts for same supplier
  const supplierContracts = request.supplierId
    ? contractsBySupplier(request.supplierId).filter((c) => c.id !== request.contractId)
    : [];

  // Previous requests for same supplier
  const relatedRequests = request.supplierId
    ? requests.filter((r) => r.supplierId === request.supplierId && r.id !== request.id)
    : [];

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
              Other Requests - {supplier?.name ?? 'Same Supplier'} ({relatedRequests.length})
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
              Other Contracts - {supplier?.name} ({supplierContracts.length})
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

      {/* Risk / SRA Status */}
      {supplier && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Risk Rating</span>
                <StatusBadge status={supplier.riskRating} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">SRA Status</span>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const Icon = sraIcons[supplier.sraStatus];
                    const color = sraColors[supplier.sraStatus];
                    return (
                      <>
                        <Icon className={`size-4 ${color}`} />
                        <span className={`text-sm font-medium ${color}`}>
                          {supplier.sraStatus.charAt(0).toUpperCase() + supplier.sraStatus.slice(1).replace('-', ' ')}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              {supplier.sraExpiryDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">SRA Expiry</span>
                  <span className="text-sm">{formatDate(supplier.sraExpiryDate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Screening Status</span>
                <StatusBadge status={supplier.screeningStatus} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Performance Score</span>
                <span className="text-sm font-medium">{supplier.performanceScore}/100</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!contract && !request.poId && relatedRequests.length === 0 && !supplier && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No related items found for this request.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
