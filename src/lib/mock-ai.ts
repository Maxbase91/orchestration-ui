import type { AIResponse, Supplier, Contract, ProcurementRequest } from '@/data/types';
import { aiResponses } from '@/data/ai-responses';
import { queryClient } from '@/lib/query-client';
import { resolveCategoryCode } from '@/lib/procurement/category-code';

function getSupplierFromCache(id: string): Supplier | undefined {
  const list = queryClient.getQueryData<Supplier[]>(['suppliers', 'list']);
  return (
    list?.find((s) => s.id === id) ??
    queryClient.getQueryData<Supplier>(['suppliers', 'detail', id])
  );
}

function getContractFromCache(id: string): Contract | undefined {
  const list = queryClient.getQueryData<Contract[]>(['contracts', 'list']);
  return (
    list?.find((c) => c.id === id) ??
    queryClient.getQueryData<Contract>(['contracts', 'detail', id])
  );
}

function getRequestFromCache(id: string): ProcurementRequest | undefined {
  const list = queryClient.getQueryData<ProcurementRequest[]>(['requests', 'list']);
  return (
    list?.find((r) => r.id === id) ??
    queryClient.getQueryData<ProcurementRequest>(['requests', 'detail', id])
  );
}

export function getAIResponse(input: string, context: string): AIResponse | null {
  const normalised = input.toLowerCase();

  let bestMatch: AIResponse | null = null;
  let bestScore = 0;

  for (const entry of aiResponses) {
    if (entry.context !== context) continue;

    let score = 0;
    for (const keyword of entry.keywords) {
      if (normalised.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  // Fall back to general context if no match in specific context
  if (!bestMatch) {
    for (const entry of aiResponses) {
      if (entry.context !== 'general') continue;

      let score = 0;
      for (const keyword of entry.keywords) {
        if (normalised.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }
  }

  return bestMatch;
}

export function getAISummary(type: 'request' | 'supplier' | 'contract', id: string): string {
  if (type === 'request') {
    const req = getRequestFromCache(id);
    if (!req) return 'Request not found.';

    const overdueText = req.isOverdue ? ' This request is OVERDUE and requires immediate attention.' : '';
    const referText = req.referBackCount > 0 ? ` It has been referred back ${req.referBackCount} time(s).` : '';

    return `${req.title} is currently in the "${req.status}" stage (day ${req.daysInStage}). ` +
      `Value: €${req.value.toLocaleString()}, priority: ${req.priority}, buying channel: ${req.buyingChannel}. ` +
      `Category: ${req.category}, commodity: ${req.commodityCodeLabel}.${overdueText}${referText}`;
  }

  if (type === 'supplier') {
    const sup = getSupplierFromCache(id);
    if (!sup) return 'Supplier not found.';

    const riskText = sup.riskRating === 'high' || sup.riskRating === 'critical'
      ? ` Risk rating is ${sup.riskRating.toUpperCase()} — exercise caution.`
      : '';
    const sraText = sup.sraStatus === 'expiring'
      ? ` SRA is expiring on ${sup.sraExpiryDate} — renewal action needed.`
      : sup.sraStatus === 'expired'
        ? ' SRA has EXPIRED — reassessment required before new engagements.'
        : '';

    return `${sup.name} (${sup.country}) is a Tier ${sup.tier} supplier with ${sup.activeContracts} active contract(s). ` +
      `12-month spend: €${sup.totalSpend12m.toLocaleString()}, performance score: ${sup.performanceScore}/100. ` +
      `Onboarding: ${sup.onboardingStatus}, screening: ${sup.screeningStatus}.${riskText}${sraText}`;
  }

  if (type === 'contract') {
    const con = getContractFromCache(id);
    if (!con) return 'Contract not found.';

    const statusText = con.status === 'expiring'
      ? ` Contract is EXPIRING on ${con.endDate} — renewal or recompete decision needed.`
      : con.status === 'expired'
        ? ' Contract has EXPIRED.'
        : '';

    return `${con.title} with ${con.supplierName}. Value: €${con.value.toLocaleString()}, ` +
      `status: ${con.status}, utilisation: ${con.utilisationPercentage}%. ` +
      `Period: ${con.startDate} to ${con.endDate}. Owner: ${con.ownerName}.${statusText}`;
  }

  return 'Unknown type.';
}

export function getAICategorySuggestions(input: string): { category: string; confidence: number }[] {
  const normalised = input.toLowerCase();
  const suggestions: { category: string; confidence: number }[] = [];

  const categoryKeywords: Record<string, string[]> = {
    software: ['software', 'license', 'saas', 'platform', 'subscription', 'cloud', 'app', 'tool', 'system', 'application', 'database', 'crm', 'erp', 'sap', 'salesforce', 'databricks', 'microsoft', 'digital'],
    goods: ['hardware', 'equipment', 'furniture', 'device', 'laptop', 'sensor', 'supplies', 'material', 'buy', 'purchase', 'order', 'chair', 'desk', 'monitor', 'phone', 'printer', 'server', 'product', 'item', 'office'],
    services: ['service', 'cleaning', 'catering', 'facility', 'management', 'maintenance', 'travel', 'security', 'support', 'outsourc', 'manage', 'operate', 'provider'],
    consulting: ['consulting', 'advisory', 'audit', 'strategy', 'assessment', 'review', 'transformation', 'consultant', 'advice', 'expert', 'analyse', 'analyze', 'recommend', 'engage'],
    'contingent-labour': ['temp', 'contractor', 'staffing', 'contingent', 'resource', 'developer', 'analyst', 'freelance', 'interim', 'worker', 'hire', 'augment', 'external staff'],
    'contract-renewal': ['renewal', 'renew', 'extend', 'extension', 'expir', 'expire', 'continue', 'prolong'],
    'supplier-onboarding': ['onboard', 'new supplier', 'register supplier', 'vendor registration', 'new vendor', 'add supplier', 'register vendor'],
    'catalogue': ['catalogue', 'catalog', 'standard', 'office supplies', 'stationery', 'toner', 'paper', 'pen', 'notebook', 'cable', 'adapter', 'headset', 'usb', 'batteries', 'labels', 'order', 'reorder'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (normalised.includes(keyword)) {
        matchCount += 1;
      }
    }
    if (matchCount > 0) {
      const confidence = Math.min(0.98, 0.5 + (matchCount * 0.15));
      suggestions.push({ category, confidence });
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, 3);
}

/**
 * Map free text (and optionally the selected category) to a standardised
 * commodity/category code. Delegates to the shared category-code resolver; when
 * a category is supplied, an unmatched description still resolves via the
 * category's default code. See `@/lib/procurement/category-code`.
 */
export function getAICommodityCode(
  description: string,
  category?: string,
): { code: string; label: string; confidence: number } | null {
  const result = resolveCategoryCode({ text: description, category });
  if (!result) return null;
  return { code: result.code, label: result.label, confidence: result.confidence };
}
