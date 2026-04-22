// Seed data only — not read by the runtime app.
// Catalogue items moved to Supabase in Wave 3
// (UI uses `@/lib/db/hooks/use-catalogue-items`).

export interface CatalogueItem {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  unit: string;
  catalogueId: string;
  catalogueName: string;
  supplierName: string;
  supplierId: string;
  leadTime: string;
}

export const catalogueItems: CatalogueItem[] = [
  // IT Equipment
  { id: 'IT-001', name: 'ThinkPad T14 Gen 5', description: 'Lenovo business laptop, 14" FHD, 16GB RAM, 512GB SSD', unitPrice: 1299, unit: 'each', catalogueId: 'it-equipment', catalogueName: 'IT Equipment', supplierName: 'Lenovo', supplierId: 'SUP-CAT-001', leadTime: '5-7 days' },
  { id: 'IT-002', name: 'Dell Monitor 27" UltraSharp', description: '27" 4K USB-C monitor with ergonomic stand', unitPrice: 449, unit: 'each', catalogueId: 'it-equipment', catalogueName: 'IT Equipment', supplierName: 'Dell Technologies', supplierId: 'SUP-CAT-002', leadTime: '3-5 days' },
  { id: 'IT-003', name: 'Logitech MX Keys', description: 'Advanced wireless keyboard with backlight', unitPrice: 109, unit: 'each', catalogueId: 'it-equipment', catalogueName: 'IT Equipment', supplierName: 'Logitech', supplierId: 'SUP-CAT-003', leadTime: '2-3 days' },
  { id: 'IT-004', name: 'USB-C Hub 7-in-1', description: 'Multi-port adapter: HDMI, USB-A, SD, Ethernet', unitPrice: 59, unit: 'each', catalogueId: 'it-equipment', catalogueName: 'IT Equipment', supplierName: 'Anker', supplierId: 'SUP-CAT-004', leadTime: '2-3 days' },
  { id: 'IT-005', name: 'Wireless Mouse MX Master', description: 'Ergonomic wireless mouse with multi-device support', unitPrice: 49, unit: 'each', catalogueId: 'it-equipment', catalogueName: 'IT Equipment', supplierName: 'Logitech', supplierId: 'SUP-CAT-003', leadTime: '2-3 days' },
  { id: 'IT-006', name: 'Webcam HD 1080p', description: 'Full HD webcam with autofocus and noise-cancelling mic', unitPrice: 89, unit: 'each', catalogueId: 'it-equipment', catalogueName: 'IT Equipment', supplierName: 'Logitech', supplierId: 'SUP-CAT-003', leadTime: '2-3 days' },
  { id: 'IT-007', name: 'Headset Pro UC', description: 'Professional wireless headset for unified communications', unitPrice: 179, unit: 'each', catalogueId: 'it-equipment', catalogueName: 'IT Equipment', supplierName: 'Jabra', supplierId: 'SUP-CAT-005', leadTime: '3-5 days' },
  { id: 'IT-008', name: 'Ethernet Cable Cat6 3m', description: 'Cat6 patch cable, 3 meters, RJ45', unitPrice: 12, unit: 'each', catalogueId: 'it-equipment', catalogueName: 'IT Equipment', supplierName: 'Belkin', supplierId: 'SUP-CAT-006', leadTime: '1-2 days' },

  // Office Supplies
  { id: 'OS-001', name: 'A4 Paper 500 sheets', description: 'Premium white A4 copy paper, 80gsm', unitPrice: 5, unit: 'pack', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
  { id: 'OS-002', name: 'Ballpoint Pens 10-pack', description: 'Blue ink ballpoint pens, medium tip', unitPrice: 8, unit: 'pack', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
  { id: 'OS-003', name: 'Sticky Notes Assorted', description: 'Post-it style notes, 76x76mm, 6 pads', unitPrice: 4, unit: 'pack', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
  { id: 'OS-004', name: 'Toner Cartridge Black', description: 'Compatible black toner for HP LaserJet Pro', unitPrice: 45, unit: 'each', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'HP Inc.', supplierId: 'SUP-CAT-008', leadTime: '2-3 days' },
  { id: 'OS-005', name: 'Binder Clips Assorted', description: 'Metal binder clips, mixed sizes, 48-pack', unitPrice: 3, unit: 'pack', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
  { id: 'OS-006', name: 'Whiteboard Markers 8-pack', description: 'Dry-erase markers, assorted colours', unitPrice: 12, unit: 'pack', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
  { id: 'OS-007', name: 'File Folders 25-pack', description: 'Manila file folders, A4, tab cut', unitPrice: 15, unit: 'pack', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
  { id: 'OS-008', name: 'Desk Organizer', description: 'Mesh desk organizer with pen holder and tray', unitPrice: 22, unit: 'each', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '2-3 days' },

  // Furniture
  { id: 'FN-001', name: 'Electric Standing Desk', description: 'Height-adjustable desk, 160x80cm, dual motor', unitPrice: 699, unit: 'each', catalogueId: 'furniture', catalogueName: 'Furniture', supplierName: 'Steelcase', supplierId: 'SUP-CAT-009', leadTime: '10-14 days' },
  { id: 'FN-002', name: 'Ergonomic Office Chair', description: 'Full mesh ergonomic chair with lumbar support', unitPrice: 549, unit: 'each', catalogueId: 'furniture', catalogueName: 'Furniture', supplierName: 'Herman Miller', supplierId: 'SUP-CAT-010', leadTime: '10-14 days' },
  { id: 'FN-003', name: 'Monitor Arm Dual', description: 'Dual monitor arm, gas spring, VESA mount', unitPrice: 89, unit: 'each', catalogueId: 'furniture', catalogueName: 'Furniture', supplierName: 'Ergotron', supplierId: 'SUP-CAT-011', leadTime: '5-7 days' },
  { id: 'FN-004', name: 'Bookshelf 5-Tier', description: 'Open bookshelf, 180cm height, oak finish', unitPrice: 199, unit: 'each', catalogueId: 'furniture', catalogueName: 'Furniture', supplierName: 'Steelcase', supplierId: 'SUP-CAT-009', leadTime: '7-10 days' },
  { id: 'FN-005', name: 'Whiteboard Magnetic 120x90', description: 'Magnetic dry-erase whiteboard with frame', unitPrice: 129, unit: 'each', catalogueId: 'furniture', catalogueName: 'Furniture', supplierName: 'Nobo', supplierId: 'SUP-CAT-012', leadTime: '5-7 days' },
  { id: 'FN-006', name: 'Filing Cabinet 3-Drawer', description: 'Lockable steel filing cabinet, A4', unitPrice: 249, unit: 'each', catalogueId: 'furniture', catalogueName: 'Furniture', supplierName: 'Steelcase', supplierId: 'SUP-CAT-009', leadTime: '7-10 days' },

  // Safety & PPE
  { id: 'SP-001', name: 'Safety Gloves 10-pack', description: 'Cut-resistant work gloves, EN388', unitPrice: 25, unit: 'pack', catalogueId: 'safety-ppe', catalogueName: 'Safety & PPE', supplierName: 'Uvex', supplierId: 'SUP-CAT-013', leadTime: '2-3 days' },
  { id: 'SP-002', name: 'Hard Hat EN397', description: 'Industrial hard hat, ventilated, adjustable', unitPrice: 35, unit: 'each', catalogueId: 'safety-ppe', catalogueName: 'Safety & PPE', supplierName: 'Uvex', supplierId: 'SUP-CAT-013', leadTime: '2-3 days' },
  { id: 'SP-003', name: 'Hi-Vis Vest Class 2', description: 'High-visibility safety vest, yellow', unitPrice: 15, unit: 'each', catalogueId: 'safety-ppe', catalogueName: 'Safety & PPE', supplierName: '3M', supplierId: 'SUP-CAT-014', leadTime: '1-2 days' },
  { id: 'SP-004', name: 'First Aid Kit Workplace', description: 'DIN 13157 compliant first aid kit', unitPrice: 45, unit: 'each', catalogueId: 'safety-ppe', catalogueName: 'Safety & PPE', supplierName: 'Leina-Werke', supplierId: 'SUP-CAT-015', leadTime: '2-3 days' },
  { id: 'SP-005', name: 'Safety Glasses Clear', description: 'Anti-scratch, anti-fog safety glasses', unitPrice: 18, unit: 'each', catalogueId: 'safety-ppe', catalogueName: 'Safety & PPE', supplierName: 'Uvex', supplierId: 'SUP-CAT-013', leadTime: '1-2 days' },

  // Catering & Pantry
  { id: 'CP-001', name: 'Coffee Beans 1kg', description: 'Premium Arabica blend, medium roast', unitPrice: 22, unit: 'bag', catalogueId: 'catering-pantry', catalogueName: 'Catering & Pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '2-3 days' },
  { id: 'CP-002', name: 'Tea Selection Box', description: 'Assorted tea bags, 6 varieties, 120 bags', unitPrice: 15, unit: 'box', catalogueId: 'catering-pantry', catalogueName: 'Catering & Pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '2-3 days' },
  { id: 'CP-003', name: 'Water Dispenser Unit', description: 'Countertop water dispenser, hot and cold', unitPrice: 89, unit: 'each', catalogueId: 'catering-pantry', catalogueName: 'Catering & Pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '5-7 days' },
  { id: 'CP-004', name: 'Paper Cups 100-pack', description: 'Disposable paper cups, 200ml', unitPrice: 8, unit: 'pack', catalogueId: 'catering-pantry', catalogueName: 'Catering & Pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '1-2 days' },
  { id: 'CP-005', name: 'Snack Box Assorted', description: 'Mixed healthy snacks, 30 portions', unitPrice: 35, unit: 'box', catalogueId: 'catering-pantry', catalogueName: 'Catering & Pantry', supplierName: 'Sodexo', supplierId: 'SUP-012', leadTime: '2-3 days' },

  // Print & Stationery
  { id: 'PS-001', name: 'Business Cards 500', description: 'Premium business cards, double-sided, matte', unitPrice: 35, unit: 'set', catalogueId: 'print-stationery', catalogueName: 'Print & Stationery', supplierName: 'Konica Minolta', supplierId: 'SUP-016', leadTime: '5-7 days' },
  { id: 'PS-002', name: 'A4 Letterhead 100 sheets', description: 'Company branded letterhead, 120gsm', unitPrice: 28, unit: 'pack', catalogueId: 'print-stationery', catalogueName: 'Print & Stationery', supplierName: 'Konica Minolta', supplierId: 'SUP-016', leadTime: '5-7 days' },
  { id: 'PS-003', name: 'Envelopes DL 100-pack', description: 'White window envelopes, peel and seal', unitPrice: 12, unit: 'pack', catalogueId: 'print-stationery', catalogueName: 'Print & Stationery', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '1-2 days' },
  { id: 'PS-004', name: 'Rubber Stamps Custom', description: 'Self-inking rubber stamp, custom text', unitPrice: 18, unit: 'each', catalogueId: 'print-stationery', catalogueName: 'Print & Stationery', supplierName: 'Konica Minolta', supplierId: 'SUP-016', leadTime: '7-10 days' },
  { id: 'PS-005', name: 'Laminating Pouches A4 100pk', description: 'Glossy laminating pouches, 125 micron', unitPrice: 15, unit: 'pack', catalogueId: 'print-stationery', catalogueName: 'Print & Stationery', supplierName: 'Staples', supplierId: 'SUP-CAT-007', leadTime: '2-3 days' },
];

const STOP_WORDS = new Set([
  'i', 'want', 'to', 'buy', 'buying', 'purchase', 'purchasing', 'order',
  'ordering', 'need', 'get', 'some', 'a', 'an', 'the', 'for', 'of',
  'my', 'me', 'please', 'can', 'could', 'would', 'like', 'new',
]);

export function searchCatalogueItems(query: string): CatalogueItem[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  if (words.length === 0) return [];

  return catalogueItems
    .map((item) => {
      const haystack = `${item.name} ${item.description} ${item.catalogueName}`.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (haystack.includes(word)) score += 1;
      }
      return { item, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
