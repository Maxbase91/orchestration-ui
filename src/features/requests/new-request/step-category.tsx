import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Loader2,
  ArrowRight,
  CheckCircle,
  ShoppingCart,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { DEFAULT_CATEGORY_TAXONOMY } from '@/data/category-taxonomy';
import { resolveCategoryIcon } from '@/data/category-icons';
import {
  classifyDemandCategory,
  classifyCommodityCategory,
  ROUTE_LIKE_CATEGORY,
} from '@/lib/procurement/classify';
import { resolveCategoryCode } from '@/lib/procurement/category-code';
import type { RequestCategory } from '@/data/types';

interface StepCategoryProps {
  category: string;
  categoryDescription: string;
  /** Original demand text forwarded from the home page — seeds the input. */
  prefill?: string;
  onUpdate: (data: {
    category: string;
    categoryDescription: string;
    title?: string;
    supplier?: string;
    supplierId?: string;
    commodityCode?: string;
    commodityCodeLabel?: string;
    estimatedValue?: number;
    businessJustification?: string;
    /** The assistant's read of what kind of demand this is — see api/ai.ts. */
    llmIntent?: string;
    supplierProvenance?: 'named' | 'chosen';
  }) => void;
  onAutoAdvance?: () => void;
  /** Jump straight to the catalogue — the one explicit alternative entry point. */
  onBrowseCatalogue?: () => void;
}

interface AIClassification {
  category: string;
  title: string;
  supplier: string;
  estimatedValue: number;
  description: string;
  /**
   * Which layer produced this. Replaces a hardcoded `confidence: 0.9` that was
   * rendered to the user as a model confidence — the LLM returns no confidence,
   * so the number was invented. Provenance is a fact we actually have.
   */
  source: 'llm' | 'rules';
  /**
   * `intent` from api/ai.ts, whose prompt already distinguishes a catalogue
   * order from new demand ("buy consulting" = new-request). The wizard used to
   * discard it and re-derive a worse answer locally.
   */
  intent?: string;
  /** Derived UNSPSC-style commodity code — the specific classification. */
  commodityCode?: string;
  commodityCodeLabel?: string;
}

/** The intent vocabulary api/ai.ts documents in its own prompt. */
const ALLOWED_INTENTS = ['catalogue', 'new-request', 'navigation', 'general'];

async function classifyWithAI(input: string): Promise<AIClassification | null> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `CLASSIFY THIS PROCUREMENT REQUEST. Return the category, extracted details, and a professional description.\n\nUser input: "${input}"\n\nIMPORTANT: Respond with JSON containing: {"intent":"new-request","message":"...","catalogueItems":[],"links":[],"category":"goods|services|software|consulting|contingent-labour|contract-renewal|supplier-onboarding","extractedTitle":"professional title","extractedSupplier":"supplier name or empty","extractedValue":0,"generatedDescription":"a 3-4 sentence business justification: what is needed, the intended outcome, and why it is required — this becomes the request's justification, so make it substantive"}` }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Only the four documented intents are honoured. Anything else — a
    // hallucinated string, a renamed field — is dropped so routing degrades to
    // the deterministic rules rather than keying on a value nobody validated.
    const intent = ALLOWED_INTENTS.includes(data.intent) ? (data.intent as string) : undefined;
    return {
      category: data.category ?? 'goods',
      title: data.extractedTitle ?? '',
      supplier: data.extractedSupplier ?? '',
      estimatedValue: data.extractedValue ?? 0,
      description: data.generatedDescription ?? data.message ?? '',
      source: 'llm',
      intent,
    };
  } catch {
    return null;
  }
}

function localClassify(input: string): AIClassification {
  const q = input.toLowerCase();
  // The route-aware classifier on purpose: a demand for paper or toner comes
  // back as `catalogue`, and that signal is worth keeping. The guard in
  // `runClassification` turns it into an intent and a real commodity category,
  // so the offline path and the LLM path are corrected in exactly one place.
  const category = classifyDemandCategory(input);

  // Extract supplier name if mentioned
  let supplier = '';
  const supplierNames = ['accenture', 'sap', 'deloitte', 'kpmg', 'capgemini', 'aws', 'microsoft', 'siemens', 'bosch'];
  for (const name of supplierNames) {
    if (q.includes(name)) { supplier = name.charAt(0).toUpperCase() + name.slice(1); break; }
  }

  return {
    category,
    title: input,
    supplier,
    estimatedValue: 0,
    // A fuller business justification (not a one-liner): restate the full need
    // and its intended outcome so the Justification field is substantive.
    description: `Business need: ${input.trim()}. This procurement supports business operations and is raised via the front door for classification, risk assessment and routing to the appropriate buying channel.`,
    source: 'rules',
  };
}

