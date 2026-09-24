// Category-code mapping (taxonomy translation).
//
// Translates a demand into a standardised commodity code (UNSPSC-style) + label.
// Two signals, in order: keyword match on the free-text description, then the
// category's default code, so every demand in a configured category resolves to
// *some* code even when no keyword hits.
//
// The codes are category configuration — each category carries its own list and
// its default, edited in Admin → Categories. They were two tables in this file,
// so a deployment with its own code set had to change code to use it. Pure and
// dependency-free: the browser builds the book from the categories query, the
// commodity-match handler from the same rows read on the server.

export interface CategoryCode {
  code: string;
  label: string;
}

/** A code a category offers, and the words in a description that point at it. */
export interface CommodityCodeEntry extends CategoryCode {
  keywords: string[];
}

export interface CategoryCodeResult extends CategoryCode {
  confidence: number;
  source: 'keyword' | 'category-default';
}

/** The codes of every active category, ready to match against. */
export interface CommodityCodeBook {
  entries: (CommodityCodeEntry & { category: string })[];
  defaults: Record<string, CategoryCode>;
}

/** The category fields the book is built from. */
export interface CategoryCodeSource {
  id: string;
  active?: boolean;
  commodityCodes?: CommodityCodeEntry[];
  defaultCode?: CategoryCode | null;
}

export const EMPTY_CODE_BOOK: CommodityCodeBook = { entries: [], defaults: {} };

/**
 * Read the commodity-code columns off a `procurement_categories` row. Shared by
 * the browser mapper and the server handler so the two cannot read the same
 * row differently.
 */
export function commodityFieldsFromRow(row: Record<string, unknown>): Pick<CategoryCodeSource, 'commodityCodes' | 'defaultCode'> {
  const raw = Array.isArray(row.commodity_codes) ? row.commodity_codes : [];
  const commodityCodes = raw
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
    .map((e) => ({
      code: String(e.code ?? '').trim(),
      label: String(e.label ?? '').trim(),
      keywords: Array.isArray(e.keywords) ? e.keywords.map((k) => String(k)) : [],
    }))
    .filter((e) => e.code !== '');
  const code = typeof row.default_code === 'string' ? row.default_code.trim() : '';
  const label = typeof row.default_code_label === 'string' ? row.default_code_label.trim() : '';
  return { commodityCodes, defaultCode: code ? { code, label: label || code } : null };
}

/**
 * Build the book from the configured categories. An inactive category offers
 * nothing — it is not offered at intake either. Keywords are lower-cased here
 * because the matchers compare against a lower-cased description, and an admin
 * typing "AWS" should not silently match nothing.
 */
export function codeBookFromCategories(categories: CategoryCodeSource[]): CommodityCodeBook {
  const entries: CommodityCodeBook['entries'] = [];
  const defaults: CommodityCodeBook['defaults'] = {};
  for (const cat of categories) {
    if (cat.active === false) continue;
    for (const entry of cat.commodityCodes ?? []) {
      const keywords = entry.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
      if (!entry.code.trim() || keywords.length === 0) continue;
      entries.push({ code: entry.code.trim(), label: entry.label.trim() || entry.code.trim(), keywords, category: cat.id });
    }
    if (cat.defaultCode?.code.trim()) defaults[cat.id] = cat.defaultCode;
  }
  return { entries, defaults };
}

/** Lower-case, punctuation to spaces — the form keywords are matched against. */
export function normaliseForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * How many of an entry's keywords the description contains, each counted at
 * the START of a word. Plain substring matching let "ai" hit "campaign",
 * "chair" and "maintenance", and "api" hit "capital"; which code then won was
 * decided by table order. A prefix still matches its longer forms — "temp"
 * finds "temporary", "print" finds "printing".
 */
export function keywordHits(normalisedText: string, keywords: string[]): number {
  const padded = ` ${normalisedText}`;
  return keywords.filter((keyword) => {
    const k = normaliseForMatch(keyword);
    return k !== '' && padded.includes(` ${k}`);
  }).length;
}

function matchKeywords(text: string, book: CommodityCodeBook, category?: string): { code: string; label: string; matchCount: number } | null {
  const normalised = normaliseForMatch(text);
  let best: { code: string; label: string; matchCount: number; own: boolean } | null = null;
  for (const entry of book.entries) {
    const matchCount = keywordHits(normalised, entry.keywords);
    if (matchCount === 0) continue;
    // Strongest match wins. On a tie the demand's own category's code wins,
    // then the first in the book — ties used to go to whichever row came first
    // in a code table, an order that meant nothing.
    const own = entry.category === category;
    if (!best || matchCount > best.matchCount || (matchCount === best.matchCount && own && !best.own)) {
      best = { code: entry.code, label: entry.label, matchCount, own };
    }
  }
  return best;
}

/**
 * Resolve a demand to a category code. Keyword match wins (confidence scales
 * with the number of hits); otherwise the category's default code is returned
 * at modest confidence so the demand always carries a code. Returns null only
 * when there is neither a keyword match nor a default for the category.
 */
export function resolveCategoryCode(
  input: { text?: string; category?: string },
  book: CommodityCodeBook,
): CategoryCodeResult | null {
  const kw = input.text ? matchKeywords(input.text, book, input.category) : null;
  if (kw) {
    return {
      code: kw.code,
      label: kw.label,
      confidence: Math.min(0.97, 0.6 + kw.matchCount * 0.12),
      source: 'keyword',
    };
  }
  const fallback = input.category ? book.defaults[input.category] : undefined;
  if (fallback) {
    return { ...fallback, confidence: 0.5, source: 'category-default' };
  }
  return null;
}
