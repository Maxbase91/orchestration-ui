import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ShoppingCart,
  ArrowRight,
  Plus,
  Minus,
  X,
  Package,
  Loader2,
  Monitor,
  Briefcase,
  Armchair,
  Shield,
  Coffee,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CatalogueItem } from '@/data/catalogue-items';
import { useCatalogueItems } from '@/lib/db/hooks/use-catalogue-items';
import { openAIChat, openAIChatWithPrompt } from '@/features/ai-assistant/ai-chat-controls';
import { formatCurrency } from '@/lib/format';
import { decideIntakeRoute } from '@/lib/procurement/intake-routing';
import { classifyDemandCategory, matchesDemandCategory } from '@/lib/procurement/classify';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { DEFAULT_CATEGORY_TAXONOMY } from '@/data/category-taxonomy';

// --- Types ---

interface CartItem {
  item: CatalogueItem;
  quantity: number;
}

interface AILink {
  label: string;
  path: string;
}

interface ProposalState {
  /**
   * `identified` names a specific catalogue item and links straight to its
   * governed checkout. It replaced dropping the requester into the full
   * catalogue grid and leaving them to find again what the matcher had already
   * found — while never navigating for them, so a wrong match costs a glance
   * rather than a wrong order.
   */
  type: 'catalogue' | 'identified' | 'action' | 'options';
  message: string;
  catalogueItems: CatalogueItem[];
  links: AILink[];
  agent?: { id?: string; name?: string; status?: string; accuracy?: number };
  /** The original wording, carried into intake when the match is rejected. */
  query?: string;
}

// --- Catalogue categories ---

const CATALOGUE_CATEGORIES = [
  { id: 'it-equipment', name: 'IT Equipment', icon: Monitor },
  { id: 'office-supplies', name: 'Office Supplies', icon: Briefcase },
  { id: 'furniture', name: 'Furniture', icon: Armchair },
  { id: 'safety-ppe', name: 'Safety & PPE', icon: Shield },
  { id: 'catering-pantry', name: 'Catering & Pantry', icon: Coffee },
  { id: 'print-stationery', name: 'Print & Stationery', icon: Printer },
];

// --- Groq API ---

interface AIResult {
  intent: string;
  message: string;
  catalogueItems?: { name: string; price: number; unit: string; id: string }[];
  links?: AILink[];
  category?: string;
  extractedTitle?: string;
  extractedSupplier?: string;
  extractedValue?: number;
  generatedDescription?: string;
  _agent?: { id?: string; name?: string; status?: string; accuracy?: number };
}

async function queryGroq(input: string): Promise<AIResult | null> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input }),
    });
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch {
    return null;
  }
}

// --- Deterministic fallback when LLM is unavailable ---

const SUPPLIER_ROUTES: Record<string, string> = {
  accenture: '/suppliers/SUP-001', sap: '/suppliers/SUP-002', deloitte: '/suppliers/SUP-003',
  kpmg: '/suppliers/SUP-004', capgemini: '/suppliers/SUP-005', aws: '/suppliers/SUP-006',
  microsoft: '/suppliers/SUP-007', siemens: '/suppliers/SUP-008', bosch: '/suppliers/SUP-009',
};

/**
 * Does the catalogue actually serve this demand?
 *
 * This used to be a private matcher in this file: strip stop words, score an
 * item on ANY word appearing anywhere in its name, description or catalogue
 * name, and return everything scoring above zero. It was checked FIRST, before
 * any intent or category reasoning, with no category gate — so
 * "I want to buy business consulting" matched **Business Cards 500** (and the
 * ThinkPad, on "business laptop" in its description) and the command bar opened
 * the catalogue. That is the reported defect, and it survived the fix to the
 * wizard's pre-check because this is a separate entry point that never called
 * the shared decision.
 *
 * It now calls `decideIntakeRoute` — the same category-gated, naming-word
 * decision the wizard's step 2 makes, benchmarked by the routing eval. One
 * decision, both doors.
 *
 * Contracts are deliberately not loaded here. The command bar decides one
 * thing: order inline from the catalogue, or hand the demand to intake. The
 * transactable-contract check belongs to the wizard's staged funnel, which has
 * the enrichment step that makes it worth running.
 */
