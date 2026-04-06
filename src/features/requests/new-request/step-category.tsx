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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { CategoryTile } from './components/category-tile';
import { getAICategorySuggestions } from '@/lib/mock-ai';
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

interface StepCategoryProps {
  category: string;
  categoryDescription: string;
  onUpdate: (data: { category: string; categoryDescription: string }) => void;
}

export function StepCategory({ category, categoryDescription, onUpdate }: StepCategoryProps) {
  const [inputValue, setInputValue] = useState(categoryDescription);
  const [aiSuggestions, setAiSuggestions] = useState<{ category: string; confidence: number }[]>([]);
  const [showNotSure, setShowNotSure] = useState(false);

  const debouncedSearch = useCallback((value: string) => {
    if (value.length >= 3) {
      const suggestions = getAICategorySuggestions(value);
      setAiSuggestions(suggestions);
    } else {
      setAiSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => debouncedSearch(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue, debouncedSearch]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onUpdate({ category, categoryDescription: value });
  };

  const handleCategorySelect = (categoryId: string) => {
    const cat = CATEGORIES.find((c) => c.id === categoryId);
    onUpdate({ category: categoryId, categoryDescription: cat?.name ?? categoryId });
  };

  const handleAiAccept = (suggestion: { category: string; confidence: number }) => {
    const cat = CATEGORIES.find((c) => c.id === suggestion.category);
    if (cat) {
      onUpdate({ category: suggestion.category, categoryDescription: cat.name });
      setAiSuggestions([]);
    }
  };

  const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="need-input" className="block text-sm font-medium text-gray-700 mb-1.5">
          What do you need?
        </label>
        <Input
          id="need-input"
          placeholder="Describe what you need in a few words..."
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          className="text-base h-12"
        />
      </div>

      {aiSuggestions.length > 0 && (
        <AISuggestionCard
          title="Category suggestions based on your description"
          confidence={Math.round(aiSuggestions[0].confidence * 100)}
          showExplanation
          explanation="The AI matched keywords in your description against known procurement categories."
        >
          <div className="space-y-2">
            {aiSuggestions.map((s) => (
              <button
                key={s.category}
                type="button"
                onClick={() => handleAiAccept(s)}
                className="flex w-full items-center justify-between rounded-md border border-blue-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50"
              >
                <span className="font-medium text-gray-900">{categoryLabel(s.category)}</span>
                <span className="text-xs text-gray-500">{Math.round(s.confidence * 100)}% match</span>
              </button>
            ))}
          </div>
        </AISuggestionCard>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">Or select a category</p>
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
          Not sure?
        </Button>
      </div>

      {showNotSure && (
        <AISuggestionCard
          title="Need help choosing?"
          confidence={95}
          onDismiss={() => setShowNotSure(false)}
        >
          <p>
            Describe what you need in the text field above and I will suggest the right category.
            For example: &quot;renew Accenture consulting contract&quot; or &quot;need 10 laptops for new hires&quot;.
          </p>
        </AISuggestionCard>
      )}
    </div>
  );
}
