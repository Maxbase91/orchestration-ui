// Knowledge-base text linked to the configuration it describes.
//
// The policy knowledge base restated figures the platform governs elsewhere,
// and they had drifted: it told requesters catalogue orders under €500 need no
// approval while Decisioning thresholds auto-approve up to €1,000, and its
// approval bands matched none of the approval chains. A policy answer that
// contradicts what the platform then does is worse than no answer.
//
// So an entry names a governed figure instead of restating it, with a token
// rendered at answer time from the live configuration:
//
//   {{policy:<key>}}                 a Decisioning threshold (numeric or category list)
//   {{approval-chains}}              every value-banded approval chain, as a list
//   {{preferred-suppliers:<cat>}}    the category's preferred suppliers
//
// Figures the platform does not enforce (insurance minimums, an ESG score)
// stay plain text: the entry is then "policy text only", which the admin page
// says, so nobody mistakes it for a control.
//
// Dependency-free beyond other relative modules, so api/chat.ts renders with
// the same code the browser does.
import type { PolicyConfig } from './policy-config.js';
import {
  POLICY_KEY_META, CATEGORY_LIST_POLICY_META,
  type NumericPolicyKey, type CategoryListPolicyKey,
} from './policy-tokens.js';
import { resolveBand, bandLabel, type BandSpec } from '../workflow/approval-bands.js';

export interface KnowledgeChain extends BandSpec {
  id: string;
  name: string;
  steps: Array<{ role: string }>;
}

export interface KnowledgeContext {
  policy: PolicyConfig;
  approvalChains: KnowledgeChain[];
  /** Category id → preferred supplier names, as configured under Categories. */
  preferredSuppliers: Record<string, string[]>;
  /** Category id → its configured label. Unknown ids read as themselves. */
  categoryLabels: Record<string, string>;
}

export type KnowledgeLinkKind = 'threshold' | 'category-list' | 'approval-chains' | 'preferred-suppliers';

export interface KnowledgeLink {
  token: string;
  kind: KnowledgeLinkKind | 'unknown';
  /** What the token stands for, in the admin's words. */
  label: string;
  /** False for a token that names nothing — a typo'd key, an unknown category. */
  valid: boolean;
}

const TOKEN = /\{\{\s*([a-z-]+)(?::([A-Za-z0-9-]+))?\s*\}\}/g;

const isNumericKey = (k: string): k is NumericPolicyKey => k in POLICY_KEY_META;
const isListKey = (k: string): k is CategoryListPolicyKey => k in CATEGORY_LIST_POLICY_META;

function describeToken(kind: string, arg: string | undefined, categoryIds?: ReadonlySet<string>): Omit<KnowledgeLink, 'token'> {
  if (kind === 'policy' && arg && isNumericKey(arg)) return { kind: 'threshold', label: POLICY_KEY_META[arg].label, valid: true };
  if (kind === 'policy' && arg && isListKey(arg)) return { kind: 'category-list', label: CATEGORY_LIST_POLICY_META[arg].label, valid: true };
  if (kind === 'approval-chains' && !arg) return { kind: 'approval-chains', label: 'Approval chains', valid: true };
  if (kind === 'preferred-suppliers' && arg) {
    // Without the category list the name cannot be checked, so it is taken as
    // given; the admin page passes the list and flags an unknown category.
    const valid = !categoryIds || categoryIds.has(arg);
    return { kind: 'preferred-suppliers', label: `Preferred suppliers — ${arg}`, valid };
  }
  return { kind: 'unknown', label: 'Unknown reference', valid: false };
}

/**
 * The configuration an entry links to. Empty means "policy text only".
 * Pass the category ids to have an unknown category flagged.
 */
export function knowledgeLinks(body: string, categoryIds?: ReadonlySet<string>): KnowledgeLink[] {
  const seen = new Map<string, KnowledgeLink>();
  for (const m of body.matchAll(TOKEN)) {
    if (!seen.has(m[0])) seen.set(m[0], { token: m[0], ...describeToken(m[1], m[2], categoryIds) });
  }
  return [...seen.values()];
}