function catalogueRoute(
  query: string,
  items: CatalogueItem[],
  eligibleCategories: string[],
  llmIntent?: string,
) {
  return decideIntakeRoute(
    {
      text: query,
      category: classifyDemandCategory(query),
      estimatedValue: 0,
      supplierId: '',
      llmIntent,
    },
    { catalogueItems: items, contracts: [], catalogueEligibleCategories: eligibleCategories },
    undefined,
    formatCurrency,
  );
}

/**
 * Openers that make a phrase a lookup rather than a demand.
 *
 * Deliberately anchored: "find a supplier" is a lookup, "we need to find a
 * cleaning supplier" is a demand that happens to contain the word.
 */
const LOOKUP_OPENERS = /^\s*(find|show|list|open|search|where|which|who|when|how many)\b/;

/** Verbs that state an intent to acquire. Not the only signal — see below. */
const DEMAND_VERBS = [
  'buy', 'buying', 'purchase', 'purchasing', 'need', 'want', 'order', 'procure',
  'hire', 'engage', 'require', 'looking for', 'source ', 'sourcing', 'contract for',
];

function localClassify(
  query: string,
  catalogueItems: CatalogueItem[],
  eligibleCategories: string[],
): AIResult {
  const q = query.toLowerCase();

  // The catalogue is offered only when the shared decision says the catalogue
  // actually serves this demand — category-gated, and on a word that NAMES what
  // is being bought rather than one that merely describes it.
  const decision = catalogueRoute(query, catalogueItems, eligibleCategories);
  if (decision.route === 'catalogue') {
    const n = decision.catalogueMatches.length;
    return { intent: 'catalogue', message: `Found ${n} matching catalogue item${n === 1 ? '' : 's'}.`, links: [] };
  }

  // An explicit lookup is a lookup, whatever it mentions. Checked first so
  // "find our cleaning services contract" does not become a demand for
  // cleaning services just because it names one.
  if (LOOKUP_OPENERS.test(q)) {
    for (const [name, path] of Object.entries(SUPPLIER_ROUTES)) {
      if (q.includes(name)) return { intent: 'navigation', message: `Opening ${name} profile.`, links: [{ label: `${name.charAt(0).toUpperCase() + name.slice(1)} Profile`, path }] };
    }
    if (/contract/.test(q)) return { intent: 'navigation', message: 'Opening contracts.', links: [{ label: 'Contracts', path: '/contracts' }] };
    if (/request/.test(q)) return { intent: 'navigation', message: 'Opening requests.', links: [{ label: 'My Requests', path: '/requests/my' }] };
    if (/supplier|vendor/.test(q)) return { intent: 'navigation', message: 'Opening supplier directory.', links: [{ label: 'Suppliers', path: '/suppliers' }] };
    if (/invoice/.test(q)) return { intent: 'navigation', message: 'Opening invoices.', links: [{ label: 'Invoices', path: '/purchasing/invoices' }] };
  }

  // A demand is a demand whether or not it has a verb in front of it.
  //
  // This used to be a hardcoded buy-verb list, which meant the most natural
  // ways of asking — "business consulting", "IT strategy consulting with
  // a named firm for 6 months", "cleaning services for the Berlin office" — were
  // not recognised and went to the chat assistant, which cannot route or
  // submit anything. Naming something procurable counts, and the category
  // rules already know what that looks like.
  if (DEMAND_VERBS.some((w) => q.includes(w)) || matchesDemandCategory(query)) {
    // One classifier. This branch used to carry its own regex cascade — a
    // fifth copy of the category decision, which could disagree with the
    // wizard about the same sentence.
    const category = classifyDemandCategory(query);

    // Keep broad classification internal. The requester confirms a specific
    // commodity/service family inside the shared intake instead of choosing a
    // Goods/Services route from this command bar.
    return {
      intent: 'new-request', message: 'I’ll help you describe and route this request.',
      category, extractedTitle: query, links: [{ label: 'Start request', path: '/requests/new' }],
    };
  }

  // Lookup — check for navigation keywords
  for (const [name, path] of Object.entries(SUPPLIER_ROUTES)) {
    if (q.includes(name)) return { intent: 'navigation', message: `Opening ${name} profile.`, links: [{ label: `${name.charAt(0).toUpperCase() + name.slice(1)} Profile`, path }] };
  }
  if (/approval/.test(q)) return { intent: 'navigation', message: 'Opening approvals.', links: [{ label: 'My Approvals', path: '/approvals' }] };
  if (/request|track|order/.test(q)) return { intent: 'navigation', message: 'Opening requests.', links: [{ label: 'My Requests', path: '/requests/my' }] };
  if (/contract/.test(q)) return { intent: 'navigation', message: 'Opening contracts.', links: [{ label: 'Contracts', path: '/contracts' }] };
  if (/invoice/.test(q)) return { intent: 'navigation', message: 'Opening invoices.', links: [{ label: 'Invoices', path: '/purchasing/invoices' }] };
  if (/spend|analytics|budget/.test(q)) return { intent: 'navigation', message: 'Opening spend dashboard.', links: [{ label: 'Spend Dashboard', path: '/analytics/spend' }] };
  if (/supplier|vendor/.test(q)) return { intent: 'navigation', message: 'Opening supplier directory.', links: [{ label: 'Suppliers', path: '/suppliers' }] };
  if (/workflow|pipeline/.test(q)) return { intent: 'navigation', message: 'Opening workflows.', links: [{ label: 'Active Workflows', path: '/workflows' }] };

  // General fallback
  return { intent: 'general', message: 'How can I help? Try describing what you need.', links: [{ label: 'Create New Request', path: '/requests/new' }, { label: 'Open AI Assistant', path: '__ai_chat__' }] };
}

