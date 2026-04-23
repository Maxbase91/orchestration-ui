import { useMemo } from 'react';
import { ShoppingCart, FileText, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { useCatalogueItems } from '@/lib/db/hooks/use-catalogue-items';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import type { CatalogueItem } from '@/data/catalogue-items';
import type { Contract, Supplier } from '@/data/types';

export type PreCheckOutcome = 'catalogue' | 'contract' | 'full-request';

interface StepPreCheckProps {
  title: string;
  category: string;
  estimatedValue: number;
  supplierId: string;
  onChooseCatalogue: (items: CatalogueItem[]) => void;
  onChooseContract: (contract: Contract, supplier: Supplier | undefined) => void;
  onProceedToFullRequest: () => void;
}

const STOP_WORDS = new Set([
  'i', 'a', 'an', 'the', 'of', 'for', 'to', 'we', 'us', 'our', 'my',
  'need', 'want', 'would', 'like', 'please', 'can', 'new', 'some',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ''))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function tokenMatches(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  // plural → singular fallback so "laptops" matches "laptop" in the seed
  if (token.endsWith('s') && token.length > 3 && haystack.includes(token.slice(0, -1))) return true;
  return false;
}

function matchCatalogueItem(item: CatalogueItem, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const name = item.name.toLowerCase();
  const haystack = `${item.description} ${item.catalogueName}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    // Name hits are weighted higher — matching "thinkpad" in the item name
    // is more signal than matching "engineering" in the description.
    if (tokenMatches(name, t)) score += 1.0;
    else if (tokenMatches(haystack, t)) score += 0.4;
  }
  return score / Math.max(tokens.length, 2); // at least-2 normalisation dampens 1-token queries
}

function matchContract(contract: Contract, ctx: {
  tokens: string[];
  category: string;
  estimatedValue: number;
  supplierId: string;
}): { score: number; reasons: string[] } | null {
  if (contract.status !== 'active' && contract.status !== 'expiring') return null;
  let score = 0;
  const reasons: string[] = [];
  let hasPrimarySignal = false; // supplier or category match required

  if (ctx.supplierId && contract.supplierId === ctx.supplierId) {
    score += 0.5;
    hasPrimarySignal = true;
    reasons.push(`matches selected supplier ${contract.supplierName}`);
  }

  const catLower = contract.category.toLowerCase();
  if (catLower.includes(ctx.category) && ctx.category) {
    score += 0.3;
    hasPrimarySignal = true;
    reasons.push(`contract category is ${contract.category}`);
  } else {
    let kwHits = 0;
    for (const t of ctx.tokens) {
      if (catLower.includes(t) || contract.title.toLowerCase().includes(t)) {
        kwHits += 1;
        if (!reasons.some((r) => r.includes(t))) reasons.push(`title/category keyword match: "${t}"`);
      }
    }
    score += kwHits * 0.1;
    // Two or more keyword hits count as a primary signal on their own
    if (kwHits >= 2) hasPrimarySignal = true;
  }

  // Without a primary signal (supplier / category / >=2 keywords), reject
  // early so incidental one-word overlaps don't trigger a false match.
  if (!hasPrimarySignal) return null;

  // Remaining budget heuristic: 100 - utilisation%. If contract is
  // essentially maxed out (>=95% utilised), exclude it.
  const remainingPct = Math.max(0, 100 - (contract.utilisationPercentage ?? 0));
  if (remainingPct < 5) return null;
  if (ctx.estimatedValue > 0 && contract.value > 0) {
    const remaining = contract.value * (remainingPct / 100);
    if (remaining >= ctx.estimatedValue) {
      score += 0.2;
      reasons.push(`has ~${formatCurrency(remaining)} remaining capacity`);
    }
  }

  return score >= 0.3 ? { score, reasons } : null;
}

export function StepPreCheck({
  title, category, estimatedValue, supplierId,
  onChooseCatalogue, onChooseContract, onProceedToFullRequest,
}: StepPreCheckProps) {
  const { data: catalogueItems = [], isLoading: catLoading } = useCatalogueItems();
  const { data: contracts = [], isLoading: conLoading } = useContracts();
  const { data: suppliers = [] } = useSuppliers();

  const tokens = useMemo(() => tokenize(title), [title]);

  const catalogueMatches = useMemo(() => {
    if (!title) return [];
    return catalogueItems
      .map((item) => ({ item, score: matchCatalogueItem(item, tokens) }))
      .filter((r) => r.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((r) => r.item);
  }, [catalogueItems, tokens, title]);

  const contractMatches = useMemo(() => {
    if (!title && !supplierId) return [];
    const out: { contract: Contract; score: number; reasons: string[] }[] = [];
    for (const c of contracts) {
      const m = matchContract(c, { tokens, category, estimatedValue, supplierId });
      if (m) out.push({ contract: c, ...m });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 4);
  }, [contracts, tokens, category, estimatedValue, supplierId]);

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const isLoading = catLoading || conLoading;
  const hasCatalogue = catalogueMatches.length > 0;
  const hasContract = contractMatches.length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm font-medium">Checking catalogue and contracts…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Catalogue & Contract Check</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Before starting a full request, let&apos;s see if we can fulfil this from an existing
          catalogue item or an active contract — it&apos;s faster for you and cheaper overall.
        </p>
      </div>

      {/* Catalogue matches */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingCart className="size-4 text-green-600" />
            Matching Catalogue Items
            <span className="text-[11px] font-normal text-gray-400">
              {hasCatalogue ? `${catalogueMatches.length} match${catalogueMatches.length === 1 ? '' : 'es'} found` : 'no match'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasCatalogue ? (
            <p className="text-sm text-gray-500">
              No catalogue item matches your description. You&apos;ll need to proceed with a full request.
            </p>
          ) : (
            <div className="space-y-2">
              {catalogueMatches.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.description} &middot; {item.supplierName} &middot; {item.leadTime}
                    </p>
                  </div>
                  <div className="ml-3 text-sm font-semibold text-gray-900">
                    {formatCurrency(item.unitPrice)} / {item.unit}
                  </div>
                </div>
              ))}
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white mt-3"
                onClick={() => onChooseCatalogue(catalogueMatches)}
              >
                <Check className="size-4" />
                Order from catalogue ({catalogueMatches.length} match{catalogueMatches.length === 1 ? '' : 'es'})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract matches */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="size-4 text-blue-600" />
            Active Contracts That Can Cover This
            <span className="text-[11px] font-normal text-gray-400">
              {hasContract ? `${contractMatches.length} candidate${contractMatches.length === 1 ? '' : 's'}` : 'no match'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasContract ? (
            <p className="text-sm text-gray-500">
              No active contract appears to cover this request.
            </p>
          ) : (
            <ul className="space-y-2">
              {contractMatches.map(({ contract, reasons, score }) => (
                <li
                  key={contract.id}
                  className="rounded-md border border-blue-100 bg-blue-50/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{contract.title}</p>
                      <p className="text-xs text-gray-500">
                        {contract.id} &middot; {contract.supplierName} &middot; {formatCurrency(contract.value)} &middot; {contract.utilisationPercentage}% utilised
                      </p>
                      <ul className="mt-1 pl-4 list-disc text-[11px] text-gray-500">
                        {reasons.map((r) => (<li key={r}>{r}</li>))}
                      </ul>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[11px] text-gray-400">fit {(score * 100).toFixed(0)}%</span>
                      <Button
                        size="sm"
                        onClick={() => onChooseContract(contract, supplierById.get(contract.supplierId))}
                      >
                        <ArrowRight className="size-3.5" />
                        Call-off
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Proceed */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-700">
          None of these fit? You&apos;ll need a full procurement request — we&apos;ll collect a
          service description, identify suppliers, and assess risk before routing.
        </p>
        <Button variant="outline" className="mt-3" onClick={onProceedToFullRequest}>
          Proceed to full request
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
