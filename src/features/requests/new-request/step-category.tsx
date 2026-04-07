import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Wrench,
  Monitor,
  BrainCircuit,
  Users,
  RefreshCw,
  UserPlus,
  HelpCircle,
  ArrowRight,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { CategoryTile } from './components/category-tile';
import { getAIResponse, getAICategorySuggestions } from '@/lib/mock-ai';
import type { RequestCategory } from '@/data/types';

const CATEGORIES = [
  {
    id: 'goods' as RequestCategory,
    name: 'Goods',
    description: 'Physical products, hardware, equipment, furniture',
    timeline: '~5 days',
    icon: Package,
  },
  {
    id: 'services' as RequestCategory,
    name: 'Services',
    description: 'Facilities, catering, cleaning, travel management',
    timeline: '~10 days',
    icon: Wrench,
  },
  {
    id: 'software' as RequestCategory,
    name: 'Software / IT',
    description: 'Licences, SaaS platforms, cloud services, subscriptions',
    timeline: '~8 days',
    icon: Monitor,
  },
  {
    id: 'consulting' as RequestCategory,
    name: 'Consulting',
    description: 'Strategy advisory, audits, assessments, transformation',
    timeline: '~15 days',
    icon: BrainCircuit,
  },
  {
    id: 'contingent-labour' as RequestCategory,
    name: 'Contingent Labour',
    description: 'Temporary staff, contractors, IT staffing, augmentation',
    timeline: '~7 days',
    icon: Users,
  },
  {
    id: 'contract-renewal' as RequestCategory,
    name: 'Contract Renewal',
    description: 'Extend or renew an existing supplier contract',
    timeline: '~12 days',
    icon: RefreshCw,
  },
  {
    id: 'supplier-onboarding' as RequestCategory,
    name: 'Supplier Onboarding',
    description: 'Register and onboard a new vendor to the platform',
    timeline: '~20 days',
    icon: UserPlus,
  },
];

const BUYING_CHANNEL_LABELS: Record<string, string> = {
  'procurement-led': 'Procurement-Led Sourcing',
  'business-led': 'Business-Led Procurement',
  'direct-po': 'Direct Purchase Order',
  'framework-call-off': 'Framework Call-Off',
  'catalogue': 'Catalogue Order',
};

interface StepCategoryProps {
  category: string;
  categoryDescription: string;
  onUpdate: (data: {
    category: string;
    categoryDescription: string;
    title?: string;
    commodityCode?: string;
    commodityCodeLabel?: string;
  }) => void;
}

