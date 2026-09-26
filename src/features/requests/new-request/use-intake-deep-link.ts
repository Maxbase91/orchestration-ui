// The conversation's first message from a link — `?q=<words>` from the Home box, the
// assistant or Start renewal — read on the first render, before anything else
// can clear the URL.
//
// It also applied two other links, each once and after its data loaded: the
// `?step=2&category=…` demand link (retired with its last producer) and the
// `?catalogueItem=…` return trip from an item's page into a one-item checkout
// in the wizard (retired when catalogue orders moved to the Catalogue page's
// basket, 2026-09-25).

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface UseIntakeDeepLinkResult {
  /** The demand text from `?q=`, so the conversation can start from it. */
  prefill: string;
}

export function useIntakeDeepLink(): UseIntakeDeepLinkResult {
  const [searchParams] = useSearchParams();
  // A lazy initialiser, not a ref: it must be read on the first render, and
  // reading a ref during render is what the compiler rules forbid.
  const [prefill] = useState(() => searchParams.get('q') ?? '');
  return { prefill };
}