const GROUPING = new Intl.NumberFormat('en-GB');

function formatThreshold(key: NumericPolicyKey, value: number): string {
  const unit = POLICY_KEY_META[key].unit;
  if (unit === '€') return `€${GROUPING.format(value)}`;
  if (unit === '%') return `${GROUPING.format(value)}%`;
  if (unit === 'days') return `${GROUPING.format(value)} days`;
  if (unit === '/100') return `${GROUPING.format(value)}/100`;
  return GROUPING.format(value);
}

/** The configured label, or the id in words — never a raw "contingent-labour". */
export function categoryLabel(ctx: Pick<KnowledgeContext, 'categoryLabels'>, id: string): string {
  const label = ctx.categoryLabels[id];
  if (label) return label;
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Value-banded chains, lowest band first; a chain reached only by a routing rule is left out. */
function renderChains(ctx: KnowledgeContext): string {
  const banded = ctx.approvalChains
    .map((chain) => ({ chain, band: resolveBand(chain, ctx.policy) }))
    .filter((c): c is { chain: KnowledgeChain; band: NonNullable<typeof c.band> } => c.band !== null)
    .sort((a, b) => a.band.min - b.band.min);
  if (banded.length === 0) return 'No approval chain is configured by value.';
  return banded
    .map(({ chain }) => `• ${bandLabel(chain, ctx.policy)}: ${chain.name} — ${chain.steps.map((s) => s.role).join(' → ')}`)
    .join('\n');
}

export interface RenderedKnowledge {
  text: string;
  links: KnowledgeLink[];
  /** Tokens that named nothing. They are left in the text, visibly, not dropped. */
  unresolved: string[];
}

/** An entry's text with every linked figure filled in from the live configuration. */
export function renderKnowledgeBody(body: string, ctx: KnowledgeContext): RenderedKnowledge {
  const unresolved: string[] = [];
  const text = body.replace(TOKEN, (token, kind: string, arg: string | undefined) => {
    if (kind === 'policy' && arg && isNumericKey(arg)) return formatThreshold(arg, ctx.policy[arg]);
    if (kind === 'policy' && arg && isListKey(arg)) {
      const labels = ctx.policy[arg].map((id) => categoryLabel(ctx, id));
      return labels.length ? joinList(labels) : 'none';
    }
    if (kind === 'approval-chains' && !arg) return renderChains(ctx);
    if (kind === 'preferred-suppliers' && arg) {
      const names = ctx.preferredSuppliers[arg] ?? [];
      return names.length ? joinList(names) : 'none set for this category';
    }
    unresolved.push(token);
    return token;
  });
  return { text, links: knowledgeLinks(body), unresolved };
}

/**
 * The entry's text with its references removed, for relevance scoring. Scoring
 * the raw body let a question containing "policy" match every linked entry on
 * the token prefix alone.
 */
export function stripKnowledgeTokens(body: string): string {
  return body.replace(TOKEN, ' ');
}

/** The references an admin can insert, for the editor's help list. */
export function availableKnowledgeTokens(categoryIds: string[]): Array<{ token: string; label: string }> {
  return [
    ...(Object.keys(POLICY_KEY_META) as NumericPolicyKey[]).map((k) => ({ token: `{{policy:${k}}}`, label: POLICY_KEY_META[k].label })),
    ...(Object.keys(CATEGORY_LIST_POLICY_META) as CategoryListPolicyKey[]).map((k) => ({ token: `{{policy:${k}}}`, label: CATEGORY_LIST_POLICY_META[k].label })),
    { token: '{{approval-chains}}', label: 'Approval chains by value' },
    ...categoryIds.map((id) => ({ token: `{{preferred-suppliers:${id}}}`, label: `Preferred suppliers — ${id}` })),
  ];
}
