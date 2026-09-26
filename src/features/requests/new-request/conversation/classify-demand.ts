// What the requester described, classified: the category, the specific
// commodity code and its candidates, and anything the words already carry — a
// title, a supplier named in them, a value.
//
// Moved out of step-category.tsx (the retired Describe step) for the
// conversation page, which asks "That sounds like … Is that right?" instead of
// showing a card. The rules came with it, unchanged: AI-001 is asked only when
// it is active, and its answer is checked — a `catalogue` category is a route,
// not a commodity, and an unrecognised category falls back to the configured
// keywords, never to a literal `goods` that could offer a consulting demand a
// catalogue item.
//
// Plain functions over their dependencies, with relative imports, so a node test
// drives the keyword path.
import type { CommodityClassificationCandidate, Supplier } from '../../../../data/types.js';
import {
  classifyDemandCategory,
  classifyCommodityCategory,
  ROUTE_LIKE_CATEGORY,
  type ClassifierCategory,
} from '../../../../lib/procurement/classify.js';
import { resolveCategoryCode, normaliseForMatch, type CommodityCodeBook } from '../../../../lib/procurement/category-code.js';
import { requestCommodityCandidates } from '../../../../lib/procurement/commodity-candidates-api.js';
import { resolveCommodityCandidates } from '../../../../lib/procurement/commodity-candidates.js';
import { seedServiceDescriptionFromText } from '../../../../lib/procurement/intake-seed.js';
import type { IntakeFormData } from '../intake-form-data.js';

export interface DemandClassification {
  category: string;
  title: string;
  supplier: string;
  estimatedValue: number;
  /**
   * Which layer produced this. Replaces a hardcoded `confidence: 0.9` that was
   * shown as a model confidence — the model returns none, so it was invented.
   */
  source: 'llm' | 'rules';
  /** `intent` from api/ai.ts, whose prompt tells a catalogue order from new demand. */
  intent?: string;
  commodityCode?: string;
  commodityCodeLabel?: string;
  commodityCandidates?: CommodityClassificationCandidate[];
}

export interface ClassifyDeps {
  /** AI-001 is active. Off, the configured keywords decide at once. */
  aiEnabled: boolean;
  /** The configured taxonomy (or the default seed): ids, keywords, activity. */
  categories: ClassifierCategory[];
  suppliers: Supplier[];
  codeBook: CommodityCodeBook;
}

/** The intent vocabulary api/ai.ts documents in its own prompt. */
const ALLOWED_INTENTS = ['catalogue', 'new-request', 'navigation', 'general'];

async function classifyWithAI(input: string): Promise<DemandClassification | null> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `CLASSIFY THIS PROCUREMENT REQUEST. Return the category and the details you can extract.\n\nUser input: "${input}"\n\nIMPORTANT: Respond with JSON containing: {"intent":"new-request","message":"...","catalogueItems":[],"links":[],"category":"one of the configured category ids","extractedTitle":"professional title","extractedSupplier":"supplier name or empty","extractedValue":0}` }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Only the documented intents are honoured; anything else is dropped so
    // routing degrades to the deterministic rules rather than keying on a value
    // nobody validated.
    const intent = ALLOWED_INTENTS.includes(data.intent) ? (data.intent as string) : undefined;
    return {
      category: data.category ?? 'goods',
      title: data.extractedTitle ?? '',
      supplier: data.extractedSupplier ?? '',
      estimatedValue: data.extractedValue ?? 0,
      source: 'llm',
      intent,
    };
  } catch {
    return null;
  }
}

/**
 * The offline classification: the configured category keywords, and a supplier
 * from the directory named in the text.
 */
function localClassify(input: string, categories: ClassifierCategory[], suppliers: Supplier[]): DemandClassification {
  // The route-aware classifier on purpose: paper or toner comes back as
  // `catalogue`, and that signal is kept — `classifyDemand` turns it into an
  // intent and a real commodity category, for this path and the model's alike.
  const category = classifyDemandCategory(input, categories);
  const text = ` ${normaliseForMatch(input)}`;
  const named = suppliers.find((s) => {
    const name = normaliseForMatch(s.name);
    const first = name.split(' ')[0] ?? '';
    return (name && text.includes(` ${name}`)) || (first.length >= 3 && text.includes(` ${first} `));
  });
  return { category, title: input, supplier: named?.name ?? '', estimatedValue: 0, source: 'rules' };
}

