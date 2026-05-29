import { knowledgeBase } from '@/data/knowledgeBase';
import type { AssistantTurn, KnowledgeEntry } from '@/data/types';

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

export function searchKnowledge(query: string): AssistantTurn[] {
  const scored = knowledgeBase
    .map((e) => ({ entry: e, score: score(e, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [];
  }

  const best = scored[0].entry;

  const turns: AssistantTurn[] = [
    {
      type: 'chat-answer',
      content: best.body,
      source: best.source,
    },
  ];

  // Suggest related entries as chips (top 2 other results)
  const related = scored.slice(1, 3).map((x) => ({
    label: x.entry.title,
    prompt: x.entry.title,
  }));
  if (related.length > 0) {
    turns.push({ type: 'suggestion-chips', chips: related });
  }

  return turns;
}
