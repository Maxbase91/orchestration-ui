// Deterministic demand classifier (CLS-02).
//
// The single source of truth for keyword-based category classification, used by
// the intake step as the local fallback when the governed LLM classifier
// (AI-001) is unavailable, and benchmarked by the classification eval harness
// (CLS-G1, tests/integration/classification-eval.mjs).
//
// Rules are evaluated in order, first-match-wins. The order encodes precedence:
// a "consulting" intent outranks the broad "services" bucket, etc. Anything that
// matches no rule falls through to the default commodity category.

import type { RequestCategory } from '@/data/types';

export interface CategoryRule {
  category: RequestCategory;
  pattern: RegExp;
}

export const DEFAULT_CATEGORY: RequestCategory = 'goods';

export const CATEGORY_RULES: CategoryRule[] = [
  { category: 'consulting', pattern: /consult|advisory|strategy|audit|transformation|business consult|operating model|tom\b|organisational|organizational|change management|programme management|program management|due diligence|feasibility|business case|maturity assessment|roadmap|target state/ },
  { category: 'services', pattern: /\bservice\b|cleaning|catering|maintenance|travel|translation|managed print|managed service|facilities|security guard|payroll|hr admin|helpdesk/ },
  { category: 'software', pattern: /software|saas|license|cloud|platform|subscription|app/ },
  { category: 'contingent-labour', pattern: /temp|contractor|staff|developer|freelance|hire|interim/ },
  { category: 'contract-renewal', pattern: /renew|extend|renewal|expir/ },
  { category: 'supplier-onboarding', pattern: /onboard|new supplier|new vendor|register/ },
  { category: 'catalogue', pattern: /paper|pen|toner|cable|headset|mouse|keyboard|office supplies/ },
];

/**
 * Classify a free-text demand into a commodity category using the keyword
 * rules. Deterministic and side-effect free.
 */
export function classifyDemandCategory(text: string): RequestCategory {
  const q = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(q)) return rule.category;
  }
  return DEFAULT_CATEGORY;
}
