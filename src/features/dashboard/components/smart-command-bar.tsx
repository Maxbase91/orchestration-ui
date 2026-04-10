import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { searchCatalogueItems, catalogueItems, type CatalogueItem } from '@/data/catalogue-items';
import { getAIResponse } from '@/lib/mock-ai';
import { openAIChat } from '@/features/ai-assistant/ai-chat-overlay';
import { formatCurrency } from '@/lib/format';

interface CartItem {
  item: CatalogueItem;
  quantity: number;
}

interface AILink {
  label: string;
  path: string;
}

interface AIResult {
  intent: 'catalogue' | 'navigation' | 'new-request' | 'general';
  message: string;
  catalogueItems: { name: string; price: number; unit: string; id: string }[];
  links: AILink[];
  suggestions: string[];
}

async function queryAI(input: string): Promise<AIResult | null> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input }),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch {
    return null;
  }
}

function fallbackDetect(input: string): AIResult {
  const matched = searchCatalogueItems(input);
  const chatResponse = getAIResponse(input, 'chat');
  const intakeResponse = getAIResponse(input, 'intake');

  if (matched.length > 0) {
    return {
      intent: 'catalogue',
      message: `I found ${matched.length} item${matched.length > 1 ? 's' : ''} matching "${input}" in our catalogues. You can order these directly — no approval needed.`,
      catalogueItems: matched.slice(0, 9).map((m) => ({ name: m.name, price: m.unitPrice, unit: m.unit, id: m.id })),
      links: [{ label: 'Browse full catalogue', path: '/requests/new' }],
      suggestions: [],
    };
  }
  if (chatResponse?.links?.length) {
    return {
      intent: 'navigation',
      message: chatResponse.response,
      catalogueItems: [],
      links: chatResponse.links ?? [],
      suggestions: chatResponse.suggestions ?? [],
    };
  }
  if (intakeResponse) {
    return {
      intent: 'new-request',
      message: intakeResponse.response,
      catalogueItems: [],
      links: [{ label: 'Create New Request', path: '/requests/new' }, ...(intakeResponse.links ?? [])],
      suggestions: intakeResponse.suggestions ?? [],
    };
  }
  return {
    intent: 'general',
    message: "I can help with that. Tell me more about what you need, or use one of the options below.",
    catalogueItems: [],
    links: [
      { label: 'Create New Request', path: '/requests/new' },
      { label: 'Browse Catalogue', path: '/requests/new' },
    ],
    suggestions: [],
  };
}

const chipSuggestions = [
  { label: 'Buy office supplies', query: 'I want to buy office supplies' },
  { label: 'Order paper', query: 'I need to order paper' },
  { label: 'New procurement request', query: 'I need to create a new procurement request' },
  { label: 'Track my request', query: 'Where is my procurement request?' },
  { label: 'Check approvals', query: 'Show me my pending approvals' },
  { label: 'Find a supplier', query: 'I need to find a supplier' },
  { label: 'View spend', query: 'Show me the spend analytics dashboard' },
];

