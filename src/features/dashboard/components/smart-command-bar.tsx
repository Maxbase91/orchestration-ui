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

type Intent = 'buy' | 'lookup' | 'policy' | 'create' | 'unknown';

// --- Structured Intent Recognition ---

function classifyIntent(input: string): Intent {
  const lower = input.toLowerCase();

  const buyWords = ['buy', 'buying', 'purchase', 'purchasing', 'order', 'ordering',
    'need', 'want', 'get', 'reorder', 'catalogue', 'catalog', 'supplies', 'shop'];
  if (buyWords.some((w) => lower.includes(w))) return 'buy';

  const lookupWords = ['find', 'search', 'where', 'show', 'check', 'view', 'open',
    'look', 'status', 'track', 'locate', 'see', 'display', 'my '];
  if (lookupWords.some((w) => lower.includes(w))) return 'lookup';

  const policyWords = ['policy', 'rule', 'process', 'how do', 'how to', 'what is',
    'explain', 'help', 'guide', 'threshold', 'limit', 'allowed', 'compliance',
    'when should', 'why', 'who approves'];
  if (policyWords.some((w) => lower.includes(w))) return 'policy';

  const createWords = ['create', 'new', 'start', 'submit', 'raise', 'initiate',
    'onboard', 'register', 'set up', 'setup'];
  if (createWords.some((w) => lower.includes(w))) return 'create';

  return 'unknown';
}

// --- Lookup entity extraction ---

const SUPPLIER_MAP: Record<string, string> = {
  accenture: '/suppliers/SUP-001',
  sap: '/suppliers/SUP-002',
  deloitte: '/suppliers/SUP-003',
  kpmg: '/suppliers/SUP-004',
  capgemini: '/suppliers/SUP-005',
  aws: '/suppliers/SUP-006',
  'amazon web services': '/suppliers/SUP-006',
  microsoft: '/suppliers/SUP-007',
  siemens: '/suppliers/SUP-008',
  bosch: '/suppliers/SUP-009',
};

function resolveLookupRoute(input: string): { path: string; label: string } | null {
  const lower = input.toLowerCase();

  // Check supplier names first
  for (const [name, path] of Object.entries(SUPPLIER_MAP)) {
    if (lower.includes(name)) return { path, label: `Opening ${name.charAt(0).toUpperCase() + name.slice(1)} profile` };
  }

  // Entity keywords
  if (lower.includes('approval')) return { path: '/approvals', label: 'Opening your approvals' };
  if (lower.includes('my request') || lower.includes('my order')) return { path: '/requests/my', label: 'Opening your requests' };
  if (lower.includes('request')) return { path: '/requests', label: 'Opening all requests' };
  if (lower.includes('contract') && lower.includes('renew')) return { path: '/contracts/renewals', label: 'Opening contract renewals' };
  if (lower.includes('contract')) return { path: '/contracts', label: 'Opening contract register' };
  if (lower.includes('invoice')) return { path: '/purchasing/invoices', label: 'Opening invoice queue' };
  if (lower.includes('purchase order') || lower.includes(' po ') || lower.includes(' pos')) return { path: '/purchasing/orders', label: 'Opening purchase orders' };
  if (lower.includes('payment')) return { path: '/purchasing/payments', label: 'Opening payment tracker' };
  if (lower.includes('spend') || lower.includes('analytics') || lower.includes('budget')) return { path: '/analytics/spend', label: 'Opening spend dashboard' };
  if (lower.includes('supplier') || lower.includes('vendor')) return { path: '/suppliers', label: 'Opening supplier directory' };
  if (lower.includes('workflow') || lower.includes('pipeline')) return { path: '/workflows', label: 'Opening active workflows' };
  if (lower.includes('bottleneck') || lower.includes('stuck')) return { path: '/workflows/bottlenecks', label: 'Opening bottlenecks' };
  if (lower.includes('task')) return { path: '/tasks', label: 'Opening your tasks' };
  if (lower.includes('notification')) return { path: '/notifications', label: 'Opening notifications' };
  if (lower.includes('sourcing') || lower.includes('rfp') || lower.includes('tender')) return { path: '/sourcing', label: 'Opening sourcing events' };
  if (lower.includes('risk') || lower.includes('compliance')) return { path: '/suppliers/risk', label: 'Opening risk & compliance' };
  if (lower.includes('report')) return { path: '/analytics/reports', label: 'Opening report builder' };

  return null;
}

// --- Create intent routing ---

function resolveCreateRoute(input: string): { path: string; label: string } {
  const lower = input.toLowerCase();

  if (lower.includes('vendor') || lower.includes('supplier') || lower.includes('onboard'))
    return { path: '/requests/new', label: 'Opening supplier onboarding request' };
  if (lower.includes('sourcing') || lower.includes('rfp') || lower.includes('rfq') || lower.includes('tender') || lower.includes('event'))
    return { path: '/sourcing/new', label: 'Opening new sourcing event' };
  if (lower.includes('contract'))
    return { path: '/requests/new', label: 'Opening new contract request' };
  return { path: '/requests/new', label: 'Opening new request form' };
}

// --- Catalogue categories for browsing ---

const CATALOGUE_CATEGORIES = [
  { id: 'it-equipment', name: 'IT Equipment', icon: Monitor },
  { id: 'office-supplies', name: 'Office Supplies', icon: Briefcase },
  { id: 'furniture', name: 'Furniture', icon: Armchair },
  { id: 'safety-ppe', name: 'Safety & PPE', icon: Shield },
  { id: 'catering-pantry', name: 'Catering & Pantry', icon: Coffee },
  { id: 'print-stationery', name: 'Print & Stationery', icon: Printer },
];

