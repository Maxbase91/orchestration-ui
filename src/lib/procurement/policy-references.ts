// Where configuration names a governed threshold: the live "used by" list on
// the Decisioning Thresholds page.
//
// A threshold matters in two ways. The platform's own code reads it (that is
// `POLICY_KEY_META[key].usedIn`, fixed with the code), and configuration can
// name it as a `policy:<key>` token: a routing-rule condition, an
// approval-chain band, a workflow branch, a form trigger, a service-description
// condition, a knowledge-base article. The second list changes whenever an
// admin edits one of those, so it is read from the stored configuration here
// rather than written down anywhere. A key that no code reads and nothing
// names drives nothing, and the page says so.
//
// Pure, relative imports only: test:policy-tokens exercises it under Node.
import { POLICY_TOKEN_PREFIX, type NumericPolicyKey } from './policy-tokens.js';

export type PolicyReferenceKind =
  | 'routing-rule' | 'approval-chain' | 'workflow' | 'form' | 'service-description' | 'knowledge';

export interface PolicyReference {
  kind: PolicyReferenceKind;
  id: string;
  /** What the admin recognises — the rule, chain, template or article name. */
  label: string;
  /** The page that edits it. */
  href: string;
  /** False for a rule or form that exists but is switched off. */
  active: boolean;
}

interface Condition { value: string }

export interface PolicyReferenceSources {
  rules?: Array<{ id: string; name: string; status: string; conditions: Condition[] }>;
  chains?: Array<{ id: string; name: string; minValue?: string | null; maxValue?: string | null }>;
  templates?: Array<{ id: string; name: string; edges: Array<{ condition?: Condition | null }> }>;
  forms?: Array<{ id: string; name: string; status: string; triggerConditions?: Condition[] }>;
  serviceDescriptions?: Array<{
    category: string;
    label: string;
    active: boolean;
    slots: Array<{ conditions?: Condition[]; requiredWhen?: Condition[] }>;
    sections: Array<{ requiredWhen?: Condition[] }>;
  }>;
  knowledge?: Array<{ id: string; title: string; body: string }>;
}

/**
 * Does a stored value name this key? Values can hold more than one token
 * (`between` stores `0,policy:businessLedCeiling`), and a key must not match
 * a longer key it happens to prefix — hence the word boundary after it.
 */
function names(value: string | null | undefined, key: NumericPolicyKey): boolean {
  if (!value) return false;
  return new RegExp(`${POLICY_TOKEN_PREFIX}${key}(?![A-Za-z0-9_])`).test(value);
}

const anyNames = (conditions: Condition[] | undefined, key: NumericPolicyKey) =>
  (conditions ?? []).some((c) => names(c.value, key));

/** Every piece of configuration that names `key`, grouped in page order. */
export function policyReferences(key: NumericPolicyKey, sources: PolicyReferenceSources): PolicyReference[] {
  const out: PolicyReference[] = [];

  for (const rule of sources.rules ?? []) {
    if (anyNames(rule.conditions, key)) {
      out.push({ kind: 'routing-rule', id: rule.id, label: `${rule.id} ${rule.name}`, href: '/admin/rules', active: rule.status === 'active' });
    }
  }
  for (const chain of sources.chains ?? []) {
    const lower = names(chain.minValue, key);
    const upper = names(chain.maxValue, key);
    if (lower || upper) {
      const end = lower && upper ? 'both ends' : lower ? 'lower end' : 'upper end';
      out.push({ kind: 'approval-chain', id: chain.id, label: `${chain.name} chain, ${end} of its band`, href: '/admin/approvals', active: true });
    }
  }
  for (const template of sources.templates ?? []) {
    if (template.edges.some((e) => names(e.condition?.value, key))) {
      out.push({ kind: 'workflow', id: template.id, label: `${template.id} ${template.name}, a branch`, href: '/admin/workflows', active: true });
    }
  }
  for (const form of sources.forms ?? []) {
    if (anyNames(form.triggerConditions, key)) {
      out.push({ kind: 'form', id: form.id, label: `${form.name} form, its trigger`, href: '/admin/forms', active: form.status === 'active' });
    }
  }
  for (const template of sources.serviceDescriptions ?? []) {
    const hit = template.slots.some((s) => anyNames(s.conditions, key) || anyNames(s.requiredWhen, key))
      || template.sections.some((s) => anyNames(s.requiredWhen, key));
    if (hit) {
      out.push({ kind: 'service-description', id: template.category, label: `Service description — ${template.label}`, href: '/admin/service-description', active: template.active });
    }
  }
  // The knowledge base names a threshold as `{{policy:<key>}}`, rendered into
  // the article with the live figure — the article moves when the number does.
  for (const entry of sources.knowledge ?? []) {
    if (names(entry.body, key)) {
      out.push({ kind: 'knowledge', id: entry.id, label: entry.title, href: '/admin/kb', active: true });
    }
  }
  return out;
}
