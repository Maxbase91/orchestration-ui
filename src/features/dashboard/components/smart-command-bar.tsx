import { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { searchCatalogueItems, type CatalogueItem } from '@/data/catalogue-items';
import { getAIResponse } from '@/lib/mock-ai';
import { openAIChat } from '@/features/ai-assistant/ai-chat-overlay';
import { formatCurrency } from '@/lib/format';
import type { AIResponse } from '@/data/types';

interface CartItem {
  item: CatalogueItem;
  quantity: number;
}

type Intent = 'catalogue' | 'navigation' | 'new-request' | 'general';

interface DetectionResult {
  intent: Intent;
  catalogueResults: CatalogueItem[];
  aiResponse: AIResponse | null;
}

function detectIntent(input: string): DetectionResult {
  const catalogueResults = searchCatalogueItems(input);
  const chatResponse = getAIResponse(input, 'chat');
  const intakeResponse = getAIResponse(input, 'intake');

  const buyKeywords = ['buy', 'order', 'purchase', 'need', 'get', 'want'];
  const hasBuyIntent = buyKeywords.some((k) => input.toLowerCase().includes(k));

  if (catalogueResults.length > 0 && (hasBuyIntent || catalogueResults.length >= 2)) {
    return { intent: 'catalogue', catalogueResults, aiResponse: null };
  }
  if (chatResponse?.links?.length) {
    return { intent: 'navigation', catalogueResults: [], aiResponse: chatResponse };
  }
  if (intakeResponse) {
    return { intent: 'new-request', catalogueResults: [], aiResponse: intakeResponse };
  }
  return { intent: 'general', catalogueResults: [], aiResponse: null };
}

const suggestions = [
  { label: 'Buy office supplies', query: 'buy office supplies' },
  { label: 'Create new request', query: 'I need to create a new procurement request' },
  { label: 'Track my request', query: 'track my request' },
  { label: 'Check approvals', query: 'show my approvals' },
  { label: 'Find a supplier', query: 'find a supplier' },
  { label: 'View spend', query: 'show spend analytics' },
];

export function SmartCommandBar() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Debounce input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(input.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const detection = useMemo<DetectionResult | null>(() => {
    if (!debouncedInput) return null;
    return detectIntent(debouncedInput);
  }, [debouncedInput]);

  const getQty = useCallback(
    (itemId: string) => quantities[itemId] ?? 1,
    [quantities]
  );

  const setQty = (itemId: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [itemId]: Math.max(1, qty) }));
  };

  const addToCart = (item: CatalogueItem) => {
    const qty = getQty(item.id);
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [...prev, { item, quantity: qty }];
    });
    setQuantities((prev) => ({ ...prev, [item.id]: 1 }));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  const cartTotal = cart.reduce(
    (sum, c) => sum + c.quantity * c.item.unitPrice,
    0
  );

  const handleOrderNow = () => {
    const id = `REQ-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    const itemNames = cart.map((c) => c.item.name).join(', ');
    toast.success(
      `Order submitted! ${id} \u2014 ${itemNames}. Estimated delivery: 2-3 business days.`
    );
    setOrderSuccess(id);
    setTimeout(() => {
      setCart([]);
      setInput('');
      setDebouncedInput('');
      setOrderSuccess(null);
      setQuantities({});
    }, 3000);
  };

  const handleSuggestion = (query: string) => {
    setInput(query);
    setDebouncedInput(query);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setInput('');
    setDebouncedInput('');
  };

  const hasResults = detection !== null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Top accent border */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-700" />

      <div className="p-6">
        {/* Title */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="size-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            What do you need?
          </h2>
        </div>

        {/* Search Input */}
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type naturally \u2014 e.g. 'buy paper', 'find Accenture', 'check my approvals'"
            className="h-12 pl-12 pr-4 text-base rounded-lg border-gray-300 focus:border-indigo-400 focus:ring-indigo-400"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput('');
                setDebouncedInput('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Suggestion Chips (only when no input) */}
        {!hasResults && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {suggestions.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleSuggestion(s.query)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        )}

        {/* Results */}
        {detection && (
          <div className="mt-6 max-w-3xl mx-auto">
            {/* Order Success Banner */}
            {orderSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-4 mb-4">
                <Check className="size-5 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-800">
                  Order {orderSuccess} submitted successfully
                </p>
              </div>
            )}

            {/* Catalogue Results */}
            {detection.intent === 'catalogue' && !orderSuccess && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {detection.catalogueResults.slice(0, 9).map((item) => {
                    const inCart = cart.find((c) => c.item.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 bg-white p-3 space-y-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.supplierName}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(item.unitPrice)}{' '}
                            <span className="text-xs font-normal text-gray-400">
                              / {item.unit}
                            </span>
                          </p>
                          {inCart && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0"
                            >
                              In cart
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setQty(item.id, getQty(item.id) - 1)
                              }
                              className="flex size-7 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="w-7 text-center text-xs font-medium">
                              {getQty(item.id)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setQty(item.id, getQty(item.id) + 1)
                              }
                              className="flex size-7 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToCart(item)}
                          >
                            <Plus className="size-3 mr-1" />
                            Add
                          </Button>
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
                      <h4 className="text-sm font-semibold text-green-900">
                        Your Order
                      </h4>
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-green-100 text-green-700"
                      >
                        {cart.length} item{cart.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {cart.map((c) => (
                        <div
                          key={c.item.id}
                          className="flex items-center justify-between rounded-md bg-white border border-green-100 p-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {c.item.name}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {c.quantity} x {formatCurrency(c.item.unitPrice)} ={' '}
                              {formatCurrency(c.quantity * c.item.unitPrice)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(c.item.id)}
                            className="ml-2 text-gray-400 hover:text-red-500"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-green-200 pt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-green-900">
                        Total
                      </span>
                      <span className="text-sm font-bold text-green-900">
                        {formatCurrency(cartTotal)}
                      </span>
                    </div>

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleOrderNow}
                    >
                      <Package className="size-4 mr-1.5" />
                      Order Now &mdash; No approval needed
                    </Button>
                    <p className="text-[11px] text-green-700 text-center">
                      Pre-approved catalogue items. Estimated delivery: 2-3
                      business days.
                    </p>
                  </div>
                )}

                {/* Footer links */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-gray-500 px-0"
                    onClick={() => handleNavigate('/requests/new')}
                  >
                    Or create a full procurement request
                    <ArrowRight className="size-3 ml-1" />
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-gray-500 px-0"
                    onClick={() => handleNavigate('/requests/new')}
                  >
                    Browse complete catalogue
                    <ArrowRight className="size-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation Results */}
            {detection.intent === 'navigation' && detection.aiResponse && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  {detection.aiResponse.response}
                </p>
                <div className="flex flex-wrap gap-2">
                  {detection.aiResponse.links?.map((link) => (
                    <Button
                      key={link.path}
                      variant="outline"
                      size="sm"
                      onClick={() => handleNavigate(link.path)}
                    >
                      <ArrowRight className="size-3.5 mr-1.5" />
                      {link.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* New Request Results */}
            {detection.intent === 'new-request' && detection.aiResponse && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  {detection.aiResponse.response}
                </p>
                {detection.aiResponse.autoFill && (
                  <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
                    <p className="text-xs font-medium text-blue-800 mb-1">
                      Auto-fill detected:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(detection.aiResponse.autoFill).map(
                        ([key, value]) => (
                          <Badge
                            key={key}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {key}: {value}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => handleNavigate('/requests/new')}
                >
                  Create New Request
                  <ArrowRight className="size-3.5 ml-1.5" />
                </Button>
              </div>
            )}

            {/* General Fallback */}
            {detection.intent === 'general' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  I can help with that. Try being more specific, or:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openAIChat()}>
                    <Sparkles className="size-3.5 mr-1.5" />
                    Open AI Assistant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNavigate('/requests/new')}
                  >
                    Create New Request
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
