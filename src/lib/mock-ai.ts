import type { AIResponse } from '@/data/types';
import { aiResponses } from '@/data/ai-responses';
import { getRequestById } from '@/data/requests';
import { getSupplierById } from '@/data/suppliers';
import { getContractById } from '@/data/contracts';

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
    const req = getRequestById(id);
    if (!req) return 'Request not found.';

    const overdueText = req.isOverdue ? ' This request is OVERDUE and requires immediate attention.' : '';
    const referText = req.referBackCount > 0 ? ` It has been referred back ${req.referBackCount} time(s).` : '';

    return `${req.title} is currently in the "${req.status}" stage (day ${req.daysInStage}). ` +
      `Value: €${req.value.toLocaleString()}, priority: ${req.priority}, buying channel: ${req.deuba}. ` +
      `Category: ${req.category}, commodity: ${req.commodityCodeLabel}.${overdueText}${referText}`;
  }

  if (type === 'supplier') {
    const sup = getSupplierById(id);
    if (!sup) return 'Supplier not found.';

    const riskText = sup.riskRating === 'high' || sup.riskRating === 'critical'
      ? ` Risk rating is ${sup.riskRating.toUpperCase()} — exercise caution.`
      : '';
    const tpraText = sup.tpraStatus === 'expiring'
      ? ` TPRA is expiring on ${sup.tpraExpiryDate} — renewal action needed.`
      : sup.tpraStatus === 'expired'
        ? ' TPRA has EXPIRED — reassessment required before new engagements.'
        : '';

    return `${sup.name} (${sup.country}) is a Tier ${sup.tier} supplier with ${sup.activeContracts} active contract(s). ` +
      `12-month spend: €${sup.totalSpend12m.toLocaleString()}, performance score: ${sup.performanceScore}/100. ` +
      `Onboarding: ${sup.onboardingStatus}, screening: ${sup.screeningStatus}.${riskText}${tpraText}`;
  }

  if (type === 'contract') {
    const con = getContractById(id);
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
    software: ['software', 'license', 'saas', 'platform', 'subscription', 'cloud', 'app', 'tool'],
    goods: ['hardware', 'equipment', 'furniture', 'device', 'laptop', 'sensor', 'supplies', 'material'],
    services: ['service', 'cleaning', 'catering', 'facility', 'management', 'maintenance', 'travel'],
    consulting: ['consulting', 'advisory', 'audit', 'strategy', 'assessment', 'review', 'transformation'],
    'contingent-labour': ['temp', 'contractor', 'staffing', 'contingent', 'resource', 'developer', 'analyst'],
    'contract-renewal': ['renewal', 'renew', 'extend', 'extension'],
    'supplier-onboarding': ['onboard', 'new supplier', 'register supplier', 'vendor registration'],
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

export function getAICommodityCode(description: string): { code: string; label: string; confidence: number } | null {
  const normalised = description.toLowerCase();

  const commodityMap: { keywords: string[]; code: string; label: string }[] = [
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

  let bestMatch: { code: string; label: string; matchCount: number } | null = null;

  for (const entry of commodityMap) {
    let matchCount = 0;
    for (const keyword of entry.keywords) {
      if (normalised.includes(keyword)) {
        matchCount += 1;
      }
    }
    if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.matchCount)) {
      bestMatch = { code: entry.code, label: entry.label, matchCount };
    }
  }

  if (!bestMatch) return null;

  const confidence = Math.min(0.97, 0.6 + (bestMatch.matchCount * 0.12));
  return { code: bestMatch.code, label: bestMatch.label, confidence };
}
