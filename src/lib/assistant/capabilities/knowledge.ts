import { knowledgeBase } from '@/data/knowledgeBase';
import type { AssistantTurn, KnowledgeEntry } from '@/data/types';

// Grounded policy Q&A: the assistant answers from the knowledge base by
// retrieving the most relevant entries, quoting the best match with its source,
// and citing other strongly-relevant policies — rather than asserting a single
// possibly-irrelevant entry. Lexical retrieval today; a vector/RAG pipeline can
// replace `rankKnowledge` without changing the answer shape.

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
  const text = `${entry.title} ${entry.body} ${entry.tags.join(' ')}`.toLowerCase();
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

export function searchKnowledge(query: string): AssistantTurn[] {
  const ranked = rankKnowledge(query);
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

  const turns: AssistantTurn[] = [
    {
      type: 'chat-answer',
      content: best.entry.body,
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