export function SmartCommandBar() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    // Try Groq API first, fall back to local detection
    const aiResult = await queryAI(query);
    if (aiResult) {
      setResult(aiResult);
    } else {
      setResult(fallbackDetect(query));
    }
    setLoading(false);
  }, []);

  // Debounce
  useEffect(() => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    const timer = setTimeout(() => doSearch(input), 500);
    return () => clearTimeout(timer);
  }, [input, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) doSearch(input);
  };

  // Resolve catalogue item IDs from AI response to actual items
  const resolvedCatalogueItems: CatalogueItem[] = result?.catalogueItems
    ?.map((aiItem) => {
      // Try exact ID match first, then fuzzy name match
      const byId = catalogueItems.find((c) => c.id === aiItem.id);
      if (byId) return byId;
      const byName = catalogueItems.find((c) =>
        c.name.toLowerCase().includes(aiItem.name.toLowerCase()) ||
        aiItem.name.toLowerCase().includes(c.name.toLowerCase())
      );
      return byName ?? null;
    })
    .filter((x): x is CatalogueItem => x !== null) ?? [];

  const getQty = useCallback((itemId: string) => quantities[itemId] ?? 1, [quantities]);
  const setQty = (itemId: string, qty: number) => setQuantities((prev) => ({ ...prev, [itemId]: Math.max(1, qty) }));

  const addToCart = (item: CatalogueItem) => {
    const qty = getQty(item.id);
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) return prev.map((c) => c.item.id === item.id ? { ...c, quantity: c.quantity + qty } : c);
      return [...prev, { item, quantity: qty }];
    });
    setQuantities((prev) => ({ ...prev, [item.id]: 1 }));
  };

  const removeFromCart = (itemId: string) => setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * c.item.unitPrice, 0);

  const handleOrderNow = () => {
    const id = `REQ-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    const itemNames = cart.map((c) => c.item.name).join(', ');
    toast.success(`Order submitted! ${id} \u2014 ${itemNames}. Estimated delivery: 2-3 business days.`);
    setOrderSuccess(id);
    setTimeout(() => { setCart([]); setInput(''); setResult(null); setOrderSuccess(null); setQuantities({}); }, 3000);
  };

  const handleChip = (query: string) => {
    setInput(query);
    doSearch(query);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setInput('');
    setResult(null);
  };

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
            placeholder="Type naturally — e.g. 'buying paper', 'find Accenture', 'check my approvals'"
            className="h-12 pl-12 pr-10 text-base rounded-lg"
          />
          {input && !loading && (
            <button type="button" onClick={() => { setInput(''); setResult(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="size-4" />
            </button>
          )}
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-[#2D5F8A]" />
            </div>
          )}
        </form>

        {/* Suggestion Chips (no input) */}
        {!result && !loading && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {chipSuggestions.map((s) => (
              <Button key={s.label} variant="outline" size="sm" className="text-xs" onClick={() => handleChip(s.query)}>
                {s.label}
              </Button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" />
            Thinking...
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="mt-6 max-w-3xl mx-auto space-y-4">
            {/* AI Message */}
            <div className="flex items-start gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 mt-0.5">
                <Sparkles className="size-3 text-[#2D5F8A]" />
              </div>
              <p className="text-sm text-gray-700">{result.message}</p>
            </div>

            {/* Order Success */}
            {orderSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-4">
                <Check className="size-5 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-800">Order {orderSuccess} submitted successfully</p>
              </div>
            )}

            {/* Catalogue Items */}
            {result.intent === 'catalogue' && resolvedCatalogueItems.length > 0 && !orderSuccess && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {resolvedCatalogueItems.slice(0, 9).map((item) => {
                    const inCart = cart.find((c) => c.item.id === item.id);
                    return (
                      <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.supplierName} &middot; {item.catalogueName}</p>
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

                {/* Cart */}
                {cart.length > 0 && (
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
              </div>
            )}

            {/* Navigation / Action Links */}
            {result.links && result.links.length > 0 && result.intent !== 'catalogue' && (
              <div className="flex flex-wrap gap-2">
                {result.links.map((link) => (
                  <Button key={link.path + link.label} variant="outline" size="sm" onClick={() => handleNavigate(link.path)}>
                    <ArrowRight className="size-3.5 mr-1.5" />{link.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Catalogue footer links */}
            {result.intent === 'catalogue' && !orderSuccess && (
              <div className="flex flex-wrap gap-3 pt-1">
                <Button variant="link" size="sm" className="text-xs text-gray-500 px-0" onClick={() => handleNavigate('/requests/new')}>
                  Or create a full procurement request <ArrowRight className="size-3 ml-1" />
                </Button>
              </div>
            )}

            {/* General fallback */}
            {result.intent === 'general' && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openAIChat()}>
                  <Sparkles className="size-3.5 mr-1.5" />Open AI Assistant
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleNavigate('/requests/new')}>
                  <ArrowRight className="size-3.5 mr-1.5" />Create New Request
                </Button>
              </div>
            )}

            {/* Follow-up suggestions */}
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {result.suggestions.map((s) => (
                  <button key={s} onClick={() => handleChip(s)} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
