// The one route a free-text question takes — in the Home box and in the
// assistant.
//
// Order matters. A status question names a record or "my …" and is
// unambiguous, so it goes first. Then an item the catalogue actually serves.
// Then a question-shaped policy query — before the demand check, which would
// read "do I *need* three quotes?" as a demand for quotes. Then a demand, which
// goes to intake with the requester's words. Everything else is the model's.
//
// This lived inside the Home box, and the assistant had a router of its own —
// a regex intent scorer with supplier names typed into it — so the same
// sentence could be answered from the configuration on Home and guessed at by
// the model in the chat. The Home box's version also kept a table of nine
// supplier names mapped to profile links, for lookups it then never used: any
// lookup went to the assistant anyway.
//
// Pure: the status and policy lookups are passed in, so this runs under Node.
// Relative imports only.

import type { CatalogueItem } from '../../data/catalogue-items.js';
import { decideIntakeRoute } from '../procurement/intake-routing.js';
import { classifyDemandCategory, matchesDemandCategory, type ClassifierCategory } from '../procurement/classify.js';
import { parseStatusQuestion, type StatusAnswer, type StatusQuestion } from './status-answer.js';
import type { PolicyAnswer } from './policy-lookup.js';

export interface QuestionRouteData {
  catalogueItems: CatalogueItem[];
  /** Categories the catalogue may serve (Admin → Categories, catalogue eligible). */
  catalogueEligibleCategories: string[];
  /** The configured categories — their keywords recognise a demand. */
  categories: ClassifierCategory[];
}

export interface QuestionRouteDeps {
  /** Null when the question is not one the status agent can answer. */
  status: (query: string, question: StatusQuestion) => Promise<StatusAnswer | null>;
  /** Null when neither the configuration nor the knowledge base has an answer. */
  policy: (query: string) => Promise<PolicyAnswer | null>;
}

export interface QuestionRouteOptions {
  /**
   * A message after the first in a conversation. There, naming something
   * procurable is not enough to make a demand — "and for consulting?" asks
   * about consulting, it does not order it — so a demand must say it wants
   * something. The first message, like the Home box, is read on its own.
   */
  followUp?: boolean;
}

export type QuestionRoute =
  | { kind: 'status'; status: StatusAnswer }
  | { kind: 'policy'; policy: PolicyAnswer }
  | { kind: 'catalogue'; items: CatalogueItem[] }
  | { kind: 'demand' }
  | { kind: 'assistant' };

/**
 * Openers that make a phrase a lookup rather than a demand. Anchored: "find a
 * supplier" is a lookup, "we need to find a cleaning supplier" is a demand that
 * happens to contain the word.
 */
const LOOKUP_OPENERS = /^\s*(find|show|list|open|search|where|which|who|when|how many)\b/i;

/** Verbs that state an intent to acquire. */
const DEMAND_VERBS = /\b(buy|buying|purchase|purchasing|need|want|order|procure|hire|engage|require|looking for|source|sourcing|contract for)\b/i;

/** Asking for a person is a handover, whatever else the sentence contains. */
const HANDOVER = /\b(speak|talk) (to|with)\b|\b(a human|a person|someone)\b/i;

/**
 * "Need", "want" and "order" also ask for help or about something already
 * bought: "I need help", "track my order". Neither is a demand.
 */
const NOT_A_DEMAND = /\b(need|want|require)s? (some )?(help|advice|information|info|to know|to understand|to ask|to check)\b|\b(status|track|tracking)\b/i;

/**
 * The catalogue items that serve this demand, or none. The same category-gated,
 * naming-word decision the intake conversation makes when it checks how a
 * demand is bought — one decision, both doors. Contracts are not checked here: the box decides only "order this
 * from the catalogue" or "take it to intake", and intake runs the contract check.
 */
export function catalogueItemsFor(query: string, data: QuestionRouteData): CatalogueItem[] {
  const decision = decideIntakeRoute(
    {
      text: query,
      category: classifyDemandCategory(query, data.categories),
      estimatedValue: 0,
      supplierId: '',
    },
    { catalogueItems: data.catalogueItems, contracts: [], catalogueEligibleCategories: data.catalogueEligibleCategories },
  );
  return decision.route === 'catalogue' ? decision.catalogueMatches.map((m) => m.item) : [];
}

/** Is this a demand for intake? */
export function isDemand(query: string, categories: ClassifierCategory[], options: QuestionRouteOptions = {}): boolean {
  if (LOOKUP_OPENERS.test(query) || HANDOVER.test(query) || NOT_A_DEMAND.test(query)) return false;
  if (DEMAND_VERBS.test(query)) return true;
  // Naming something procurable is a demand as much as saying "buy" in front of
  // it — "cleaning services for the Berlin office" — but only on its own.
  return !options.followUp && matchesDemandCategory(query, categories);
}

/**
 * Question-shaped and not a demand in disguise — worth trying as policy.
 * "Can I buy a laptop?" is a demand phrased as a question, not a policy query.
 */
const QUESTION_START = /^\s*(do|does|did|can|could|may|must|should|shall|is|are|am|how|what|when|which|who|why|where)\b/i;
const DEMAND_QUESTION = /^\s*(can|could|may) (i|we) (please )?(buy|order|get|purchase|have|procure)\b/i;

export function looksLikePolicyQuestion(text: string): boolean {
  return (QUESTION_START.test(text) || text.trim().endsWith('?')) && !DEMAND_QUESTION.test(text);
}

export async function routeQuestion(
  query: string,
  data: QuestionRouteData,
  deps: QuestionRouteDeps,
  options: QuestionRouteOptions = {},
): Promise<QuestionRoute> {
  const text = query.trim();

  const statusQuestion = parseStatusQuestion(text);
  if (statusQuestion) {
    const status = await deps.status(text, statusQuestion);
    if (status) return { kind: 'status', status };
  }

  const items = catalogueItemsFor(text, data);
  if (items.length > 0) return { kind: 'catalogue', items };

  if (looksLikePolicyQuestion(text)) {
    const policy = await deps.policy(text);
    if (policy) return { kind: 'policy', policy };
  }

  if (isDemand(text, data.categories, options)) return { kind: 'demand' };
  return { kind: 'assistant' };
}
