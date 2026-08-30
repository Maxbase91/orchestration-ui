// Conservative first-pass extraction for pasted briefs. It deliberately seeds
// only text the requester supplied; the assistant can enrich missing sections.

import type { ServiceDescription } from '@/features/requests/new-request/new-request-page';

export function seedServiceDescriptionFromText(text: string): Partial<ServiceDescription> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < 120) return {};
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const objective = sentences[0] ?? clean;
  const deliverableSentence = sentences.find((sentence) => /deliver|output|report|milestone|provide/i.test(sentence));
  return {
    objective,
    scope: clean,
    ...(deliverableSentence ? { deliverables: deliverableSentence } : {}),
    captureFlags: { objective: 'answered', scope: 'answered', ...(deliverableSentence ? { deliverables: 'answered' } : {}) },
  };
}
