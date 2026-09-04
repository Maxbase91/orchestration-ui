// Applying a deep link, once, when the data it needs has arrived.
//
// The two effects this replaces lived in the intake page and each carried its
// own guard against re-running: one an `initialized` flag, the other a check
// that the order had not already been hydrated. Both had to wait for a
// different query (suppliers; catalogue items) before they could resolve their
// references, and both cleared the URL afterwards so a refresh did not replay
// them. That is one concern, stated twice, sixty lines apart.
//
// The parsing is in `intake-deep-link.ts` and is pure. This is only the seam:
// when to run, what to wait for, and clearing the params afterwards.

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  parseCatalogueDeepLink,
  parseDemandDeepLink,
  type CatalogueDeepLink,
  type DemandDeepLink,
} from './intake-deep-link';
import type { CatalogueItem } from '@/data/catalogue-items';
import type { Supplier } from '@/data/types';

export interface UseIntakeDeepLinkInput {
  suppliers: Supplier[];
  catalogueItems: CatalogueItem[];
  /** The command bar's demand link — seed the form and jump to its step. */
  onDemand: (link: DemandDeepLink) => void;
  /** The return trip from an item detail page — open its governed checkout. */
  onCatalogueOrder: (link: CatalogueDeepLink) => void;
}

export interface UseIntakeDeepLinkResult {
  /**
   * The demand text from `?q=`, read synchronously on the first render so the
   * describe step can start populated — the params are cleared moments later.
   */
  prefill: string;
}

export function useIntakeDeepLink({
  suppliers, catalogueItems, onDemand, onCatalogueOrder,
}: UseIntakeDeepLinkInput): UseIntakeDeepLinkResult {
  const [searchParams, setSearchParams] = useSearchParams();
  // A lazy initialiser, not a ref: this must be read on the first render,
  // before the effect below clears the params, and reading a ref during render
  // is what the compiler rules (correctly) forbid.
  const [prefill] = useState(() => searchParams.get('q') ?? '');

  // Applied at most once. Re-applying would overwrite whatever the requester
  // has typed since, with the values the link arrived with.
  const appliedRef = useRef(false);

  // The callbacks are new closures on every render of the page, so they are
  // written to a ref inside an effect rather than listed as dependencies —
  // depending on them directly would re-run the apply effect continuously.
  const handlers = useRef({ onDemand, onCatalogueOrder });
  useEffect(() => {
    handlers.current = { onDemand, onCatalogueOrder };
  }, [onDemand, onCatalogueOrder]);

  useEffect(() => {
    if (appliedRef.current) return;

    // A catalogue link needs the catalogue; a demand link needs the supplier
    // directory to resolve a name to a record. Waiting is not optional — acting
    // early resolves nothing and then marks itself done.
    if (searchParams.get('catalogueItem')) {
      if (catalogueItems.length === 0) return;
      const link = parseCatalogueDeepLink(searchParams, catalogueItems, suppliers);
      if (!link) return;
      appliedRef.current = true;
      handlers.current.onCatalogueOrder(link);
      setSearchParams({}, { replace: true });
      return;
    }

    if (searchParams.get('step') && searchParams.get('category')) {
      if (suppliers.length === 0) return;
      const link = parseDemandDeepLink(searchParams, suppliers);
      if (!link) return;
      appliedRef.current = true;
      handlers.current.onDemand(link);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, suppliers, catalogueItems]);

  return { prefill };
}