/** Classify a description: the model when AI-001 is on and answers, else the keywords. */
export async function classifyDemand(raw: string, deps: ClassifyDeps): Promise<DemandClassification | null> {
  const text = raw.trim();
  if (!text) return null;
  const active = deps.categories.filter((c) => c.active !== false);

  const result = (deps.aiEnabled ? await classifyWithAI(text) : null) ?? localClassify(text, deps.categories, deps.suppliers);

  // `catalogue` is a fulfilment ROUTE, not a commodity category, and
  // classification does not get to choose the route. The intent it signals is
  // kept; the category is corrected.
  if (result.category === ROUTE_LIKE_CATEGORY) {
    if (!result.intent) result.intent = 'catalogue';
    result.category = classifyCommodityCategory(text, deps.categories);
  }
  // An unrecognised category falls back to the configured keywords, not to a
  // literal 'goods' — goods is catalogue-eligible, and defaulting there could
  // offer a consulting demand a catalogue item.
  if (!active.some((c) => c.id === result.category)) {
    const fallback = classifyCommodityCategory(text, deps.categories);
    result.category = active.some((c) => c.id === fallback) ? fallback : 'goods';
  }

  const code = resolveCategoryCode({ text, category: result.category }, deps.codeBook);
  if (code) {
    result.commodityCode = code.code;
    result.commodityCodeLabel = code.label;
  }
  try {
    const candidates = await requestCommodityCandidates({ text, category: result.category });
    result.commodityCandidates = candidates.length > 0 ? candidates : resolveCommodityCandidates(text, result.category, deps.codeBook);
  } catch {
    result.commodityCandidates = resolveCommodityCandidates(text, result.category, deps.codeBook);
  }
  return result;
}

/** How the requester answered "Is that right?". */
export type ClassificationChoice =
  | { kind: 'candidate'; code: string }
  /** None of the codes fits: keep the category, leave the code to be confirmed later. */
  | { kind: 'none' };

/**
 * The form updates a confirmed classification makes.
 *
 * The broad category is routing metadata and is never a requester choice; the
 * specific code is what they confirm. A supplier named in the words is carried
 * as `named` — a suggestion to confirm, not a choice.
 */
export function acceptClassification(
  result: DemandClassification,
  choice: ClassificationChoice,
  words: string,
  deps: { categoryLabel: (id: string) => string; suppliers: Supplier[] },
): Partial<IntakeFormData> {
  const updates: Partial<IntakeFormData> = {
    category: result.category,
    categoryDescription: deps.categoryLabel(result.category),
    title: result.title || words,
  };
  const seeded = seedServiceDescriptionFromText(words);
  if (Object.keys(seeded).length > 0) updates.serviceDescription = seeded as IntakeFormData['serviceDescription'];

  const selected = choice.kind === 'candidate'
    ? result.commodityCandidates?.find((candidate) => candidate.code === choice.code)
    : undefined;
  updates.commodityCode = selected?.code ?? '';
  updates.commodityCodeLabel = selected?.label ?? '';
  updates.commodityCandidates = result.commodityCandidates ?? [];
  updates.commodityClassificationConfirmed = true;

  if (result.supplier) {
    const wanted = result.supplier.toLowerCase();
    const matched = deps.suppliers.find((s) => s.name.toLowerCase().includes(wanted) || wanted.includes(s.name.toLowerCase()));
    updates.supplier = matched?.name ?? result.supplier;
    if (matched) {
      updates.supplierId = matched.id;
      updates.supplierProvenance = 'named';
    }
  }
  if (result.estimatedValue > 0) updates.estimatedValue = result.estimatedValue;
  // The routing decision reads this; without it the assistant's answer is re-derived worse.
  if (result.intent) updates.llmIntent = result.intent;
  return updates;
}
