import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Search,
  ShoppingCart,
  ArrowRight,
  Plus,
  Minus,
  X,
  Check,
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
import { searchCatalogueItems, catalogueItems, type CatalogueItem } from '@/data/catalogue-items';
import { openAIChat } from '@/features/ai-assistant/ai-chat-overlay';
import { formatCurrency } from '@/lib/format';

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
  type: 'catalogue' | 'action' | 'options';
  message: string;
  catalogueItems: CatalogueItem[];
  links: AILink[];
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

function localClassify(query: string): AIResult {
  const q = query.toLowerCase();

  // Check catalogue items first
  const catItems = searchCatalogueItems(query);
  if (catItems.length > 0) {
    return { intent: 'catalogue', message: `Found ${catItems.length} matching catalogue items.`, links: [] };
  }

  // Buy intent — check if it's a procurement request
  const buyWords = ['buy', 'buying', 'purchase', 'purchasing', 'need', 'want', 'order', 'procure', 'hire', 'engage'];
  if (buyWords.some((w) => q.includes(w))) {
    // Determine category
    let category = 'goods';
    if (/consult|advisory|strategy|audit|transformation/.test(q)) category = 'consulting';
    else if (/service|cleaning|catering|maintenance|travel|training/.test(q)) category = 'services';
    else if (/software|saas|license|cloud|platform|app/.test(q)) category = 'software';
    else if (/temp|contractor|staff|developer|freelance|hire/.test(q)) category = 'contingent-labour';
    else if (/renew|extend|renewal/.test(q)) category = 'contract-renewal';
    else if (/onboard|new supplier|new vendor/.test(q)) category = 'supplier-onboarding';

    const labels: Record<string, string> = { goods: 'Goods', services: 'Services', software: 'Software / IT', consulting: 'Consulting', 'contingent-labour': 'Contingent Labour', 'contract-renewal': 'Contract Renewal', 'supplier-onboarding': 'Supplier Onboarding' };
    return {
      intent: 'new-request', message: `This is a ${labels[category] ?? category} request.`,
      category, extractedTitle: query, links: [{ label: `Start ${labels[category]} Request`, path: '/requests/new' }],
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

  // Catalogue state
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [catalogueResults, setCatalogueResults] = useState<CatalogueItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // --- Submit: EVERYTHING goes through Groq ---
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    setProposal(null);
    setShowCatalogue(false);
    setLoading(true);

    try {
      const aiResult = await queryGroq(query);
      setLoading(false);

      // Use LLM result, or fall back to local classifier
      const result = aiResult ?? localClassify(query);
      processResult(result, query);
    } catch {
      setLoading(false);
      // Error — fall back to deterministic local classifier
      processResult(localClassify(query), query);
    }
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Process an AI result (from LLM or local fallback) ---
  const processResult = useCallback((aiResult: AIResult, query: string) => {
    let intent = aiResult.intent ?? 'general';

    // Safety: buying words should never route to navigation
    const buyWords = ['buy', 'buying', 'purchase', 'purchasing', 'procure', 'acquire', 'engage', 'hire', 'contract for'];
    if (intent === 'navigation' && buyWords.some((w) => query.toLowerCase().includes(w))) {
      intent = 'new-request';
    }

    // CATALOGUE
    if (intent === 'catalogue') {
      const localMatches = searchCatalogueItems(query);
      if (localMatches.length > 0) setCatalogueResults(localMatches.slice(0, 9));
      setShowCatalogue(true);
      setProposal({
        type: 'catalogue',
        message: aiResult.message || 'Found matching catalogue items. Order directly — no approval needed.',
        catalogueItems: [], links: [],
      });
      return;
    }

    // NEW-REQUEST
    if (intent === 'new-request') {
      const params = new URLSearchParams();
      params.set('step', '2');
      const cat = aiResult.category ?? 'goods';
      params.set('category', cat);
      if (aiResult.extractedTitle) params.set('title', aiResult.extractedTitle);
      if (aiResult.extractedSupplier) params.set('supplier', aiResult.extractedSupplier);
      if (aiResult.extractedValue) params.set('value', String(aiResult.extractedValue));
      if (aiResult.generatedDescription) params.set('description', aiResult.generatedDescription);

      const labels: Record<string, string> = { goods: 'Goods', services: 'Services', software: 'Software / IT', consulting: 'Consulting', 'contingent-labour': 'Contingent Labour', 'contract-renewal': 'Contract Renewal', 'supplier-onboarding': 'Supplier Onboarding' };
      const catLabel = labels[cat] ?? cat;

      setProposal({
        type: 'action',
        message: aiResult.message || `This is a ${catLabel} request.`,
        catalogueItems: [],
        links: [
          { label: `Start ${catLabel} Request`, path: `/requests/new?${params.toString()}` },
          { label: 'Browse Catalogue Instead', path: '__show_catalogue__' },
        ],
      });
      return;
    }

    // NAVIGATION
    if (intent === 'navigation' && aiResult.links?.length) {
      setProposal({ type: 'options', message: aiResult.message || 'Here is what I found:', catalogueItems: [], links: aiResult.links.slice(0, 4) });
      return;
    }

    // GENERAL
    setProposal({
      type: 'options',
      message: aiResult.message || 'How can I help?',
      catalogueItems: [],
      links: [...(aiResult.links?.slice(0, 3) ?? []), { label: 'Create New Request', path: '/requests/new' }, { label: 'Open AI Assistant', path: '__ai_chat__' }],
    });
  }, []);

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
    const id = `REQ-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    toast.success(`Order submitted! ${id} \u2014 ${cart.map((c) => c.item.name).join(', ')}. Delivery: 2-3 business days.`);
    setOrderSuccess(id);
    setTimeout(() => { setCart([]); setInput(''); setShowCatalogue(false); setCatalogueResults([]); setOrderSuccess(null); setQuantities({}); setProposal(null); }, 3000);
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[#1B2A4A] via-[#2D5F8A] to-[#D4782F]" />

      <div className="p-6">
        {/* Title */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="size-5 text-[#2D5F8A]" />
          <h2 className="text-lg font-semibold text-gray-900">What do you need?</h2>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Press Enter — e.g. 'buy paper', 'consulting services', 'find Accenture'"
            className="h-12 pl-12 pr-10 text-base rounded-lg"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-[#2D5F8A]" />
            </div>
          )}
          {!loading && (input || proposal || showCatalogue) && (
            <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="size-4" />
            </button>
          )}
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" />
            Analysing...
          </div>
        )}

        {/* ── PROPOSAL CARD (non-catalogue) ── */}
        {proposal && !showCatalogue && !loading && (
          <div className="mt-6 max-w-2xl mx-auto">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 mt-0.5">
                  <Sparkles className="size-3 text-[#2D5F8A]" />
                </div>
                <p className="text-sm text-gray-700">{proposal.message}</p>
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
          <div className="mt-6 max-w-3xl mx-auto space-y-4">
            {/* Catalogue message */}
            {proposal && (
              <div className="flex items-start gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 mt-0.5">
                  <Sparkles className="size-3 text-[#2D5F8A]" />
                </div>
                <p className="text-sm text-gray-700">{proposal.message}</p>
              </div>
            )}

            {/* Order Success */}
            {orderSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-4">
                <Check className="size-5 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-800">Order {orderSuccess} submitted successfully</p>
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
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${isActive ? 'border-[#2D5F8A] bg-blue-50 text-[#2D5F8A]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'}`}
                  >
                    <Icon className="size-5" />
                    <span className="text-[10px] font-medium leading-tight">{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Items */}
            {catalogueResults.length > 0 && !orderSuccess && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catalogueResults.slice(0, 9).map((item) => {
                  const inCart = cart.find((c) => c.item.id === item.id);
                  return (
                    <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.supplierName} &middot; {item.leadTime}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.unitPrice)} <span className="text-xs font-normal text-gray-400">/ {item.unit}</span>
                        </p>
                        {inCart && <Badge variant="secondary" className="text-[10px]">In cart</Badge>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setQty(item.id, getQty(item.id) - 1)} className="flex size-7 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"><Minus className="size-3" /></button>
                          <span className="w-7 text-center text-xs font-medium">{getQty(item.id)}</span>
                          <button type="button" onClick={() => setQty(item.id, getQty(item.id) + 1)} className="flex size-7 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"><Plus className="size-3" /></button>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addToCart(item)}><Plus className="size-3 mr-1" />Add</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cart */}
            {cart.length > 0 && !orderSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="size-4 text-green-600" />
                  <h4 className="text-sm font-semibold text-green-900">Your Order</h4>
                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">{cart.length} item{cart.length !== 1 ? 's' : ''}</Badge>
                </div>
                <div className="space-y-2">
                  {cart.map((c) => (
                    <div key={c.item.id} className="flex items-center justify-between rounded-md bg-white border border-green-100 p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{c.item.name}</p>
                        <p className="text-[10px] text-gray-500">{c.quantity} x {formatCurrency(c.item.unitPrice)} = {formatCurrency(c.quantity * c.item.unitPrice)}</p>
                      </div>
                      <button type="button" onClick={() => removeFromCart(c.item.id)} className="ml-2 text-gray-400 hover:text-red-500"><X className="size-3.5" /></button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-green-200 pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-900">Total</span>
                  <span className="text-sm font-bold text-green-900">{formatCurrency(cartTotal)}</span>
                </div>
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleOrderNow}>
                  <Package className="size-4 mr-1.5" />Order Now &mdash; No approval needed
                </Button>
                <p className="text-[11px] text-green-700 text-center">Pre-approved catalogue items. Estimated delivery: 2-3 business days.</p>
              </div>
            )}

            {/* Footer */}
            {!orderSuccess && (
              <div className="flex items-center gap-3 pt-1">
                <Button variant="link" size="sm" className="text-xs text-gray-500 px-0" onClick={() => { navigate('/requests/new'); handleClear(); }}>
                  Not in the catalogue? Create a procurement request <ArrowRight className="size-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
