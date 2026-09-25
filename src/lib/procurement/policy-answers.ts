// Direct answers to the policy questions the platform itself decides.
//
// "Do I need three quotes for €40,000?" has one right answer, and it is the
// one the determination will reach: the competitive-sourcing threshold, the
// minimum quotes and the exempt categories from Decisioning thresholds; the
// approval chain whose band holds the value; the business-led ceiling. So the
// answer is computed from that configuration, not paraphrased by a model or
// quoted from text — the knowledge-base entry follows it as the rule in full.
//
// Pure: the configuration comes in as the knowledge context both sides load.
import { categoryLabel, type KnowledgeContext } from './knowledge-links.js';
import { selectChainForValue } from '../workflow/approval-bands.js';

export interface DirectPolicyAnswer {
  answer: string;
  /** Where the figures came from, in the admin's words. */
  source: string;
}

const money = (n: number) => `€${n.toLocaleString('en-GB')}`;

/** "€40,000", "40k", "EUR 1.2m", "40,000 euros" → 40000. The first amount wins. */
export function parseAmount(text: string): number | null {
  const m = text.match(/(?:€|eur\s?)\s*([\d][\d.,]*)\s*(k|m)?\b|([\d][\d.,]*)\s*(k|m)?\s*(?:€|euros?|eur)\b|\b(\d+(?:[.,]\d+)?)\s*(k|m)\b/i);
  if (!m) return null;
  const digits = m[1] ?? m[3] ?? m[5];
  const suffix = (m[2] ?? m[4] ?? m[6] ?? '').toLowerCase();
  // "40,000" and "1.2" — commas are grouping; a single dot with ≤2 decimals is a decimal point.
  const n = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return n * (suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1);
}

function list(labels: string[]): string {
  return labels.length <= 1 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

export function directPolicyAnswer(question: string, ctx: KnowledgeContext): DirectPolicyAnswer | null {
  const q = question.toLowerCase();
  const value = parseAmount(question);
  const { policy } = ctx;

  if (/\b(quotes?|competitive|tender|bids?|single.?source)\b/.test(q)) {
    const exempt = policy.competitiveSourcingExemptCategories.map((id) => categoryLabel(ctx, id).toLowerCase());
    const unless = `unless the supplier is preferred for the category${exempt.length ? `, the demand is ${list(exempt)}` : ''}, or a single-source justification is approved`;
    const rule = `From ${money(policy.competitiveSourcingThreshold)} you need at least ${policy.minCompetitiveQuotes} competitive quotes, ${unless}.`;
    const source = `Decisioning thresholds — competitive sourcing ${money(policy.competitiveSourcingThreshold)}, ${policy.minCompetitiveQuotes} quotes`;
    if (value === null) return { answer: rule, source };
    return value >= policy.competitiveSourcingThreshold
      ? { answer: `Yes. At ${money(value)} you need at least ${policy.minCompetitiveQuotes} competitive quotes — ${unless}.`, source }
      : { answer: `No. ${money(value)} is below the ${money(policy.competitiveSourcingThreshold)} competitive-sourcing threshold, so one quote is enough.`, source };
  }

  if (/\bcatalog/.test(q) && /\b(approv|auto|straight|sign)/.test(q)) {
    const limit = policy.catalogueAutoApprovalThreshold;
    const source = `Decisioning thresholds — catalogue auto-approval ${money(limit)}`;
    if (value === null) return { answer: `A catalogue order up to ${money(limit)} is approved automatically; above that it goes to your manager.`, source };
    return value <= limit
      ? { answer: `Yes. A ${money(value)} catalogue order is within ${money(limit)}, so it is approved automatically.`, source }
      : { answer: `No. Above ${money(limit)} a catalogue order goes to your manager for approval.`, source };
  }

  if (value !== null && /\b(approv|sign.?off|signs? off|who (approves|signs))/.test(q)) {
    const chain = selectChainForValue(ctx.approvalChains, value, policy);
    if (!chain) return null;
    return {
      answer: `${money(value)} is approved through the ${chain.name} chain: ${chain.steps.map((s) => s.role).join(' → ')}.`,
      source: `Approval chains — ${chain.name}`,
    };
  }

  if (value !== null && /\b(business.?led|procurement.?led|buying channel|channel|who buys|run the sourcing|do (it|this) myself)\b/.test(q)) {
    const ceiling = policy.businessLedCeiling;
    return {
      answer: value <= ceiling
        ? `Up to ${money(ceiling)} your team buys it itself (business-led) — unless it is consulting or contingent labour, which procurement always runs.`
        : `Above ${money(ceiling)} procurement runs the sourcing (procurement-led).`,
      source: `Routing rules · Decisioning thresholds — business-led ceiling ${money(ceiling)}`,
    };
  }

  return null;
}