export function StepCategory({ category, categoryDescription, onUpdate }: StepCategoryProps) {
  const [inputValue, setInputValue] = useState(categoryDescription);
  const [aiSuggestions, setAiSuggestions] = useState<{ category: string; confidence: number }[]>([]);
  const [aiGuidance, setAiGuidance] = useState<{
    response: string;
    confidence: number;
    suggestions?: string[];
    autoFill?: Record<string, string>;
    buyingChannel?: string;
  } | null>(null);
  const [showNotSure, setShowNotSure] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const debouncedSearch = useCallback((value: string) => {
    if (value.length >= 3) {
      const suggestions = getAICategorySuggestions(value);
      setAiSuggestions(suggestions);

      // Also get full AI guidance with buying channel and auto-fill
      const fullResponse = getAIResponse(value, 'intake');
      if (fullResponse) {
        setAiGuidance({
          response: fullResponse.response,
          confidence: fullResponse.confidence,
          suggestions: fullResponse.suggestions,
          autoFill: fullResponse.autoFill,
          buyingChannel: fullResponse.autoFill?.buyingChannel,
        });
      } else {
        setAiGuidance(null);
      }
      setAccepted(false);
    } else {
      setAiSuggestions([]);
      setAiGuidance(null);
      setAccepted(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => debouncedSearch(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue, debouncedSearch]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // Don't update category on every keystroke — only on explicit selection
  };

  const handleCategorySelect = (categoryId: string) => {
    const cat = CATEGORIES.find((c) => c.id === categoryId);
    onUpdate({ category: categoryId, categoryDescription: cat?.name ?? categoryId });
    setAccepted(false);
  };

  const handleAcceptGuidance = () => {
    if (!aiGuidance) return;

    const af = aiGuidance.autoFill ?? {};
    // Use autoFill category, or fall back to best category suggestion
    const selectedCategory = af.category ?? aiSuggestions[0]?.category ?? category;
    const cat = CATEGORIES.find((c) => c.id === selectedCategory);

    onUpdate({
      category: selectedCategory,
      categoryDescription: cat?.name ?? selectedCategory ?? categoryDescription,
      title: inputValue,
      commodityCode: af.commodityCode,
      commodityCodeLabel: af.commodityCodeLabel,
    });
    setAccepted(true);
  };

  const handleAiCategoryAccept = (suggestion: { category: string; confidence: number }) => {
    const cat = CATEGORIES.find((c) => c.id === suggestion.category);
    if (cat) {
      onUpdate({
        category: suggestion.category,
        categoryDescription: cat.name,
        title: inputValue,
      });
      setAiSuggestions([]);
    }
  };

  const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {/* Free text input */}
      <div>
        <label htmlFor="need-input" className="block text-sm font-medium text-gray-700 mb-1.5">
          Describe what you need
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Type naturally — the system will identify the right category, buying channel, and process for you.
        </p>
        <Input
          id="need-input"
          placeholder='e.g., "I need to renew the Accenture consulting contract" or "10 laptops for new hires"'
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          className="text-base h-12"
        />
      </div>

      {/* AI Guidance Card — full intelligent routing */}
      {aiGuidance && !accepted && (
        <div className="rounded-md border-l-2 border-blue-400 bg-blue-50/70 p-4 space-y-4">
          <div className="flex items-start gap-2">
            <Sparkles className="size-4 shrink-0 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-blue-600">AI-assisted routing</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-600">
                  {Math.round(aiGuidance.confidence * 100)}% confidence
                </Badge>
              </div>

              {/* Main guidance text */}
              <p className="mt-2 text-sm text-gray-700">{aiGuidance.response}</p>

              {/* Identified parameters */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {aiGuidance.autoFill?.category && (
                  <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Category</p>
                    <p className="text-sm font-medium text-gray-900">{categoryLabel(aiGuidance.autoFill.category)}</p>
                  </div>
                )}
                {aiGuidance.buyingChannel && (
                  <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Buying Channel</p>
                    <p className="text-sm font-medium text-gray-900">
                      {BUYING_CHANNEL_LABELS[aiGuidance.buyingChannel] ?? aiGuidance.buyingChannel}
                    </p>
                  </div>
                )}
                {aiGuidance.autoFill?.commodityCodeLabel && (
                  <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Commodity Code</p>
                    <p className="text-sm font-medium text-gray-900">
                      {aiGuidance.autoFill.commodityCode} — {aiGuidance.autoFill.commodityCodeLabel}
                    </p>
                  </div>
                )}
                {aiGuidance.autoFill?.category && (
                  <div className="rounded-md bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Est. Timeline</p>
                    <p className="text-sm font-medium text-gray-900">
                      {CATEGORIES.find((c) => c.id === aiGuidance.autoFill?.category)?.timeline ?? '—'}
                    </p>
                  </div>
                )}
              </div>

              {/* Suggested next steps */}
              {aiGuidance.suggestions && aiGuidance.suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">Recommended actions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiGuidance.suggestions.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2.5 py-1 text-xs text-gray-600">
                        <ArrowRight className="size-3 text-blue-500" />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Accept / Change buttons */}
              {(aiGuidance.autoFill?.category || aiSuggestions.length > 0) && (
                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" onClick={handleAcceptGuidance}>
                    <CheckCircle className="size-3.5" />
                    Accept & continue with this route
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAiGuidance(null)}>
                    Choose manually
                  </Button>
                </div>
              )}
              {!aiGuidance.autoFill?.category && aiSuggestions.length === 0 && (
                <div className="mt-4">
                  <p className="text-xs text-blue-600">Add more detail or select a category below to continue.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accepted confirmation */}
      {accepted && aiGuidance && (
        <div className="rounded-md border border-green-200 bg-green-50/50 p-3 flex items-center gap-3">
          <CheckCircle className="size-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              Route accepted: {categoryLabel(aiGuidance.autoFill?.category ?? category)} via {BUYING_CHANNEL_LABELS[aiGuidance.buyingChannel ?? ''] ?? 'standard process'}
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              Category, commodity code, and buying channel have been pre-filled. You can adjust in the next step.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setAccepted(false); setAiGuidance(null); }}>
            Change
          </Button>
        </div>
      )}

      {/* Category-only suggestions (shown alongside or as fallback) */}
      {aiSuggestions.length > 0 && !accepted && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">
            {aiGuidance ? 'Other matching categories' : 'Suggested categories based on your description'}
          </p>
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((s) => (
              <button
                key={s.category}
                type="button"
                onClick={() => handleAiCategoryAccept(s)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-blue-50 hover:border-blue-200"
              >
                <span className="font-medium text-gray-900">{categoryLabel(s.category)}</span>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{Math.round(s.confidence * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fallback when text entered but no matches */}
      {inputValue.length >= 3 && aiSuggestions.length === 0 && !aiGuidance && !accepted && (
        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2">
          <HelpCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-800">
              I couldn&apos;t identify a specific category from your description. Try adding more detail, or select a category below.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Tip: mention what you&apos;re buying (e.g., &quot;laptops&quot;, &quot;consulting&quot;, &quot;software license&quot;) or the action needed (&quot;renew&quot;, &quot;onboard supplier&quot;).
            </p>
          </div>
        </div>
      )}

      {/* Manual category selection */}
      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">
          {aiGuidance || accepted ? 'Or select a different category' : 'Or select a category'}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
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
      </div>

      <div className="flex items-center justify-center">
        <Button variant="ghost" size="sm" onClick={() => setShowNotSure(!showNotSure)}>
          <HelpCircle className="size-4" />
          Not sure what to choose?
        </Button>
      </div>

      {showNotSure && (
        <AISuggestionCard
          title="Let me help you find the right process"
          confidence={95}
          onDismiss={() => setShowNotSure(false)}
        >
          <div className="space-y-2 text-sm">
            <p>Try describing what you need naturally. For example:</p>
            <ul className="space-y-1 text-gray-600">
              <li>&bull; <strong>&quot;I need to renew the Accenture consulting contract&quot;</strong> → Contract Renewal via Procurement-Led</li>
              <li>&bull; <strong>&quot;10 laptops for new hires in Berlin&quot;</strong> → Goods via Catalogue Order</li>
              <li>&bull; <strong>&quot;Cloud hosting migration to AWS&quot;</strong> → Software via Framework Call-Off</li>
              <li>&bull; <strong>&quot;Need a strategy consultant for digital transformation&quot;</strong> → Consulting via Procurement-Led</li>
              <li>&bull; <strong>&quot;Temporary Java developer for 6 months&quot;</strong> → Contingent Labour via Framework Call-Off</li>
            </ul>
            <p className="text-gray-500">
              The AI will identify the category, suggest the right buying channel, and pre-fill details to speed up your request.
            </p>
          </div>
        </AISuggestionCard>
      )}
    </div>
  );
}
