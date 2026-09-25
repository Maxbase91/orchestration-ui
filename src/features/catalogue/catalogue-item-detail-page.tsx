/**
 * Deep-linkable catalogue item page: what the item is, who supplies it and
 * when it arrives. Ordering happens in the basket on the Catalogue page
 * (Door 2), which this page adds to — it used to run a one-item checkout of
 * its own through the intake wizard, a second way to place the same order.
 */
import { ArrowLeft, CheckCircle2, Clock3, Loader2, ShieldCheck, ShoppingCart, Store } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useCatalogueItem } from '@/lib/db/hooks/use-catalogue-items';

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
        <h1 className="text-xl font-semibold text-ink">Catalogue item not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This item may have been removed or is no longer available.</p>
        <Button asChild variant="outline" className="mt-5"><Link to="/requests/new"><ArrowLeft className="size-4" />Back to requests</Link></Button>
      </div>
    );
  }

  const available = item.available !== false;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="size-4" />Back</Button>
        <Button asChild variant="outline" size="sm"><Link to="/catalogue">Browse the catalogue</Link></Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.catalogueName}</Badge>
                <Badge className={available ? 'gap-1 bg-ok-soft text-ok hover:bg-ok-soft' : 'gap-1 bg-warn-soft text-warn hover:bg-warn-soft'}>{available ? <><CheckCircle2 className="size-3" />Available</> : 'Unavailable'}</Badge>
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-ink">{item.name}</h1>
              <p className="mt-3 text-base leading-7 text-ink-2">{item.description}</p>
              <div className="mt-6 grid gap-4 border-t border-line-2 pt-5 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Price</p><p className="mt-1 text-lg font-semibold text-ink">€{item.unitPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}<span className="text-sm font-normal text-ink-3"> / {item.unit}</span></p></div>
                <div><p className="text-xs text-muted-foreground">Supplier</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink"><Store className="size-4 text-ink-3" />{item.supplierName}</p></div>
                <div><p className="text-xs text-muted-foreground">Estimated delivery</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink"><Clock3 className="size-4 text-ink-3" />{item.leadTime}</p></div>
              </div>
            </CardContent>
          </Card>

          {!available ? (
            <Card className="border-warn-line bg-warn-soft/60"><CardContent className="p-5"><p className="text-sm font-medium text-warn">This item cannot be ordered right now</p><p className="mt-1 text-sm text-warn">The catalogue agreement or fulfilment data needs attention. Procurement must update it before an order can be placed.</p></CardContent></Card>
          ) : (
            /* Both halves of the old Simple/Expert fork, which showed one OR
               the other. The reassurance is what the reader needs first; the
               governance context is evidence, so it sits under it, collapsed —
               available to anyone who wants it rather than to whichever density
               they happened to be in. */
            <Card className="border-ok-line bg-ok-soft/50">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" />
                  <div><p className="text-sm font-medium text-ok">Approved catalogue item</p><p className="mt-1 text-sm text-ok">This item is available from an approved supplier agreement. The order is checked against its contract and risk assessment when you place it.</p></div>
                </div>
                <details className="rounded-lg border border-ok-line bg-card/60">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-ok">Governance context</summary>
                  <div className="space-y-1.5 border-t border-ok-line px-3 py-2 text-xs text-ink-2">
                    <p><span className="font-medium text-ink">Supplier:</span> {item.supplierName} ({item.supplierId})</p>
                    <p><span className="font-medium text-ink">Catalogue:</span> {item.catalogueName}</p>
                    <p><span className="font-medium text-ink">Contract and risk:</span> Resolved and checked as part of request submission.</p>
                    <p><span className="font-medium text-ink">Routing:</span> The final approval path depends on total order value and configured policy.</p>
                  </div>
                </details>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-ink-2">Add it to your order on the Catalogue page — deliver to, charged to and anything else in the basket are placed together.</p>
            <Button type="button" className="w-full" disabled={!available} onClick={() => navigate(`/catalogue?add=${encodeURIComponent(item.id)}`)}>
              <ShoppingCart className="size-4" /> Add to order
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
