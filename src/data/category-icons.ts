// Category icon resolution (client-only — pulls lucide components).
//
// Kept separate from `category-taxonomy.ts` so the taxonomy data stays free of
// component imports and can be consumed by the server-side seed without pulling
// in lucide. Category config stores the icon *name* (a string, i.e. data);
// this module maps that name to a component.

import {
  Package,
  ShoppingBag,
  Wrench,
  Monitor,
  BrainCircuit,
  Users,
  RefreshCw,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

/** Supported category icons, keyed by name. Add entries to widen the set. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Package,
  ShoppingBag,
  Wrench,
  Monitor,
  BrainCircuit,
  Users,
  RefreshCw,
  UserPlus,
};

/** The icon names an admin may choose from, for editor hints/selects. */
export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

/** Resolve a category's configured icon name to a component (defaults to Package). */
export function resolveCategoryIcon(name?: string): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Package;
}
