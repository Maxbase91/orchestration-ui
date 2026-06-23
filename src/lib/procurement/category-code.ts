// Category-code mapping (taxonomy translation).
//
// Translates a demand into a standardised commodity/category code (UNSPSC-style)
// + label. Two signals, in order: keyword match on the free-text description,
// then a per-category default so every demand resolves to *some* code (a
// guaranteed translation) even when no keyword hits.
//
// Standardised / white-label: codes are illustrative reference data, not tied to
// any organisation's scheme. Move these tables into the configurable store when a
// real code set is supplied — call sites depend only on `resolveCategoryCode`.

export interface CategoryCode {
  code: string;
  label: string;
}

export interface CategoryCodeResult extends CategoryCode {
  confidence: number;
  source: 'keyword' | 'category-default';
}

/** Keyword → code table. First/strongest keyword match wins. */
export const KEYWORD_CODES: { keywords: string[]; code: string; label: string }[] = [
  { keywords: ['cloud', 'hosting', 'aws', 'azure'], code: '81112200', label: 'Cloud computing services' },
  { keywords: ['laptop', 'computer', 'workstation', 'pc'], code: '43211500', label: 'Laptop computers' },
  { keywords: ['sap', 'erp', 'enterprise software'], code: '43231500', label: 'Enterprise application software' },
  { keywords: ['consulting', 'advisory', 'strategy'], code: '80101600', label: 'Management consulting' },
  { keywords: ['security', 'audit', 'penetration', 'cyber'], code: '81111800', label: 'Information security' },
  { keywords: ['furniture', 'desk', 'chair', 'table'], code: '56101500', label: 'Office furniture' },
  { keywords: ['marketing', 'campaign', 'brand', 'advertising'], code: '80141600', label: 'Marketing campaign management' },
  { keywords: ['temp', 'contractor', 'staffing', 'contingent'], code: '80111600', label: 'Temporary IT staffing' },
  { keywords: ['catering', 'food', 'meal', 'canteen'], code: '90101600', label: 'Catering services' },
  { keywords: ['cleaning', 'janitorial', 'housekeeping'], code: '76111500', label: 'Cleaning services' },
  { keywords: ['print', 'printer', 'copier', 'scan'], code: '44103100', label: 'Managed print services' },
  { keywords: ['sensor', 'iot', 'industrial'], code: '41113600', label: 'Industrial sensors' },
  { keywords: ['network', 'switch', 'router', 'cisco'], code: '43222600', label: 'Network switches' },
  { keywords: ['travel', 'flight', 'hotel', 'booking'], code: '90121500', label: 'Travel management services' },
  { keywords: ['insurance', 'policy', 'coverage', 'indemnity'], code: '84131500', label: 'Insurance services' },
  { keywords: ['tax', 'accounting', 'transfer pricing'], code: '84111500', label: 'Tax advisory services' },
  { keywords: ['data', 'analytics', 'ml', 'ai', 'databricks'], code: '43232100', label: 'Data analytics platforms' },
  { keywords: ['crm', 'salesforce', 'customer'], code: '43231500', label: 'CRM software' },
  { keywords: ['translation', 'localisation', 'language'], code: '82121500', label: 'Translation services' },
  { keywords: ['facility', 'building', 'maintenance'], code: '80131500', label: 'Facilities management' },
  { keywords: ['warehouse', 'racking', 'storage', 'shelving'], code: '24102000', label: 'Industrial shelving and racking' },
  { keywords: ['energy', 'renewable', 'solar', 'wind'], code: '83101800', label: 'Renewable energy services' },
  { keywords: ['event', 'venue', 'conference', 'summit'], code: '80141800', label: 'Event management' },
  { keywords: ['integration', 'middleware', 'api'], code: '43232300', label: 'Integration middleware' },
  { keywords: ['records', 'archive', 'document', 'storage'], code: '80161500', label: 'Records management' },
];

/** Per-category baseline code, applied when no keyword matches. */
export const CATEGORY_DEFAULT_CODES: Record<string, CategoryCode> = {
  catalogue: { code: '44120000', label: 'Office supplies and stationery' },
  goods: { code: '31160000', label: 'General hardware and goods' },
  services: { code: '80100000', label: 'Business and professional services' },
  software: { code: '43230000', label: 'Software' },
  consulting: { code: '80101600', label: 'Management consulting' },
  'contingent-labour': { code: '80111600', label: 'Temporary staffing services' },
  'contract-renewal': { code: '80100000', label: 'Professional services (renewal)' },
  'supplier-onboarding': { code: '80100000', label: 'Supplier onboarding services' },
};

function matchKeywords(text: string): { code: string; label: string; matchCount: number } | null {
  const normalised = text.toLowerCase();
  let best: { code: string; label: string; matchCount: number } | null = null;
  for (const entry of KEYWORD_CODES) {
    let matchCount = 0;
    for (const keyword of entry.keywords) {
      if (normalised.includes(keyword)) matchCount += 1;
    }
    if (matchCount > 0 && (!best || matchCount > best.matchCount)) {
      best = { code: entry.code, label: entry.label, matchCount };
    }
  }
  return best;
}

/**
 * Resolve a demand to a category code. Keyword match wins (confidence scales
 * with the number of hits); otherwise the category's default code is returned
 * at modest confidence so the demand always carries a code. Returns null only
 * when there is neither a keyword match nor a known category.
 */
export function resolveCategoryCode(input: {
  text?: string;
  category?: string;
}): CategoryCodeResult | null {
  const kw = input.text ? matchKeywords(input.text) : null;
  if (kw) {
    return {
      code: kw.code,
      label: kw.label,
      confidence: Math.min(0.97, 0.6 + kw.matchCount * 0.12),
      source: 'keyword',
    };
  }
  const fallback = input.category ? CATEGORY_DEFAULT_CODES[input.category] : undefined;
  if (fallback) {
    return { ...fallback, confidence: 0.5, source: 'category-default' };
  }
  return null;
}