// --- Groq API fallback for unknown intent ---

interface AIResult {
  intent: string;
  message: string;
  catalogueItems: { name: string; price: number; unit: string; id: string }[];
  links: { label: string; path: string }[];
}

async function queryGroq(input: string): Promise<AIResult | null> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input }),
    });
    if (!response.ok) throw new Error('API error');
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================================
// COMPONENT
// ============================================================

export function SmartCommandBar() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Buy intent state
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [catalogueResults, setCatalogueResults] = useState<CatalogueItem[]>([]);
  const [catalogueMessage, setCatalogueMessage] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // --- Submit handler (ONLY fires on Enter) ---
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    const intent = classifyIntent(query);

    switch (intent) {
      case 'buy': {
        const matched = searchCatalogueItems(query);
        if (matched.length > 0) {
          // Show catalogue items inline
          setCatalogueResults(matched.slice(0, 9));
          setCatalogueMessage(`Found ${matched.length} item${matched.length !== 1 ? 's' : ''} matching "${query}" — order directly, no approval needed.`);
          setShowCatalogue(true);
        } else {
          // No catalogue match — show categories + offer new request
          setCatalogueResults([]);
          setCatalogueMessage(`No exact catalogue match for "${query}". Browse a catalogue below, or create a procurement request.`);
          setShowCatalogue(true);
        }
        return;
      }

      case 'lookup': {
        const route = resolveLookupRoute(query);
        if (route) {
          toast.info(route.label, { duration: 3000 });
          navigate(route.path);
          setInput('');
          return;
        }
        // Couldn't resolve locally — fall through to LLM
        break;
      }

      case 'policy': {
        toast.info('Opening AI Assistant...', { duration: 3000 });
        openAIChat();
        setInput('');
        return;
      }

      case 'create': {
        const route = resolveCreateRoute(query);
        toast.info(route.label, { duration: 3000 });
        navigate(route.path);
        setInput('');
        return;
      }

      case 'unknown':
      default:
        break;
    }

    // --- Fallback: send to Groq LLM ---
    setLoading(true);
    const aiResult = await queryGroq(query);
    setLoading(false);

    if (aiResult) {
      // If LLM says catalogue, try resolving items
      if (aiResult.intent === 'catalogue' && aiResult.catalogueItems?.length) {
        const resolved = aiResult.catalogueItems
          .map((ai) => catalogueItems.find((c) =>
            c.name.toLowerCase().includes(ai.name.toLowerCase()) ||
            ai.name.toLowerCase().includes(c.name.toLowerCase())
          ))
          .filter((x): x is CatalogueItem => x !== null);

        if (resolved.length > 0) {
          setCatalogueResults(resolved);
          setCatalogueMessage(aiResult.message);
          setShowCatalogue(true);
          return;
        }
      }

      // If LLM returned links, navigate to first one
      if (aiResult.links?.length) {
        toast.info(aiResult.message, { duration: 4000 });
        navigate(aiResult.links[0].path);
        setInput('');
        return;
      }

      // Show message as toast and open AI chat for more help
      toast.info(aiResult.message, { duration: 4000 });
      openAIChat();
    } else {
      // Total fallback — open AI chat
      toast.info('Opening AI Assistant for help...', { duration: 3000 });
      openAIChat();
    }
    setInput('');
  }, [input, navigate]);

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
    setTimeout(() => { setCart([]); setInput(''); setShowCatalogue(false); setCatalogueResults([]); setOrderSuccess(null); setQuantities({}); }, 3000);
  };

  const handleBrowseCategory = (catId: string) => {
    const items = catalogueItems.filter((i) => i.catalogueId === catId);
    const catName = CATALOGUE_CATEGORIES.find((c) => c.id === catId)?.name ?? catId;
    setCatalogueResults(items);
    setCatalogueMessage(`Showing all items in ${catName}`);
  };

  const handleCloseCatalogue = () => {
    setShowCatalogue(false);
    setCatalogueResults([]);
    setCatalogueMessage('');
    setInput('');
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

        {/* Search Input — ONLY fires on Enter */}
        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Press Enter to search — e.g. 'buy paper', 'find Accenture', 'how do approvals work'"
            className="h-12 pl-12 pr-10 text-base rounded-lg"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-[#2D5F8A]" />
            </div>
          )}
          {!loading && input && (
            <button type="button" onClick={() => { setInput(''); setShowCatalogue(false); setCatalogueResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="size-4" />
            </button>
          )}
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" />
            Thinking...
          </div>
        )}

        {/* Catalogue View */}
        {showCatalogue && !loading && (
          <div className="mt-6 max-w-3xl mx-auto space-y-4">
            {/* Message */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 mt-0.5">
                  <Sparkles className="size-3 text-[#2D5F8A]" />
                </div>
                <p className="text-sm text-gray-700">{catalogueMessage}</p>
              </div>
              <button type="button" onClick={handleCloseCatalogue} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="size-4" />
              </button>
            </div>

            {/* Order Success */}
            {orderSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-4">
                <Check className="size-5 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-800">Order {orderSuccess} submitted successfully</p>
              </div>
            )}

            {/* Catalogue Category Tiles (always shown when catalogue is open) */}
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

            {/* Catalogue Items */}
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

            {/* Footer: alternative action */}
            {!orderSuccess && (
              <div className="flex items-center gap-3 pt-1">
                <Button variant="link" size="sm" className="text-xs text-gray-500 px-0" onClick={() => { navigate('/requests/new'); setShowCatalogue(false); }}>
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