export function StepCategory({ prefill, onUpdate, onAutoAdvance, onBrowseCatalogue }: StepCategoryProps) {
  const [inputValue, setInputValue] = useState(prefill ?? '');
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIClassification | null>(null);
  const [accepted, setAccepted] = useState(false);
  const { data: suppliers = [] } = useSuppliers();
  const { data: classifierAgent } = useAiAgent('AI-001');
  const { data: dbCategories = [] } = useProcurementCategories();

  // One taxonomy source: the configurable store when populated, else the
  // canonical default. Both carry their own icon name, resolved the same way,
  // so admin-defined categories render their configured icon.
  const source = dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORY_TAXONOMY;
  const activeCategories = source
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id as RequestCategory,
      name: c.label,
      description: c.description,
      timeline: `~${c.timelineDays}d`,
      icon: resolveCategoryIcon(c.icon),
    }));

  // AI-001 (Category Classifier) gates LLM classification. When disabled/draft,
  // the step falls back to local keyword classification immediately.
  const aiClassifierEnabled = classifierAgent?.status === 'active';

  const runClassification = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    setLoading(true);
    setAiResult(null);
    setAccepted(false);

    // Try LLM only if AI-001 is active; otherwise use local keyword classification
    let result = aiClassifierEnabled ? await classifyWithAI(text) : null;

    if (!result) {
      // LLM unavailable — use local deterministic classification
      result = localClassify(text);
    }

    setLoading(false);

    // `catalogue` is a fulfilment ROUTE, not a commodity category, and
    // classification does not get to choose the route. The wizard keys its
    // whole journey off the category (`isCatalogue` in new-request-page), so a
    // classifier answering "catalogue" silently turned the entire flow into a
    // catalogue order and skipped the funnel — the third door into the fault
    // this work exists to close, after the pre-check and the command bar.
    //
    // The signal is not thrown away: a model that says "catalogue" is telling
    // us its INTENT, which is carried separately below and which the pre-check
    // already honours *and* guards (an intent cannot open an ineligible or
    // empty catalogue). Only the category is corrected.
    if (result.category === ROUTE_LIKE_CATEGORY) {
      if (!result.intent) result.intent = 'catalogue';
      result.category = classifyCommodityCategory(text);
    }

    // Validate the category against the configured taxonomy. An unrecognised
    // value falls back to the deterministic classifier, NOT to a literal
    // 'goods': goods is catalogue-eligible, so silently defaulting there could
    // offer a consulting demand a catalogue item — the fault this whole change
    // exists to fix, re-entered through the back door.
    const validCat = activeCategories.find((c) => c.id === result.category);
    if (!validCat) {
      const fallback = classifyCommodityCategory(text);
      result.category = activeCategories.some((c) => c.id === fallback) ? fallback : 'goods';
    }

    // Derive the commodity code — the specific, meaningful classification (the
    // high-level category only drives the fulfilment routing).
    const cc = resolveCategoryCode({ text, category: result.category });
    if (cc) {
      result.commodityCode = cc.code;
      result.commodityCodeLabel = cc.label;
    }

    setAiResult(result);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runClassification(inputValue);
  };

  // Forwarded from the home page with a demand already typed — classify it once
  // automatically so the user lands on the result ready to accept.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !prefill?.trim()) return;
    autoRan.current = true;
    void runClassification(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const handleAccept = () => {
    if (!aiResult) return;

    const cat = activeCategories.find((c) => c.id === aiResult.category);
    const updates: Record<string, unknown> = {
      category: aiResult.category,
      categoryDescription: cat?.name ?? aiResult.category,
      title: aiResult.title || inputValue,
    };

    // Carry the derived commodity code downstream (shown in the SOW panel).
    if (aiResult.commodityCode) {
      updates.commodityCode = aiResult.commodityCode;
      updates.commodityCodeLabel = aiResult.commodityCodeLabel;
    }

    // Pre-fill supplier if extracted
    if (aiResult.supplier) {
      updates.supplier = aiResult.supplier;
      const matched = suppliers.find((s) =>
        s.name.toLowerCase().includes(aiResult.supplier.toLowerCase()) ||
        aiResult.supplier.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matched) {
        updates.supplierId = matched.id;
        updates.supplier = matched.name;
        // Extracted from the demand text, not chosen — the determination step
        // presents it as a suggestion to confirm.
        updates.supplierProvenance = 'named';
      }
    }

    // Pre-fill value if extracted
    if (aiResult.estimatedValue > 0) {
      updates.estimatedValue = aiResult.estimatedValue;
    }

    // Pre-fill description as business justification
    if (aiResult.description) {
      updates.businessJustification = aiResult.description;
    }

    // The routing decision in step 2 reads this; without it the wizard would
    // re-derive the answer the assistant has already given.
    if (aiResult.intent) updates.llmIntent = aiResult.intent;

    onUpdate(updates as Parameters<typeof onUpdate>[0]);
    setAccepted(true);

    // Auto-advance to Step 2 after a short delay
    if (onAutoAdvance) setTimeout(onAutoAdvance, 600);
  };

  const categoryLabel = (id: string) => activeCategories.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {/* Free text input */}
      <div>
        <label htmlFor="need-input" className="block text-sm font-medium text-gray-700 mb-1">
          Describe what you need
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Press Enter — we&apos;ll find the fastest way to fulfil it: an existing catalogue item, an
          active contract, or a full request. No need to pick a category.
        </p>
        <form onSubmit={handleSubmit} className="relative">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            id="need-input"
            placeholder='e.g. "I need business consulting from Accenture for a digital transformation project"'
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="text-base h-12 pl-10"
            disabled={loading}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-[#2D5F8A]" />
            </div>
          )}
        </form>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="size-4 animate-spin" />
          Analysing your request...
        </div>
      )}

      {/* AI Result. Stays on screen through the hand-off to step 2 — the
          controls lock rather than the block vanishing, so the requester is not
          shown an empty screen while the wizard advances. */}
      {aiResult && !loading && (
        <div className="rounded-lg border-l-2 border-[#2D5F8A] bg-blue-50/50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="size-4 text-[#2D5F8A] mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-[#2D5F8A]">AI Classification</span>
                {/* Provenance, not a confidence score: the model returns no
                    confidence, so any percentage here would be invented. */}
                <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600">
                  {aiResult.source === 'llm' ? 'AI classified' : 'Keyword match'}
                </Badge>
              </div>

              {/* The demand, restated once. The extracted title is the block's
                  heading rather than a card of its own: it and the raw input
                  above are the same sentence, and showing it three times (title
                  card, description, input box) read as three separate facts. */}
              <h3 className="text-base font-semibold leading-snug text-gray-900">
                {aiResult.title || inputValue}
              </h3>

              {/* One classification block. The commodity code is DERIVED from
                  the category (resolveCategoryCode takes it as input), so it
                  sits beneath it as the specific code rather than beside it as
                  an independent fact. No "routes the request" sub-label: the
                  buying channel routes it, and that is settled on step 2. */}
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  Classification
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {categoryLabel(aiResult.category)}
                </p>
                {aiResult.commodityCode && (
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    <span className="font-medium text-gray-600">{aiResult.commodityCode}</span>
                    {aiResult.commodityCodeLabel ? ` · ${aiResult.commodityCodeLabel}` : ''}
                  </p>
                )}
              </div>

              {/* Supplier and value are labelled EXTRACTED, matching the
                  named / chosen provenance the determination step already uses.
                  Neither is a decision taken here — the supplier is chosen once,
                  on the determination. */}
              {(aiResult.supplier || aiResult.estimatedValue > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {aiResult.supplier && (
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                        Supplier · extracted
                      </p>
                      <p className="truncate text-sm font-medium text-gray-900">{aiResult.supplier}</p>
                      <p className="text-[11px] text-gray-400">confirm on the determination</p>
                    </div>
                  )}
                  {aiResult.estimatedValue > 0 && (
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                        Est. value · extracted
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        €{aiResult.estimatedValue.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-gray-400">refine at any point</p>
                    </div>
                  )}
                </div>
              )}

              {/* The one genuinely new piece of content on this screen — it
                  becomes the request's business justification. */}
              {aiResult.description && (
                <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Business justification · generated
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{aiResult.description}</p>
                </div>
              )}

              {/* Accept */}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAccept} disabled={accepted}>
                  <CheckCircle className="size-3.5" />
                  {accepted ? 'Continuing…' : 'Accept & continue'}
                  <ArrowRight className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAiResult(null)}
                  disabled={accepted}
                >
                  Try again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The one explicit alternative entry point: the catalogue, for known
          off-the-shelf items. There is no commodity-category selection — the
          fulfilment path (catalogue / contract / full request) is derived from
          the description, not chosen up front. */}
      {!loading && !accepted && onBrowseCatalogue && (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-600">Already know it&apos;s an off-the-shelf catalogue item?</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={onBrowseCatalogue}>
            <ShoppingCart className="size-4" />
            Browse the catalogue
          </Button>
        </div>
      )}
    </div>
  );
}
