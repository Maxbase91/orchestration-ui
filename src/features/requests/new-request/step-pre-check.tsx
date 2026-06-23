import { useMemo, useState } from 'react';
import { ShoppingCart, FileText, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import { useSourceData } from '@/lib/integrations';
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
  /** Carry enrichment text forward so the full SD / second contract check benefit. */
  onEnrich?: (text: string) => void;
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

/**
 * Staged-intake funnel (FD-E3-10). The check is sequential, not parallel:
 *   1. Catalogue derivation — try to fulfil from the catalogue first.
 *   2. Contract derivation — only after catalogue is ruled out and the user has
 *      added enrichment detail; we never assert a covering contract before
 *      enough is known to justify it.
 *   3. Full request — only when neither early exit fires.
 */
type Stage = 'catalogue' | 'contract';

export function StepPreCheck({
  title, category, estimatedValue, supplierId,
  onChooseCatalogue, onChooseContract, onProceedToFullRequest, onEnrich,
}: StepPreCheckProps) {
  // Reads go through the standardised source-connector layer (own store today,
  // live source later) rather than directly to the data layer.
  const { data: catalogueItems = [], isLoading: catLoading } =
    useSourceData<CatalogueItem>('catalogue-item');
  const { data: contracts = [], isLoading: conLoading } = useSourceData<Contract>('contract');
  const { data: suppliers = [] } = useSourceData<Supplier>('supplier');

  const [stage, setStage] = useState<Stage>('catalogue');
  const [enrich, setEnrich] = useState('');

  // Catalogue matches on the captured text alone (stage 1).
  const catalogueTokens = useMemo(() => tokenize(title), [title]);
  // Contract matching benefits from the enrichment the user adds in stage 1.
  const contractTokens = useMemo(() => tokenize(`${title} ${enrich}`), [title, enrich]);

  const catalogueMatches = useMemo(() => {
    if (!title) return [];
    return catalogueItems
      .map((item) => ({ item, score: matchCatalogueItem(item, catalogueTokens) }))
      .filter((r) => r.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((r) => r.item);
  }, [catalogueItems, catalogueTokens, title]);

  const contractMatches = useMemo(() => {
    // Gate: only compute (and only ever render) contracts in the contract stage.
    if (stage !== 'contract') return [];
    if (!title && !supplierId) return [];
    const out: { contract: Contract; score: number; reasons: string[] }[] = [];
    for (const c of contracts) {
      const m = matchContract(c, { tokens: contractTokens, category, estimatedValue, supplierId });
      if (m) out.push({ contract: c, ...m });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 4);
  }, [stage, contracts, contractTokens, category, estimatedValue, supplierId, title]);

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const isLoading = catLoading || conLoading;
  const hasCatalogue = catalogueMatches.length > 0;
  const hasContract = contractMatches.length > 0;

  const goToContractStage = () => {
    if (enrich.trim() && onEnrich) onEnrich(enrich.trim());
    setStage('contract');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm font-medium">Checking the catalogue…</p>
      </div>
    );
  }

  // ── Stage 1 — Catalogue derivation ───────────────────────────────────────
  if (stage === 'catalogue') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Catalogue check</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            The fastest path is an existing catalogue item. Let&apos;s see if one fits before we go
            any further.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="size-4 text-green-600" />
              Matching catalogue items
              <span className="text-[11px] font-normal text-gray-400">
                {hasCatalogue ? `${catalogueMatches.length} match${catalogueMatches.length === 1 ? '' : 'es'} found` : 'no match'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasCatalogue ? (
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
                <p className="mt-2 text-center text-xs text-gray-400">
                  Not what you need?{' '}
                  <button type="button" className="font-medium text-blue-600 hover:underline" onClick={goToContractStage}>
                    Check for a covering contract
                  </button>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No catalogue item matches your description so far.
              </p>
            )}
          </CardContent>
        </Card>

        {/* No premature contract display. When the catalogue doesn't fit, we
            ask for a little more detail before looking for a contract. */}
        {!hasCatalogue && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-900">Tell us a bit more</p>
            <p className="mt-0.5 text-xs text-gray-500">
              A short description helps us check whether an existing contract already covers this —
              before you complete a full request.
            </p>
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="e.g. ongoing managed service for the EMEA region, ~12 months, two FTE…"
              value={enrich}
              onChange={(e) => setEnrich(e.target.value)}
            />
            <Button className="mt-3" onClick={goToContractStage} disabled={!enrich.trim()}>
              Check for a covering contract
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Stage 2 — Contract derivation ────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Contract check</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            No catalogue item fit. Next we look for an active contract that can already cover this.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStage('catalogue')}>
          <ArrowLeft className="size-3.5" />
          Catalogue
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="size-4 text-blue-600" />
            Active contracts that can cover this
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

      {/* Proceed — only reachable once catalogue and contract are both ruled out. */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-700">
          {hasContract
            ? 'None of these fit? '
            : 'No catalogue item or contract covers this. '}
          You&apos;ll need a full procurement request — we&apos;ll collect a service description,
          identify suppliers, and assess risk before routing.
        </p>
        <Button variant="outline" className="mt-3" onClick={onProceedToFullRequest}>
          Proceed to full request
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
