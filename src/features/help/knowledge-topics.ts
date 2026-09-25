// How the Help page arranges the knowledge base: grouped by topic, a topic
// placed where its first entry sits, entries by their order then title.
//
// Pure, relative imports only, so test:knowledge-links exercises it directly.

import type { KnowledgeEntry } from '../../data/types.js';

/** Where an entry with no topic is listed — last, whatever its order. */
export const UNFILED_TOPIC = 'More';

export interface HelpTopic {
  name: string;
  entries: KnowledgeEntry[];
}

export function helpTopics(entries: KnowledgeEntry[]): HelpTopic[] {
  const sorted = [...entries].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  // Case-insensitive, so "Getting Started" typed once does not split a topic
  // in two; the first spelling met names it.
  const byKey = new Map<string, HelpTopic>();
  for (const entry of sorted) {
    const name = entry.topic.trim() || UNFILED_TOPIC;
    const key = name.toLowerCase();
    const topic = byKey.get(key) ?? { name, entries: [] };
    topic.entries.push(entry);
    byKey.set(key, topic);
  }
  const topics = [...byKey.values()];
  const unfiled = UNFILED_TOPIC.toLowerCase();
  return [...topics.filter((t) => t.name.toLowerCase() !== unfiled), ...topics.filter((t) => t.name.toLowerCase() === unfiled)];
}

/**
 * Does an entry match a search? Every word must appear somewhere the reader can
 * see it — title, topic, tags or the text as rendered with its live figures —
 * so "three quotes" finds the article that says "at least 3 competitive quotes"
 * only if both words are there, and a figure typed as it reads ("€25,000")
 * finds the entry that references it.
 */
export function matchesHelpSearch(entry: KnowledgeEntry, renderedText: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [entry.title, entry.topic, renderedText, ...entry.tags].join('\n').toLowerCase();
  return words.every((word) => haystack.includes(word));
}
