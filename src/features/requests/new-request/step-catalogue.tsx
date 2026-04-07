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

interface CatalogueItem {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  unit: string;
  catalogueId: string;
  supplierName: string;
  supplierId: string;
  leadTime: string;
}

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
    items: [
      { id: 'IT-001', name: 'ThinkPad T14 Gen 5', description: 'Lenovo business laptop, 14" FHD, 16GB RAM, 512GB SSD', unitPrice: 1299, unit: 'each', catalogueId: 'it-equipment', supplierName: 'Lenovo', supplierId: 'SUP-CAT-001', leadTime: '5-7 days' },
      { id: 'IT-002', name: 'Dell Monitor 27" UltraSharp', description: '27" 4K USB-C monitor with ergonomic stand', unitPrice: 449, unit: 'each', catalogueId: 'it-equipment', supplierName: 'Dell Technologies', supplierId: 'SUP-CAT-002', leadTime: '3-5 days' },
      { id: 'IT-003', name: 'Logitech MX Keys', description: 'Advanced wireless keyboard with backlight', unitPrice: 109, unit: 'each', catalogueId: 'it-equipment', supplierName: 'Logitech', supplierId: 'SUP-CAT-003', leadTime: '2-3 days' },
      { id: 'IT-004', name: 'USB-C Hub 7-in-1', description: 'Multi-port adapter: HDMI, USB-A, SD, Ethernet', unitPrice: 59, unit: 'each', catalogueId: 'it-equipment', supplierName: 'Anker', supplierId: 'SUP-CAT-004', leadTime: '2-3 days' },
      { id: 'IT-005', name: 'Wireless Mouse MX Master', description: 'Ergonomic wireless mouse with multi-device support', unitPrice: 49, unit: 'each', catalogueId: 'it-equipment', supplierName: 'Logitech', supplierId: 'SUP-CAT-003', leadTime: '2-3 days' },
      { id: 'IT-006', name: 'Webcam HD 1080p', description: 'Full HD webcam with autofocus and noise-cancelling mic', unitPrice: 89, unit: 'each', catalogueId: 'it-equipment', supplierName: 'Logitech', supplierId: 'SUP-CAT-003', leadTime: '2-3 days' },
      { id: 'IT-007', name: 'Headset Pro UC', description: 'Professional wireless headset for unified communications', unitPrice: 179, unit: 'each', catalogueId: 'it-equipment', supplierName: 'Jabra', supplierId: 'SUP-CAT-005', leadTime: '3-5 days' },
      { id: 'IT-008', name: 'Ethernet Cable Cat6 3m', description: 'Cat6 patch cable, 3 meters, RJ45', unitPrice: 12, unit: 'each', catalogueId: 'it-equipment', supplierName: 'Belkin', supplierId: 'SUP-CAT-006', leadTime: '1-2 days' },
    ],
  },
  {
    id: 'office-supplies',
    name: 'Office Supplies',
    icon: Briefcase,
    items: [
      { id: 'OS-001', name: 'A4 Paper 500 sheets', description: 'Premium white A4 copy paper, 80gsm', unitPrice: 5, unit: 'pack', catalogueId: 'office-supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
      { id: 'OS-002', name: 'Ballpoint Pens 10-pack', description: 'Blue ink ballpoint pens, medium tip', unitPrice: 8, unit: 'pack', catalogueId: 'office-supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
      { id: 'OS-003', name: 'Sticky Notes Assorted', description: 'Post-it style notes, 76x76mm, 6 pads', unitPrice: 4, unit: 'pack', catalogueId: 'office-supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
      { id: 'OS-004', name: 'Toner Cartridge Black', description: 'Compatible black toner for HP LaserJet Pro', unitPrice: 45, unit: 'each', catalogueId: 'office-supplies', supplierName: 'HP Inc.', supplierId: 'SUP-CAT-008', leadTime: '2-3 days' },
      { id: 'OS-005', name: 'Binder Clips Assorted', description: 'Metal binder clips, mixed sizes, 48-pack', unitPrice: 3, unit: 'pack', catalogueId: 'office-supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
      { id: 'OS-006', name: 'Whiteboard Markers 8-pack', description: 'Dry-erase markers, assorted colours', unitPrice: 12, unit: 'pack', catalogueId: 'office-supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
      { id: 'OS-007', name: 'File Folders 25-pack', description: 'Manila file folders, A4, tab cut', unitPrice: 15, unit: 'pack', catalogueId: 'office-supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
      { id: 'OS-008', name: 'Desk Organizer', description: 'Mesh desk organizer with pen holder and tray', unitPrice: 22, unit: 'each', catalogueId: 'office-supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '2-3 days' },
    ],
  },
  {
    id: 'furniture',
    name: 'Furniture',
    icon: Package,
    items: [
      { id: 'FN-001', name: 'Electric Standing Desk', description: 'Height-adjustable desk, 160x80cm, dual motor', unitPrice: 699, unit: 'each', catalogueId: 'furniture', supplierName: 'Steelcase', supplierId: 'SUP-CAT-009', leadTime: '10-14 days' },
      { id: 'FN-002', name: 'Ergonomic Office Chair', description: 'Full mesh ergonomic chair with lumbar support', unitPrice: 549, unit: 'each', catalogueId: 'furniture', supplierName: 'Herman Miller', supplierId: 'SUP-CAT-010', leadTime: '10-14 days' },
      { id: 'FN-003', name: 'Monitor Arm Dual', description: 'Dual monitor arm, gas spring, VESA mount', unitPrice: 89, unit: 'each', catalogueId: 'furniture', supplierName: 'Ergotron', supplierId: 'SUP-CAT-011', leadTime: '5-7 days' },
      { id: 'FN-004', name: 'Bookshelf 5-Tier', description: 'Open bookshelf, 180cm height, oak finish', unitPrice: 199, unit: 'each', catalogueId: 'furniture', supplierName: 'Steelcase', supplierId: 'SUP-CAT-009', leadTime: '7-10 days' },
      { id: 'FN-005', name: 'Whiteboard Magnetic 120x90', description: 'Magnetic dry-erase whiteboard with frame', unitPrice: 129, unit: 'each', catalogueId: 'furniture', supplierName: 'Nobo', supplierId: 'SUP-CAT-012', leadTime: '5-7 days' },
      { id: 'FN-006', name: 'Filing Cabinet 3-Drawer', description: 'Lockable steel filing cabinet, A4', unitPrice: 249, unit: 'each', catalogueId: 'furniture', supplierName: 'Steelcase', supplierId: 'SUP-CAT-009', leadTime: '7-10 days' },
    ],
  },
  {
    id: 'safety-ppe',
    name: 'Safety & PPE',
    icon: Shield,
    items: [
      { id: 'SP-001', name: 'Safety Gloves 10-pack', description: 'Cut-resistant work gloves, EN388', unitPrice: 25, unit: 'pack', catalogueId: 'safety-ppe', supplierName: 'Uvex', supplierId: 'SUP-CAT-013', leadTime: '2-3 days' },
      { id: 'SP-002', name: 'Hard Hat EN397', description: 'Industrial hard hat, ventilated, adjustable', unitPrice: 35, unit: 'each', catalogueId: 'safety-ppe', supplierName: 'Uvex', supplierId: 'SUP-CAT-013', leadTime: '2-3 days' },
      { id: 'SP-003', name: 'Hi-Vis Vest Class 2', description: 'High-visibility safety vest, yellow', unitPrice: 15, unit: 'each', catalogueId: 'safety-ppe', supplierName: '3M', supplierId: 'SUP-CAT-014', leadTime: '1-2 days' },
      { id: 'SP-004', name: 'First Aid Kit Workplace', description: 'DIN 13157 compliant first aid kit', unitPrice: 45, unit: 'each', catalogueId: 'safety-ppe', supplierName: 'Leina-Werke', supplierId: 'SUP-CAT-015', leadTime: '2-3 days' },
      { id: 'SP-005', name: 'Safety Glasses Clear', description: 'Anti-scratch, anti-fog safety glasses', unitPrice: 18, unit: 'each', catalogueId: 'safety-ppe', supplierName: 'Uvex', supplierId: 'SUP-CAT-013', leadTime: '1-2 days' },
    ],
  },
  {
    id: 'catering-pantry',
    name: 'Catering & Pantry',
    icon: Coffee,
    items: [
      { id: 'CP-001', name: 'Coffee Beans 1kg', description: 'Premium Arabica blend, medium roast', unitPrice: 22, unit: 'bag', catalogueId: 'catering-pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '2-3 days' },
      { id: 'CP-002', name: 'Tea Selection Box', description: 'Assorted tea bags, 6 varieties, 120 bags', unitPrice: 15, unit: 'box', catalogueId: 'catering-pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '2-3 days' },
      { id: 'CP-003', name: 'Water Dispenser Unit', description: 'Countertop water dispenser, hot and cold', unitPrice: 89, unit: 'each', catalogueId: 'catering-pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '5-7 days' },
      { id: 'CP-004', name: 'Paper Cups 100-pack', description: 'Disposable paper cups, 200ml', unitPrice: 8, unit: 'pack', catalogueId: 'catering-pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '1-2 days' },
      { id: 'CP-005', name: 'Snack Box Assorted', description: 'Mixed healthy snacks, 30 portions', unitPrice: 35, unit: 'box', catalogueId: 'catering-pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '2-3 days' },
    ],
  },
  {
    id: 'print-stationery',
    name: 'Print & Stationery',
    icon: Printer,
    items: [
      { id: 'PS-001', name: 'Business Cards 500', description: 'Premium business cards, double-sided, matte', unitPrice: 35, unit: 'set', catalogueId: 'print-stationery', supplierName: 'Konica Minolta', supplierId: 'SUP-016', leadTime: '5-7 days' },
      { id: 'PS-002', name: 'A4 Letterhead 100 sheets', description: 'Company branded letterhead, 120gsm', unitPrice: 28, unit: 'pack', catalogueId: 'print-stationery', supplierName: 'Konica Minolta', supplierId: 'SUP-016', leadTime: '5-7 days' },
      { id: 'PS-003', name: 'Envelopes DL 100-pack', description: 'White window envelopes, peel and seal', unitPrice: 12, unit: 'pack', catalogueId: 'print-stationery', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
      { id: 'PS-004', name: 'Rubber Stamps Custom', description: 'Self-inking rubber stamp, custom text', unitPrice: 18, unit: 'each', catalogueId: 'print-stationery', supplierName: 'Konica Minolta', supplierId: 'SUP-016', leadTime: '7-10 days' },
      { id: 'PS-005', name: 'Laminating Pouches A4 100pk', description: 'Glossy laminating pouches, 125 micron', unitPrice: 15, unit: 'pack', catalogueId: 'print-stationery', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '2-3 days' },
    ],
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