// ============================================================
// COMPONENT
// ============================================================

export function SmartCommandBar() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalState | null>(null);

  const { data: catalogueItems = [] } = useCatalogueItems();
  const { data: dbCategories = [] } = useProcurementCategories();

  // Which categories the catalogue can actually fulfil — admin config
  // (`procurement_categories.catalogue_eligible`), falling back to the
  // canonical taxonomy so an empty store behaves identically. Same source the
  // wizard's pre-check reads, so both doors gate on the same setting.
  const eligibleCategories = useMemo(() => {
    const src = dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORY_TAXONOMY;
    return src.filter((c) => c.catalogueEligible).map((c) => c.id);
  }, [dbCategories]);

  // Catalogue state
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [catalogueResults, setCatalogueResults] = useState<CatalogueItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Declared before `handleSubmit`, which calls it — the reverse order relied
  // on hoisting through a memoized callback, which the compiler cannot track.
  // --- Process an AI result (from LLM or local fallback) ---
  // Plain functions, not useCallback: both are handlers, neither is an effect
  // dependency, and the manual memos could not be preserved — which made the
  // compiler skip optimizing this component to keep memos buying nothing.
  const processResult = (aiResult: AIResult, query: string) => {
    let intent = aiResult.intent ?? 'general';
    // Locals rather than mutating the argument: the catalogue branch below can
    // overrule the model, and the new-request branch has to read what it landed on.
    let message = aiResult.message;
    let category = aiResult.category;

    // Safety: buying words should never route to navigation
    // Same rule as the local classifier: a model answering "navigation" for
    // something that states an intent to acquire, or that simply names
    // something procurable, is answering the wrong question.
    if (intent === 'navigation'
      && !LOOKUP_OPENERS.test(query.toLowerCase())
      && (DEMAND_VERBS.some((w) => query.toLowerCase().includes(w)) || matchesDemandCategory(query))) {
      intent = 'new-request';
    }

    const agent = aiResult._agent;

    // CATALOGUE — but only if the catalogue genuinely serves this demand.
    //
    // The LLM's intent is honoured except that a `catalogue` intent cannot open
    // an empty or ineligible catalogue. `decideIntakeRoute` applies that guard
    // itself, so a model that answers "catalogue" to "buy business consulting"
    // is overruled here exactly as it is in the wizard, and the demand falls
    // through to intake instead of being shown unrelated items.
    if (intent === 'catalogue') {
      const decision = catalogueRoute(query, catalogueItems, eligibleCategories, 'catalogue');
      if (decision.route === 'catalogue') {
        const matched = decision.catalogueMatches.map((m) => m.item);
        setProposal({
          type: 'identified',
          message: matched.length === 1
            ? 'This looks like a catalogue item you can order today.'
            : `This looks like ${matched.length} catalogue items you can order today.`,
          catalogueItems: matched.slice(0, 3),
          links: [],
          agent,
          query,
        });
        return;
      }
      // Overruled — treat it as the demand it is, and say why the catalogue was
      // ruled out rather than silently showing a different screen.
      intent = 'new-request';
      category = category ?? classifyDemandCategory(query);
      if (decision.ruledOut.catalogue) {
        message = `${decision.ruledOut.catalogue} Let's raise this as a request.`;
      }
    }

    // NEW-REQUEST
    if (intent === 'new-request') {
      const params = new URLSearchParams();
      params.set('step', '2');
      const cat = category ?? 'goods';
      params.set('category', cat);
      if (aiResult.extractedTitle) params.set('title', aiResult.extractedTitle);
      if (aiResult.extractedSupplier) params.set('supplier', aiResult.extractedSupplier);
      if (aiResult.extractedValue) params.set('value', String(aiResult.extractedValue));
      if (aiResult.generatedDescription) params.set('description', aiResult.generatedDescription);

      setProposal({
        type: 'action',
        message: message || 'I’ll help you describe and route this request.',
        catalogueItems: [],
        links: [
          { label: 'Start request', path: `/requests/new?${params.toString()}` },
          { label: 'Browse Catalogue Instead', path: '__show_catalogue__' },
        ],
        agent,
      });
      return;
    }

    // NAVIGATION
    if (intent === 'navigation' && aiResult.links?.length) {
      setProposal({ type: 'options', message: message || 'Here is what I found:', catalogueItems: [], links: aiResult.links.slice(0, 4), agent });
      return;
    }

    // GENERAL
    setProposal({
      type: 'options',
      message: message || 'How can I help?',
      catalogueItems: [],
      links: [...(aiResult.links?.slice(0, 3) ?? []), { label: 'Create New Request', path: '/requests/new' }, { label: 'Open AI Assistant', path: '__ai_chat__' }],
      agent,
    });
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    // A demand goes into intake. It used to go into the AI chat overlay, which
    // meant "I want to buy X" — the single thing this box exists for — landed
    // in a conversation with no route, no classification and no way to submit.
    // Only lookups and open questions belong to the assistant.
    const localResult = localClassify(query, catalogueItems, eligibleCategories);
    if (localResult.intent === 'new-request') {
      navigate(`/requests/new?q=${encodeURIComponent(query)}`);
      setInput('');
      return;
    }
    if (localResult.intent !== 'catalogue') {
      openAIChatWithPrompt(query);
      setInput('');
      return;
    }

    // Catalogue query — show inline catalogue UI
    setProposal(null);
    setShowCatalogue(false);
    setLoading(true);

    try {
      const aiResult = await queryGroq(query);
      setLoading(false);
      processResult(aiResult ?? localResult, query);
    } catch {
      setLoading(false);
      processResult(localResult, query);
    }
  };

  // --- Handle link click from proposal ---
  const handleLinkClick = (path: string) => {
    if (path === '__ai_chat__') {
      openAIChat();
      setProposal(null);
      setInput('');
    } else if (path === '__show_catalogue__') {
      setProposal(null);
      setCatalogueResults([]);
      setShowCatalogue(true);
    } else {
      navigate(path);
      setProposal(null);
      setInput('');
    }
  };

  // --- Cart logic ---
  const getQty = useCallback((id: string) => quantities[id] ?? 1, [quantities]);
  const setQty = (id: string, qty: number) => setQuantities((p) => ({ ...p, [id]: Math.max(1, qty) }));

  const addToCart = (item: CatalogueItem) => {
    const qty = getQty(item.id);
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) return prev.map((c) => c.item.id === item.id ? { ...c, quantity: c.quantity + qty } : c);
      return [...prev, { item, quantity: qty }];
    });
    setQuantities((p) => ({ ...p, [item.id]: 1 }));
  };

  const removeFromCart = (id: string) => setCart((p) => p.filter((c) => c.item.id !== id));
  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.item.unitPrice, 0);

  const handleOrderNow = () => {
    if (cart.length === 0) return;
    if (cart.length > 1) {
      // The shared item-detail flow currently accepts one governed line. Do
      // not silently discard the rest of a command-bar basket; ask the user to
      // review items individually until the multi-line detail flow is wired.
      toast.error('Review one catalogue item at a time from its item page.');
      return;
    }
    const primary = cart[0].item;
    // The detail page is the single governed checkout entry point. The old
    // direct request write bypassed contract, risk, accounting and replay
    // checks, so preserve the selected item context and collect fields there.
    navigate(`/catalogue/items/${encodeURIComponent(primary.id)}`);
    setProposal(null);
    setShowCatalogue(false);
  };

  const handleBrowseCategory = (catId: string) => {
    const items = catalogueItems.filter((i) => i.catalogueId === catId);
    setCatalogueResults(items);
  };

  const handleClear = () => {
    setInput('');
    setProposal(null);
    setShowCatalogue(false);
    setCatalogueResults([]);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    // No card, no gradient strip and no centred heading: the input asks the
    // question itself. The block used to take ~170px — a titled, bordered panel
    // with the field floating in its middle — for one text box and a hint.
    // Results still get a surface, because only they are a separate object.
    <section aria-label="What do you need?">
      <div>
        {/* Flat, but not grey. Stripped of its card it read as one more search
            box — the header already has one — and requesters stopped noticing
            it was the way in. The accent edge and the sparkle say "this is the
            assistant", without the 170px panel it used to be. */}
        <form onSubmit={handleSubmit} className="relative">
          <Sparkles className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-accent" aria-hidden="true" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="What do you need?"
            placeholder="What do you need? e.g. 'buy paper', 'consulting services', 'find a supplier' — press Enter"
            className="h-12 rounded-lg border-accent-line bg-card pl-11 pr-10 text-prose shadow-[var(--shadow)] focus-visible:border-accent focus-visible:ring-accent/15"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-accent" />
            </div>
          )}
          {!loading && (input || proposal || showCatalogue) && (
            <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2">
              <X className="size-4" />
            </button>
          )}
        </form>

        {/* AI hint */}
        {!proposal && !showCatalogue && !loading && (
          <p className="mt-1.5 text-caption text-ink-3">
            Describe what you need and we&apos;ll route it — or ask a question and the{' '}
            <span className="font-medium text-accent">AI assistant</span> takes it.
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-body text-ink-3">
            <Loader2 className="size-4 animate-spin" />
            Analysing...
          </div>
        )}

        {/* ── IDENTIFIED CATALOGUE ITEM ──
            Say what was recognised, then hand over a link. Navigating for the
            requester would be faster and worse: a wrong match would land them
            in a checkout for the wrong thing. */}
        {proposal?.type === 'identified' && !showCatalogue && !loading && (
          <div className="mt-3 space-y-3 rounded-md border border-line bg-card p-4">
            <div className="flex items-start gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft mt-0.5">
                <Sparkles className="size-3 text-accent" />
              </div>
              <p className="text-sm text-ink-2">{proposal.message}</p>
            </div>
            {proposal.catalogueItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-3">
                    {formatCurrency(item.unitPrice)} / {item.unit} · {item.supplierName} · {item.leadTime}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleLinkClick(`/catalogue/items/${encodeURIComponent(item.id)}`)}>
                  Order this
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ))}
            {/* The correction, always available and never hidden behind the
                match: the original wording goes with it, so nothing is retyped. */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="text-xs font-medium text-accent-solid hover:underline"
                onClick={() => handleLinkClick(`/requests/new?q=${encodeURIComponent(proposal.query ?? '')}`)}
              >
                Not what you need? Describe it in full →
              </button>
              <button
                type="button"
                className="text-xs text-ink-3 hover:text-ink-2 hover:underline"
                onClick={() => { setProposal(null); setCatalogueResults([]); setShowCatalogue(true); }}
              >
                Browse the whole catalogue
              </button>
            </div>
          </div>
        )}

        {/* ── PROPOSAL CARD (non-catalogue) ── */}
        {proposal && proposal.type !== 'identified' && !showCatalogue && !loading && (
          <div className="mt-3 rounded-md border border-line bg-card p-4">
            <div className="rounded-lg border border-line bg-card-2 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft mt-0.5">
                  <Sparkles className="size-3 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-ink-2">{proposal.message}</p>
                  {proposal.agent?.name && proposal.agent.status === 'active' && (
                    <p className="mt-1 text-[11px] text-ink-3">
                      via {proposal.agent.name} ({proposal.agent.id}) · accuracy {proposal.agent.accuracy ?? 0}%
                    </p>
                  )}
                </div>
              </div>

              {proposal.links.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-8">
                  {proposal.links.map((link, i) => (
                    <Button
                      key={link.path + i}
                      variant={i === 0 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleLinkClick(link.path)}
                    >
                      <ArrowRight className="size-3.5" />
                      {link.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CATALOGUE VIEW ── */}
        {showCatalogue && !loading && (
          <div className="mt-3 space-y-4 rounded-md border border-line bg-card p-4">
            {/* Catalogue message */}
            {proposal && (
              <div className="flex items-start gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft mt-0.5">
                  <Sparkles className="size-3 text-accent" />
                </div>
                <p className="text-sm text-ink-2">{proposal.message}</p>
              </div>
            )}

            {/* Category tiles */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CATALOGUE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = catalogueResults.length > 0 && catalogueResults[0]?.catalogueId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleBrowseCategory(cat.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${isActive ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-line hover:bg-card-2 text-ink-2'}`}
                  >
                    <Icon className="size-5" />
                    <span className="text-[10px] font-medium leading-tight">{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Items */}
            {catalogueResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catalogueResults.slice(0, 9).map((item) => {
                  const inCart = cart.find((c) => c.item.id === item.id);
                  return (
                    <div key={item.id} className="rounded-lg border border-line bg-card p-3 space-y-2">
                      <div>
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-ink hover:text-accent hover:underline"
                          onClick={() => { navigate(`/catalogue/items/${encodeURIComponent(item.id)}`); setProposal(null); setShowCatalogue(false); }}
                        >
                          {item.name}
                          <span className="sr-only"> View item details</span>
                        </button>
                        <p className="text-xs text-ink-3 mt-0.5">{item.supplierName} &middot; {item.leadTime}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink">
                          {formatCurrency(item.unitPrice)} <span className="text-xs font-normal text-ink-3">/ {item.unit}</span>
                        </p>
                        {inCart && <Badge variant="secondary" className="text-[10px]">In cart</Badge>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setQty(item.id, getQty(item.id) - 1)} className="flex size-7 items-center justify-center rounded border border-line hover:bg-card-2"><Minus className="size-3" /></button>
                          <span className="w-7 text-center text-xs font-medium">{getQty(item.id)}</span>
                          <button type="button" onClick={() => setQty(item.id, getQty(item.id) + 1)} className="flex size-7 items-center justify-center rounded border border-line hover:bg-card-2"><Plus className="size-3" /></button>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addToCart(item)}><Plus className="size-3 mr-1" />Add</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cart */}
            {cart.length > 0 && (
              <div className="rounded-lg border border-ok-line bg-ok-soft p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="size-4 text-ok" />
                  <h4 className="text-sm font-semibold text-ok">Your Order</h4>
                  <Badge variant="secondary" className="text-[10px] bg-ok-soft text-ok">{cart.length} item{cart.length !== 1 ? 's' : ''}</Badge>
                </div>
                <div className="space-y-2">
                  {cart.map((c) => (
                    <div key={c.item.id} className="flex items-center justify-between rounded-md bg-card border border-ok-line p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-ink truncate">{c.item.name}</p>
                        <p className="text-[10px] text-ink-3">{c.quantity} x {formatCurrency(c.item.unitPrice)} = {formatCurrency(c.quantity * c.item.unitPrice)}</p>
                      </div>
                      <button type="button" onClick={() => removeFromCart(c.item.id)} className="ml-2 text-ink-3 hover:text-stop"><X className="size-3.5" /></button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-ok-line pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ok">Total</span>
                  <span className="text-sm font-bold text-ok">{formatCurrency(cartTotal)}</span>
                </div>
                <Button className="w-full bg-ok hover:bg-ok text-paper" onClick={handleOrderNow}>
                  <Package className="size-4 mr-1.5" />Review order
                </Button>
                <p className="text-[11px] text-ok text-center">Pre-approved catalogue items. Estimated delivery: 2-3 business days.</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-3 pt-1">
                <Button variant="link" size="sm" className="text-xs text-ink-3 px-0" onClick={() => { navigate('/requests/new'); handleClear(); }}>
                  Not in the catalogue? Create a procurement request <ArrowRight className="size-3 ml-1" />
                </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
