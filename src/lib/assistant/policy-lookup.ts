// Answering a policy question on Home: the direct answer the configuration
// gives (policy-answers.ts), and the knowledge-base entry that states the rule
// in full, its figures rendered from the same configuration.
import { db } from '../db-client.js';
import { loadKnowledgeContextWith } from '../db/knowledge-core.js';
import { renderKnowledgeBody } from '../procurement/knowledge-links.js';
import { directPolicyAnswer, type DirectPolicyAnswer } from '../procurement/policy-answers.js';
import { knowledgePool, rankKnowledge, RELEVANCE_FLOOR } from './capabilities/knowledge.js';

export interface PolicyAnswer {
  direct: DirectPolicyAnswer | null;
  entry: { id: string; title: string; text: string; source: string } | null;
  /** Closest topics when nothing matched well enough to quote. */
  topics: string[];
}

const QUESTION_START = /^\s*(do|does|did|can|could|may|must|should|shall|is|are|am|how|what|when|which|who|why|where)\b/i;
// "Can I buy a laptop?" is a demand phrased as a question, not a policy query.
const DEMAND_QUESTION = /^\s*(can|could|may) (i|we) (please )?(buy|order|get|purchase|have|procure)\b/i;

/** Question-shaped and not a demand in disguise — worth trying as policy. */
export function looksLikePolicyQuestion(text: string): boolean {
  return (QUESTION_START.test(text) || text.trim().endsWith('?')) && !DEMAND_QUESTION.test(text);
}

/** Null when neither the configuration nor the knowledge base has anything to say. */
export async function answerPolicyQuestion(text: string): Promise<PolicyAnswer | null> {
  const [pool, ctx] = await Promise.all([knowledgePool(), loadKnowledgeContextWith(db)]);
  const direct = directPolicyAnswer(text, ctx);
  const ranked = rankKnowledge(text, pool);
  const best = ranked[0];
  const entry = best && best.score >= RELEVANCE_FLOOR
    ? { id: best.entry.id, title: best.entry.title, text: renderKnowledgeBody(best.entry.body, ctx).text, source: best.entry.source }
    : null;
  const topics = entry ? [] : ranked.slice(0, 3).map((r) => r.entry.title);
  if (!direct && !entry) return null;
  return { direct, entry, topics };
}
