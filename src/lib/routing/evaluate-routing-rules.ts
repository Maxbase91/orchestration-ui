import type { RoutingRule, BuyingChannel } from '@/data/types';

export interface RoutingContext {
  category?: string;
  value?: number;
  supplierId?: string;
  commodityCode?: string;
  priority?: string;
  isUrgent?: boolean;
}

export interface RoutingMatch {
  channel: BuyingChannel;
  approvalChain: string;
  matchedRule: RoutingRule | null;
}

const BUYING_CHANNEL_LABELS: Record<BuyingChannel, string> = {
  catalogue: 'Catalogue / Direct PO',
  'direct-po': 'Direct PO',
  'business-led': 'Business-Led',
  'procurement-led': 'Procurement-Led Sourcing',
  'framework-call-off': 'Framework Call-Off',
};

export function buyingChannelLabel(channel: BuyingChannel): string {
  return BUYING_CHANNEL_LABELS[channel] ?? channel;
}

function fieldValue(ctx: RoutingContext, field: string): string | number | boolean | undefined {
  switch (field) {
    case 'category': return ctx.category;
    case 'value': return ctx.value;
    case 'supplierId': return ctx.supplierId;
    case 'commodityCode': return ctx.commodityCode;
    case 'priority': return ctx.priority;
    case 'isUrgent': return ctx.isUrgent;
    default: return undefined;
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function evalCondition(
  field: string,
  operator: string,
  value: string,
  ctx: RoutingContext,
): boolean {
  const actual = fieldValue(ctx, field);
  if (actual === undefined) return false;

  switch (operator) {
    case 'equals':
      return String(actual) === value;
    case 'greater_than': {
      const a = toNumber(actual);
      const b = toNumber(value);
      return a !== null && b !== null && a > b;
    }
    case 'less_than': {
      const a = toNumber(actual);
      const b = toNumber(value);
      return a !== null && b !== null && a < b;
    }
    case 'in': {
      const set = value.split(',').map((s) => s.trim());
      return set.includes(String(actual));
    }
    case 'starts_with':
      return String(actual).startsWith(value);
    case 'between': {
      const [lo, hi] = value.split(',').map((s) => Number(s.trim()));
      const a = toNumber(actual);
      return a !== null && Number.isFinite(lo) && Number.isFinite(hi) && a >= lo && a <= hi;
    }
    case 'risk_rating':
      // Supplier-side risk rating is not passed into RoutingContext today.
      // Returning false means rules keyed on risk_rating are a no-op until the
      // caller enriches the context with supplier.risk_rating.
      return false;
    default:
      return false;
  }
}

function ruleMatches(rule: RoutingRule, ctx: RoutingContext): boolean {
  if (rule.status !== 'active') return false;
  if (!rule.conditions || rule.conditions.length === 0) return false;
  return rule.conditions.every((c) => evalCondition(c.field, c.operator, c.value, ctx));
}

export function evaluateRoutingRules(
  rules: RoutingRule[],
  ctx: RoutingContext,
): RoutingMatch | null {
  for (const rule of rules) {
    if (ruleMatches(rule, ctx)) {
      return { channel: rule.action.buyingChannel, approvalChain: rule.action.approvalChain, matchedRule: rule };
    }
  }
  return null;
}

/**
 * Fallback classifier used when no routing rule matches. Mirrors the legacy
 * hard-coded behaviour in step-compliance.tsx so the UI never ends up with
 * an empty channel.
 */
export function fallbackBuyingChannel(ctx: RoutingContext): { channel: BuyingChannel; approvalChain: string } {
  const value = ctx.value ?? 0;
  const category = ctx.category ?? '';
  if (value < 25000) return { channel: 'catalogue', approvalChain: 'line-manager' };
  if (category === 'consulting' || value > 100000) return { channel: 'procurement-led', approvalChain: 'category-manager > finance > vp-procurement' };
  if (category === 'contingent-labour') return { channel: 'framework-call-off', approvalChain: 'category-manager > finance' };
  if (value <= 50000) return { channel: 'business-led', approvalChain: 'category-manager' };
  return { channel: 'procurement-led', approvalChain: 'category-manager > finance > vp-procurement' };
}

export function resolveRouting(
  rules: RoutingRule[],
  ctx: RoutingContext,
): RoutingMatch {
  const match = evaluateRoutingRules(rules, ctx);
  if (match) return match;
  const fb = fallbackBuyingChannel(ctx);
  return { channel: fb.channel, approvalChain: fb.approvalChain, matchedRule: null };
}
