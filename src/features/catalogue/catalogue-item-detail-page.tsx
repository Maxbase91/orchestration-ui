/**
 * Deep-linkable catalogue item page. It is the product-details boundary
 * between search results and the governed request/PR checkout.
 */
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Loader2, ShieldCheck, Store } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useCatalogueItem } from '@/lib/db/hooks/use-catalogue-items';
import { CatalogueOrderCheckout, type CatalogueOrderDraft } from './catalogue-order-checkout';

export function CatalogueItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: item, isLoading, isError } = useCatalogueItem(id);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Loading catalogue item…</div>;
  }

  if (isError || !item) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Catalogue item not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This item may have been removed or is no longer available.</p>
        <Button asChild variant="outline" className="mt-5"><Link to="/requests/new"><ArrowLeft className="size-4" />Back to requests</Link></Button>
      </div>
    );
  }

  const continueToRequest = (draft: CatalogueOrderDraft) => {
    const params = new URLSearchParams({
      catalogueItem: draft.itemId,
      quantity: String(draft.quantity),
      needBy: draft.needBy,
      deliveryLocation: draft.deliveryLocation,
      recipient: draft.recipient,
      purpose: draft.businessPurpose,
      costCentre: draft.costCentre,
    });
    navigate(`/requests/new?${params.toString()}`);
  };
  const available = item.available !== false;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="size-4" />Back</Button>
        <Button asChild variant="outline" size="sm"><Link to="/requests/new">Browse catalogue<ExternalLink className="size-3.5" /></Link></Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.catalogueName}</Badge>
                <Badge className={available ? 'gap-1 bg-green-100 text-green-800 hover:bg-green-100' : 'gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100'}>{available ? <><CheckCircle2 className="size-3" />Available</> : 'Unavailable'}</Badge>
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-gray-950">{item.name}</h1>
              <p className="mt-3 text-base leading-7 text-gray-600">{item.description}</p>
              <div className="mt-6 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Price</p><p className="mt-1 text-lg font-semibold text-gray-950">€{item.unitPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}<span className="text-sm font-normal text-gray-500"> / {item.unit}</span></p></div>
                <div><p className="text-xs text-muted-foreground">Supplier</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-gray-900"><Store className="size-4 text-gray-400" />{item.supplierName}</p></div>
                <div><p className="text-xs text-muted-foreground">Estimated delivery</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-gray-900"><Clock3 className="size-4 text-gray-400" />{item.leadTime}</p></div>
              </div>
            </CardContent>
          </Card>

          {!available ? (
            <Card className="border-amber-200 bg-amber-50/60"><CardContent className="p-5"><p className="text-sm font-medium text-amber-950">This item cannot be ordered right now</p><p className="mt-1 text-sm text-amber-800">The catalogue agreement or fulfilment data needs attention. Procurement must update it before an order can be placed.</p></CardContent></Card>
          ) : (
            /* Both halves of the old Simple/Expert fork, which showed one OR
               the other. The reassurance is what the reader needs first; the
               governance context is evidence, so it sits under it, collapsed —
               available to anyone who wants it rather than to whichever density
               they happened to be in. */
            <Card className="border-green-100 bg-green-50/50">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-green-700" />
                  <div><p className="text-sm font-medium text-green-950">Approved catalogue item</p><p className="mt-1 text-sm text-green-800">This item is available from an approved supplier agreement. We’ll check the remaining order details before creating your request.</p></div>
                </div>
                <details className="rounded-lg border border-green-200 bg-white/60">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-green-900">Governance context</summary>
                  <div className="space-y-1.5 border-t border-green-200 px-3 py-2 text-xs text-gray-600">
                    <p><span className="font-medium text-gray-900">Supplier:</span> {item.supplierName} ({item.supplierId})</p>
                    <p><span className="font-medium text-gray-900">Catalogue:</span> {item.catalogueName}</p>
                    <p><span className="font-medium text-gray-900">Contract and risk:</span> Resolved and checked as part of request submission.</p>
                    <p><span className="font-medium text-gray-900">Routing:</span> The final approval path depends on total order value and configured policy.</p>
                  </div>
                </details>
              </CardContent>
            </Card>
          )}
        </div>

        <CatalogueOrderCheckout item={item} disabled={!available} onSubmit={continueToRequest} />
      </div>
    </div>
  );
}
