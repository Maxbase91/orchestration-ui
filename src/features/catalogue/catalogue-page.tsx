// Door 2 — the catalogue: pre-approved items from agreed suppliers, added to a
// basket and ordered without a request (the Intake Prototype's second door).
//
// Everything on the page is configuration or stored data: the catalogues are
// the ones the items belong to, prices and lead times are the items', deliver
// to / charged to are Delivery locations and Cost centres (the requester's
// profile first), and the approval note reads the catalogue auto-approval
// threshold. A basket across suppliers is placed as one order per supplier,
// approved on the basket total, all or nothing (ADR-0009).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Minus, Package, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { useBasket, useCatalogueBasketStore } from '@/stores/catalogue-basket-store';
import { useCatalogueItems } from '@/lib/db/hooks/use-catalogue-items';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useProcurementProfile } from '@/lib/db/hooks/use-procurement-profile';
import { useCostCentres } from '@/lib/db/hooks/use-cost-centres';
import { useDeliveryLocations } from '@/lib/db/hooks/use-delivery-locations';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { nextRequestId } from '@/lib/db/requests';
import { planBasket, basketPayloads } from '@/lib/procurement/catalogue-basket';
import { submitGovernedBasket, type SubmitGovernedCheckoutResult } from '@/lib/procurement/submit-governed-checkout';
import { formatCurrency } from '@/lib/format';
import type { CatalogueItem } from '@/data/catalogue-items';

const selectClass = 'h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-ink';

/** What happened to a placed order, in the requester's words. */
function placedStatus(order: SubmitGovernedCheckoutResult): string {
  switch (order.requisition.status) {
    case 'po-created': return 'Ordered — purchase order raised';
    case 'pending-approval': return 'Waiting for approval';
    case 'risk-review': return 'Risk review first';
    case 'contract-amendment-required': return 'Contract needs amending first';
    default: return order.requisition.status;
  }
}

