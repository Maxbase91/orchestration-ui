// Derives the breadcrumb trail from the current URL path. A path the
// navigation names takes its label from there — the sidebar and the trail say
// the same thing; any other segment is title-cased, and a record id is shown
// as stored.
//
// Labels were a second table here, kept by hand. It had drifted: `/help/kb`
// read "Kb" beside a menu saying "Knowledge Base", `/admin/sla-targets` read
// "Sla Targets" for "Support SLAs", and it still named Policy Management, a
// page since removed.
import { useLocation } from 'react-router-dom';
import { navigation, type NavItem } from '@/config/navigation';

export interface Breadcrumb {
  label: string;
  path: string;
}

function collect(items: NavItem[], into: Map<string, string>): Map<string, string> {
  for (const item of items) {
    if (item.path && !into.has(item.path)) into.set(item.path, item.label);
    if (item.children) collect(item.children, into);
  }
  return into;
}

/** Every path the navigation names, with its label. */
const NAV_LABELS = collect(navigation.flatMap((group) => group.items), new Map());

/**
 * A record id — REQ-2024-0001, PO-0042, SUP-013 — is shown exactly as stored.
 * Title-casing it split it on its hyphens, so the breadcrumb said "REQ 2024
 * 0001" beside a header saying REQ-2024-0001, and the id could not be copied
 * from either one and searched for. Anything containing a digit is treated as
 * an id: route names never have one.
 */
const looksLikeId = (segment: string) => /\d/.test(segment);

function humanize(segment: string, path: string): string {
  const named = NAV_LABELS.get(path);
  if (named) return named;
  if (looksLikeId(segment)) return decodeURIComponent(segment);
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function useBreadcrumbs(): Breadcrumb[] {
  const location = useLocation();
  const { pathname } = location;

  if (pathname === '/') {
    return [{ label: 'Home', path: '/' }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [{ label: 'Home', path: '/' }];

  segments.forEach((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    breadcrumbs.push({ label: humanize(segment, path), path });
  });

  return breadcrumbs;
}
