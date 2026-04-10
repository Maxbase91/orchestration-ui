import { useState, useMemo } from 'react';
import {
  Monitor,
  Briefcase,
  Package,
  Shield,
  Coffee,
  Printer,
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { catalogueItems, type CatalogueItem } from '@/data/catalogue-items';

interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  supplierId: string;
}

interface StepCatalogueProps {
  onUpdate: (data: {
    title: string;
    estimatedValue: number;
    supplier: string;
    supplierId: string;
    catalogueItems: CartItem[];
  }) => void;
}

interface SubCatalogue {
  id: string;
  name: string;
  icon: typeof Monitor;
  items: CatalogueItem[];
}

const SUB_CATALOGUES: SubCatalogue[] = [
  {
    id: 'it-equipment',
    name: 'IT Equipment',
    icon: Monitor,
    items: catalogueItems.filter((i) => i.catalogueId === 'it-equipment'),
  },
  {
    id: 'office-supplies',
    name: 'Office Supplies',
    icon: Briefcase,
    items: catalogueItems.filter((i) => i.catalogueId === 'office-supplies'),
  },
  {
    id: 'furniture',
    name: 'Furniture',
    icon: Package,
    items: catalogueItems.filter((i) => i.catalogueId === 'furniture'),
  },
  {
    id: 'safety-ppe',
    name: 'Safety & PPE',
    icon: Shield,
    items: catalogueItems.filter((i) => i.catalogueId === 'safety-ppe'),
  },
  {
    id: 'catering-pantry',
    name: 'Catering & Pantry',
    icon: Coffee,
    items: catalogueItems.filter((i) => i.catalogueId === 'catering-pantry'),
  },
  {
    id: 'print-stationery',
    name: 'Print & Stationery',
    icon: Printer,
    items: catalogueItems.filter((i) => i.catalogueId === 'print-stationery'),
  },
];

export function StepCatalogue({ onUpdate }: StepCatalogueProps) {
  const [selectedCatalogue, setSelectedCatalogue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const activeCatalogue = SUB_CATALOGUES.find((c) => c.id === selectedCatalogue);

  const filteredItems = useMemo(() => {
    if (!activeCatalogue) return [];
    if (!searchQuery.trim()) return activeCatalogue.items;
    const q = searchQuery.toLowerCase();
    return activeCatalogue.items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [activeCatalogue, searchQuery]);

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const getQty = (itemId: string) => quantities[itemId] ?? 1;

  const setQty = (itemId: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [itemId]: Math.max(1, qty) }));
  };

  const addToCart = (item: CatalogueItem) => {
    const qty = getQty(item.id);
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          quantity: qty,
          unitPrice: item.unitPrice,
          supplierId: item.supplierId,
        },
      ];
    });
    // Reset quantity input for this item
    setQuantities((prev) => ({ ...prev, [item.id]: 1 }));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const handleProceed = () => {
    // Determine primary supplier (most items or highest value)
    const supplierSpend: Record<string, { name: string; total: number }> = {};
    for (const item of cart) {
      const catItem = SUB_CATALOGUES.flatMap((c) => c.items).find((i) => i.id === item.itemId);
      const sName = catItem?.supplierName ?? 'Catalogue Supplier';
      if (!supplierSpend[item.supplierId]) {
        supplierSpend[item.supplierId] = { name: sName, total: 0 };
      }
      supplierSpend[item.supplierId].total += item.quantity * item.unitPrice;
    }
    const primarySupplier = Object.entries(supplierSpend).sort(
      (a, b) => b[1].total - a[1].total
    )[0];

    const title = cart.length === 1
      ? `Catalogue order: ${cart[0].name}`
      : `Catalogue order: ${cart.length} items`;

    onUpdate({
      title,
      estimatedValue: cartTotal,
      supplier: primarySupplier?.[1].name ?? '',
      supplierId: primarySupplier?.[0] ?? '',
      catalogueItems: cart,
    });
  };

  // Sub-catalogue grid view
  if (!selectedCatalogue) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Browse Catalogues</h3>
          <p className="text-xs text-gray-500">
            Select a catalogue to browse approved items and add them to your order.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SUB_CATALOGUES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCatalogue(cat.id)}
                className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-center transition-colors hover:bg-blue-50 hover:border-blue-200"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
                  <Icon className="size-5 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                <span className="text-xs text-gray-500">{cat.items.length} items</span>
              </button>
            );
          })}
        </div>

        {/* Cart summary at bottom if items exist */}
        {cart.length > 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {cart.length} item{cart.length !== 1 ? 's' : ''} in cart
                </span>
              </div>
              <span className="text-sm font-semibold text-green-900">
                {'\u20AC'}{cartTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Button size="sm" className="w-full" onClick={handleProceed}>
              Proceed with order
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Product grid + cart sidebar
  return (
    <div className="space-y-4">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedCatalogue(null);
            setSearchQuery('');
          }}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h3 className="text-sm font-semibold text-gray-900">{activeCatalogue?.name}</h3>
      </div>

      <div className="flex gap-4">
        {/* Product grid */}
        <div className="flex-1 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="pl-9"
            />
          </div>

          {/* Items */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const inCart = cart.find((c) => c.itemId === item.id);
              return (
                <div
                  key={item.id}
                  className="rounded-md border border-gray-200 bg-white p-3 space-y-2"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      {inCart && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          In cart
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {'\u20AC'}{item.unitPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        per {item.unit} &middot; {item.leadTime}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQty(item.id, getQty(item.id) - 1)}
                        className="flex size-6 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-medium">
                        {getQty(item.id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(item.id, getQty(item.id) + 1)}
                        className="flex size-6 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"
                      >
                        <Plus className="size-3" />
                      </button>
                      <Button size="sm" variant="outline" onClick={() => addToCart(item)}>
                        <Plus className="size-3" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              No items match your search.
            </p>
          )}
        </div>

        {/* Cart sidebar */}
        <div className="w-[250px] shrink-0">
          <div className="sticky top-0 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-4 text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-900">
                Cart ({cart.length})
              </h4>
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                No items added yet.
              </p>
            ) : (
              <>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex items-start justify-between rounded-md bg-white border border-gray-100 p-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {item.quantity} x {'\u20AC'}{item.unitPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="text-xs font-semibold text-gray-900">
                          {'\u20AC'}{(item.quantity * item.unitPrice).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.itemId)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total</span>
                    <span className="text-sm font-bold text-gray-900">
                      {'\u20AC'}{cartTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <Button size="sm" className="w-full" onClick={handleProceed}>
                  Proceed with order
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