export function CataloguePage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { currentUser } = useAuthStore();
  const userId = currentUser.id;
  const lines = useBasket(userId);
  const { add, setQuantity, remove, clear } = useCatalogueBasketStore();

  const { data: items = [], isLoading, isError } = useCatalogueItems();
  const { data: suppliers = [] } = useSuppliers();
  const { data: contracts = [] } = useContracts();
  const { data: riskAssessments = [] } = useRiskAssessments();
  const { data: profile } = useProcurementProfile(userId);
  const { data: costCentres = [] } = useCostCentres();
  const { data: locations = [] } = useDeliveryLocations();
  const policy = usePolicyConfig();

  // The catalogues are the ones the items belong to — a catalogue added to the
  // store appears here without anyone listing it.
  const catalogues = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const item of items) {
      const entry = byId.get(item.catalogueId) ?? { id: item.catalogueId, name: item.catalogueName || item.catalogueId, count: 0 };
      entry.count += 1;
      byId.set(item.catalogueId, entry);
    }
    return [...byId.values()];
  }, [items]);

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const current = selected ?? catalogues[0]?.id ?? null;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // A search spans every catalogue; otherwise the chosen one is shown.
  const shown = words.length > 0
    ? items.filter((item) => words.every((w) => `${item.name} ${item.description} ${item.catalogueName}`.toLowerCase().includes(w)))
    : items.filter((item) => item.catalogueId === current);

  // `?add=ID,ID` — from Home, the assistant, an item's page or intake's
  // catalogue match: the items go into the basket once, then the link is
  // cleared so a refresh does not add them again.
  // Handled once per link: an effect can run twice for one change (React's
  // strict mode does it on purpose), and each run added the item again.
  const handledAdd = useRef<string | null>(null);
  useEffect(() => {
    const ids = params.get('add');
    if (!ids || items.length === 0 || handledAdd.current === ids) return;
    handledAdd.current = ids;
    const found = ids.split(',').map((id) => items.find((item) => item.id === id)).filter((item): item is CatalogueItem => Boolean(item));
    for (const item of found) add(userId, item.id);
    if (found[0]) setSelected(found[0].catalogueId);
    setParams({}, { replace: true });
  }, [params, items, add, userId, setParams]);

  const plan = useMemo(
    () => planBasket(lines, { items, suppliers, contracts, riskAssessments }),
    [lines, items, suppliers, contracts, riskAssessments],
  );
  const quantityOf = (itemId: string) => lines.find((line) => line.itemId === itemId)?.quantity ?? 0;

  const activeLocations = locations.filter((location) => location.active);
  const activeCentres = costCentres.filter((centre) => centre.active);
  const [deliverTo, setDeliverTo] = useState('');
  const [chargedTo, setChargedTo] = useState('');
  const [purpose, setPurpose] = useState('');
  const effectiveDeliverTo = deliverTo || profile?.defaultShipToLocationId || '';
  const effectiveChargedTo = chargedTo || profile?.costCentre || '';

  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<SubmitGovernedCheckoutResult[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  // One attempt's ids and key, kept across a retry so a double click or a
  // resubmit after a timeout places the same orders — the server's idempotency
  // is keyed on them. A changed basket is a new attempt.
  const attempt = useRef<{ signature: string; requestIds: string[]; basketKey: string } | null>(null);

  const threshold = policy.catalogueAutoApprovalThreshold;
  const ready = plan.orders.length > 0 && plan.problems.length === 0 && Boolean(purpose.trim() && effectiveDeliverTo && effectiveChargedTo);

  // No stored profile yet: the defaults the governed checkout has always used
  // for a requester without one — never an invented location.
  const orderProfile = profile ?? {
    userId, defaultCurrency: 'EUR', costCentre: effectiveChargedTo, budgetOwner: currentUser.name,
    accountType: 'expense', beneficiaryId: userId, approvedShipToLocations: [],
  };
  const orderContext = {
    requesterId: userId,
    profile: orderProfile,
    costCentre: effectiveChargedTo,
    shipToLocationId: effectiveDeliverTo,
    purpose: purpose.trim(),
    currency: 'EUR',
    activeCostCentreIds: activeCentres.map((centre) => centre.id),
    activeDeliveryLocationIds: activeLocations.map((location) => location.id),
  };
  // What will happen to each order, from the same decision the server makes —
  // not a threshold comparison alone: an order under the threshold still waits
  // for a risk review when its supplier's assessment has lapsed.
  const preview = plan.orders.length > 0
    ? basketPayloads(plan, { ...orderContext, requestIds: plan.orders.map((_, index) => `preview-${index}`), basketKey: 'preview' }, policy)
    : [];
  const needsApproval = preview.some((order) => order.decision.approvalRequired);
  const riskFirst = preview.filter((order) => order.decision.riskReviewRequired).map((order) => order.checkout.supplier.name);

  async function placeOrder() {
    setProblems([]);
    setPlacing(true);
    try {
      const signature = JSON.stringify(lines);
      if (!attempt.current || attempt.current.signature !== signature || attempt.current.requestIds.length !== plan.orders.length) {
        attempt.current = {
          signature,
          requestIds: await Promise.all(plan.orders.map(() => nextRequestId())),
          basketKey: `${userId}-${Date.now().toString(36)}`,
        };
      }
      const payloads = basketPayloads(plan, {
        ...orderContext,
        requestIds: attempt.current.requestIds,
        basketKey: attempt.current.basketKey,
      }, policy);
      const refused = [...new Set(payloads.flatMap((payload) => payload.decision.errors))];
      if (refused.length > 0) { setProblems(refused); return; }
      const result = await submitGovernedBasket(payloads.map(({ request, requestId, requisitionId, decision, checkout, lines: orderLines }) => ({
        request, requestId, requisitionId, decision, checkout, lines: orderLines,
      })));
      setPlaced(result);
      clear(userId);
      attempt.current = null;
      setPurpose('');
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    } catch (error) {
      setProblems([error instanceof Error ? error.message : 'The order could not be placed.']);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">Catalogue</h1>
          <p className="text-sm text-ink-2">Pre-approved items from agreed suppliers. Ordering here skips the request — it goes straight to an order.</p>
        </div>
        <Link to="/requests/new" className="whitespace-nowrap text-sm font-medium text-accent hover:underline">
          Can&apos;t find it? Describe what you need →
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <Input
          aria-label="Search the catalogue"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items, e.g. toner, headset, monitor"
          className="h-10 bg-card pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-3"><Loader2 className="size-5 animate-spin" /> Loading the catalogue…</div>
      ) : isError ? (
        <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn">The catalogue could not be loaded. Try again in a moment.</p>
      ) : (
        <div className="grid grid-cols-[200px_minmax(0,1fr)_320px] items-start gap-4">
          <nav aria-label="Catalogues" className="flex flex-col gap-0.5">
            {catalogues.map((catalogue) => {
              const active = words.length === 0 && catalogue.id === current;
              return (
                <button
                  key={catalogue.id}
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => { setSelected(catalogue.id); setQuery(''); }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${active ? 'bg-accent-soft font-medium text-accent' : 'text-ink-2 hover:bg-card-2'}`}
                >
                  <span>{catalogue.name}</span>
                  <span className="text-xs text-ink-3 tabular-nums">{catalogue.count}</span>
                </button>
              );
            })}
          </nav>

          <section aria-label="Items" className="grid grid-cols-2 gap-3">
            {shown.map((item) => {
              const quantity = quantityOf(item.id);
              const agreement = contracts.find((contract) => contract.id === item.contractId)?.title ?? item.supplierName;
              const orderable = item.available !== false;
              return (
                <article key={item.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">
                      <Link to={`/catalogue/items/${encodeURIComponent(item.id)}`} className="hover:underline">{item.name}</Link>
                    </h3>
                    <span className="whitespace-nowrap text-sm font-semibold text-ink tabular-nums">{formatCurrency(item.unitPrice)} / {item.unit}</span>
                  </div>
                  <span className="text-xs text-ink-3">{words.length > 0 ? `${item.catalogueName} · ` : ''}{agreement}</span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`text-xs ${orderable ? 'text-ok' : 'text-warn'}`}>{orderable ? item.leadTime : 'Not available right now'}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!orderable}
                      aria-label={quantity > 0 ? `Add another ${item.name} (${quantity} in your order)` : `Add ${item.name}`}
                      className={quantity > 0 ? 'border-ok-line bg-ok-soft text-ok hover:bg-ok-soft' : ''}
                      onClick={() => { add(userId, item.id); setPlaced(null); }}
                    >
                      {quantity > 0 ? `Added · ${quantity}` : 'Add'}
                    </Button>
                  </div>
                </article>
              );
            })}
            {shown.length === 0 && (
              <p className="col-span-2 py-10 text-center text-sm text-ink-3">
                {words.length > 0 ? `Nothing in the catalogue matches “${query.trim()}”.` : 'This catalogue has no items.'}
              </p>
            )}
          </section>

          <aside aria-label="Your order" className="overflow-hidden rounded-xl border border-line bg-card">
            <div className="flex items-baseline justify-between border-b border-line-2 px-4 py-3.5">
              <h2 className="text-sm font-semibold text-ink">Your order</h2>
              <span className="text-xs text-ink-3">{plan.orders.length === 0 && lines.length === 0 ? 'Empty' : `${lines.length} ${lines.length === 1 ? 'item' : 'items'}`}</span>
            </div>

            {placed && (
              <div className="space-y-2 border-b border-line-2 bg-ok-soft/50 px-4 py-3" role="status">
                <p className="text-sm font-semibold text-ok">{placed.length === 1 ? 'Order placed' : `${placed.length} orders placed`}</p>
                {placed.map((order) => (
                  <p key={order.requestId} className="text-xs text-ink-2">
                    <Link to={`/requests/${encodeURIComponent(order.requestId)}`} className="font-mono text-accent hover:underline">{order.requestId}</Link>
                    {' · '}{placedStatus(order)}
                  </p>
                ))}
              </div>
            )}

            {lines.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-3">Add items from the catalogue. They are ordered together, from their agreed suppliers.</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {lines.map((line) => {
                  const item = items.find((candidate) => candidate.id === line.itemId);
                  if (!item) return null;
                  return (
                    <li key={line.itemId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-ink">{item.name}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <button type="button" aria-label={`One fewer ${item.name}`} onClick={() => setQuantity(userId, item.id, line.quantity - 1)} className="flex size-6 items-center justify-center rounded border border-line text-ink-2 hover:bg-card-2"><Minus className="size-3" /></button>
                          <span className="w-6 text-center text-xs tabular-nums">{line.quantity}</span>
                          <button type="button" aria-label={`One more ${item.name}`} onClick={() => setQuantity(userId, item.id, line.quantity + 1)} className="flex size-6 items-center justify-center rounded border border-line text-ink-2 hover:bg-card-2"><Plus className="size-3" /></button>
                          <button type="button" aria-label={`Remove ${item.name}`} onClick={() => remove(userId, item.id)} className="ml-1 flex size-6 items-center justify-center rounded text-ink-3 hover:text-stop"><X className="size-3.5" /></button>
                        </div>
                      </div>
                      <span className="text-ink tabular-nums">{formatCurrency(item.unitPrice * line.quantity)}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="space-y-3 border-t border-line-2 px-4 py-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-ink-3">Total</span>
                <span className="text-xl font-bold text-ink tabular-nums">{formatCurrency(plan.total)}</span>
              </div>

              <div className="space-y-2 text-xs">
                <label className="block space-y-1">
                  <span className="text-ink-3">Deliver to</span>
                  <select aria-label="Deliver to" className={selectClass} value={effectiveDeliverTo} onChange={(e) => setDeliverTo(e.target.value)}>
                    <option value="">Choose a location…</option>
                    {activeLocations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-ink-3">Charged to{profile?.costCentre && effectiveChargedTo === profile.costCentre ? ' · your profile' : ''}</span>
                  <select aria-label="Charged to" className={selectClass} value={effectiveChargedTo} onChange={(e) => setChargedTo(e.target.value)}>
                    <option value="">Choose a cost centre…</option>
                    {activeCentres.map((centre) => <option key={centre.id} value={centre.id}>{centre.id} · {centre.label}</option>)}
                  </select>
                </label>
                {/* The governed checkout requires a business purpose; the
                    approver reads it. */}
                <label className="block space-y-1">
                  <span className="text-ink-3">What is it for?</span>
                  <Input aria-label="What is it for?" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Kitchen restock, Dublin office" className="h-8 text-xs" />
                </label>
              </div>

              {plan.orders.length > 1 && (
                <p className="text-xs leading-relaxed text-ink-2">
                  Placed as {plan.orders.length} orders — one per supplier. Approval is judged on the whole basket.
                </p>
              )}
              {preview.length > 0 && (
                <p className="text-xs leading-relaxed text-ink-3">
                  {needsApproval
                    ? `Over ${formatCurrency(threshold)}, so your manager approves before the order is sent.`
                    : riskFirst.length > 0
                      ? `No approval needed, but a supplier risk review comes first for ${riskFirst.join(', ')}.`
                      : `Up to ${formatCurrency(threshold)} goes straight to the supplier — no approval needed.`}
                </p>
              )}
              {[...plan.problems.map((problem) => `${problem.name}: ${problem.reason}`), ...problems].map((problem) => (
                <p key={problem} className="rounded-md border border-warn-line bg-warn-soft px-2.5 py-1.5 text-xs text-warn">{problem}</p>
              ))}

              <Button type="button" className="w-full" disabled={!ready || placing} onClick={() => void placeOrder()}>
                {placing ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
                Place order
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
