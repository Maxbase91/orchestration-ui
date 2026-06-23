import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryTile } from './components/category-tile';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { DEFAULT_CATEGORY_TAXONOMY } from '@/data/category-taxonomy';
import { resolveCategoryIcon } from '@/data/category-icons';
import type { RequestCategory } from '@/data/types';

interface StepCategoryProps {
  category: string;
  categoryDescription: string;
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
  }) => void;
  onAutoAdvance?: () => void;
}

interface AIClassification {
  category: string;
  title: string;
  supplier: string;
  estimatedValue: number;
  description: string;
  confidence: number;
}

async function classifyWithAI(input: string): Promise<AIClassification | null> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `CLASSIFY THIS PROCUREMENT REQUEST. Return the category, extracted details, and a professional description.\n\nUser input: "${input}"\n\nIMPORTANT: Respond with JSON containing: {"intent":"new-request","message":"...","catalogueItems":[],"links":[],"category":"goods|services|software|consulting|contingent-labour|contract-renewal|supplier-onboarding|catalogue","extractedTitle":"professional title","extractedSupplier":"supplier name or empty","extractedValue":0,"generatedDescription":"2-3 sentence professional service/goods description based on the input"}` }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      category: data.category ?? 'goods',
      title: data.extractedTitle ?? '',
      supplier: data.extractedSupplier ?? '',
      estimatedValue: data.extractedValue ?? 0,
      description: data.generatedDescription ?? data.message ?? '',
      confidence: 0.9,
    };
  } catch {
    return null;
  }
}

function localClassify(input: string): AIClassification {
  const q = input.toLowerCase();
  let category = 'goods';
  if (/consult|advisory|strategy|audit|transformation|business consult|operating model|tom\b|organisational|organizational|change management|programme management|program management|due diligence|feasibility|business case|maturity assessment|roadmap|target state/.test(q)) category = 'consulting';
  else if (/\bservice\b|cleaning|catering|maintenance|travel|translation|managed print|managed service|facilities|security guard|payroll|hr admin|helpdesk/.test(q)) category = 'services';
  else if (/software|saas|license|cloud|platform|subscription|app/.test(q)) category = 'software';
  else if (/temp|contractor|staff|developer|freelance|hire|interim/.test(q)) category = 'contingent-labour';
  else if (/renew|extend|renewal|expir/.test(q)) category = 'contract-renewal';
  else if (/onboard|new supplier|new vendor|register/.test(q)) category = 'supplier-onboarding';
  else if (/paper|pen|toner|cable|headset|mouse|keyboard|office supplies/.test(q)) category = 'catalogue';

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
    description: `Procurement request for ${input}.`,
    confidence: 0.7,
  };
}

export function StepCategory({ category, onUpdate, onAutoAdvance }: StepCategoryProps) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIClassification | null>(null);
  const [accepted, setAccepted] = useState(false);
  // Free text is the primary entry point; the category grid is a manual
  // fallback (FD-E3-10) revealed on demand, not a parallel set of entry tiles.
  const [showManual, setShowManual] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
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

    // Validate category exists
    const validCat = activeCategories.find((c) => c.id === result.category);
    if (validCat) {
      result.category = validCat.id;
    } else {
      result.category = 'goods';
    }
    setAiResult(result);
  };

  const handleAccept = () => {
    if (!aiResult) return;

    const cat = activeCategories.find((c) => c.id === aiResult.category);
    const updates: Record<string, unknown> = {
      category: aiResult.category,
      categoryDescription: cat?.name ?? aiResult.category,
      title: aiResult.title || inputValue,
    };

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

    onUpdate(updates as Parameters<typeof onUpdate>[0]);
    setAccepted(true);

    // Auto-advance to Step 2 after a short delay
    if (onAutoAdvance) setTimeout(onAutoAdvance, 600);
  };

  const handleCategorySelect = (categoryId: string) => {
    // Reset AI state so this manual override is treated as the definitive choice.
    // Without this, `accepted = true` from a prior AI accept can cause auto-advance
    // to fire with the stale AI-classified category instead of the user's selection.
    setAccepted(false);
    setAiResult(null);
    const cat = activeCategories.find((c) => c.id === categoryId);
    onUpdate({ category: categoryId, categoryDescription: cat?.name ?? categoryId });
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
          Press Enter — the AI will identify the right category, extract details, and take you to the next step.
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

      {/* AI Result */}
      {aiResult && !accepted && !loading && (
        <div className="rounded-lg border-l-2 border-[#2D5F8A] bg-blue-50/50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="size-4 text-[#2D5F8A] mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-[#2D5F8A]">AI Classification</span>
                <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600">
                  {Math.round(aiResult.confidence * 100)}% confidence
                </Badge>
              </div>

              {/* Extracted info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Category</p>
                  <p className="text-sm font-semibold text-gray-900">{categoryLabel(aiResult.category)}</p>
                </div>
                {aiResult.title && (
                  <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Title</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{aiResult.title}</p>
                  </div>
                )}
                {aiResult.supplier && (
                  <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Supplier</p>
                    <p className="text-sm font-medium text-gray-900">{aiResult.supplier}</p>
                  </div>
                )}
                {aiResult.estimatedValue > 0 && (
                  <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Est. Value</p>
                    <p className="text-sm font-medium text-gray-900">€{aiResult.estimatedValue.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Generated description */}
              {aiResult.description && (
                <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Generated Description</p>
                  <p className="text-sm text-gray-700 mt-1">{aiResult.description}</p>
                </div>
              )}

              {/* Accept */}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAccept}>
                  <CheckCircle className="size-3.5" />
                  Accept & continue
                  <ArrowRight className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAiResult(null)}>
                  Try again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accepted state */}
      {accepted && aiResult && (
        <div className="rounded-md border border-green-200 bg-green-50/50 p-3 flex items-center gap-3">
          <CheckCircle className="size-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              {categoryLabel(aiResult.category)}{aiResult.supplier ? ` — ${aiResult.supplier}` : ''}
            </p>
            <p className="text-xs text-green-600 mt-0.5">Details pre-filled. Moving to next step...</p>
          </div>
        </div>
      )}

      {/* Manual category selection — a fallback behind a disclosure, so free
          text stays the primary entry point. Auto-opens if a category is
          already chosen (e.g. a deep-link or returning to the step). */}
      {!loading && !accepted && (
        <div>
          {!showManual && !category ? (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {aiResult ? 'Or choose a different category manually' : 'Or choose a category manually'}
            </button>
          ) : (
            <>
              <p className="mb-3 text-sm font-medium text-gray-700">
                {aiResult ? 'Or select a different category' : 'Choose a category'}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {activeCategories.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    icon={cat.icon}
                    name={cat.name}
                    description={cat.description}
                    timeline={cat.timeline}
                    selected={category === cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
