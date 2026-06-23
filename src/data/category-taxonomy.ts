// Canonical default category taxonomy — the single source of truth for the
// out-of-the-box demand categories. The data-driven path (the
// `procurement_categories` store, edited in Admin → Categories) overrides this
// at runtime; this module is the fallback and the seed.
//
// Standardised / white-label: these are generic procurement categories with no
// organisation- or industry-specific framing. A deployment can replace the set
// entirely through Admin without code changes.
//
// PURE DATA — no runtime imports, so the server-side seed can import this without
// pulling in lucide. Icon *names* are strings here; `@/data/category-icons`
// resolves them to components on the client.

import type { ProcurementCategory } from '@/lib/db/procurement-categories';

/** Canonical default taxonomy, in display order. */
export const DEFAULT_CATEGORY_TAXONOMY: ProcurementCategory[] = [
  { id: 'catalogue', label: 'Catalogue Purchase', description: 'Order from pre-approved catalogues — fast track, no sourcing needed', icon: 'ShoppingBag', timelineDays: 2, sortOrder: 1, active: true },
  { id: 'goods', label: 'Goods', description: 'Physical products, hardware, equipment, furniture', icon: 'Package', timelineDays: 5, sortOrder: 2, active: true },
  { id: 'services', label: 'Services', description: 'Facilities, catering, cleaning, travel management', icon: 'Wrench', timelineDays: 10, sortOrder: 3, active: true },
  { id: 'software', label: 'Software / IT', description: 'Licences, SaaS platforms, cloud services, subscriptions', icon: 'Monitor', timelineDays: 8, sortOrder: 4, active: true },
  { id: 'consulting', label: 'Consulting', description: 'Strategy advisory, audits, assessments, transformation', icon: 'BrainCircuit', timelineDays: 15, sortOrder: 5, active: true },
  { id: 'contingent-labour', label: 'Contingent Labour', description: 'Temporary staff, contractors, IT staffing, augmentation', icon: 'Users', timelineDays: 7, sortOrder: 6, active: true },
  { id: 'contract-renewal', label: 'Contract Renewal', description: 'Extend or renew an existing supplier contract', icon: 'RefreshCw', timelineDays: 12, sortOrder: 7, active: true },
  { id: 'supplier-onboarding', label: 'Supplier Onboarding', description: 'Register and onboard a new vendor to the platform', icon: 'UserPlus', timelineDays: 20, sortOrder: 8, active: true },
];
