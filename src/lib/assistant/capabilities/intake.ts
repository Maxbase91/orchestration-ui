import type { AssistantTurn } from '@/data/types';
import type { RequestCategory } from '@/data/types';

const categoryKeywords: Record<RequestCategory, string[]> = {
  software: ['software', 'saas', 'app', 'tool', 'platform', 'licence', 'license', 'subscription', 'cloud'],
  services: ['service', 'consultant', 'advisory', 'professional services', 'managed service'],
  consulting: ['consulting', 'advisory', 'strategy', 'audit', 'assessment'],
  goods: ['goods', 'hardware', 'equipment', 'furniture', 'device', 'laptop', 'machine'],
  'contingent-labour': ['contractor', 'temp', 'interim', 'freelance', 'staff aug', 'resource'],
  'contract-renewal': ['renew', 'renewal', 'extend', 'extension'],
  'supplier-onboarding': ['onboard', 'new supplier', 'register'],
  catalogue: ['office', 'stationery', 'supplies', 'pen', 'paper', 'printer', 'toner'],
};

function guessCategory(input: string): RequestCategory {
  const t = input.toLowerCase();
  let best: RequestCategory = 'services';
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(categoryKeywords) as [RequestCategory, string[]][]) {
    const score = keywords.filter((k) => t.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

function extractValue(input: string): number | undefined {
  const match = input.match(/[€$£]?\s*(\d[\d,]*(?:\.\d+)?)\s*[kK]?/);
  if (!match) return undefined;
  let val = parseFloat(match[1].replace(/,/g, ''));
  if (/\d\s*[kK]/.test(match[0])) val *= 1000;
  return val;
}

function extractSupplier(input: string): string | undefined {
  const knownSuppliers = ['Accenture', 'SAP', 'Deloitte', 'Infosys', 'Capgemini', 'Randstad', 'Hays', 'AWS', 'Azure', 'GCP'];
  return knownSuppliers.find((s) => input.toLowerCase().includes(s.toLowerCase()));
}

export function startDemand(input: string): AssistantTurn[] {
  const category = guessCategory(input);
  const value = extractValue(input);
  const supplier = extractSupplier(input);

  // Build query string to pre-populate the wizard
  const params = new URLSearchParams();
  params.set('category', category);
  if (value) params.set('value', String(value));
  if (supplier) params.set('supplier', supplier);
  // Carry the original demand text so the wizard's "Describe what you need" is
  // pre-populated instead of starting blank.
  if (input.trim()) params.set('q', input.trim().slice(0, 300));

  const prefilledNote = [
    `Category: **${category}**`,
    value ? `Estimated value: €${value.toLocaleString()}` : null,
    supplier ? `Preferred supplier: ${supplier}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return [
    {
      type: 'chat-answer',
      content: `I'll take you to the New Request wizard with the details I've gathered so far:\n${prefilledNote}\n\nYou can refine any of these fields in the form.`,
    },
    {
      type: 'deep-link',
      label: 'New Request Wizard',
      description: `Pre-filled: ${prefilledNote}`,
      path: `/requests/new?${params.toString()}`,
    },
  ];
}
