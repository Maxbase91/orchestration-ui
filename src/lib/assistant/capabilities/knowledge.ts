import { knowledgeBase } from '../../../data/knowledge-base.js';
import { listKnowledgeBase } from '../../db/knowledge-base.js';
import type { AssistantTurn, KnowledgeEntry } from '../../../data/types.js';
import { db } from '../../db-client.js';
import { loadKnowledgeContextWith } from '../../db/knowledge-core.js';
import { renderKnowledgeBody, stripKnowledgeTokens } from '../../procurement/knowledge-links.js';

// Grounded policy Q&A: the assistant answers from the knowledge base by
// retrieving the most relevant entries, quoting the best match with its source,
// and citing other strongly-relevant policies — rather than asserting a single
// possibly-irrelevant entry. Lexical retrieval today; a vector/RAG pipeline can
// replace `rankKnowledge` without changing the answer shape.
//
// Which entries it ranks over is the part that was wrong. `rankKnowledge`
// defaulted to the built-in `knowledgeBase` array and every caller took the
// default, so the browser assistant answered from a fixture while
// `/admin/kb` wrote to `knowledge_base` — and src/lib/db/knowledge-base.ts's
// own header claimed those entries were "the first thing the assistant's
// retrieval consults". They were not consulted at all.
//
// That was the default configuration, not an edge case: `mockProvider` is the
// provider unless VITE_ASSISTANT_PROVIDER=groq, and groq-provider falls back to
// it on every failure. So an admin adding a policy saw it appear on the admin
// screen, and the assistant kept quoting the shipped set.
//
// The server has always done this correctly (api/chat.ts `execSearchKnowledge`)
// and this mirrors it exactly, including the rule: stored entries REPLACE the
// built-ins when there are any, rather than merging. Merging would make an
// entry an admin deleted keep answering.

export interface RankedEntry {
  entry: KnowledgeEntry;
  score: number;
}

/**
 * Relevance below this means only weak body overlap — treat as low-confidence
 * and offer the closest topics instead of quoting a specific policy.
 */
export const RELEVANCE_FLOOR = 2;

function score(entry: KnowledgeEntry, query: string): number {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  let s = 0;
  // References are scored as the words around them, not as "policy:…" tokens.
  const text = `${entry.title} ${stripKnowledgeTokens(entry.body)} ${entry.tags.join(' ')}`.toLowerCase();
  for (const w of words) {
    if (entry.tags.some((t) => t.includes(w))) s += 3;
    else if (entry.title.toLowerCase().includes(w)) s += 2;
    else if (text.includes(w)) s += 1;
  }
  return s;
}

/** Rank the knowledge base for a query, best-first; entries with no hit drop out. */
export function rankKnowledge(query: string, entries: KnowledgeEntry[] = knowledgeBase): RankedEntry[] {
  return entries
    .map((entry) => ({ entry, score: score(entry, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * The entries to answer from: the admin's, else the built-in set.
 *
 * Replace rather than merge, matching api/chat.ts — an entry an admin deleted
 * must stop answering, and a merged pool would keep it. An unreachable database
 * falls back to the built-ins with a warning rather than leaving the assistant
 * with nothing to say; a knowledge base that cannot be read is not a reason to
 * refuse to answer, but it is a reason to say so somewhere.
 */
export async function knowledgePool(): Promise<KnowledgeEntry[]> {
  try {
    const stored = await listKnowledgeBase();
    if (stored.length > 0) return stored as unknown as KnowledgeEntry[];
  } catch (e) {
    console.warn('[assistant] knowledge base unreadable; answering from the built-in set:', e);
  }
  return knowledgeBase;
}

export async function searchKnowledge(query: string): Promise<AssistantTurn[]> {
  const ranked = rankKnowledge(query, await knowledgePool());
  if (ranked.length === 0) return [];

  const best = ranked[0];

  // Low confidence — don't assert a specific policy on a weak match; surface the
  // closest topics so the user can disambiguate.
  if (best.score < RELEVANCE_FLOOR) {
    const topics = ranked.slice(0, 3).map((r) => `• ${r.entry.title}`).join('\n');
    return [
      {
        type: 'chat-answer',
        content: `I couldn't find an exact policy match. The closest topics are:\n${topics}\n\nAsk about one of these and I'll quote the policy.`,
      },
    ];
  }

  // Grounded answer: quote the best entry with its source, then cite any other
  // strongly-relevant policies so the answer is traceable.
  const related = ranked
    .slice(1)
    .filter((r) => r.score >= Math.max(RELEVANCE_FLOOR, best.score * 0.5))
    .slice(0, 2);

  // Figures come from the live configuration, so the answer states what the
  // platform will actually do — not what the entry said when it was written.
  const ctx = await loadKnowledgeContextWith(db);
  const turns: AssistantTurn[] = [
    {
      type: 'chat-answer',
      content: renderKnowledgeBody(best.entry.body, ctx).text,
      source: best.entry.source,
    },
  ];
  if (related.length > 0) {
    turns.push({
      type: 'chat-answer',
      content: `Related policies: ${related.map((r) => r.entry.title).join(' · ')}`,
    });
  }
  return turns;
}
