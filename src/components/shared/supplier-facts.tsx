// The supplier, as an attribute of the request, and who is preferred for its
// category — the same block on the intake side panel and on the request.
//
// The supplier was not visible on either: the intake panel showed it only once
// one had been named, and the request's Overview showed a dash. "Currently
// unknown" is a real state — most requests that go to sourcing have no supplier
// until one is awarded — and saying so is what tells the requester the
// category's preferred suppliers will be asked.
import { Building2 } from 'lucide-react';
import { usePreferredSupplierIds } from '@/lib/db/hooks/use-category-preferred-suppliers';
import { useSupplierLookup, useSuppliers } from '@/lib/db/hooks/use-suppliers';

interface SupplierFactsProps {
  supplierId?: string | null;
  /** A name captured before it was matched to the directory. */
  supplierName?: string | null;
  category: string | undefined;
  /** Where this request stands with sourcing: shapes the line under the list. */
  sourcing?: 'will-source' | 'no-sourcing' | 'unknown';
}

export function SupplierFacts({ supplierId, supplierName, category, sourcing = 'unknown' }: SupplierFactsProps) {
  useSuppliers();
  const lookup = useSupplierLookup();
  const preferredIds = usePreferredSupplierIds(category);
  const supplier = lookup(supplierId ?? undefined);
  const name = supplier?.name ?? supplierName ?? null;
  const preferred = preferredIds.map((id) => lookup(id)?.name ?? id);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[88px_minmax(0,1fr)] items-baseline gap-2">
        <span className="text-caption text-ink-3">Supplier</span>
        {name
          ? <span className="text-body font-medium text-ink">{name}</span>
          : <span className="text-body italic text-ink-3">Currently unknown</span>}
      </div>
      <div className="rounded-md border border-line bg-card-2 px-2.5 py-2">
        <p className="flex items-center gap-1.5 text-caption text-ink-3">
          <Building2 className="size-3.5" aria-hidden="true" />
          Preferred suppliers for this category
        </p>
        {preferred.length === 0 ? (
          <p className="mt-1 text-caption text-ink-3">None set for this category.</p>
        ) : (
          <>
            <p className="mt-1 text-body text-ink">{preferred.join(', ')}</p>
            <p className="mt-0.5 text-caption text-ink-3">
              {sourcing === 'no-sourcing'
                ? 'Not needed here — this is bought without a sourcing exercise.'
                : sourcing === 'will-source'
                  ? 'All of them are invited when sourcing starts.'
                  : 'All of them are invited if this goes to sourcing.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
