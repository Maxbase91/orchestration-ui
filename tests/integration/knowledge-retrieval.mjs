#!/usr/bin/env node
// Verifies grounded policy-Q&A retrieval (AST-P).
//
// Self-contained — mirrors src/lib/assistant/capabilities/knowledge.ts
// (score / rankKnowledge / searchKnowledge). Keep in sync.
// Run: node tests/integration/knowledge-retrieval.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const RELEVANCE_FLOOR = 2;
function score(entry, query) {
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
function rankKnowledge(query, entries) {
  return entries.map((entry) => ({ entry, score: score(entry, query) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}
function searchKnowledge(query, kb) {
  const ranked = rankKnowledge(query, kb);
  if (ranked.length === 0) return { kind: 'none', turns: [] };
  const best = ranked[0];
  if (best.score < RELEVANCE_FLOOR) {
    return { kind: 'low-confidence', turns: [{ content: 'closest topics', titles: ranked.slice(0, 3).map((r) => r.entry.title) }] };
  }
  const related = ranked.slice(1).filter((r) => r.score >= Math.max(RELEVANCE_FLOOR, best.score * 0.5)).slice(0, 2);
  const turns = [{ content: best.entry.body, source: best.entry.source }];
  if (related.length) turns.push({ content: `Related policies: ${related.map((r) => r.entry.title).join(' · ')}` });
  return { kind: 'grounded', turns, best: best.entry, related };
}

const KB = [
  { id: 'K1', title: 'Procurement Approval Thresholds', body: 'Spend up to 10k manager; above needs finance.', tags: ['threshold', 'approval', 'limit', 'spend'], source: 'Policy §3.2' },
  { id: 'K2', title: 'Consulting Services Threshold', body: 'Consulting above 50k requires three quotes.', tags: ['consulting', 'threshold', 'quote'], source: 'Policy §4.1' },
  { id: 'K3', title: 'Supplier Risk Assessment', body: 'An SRA is required annually for tier-1 suppliers handling data.', tags: ['sra', 'risk', 'supplier'], source: 'Policy §7' },
];

console.log('Ranking');
check('tag hit ranks the right entry first', rankKnowledge('what is the approval threshold', KB)[0].entry.id === 'K1');
check('tag weighted above title/body', score(KB[0], 'threshold') === 3);
check('title hit scores 2', score({ title: 'Catalogue Ordering', body: 'x', tags: [] }, 'catalogue') === 2);
check('body-only hit scores 1', score({ title: 'Z', body: 'annually reviewed', tags: [] }, 'annually') === 1);
check('irrelevant query → empty ranking', rankKnowledge('weather forecast tomorrow', KB).length === 0);

console.log('Grounded answer');
const g = searchKnowledge('consulting threshold for quotes', KB);
check('strong match → grounded answer', g.kind === 'grounded');
check('grounded answer quotes the best entry body', g.turns[0].content === KB[1].body);
check('grounded answer carries the source citation', g.turns[0].source === 'Policy §4.1');

console.log('Related citations');
const multi = searchKnowledge('threshold', KB); // matches K1 (tag) and K2 (tag)
check('cites a related policy when another is strongly relevant', multi.turns.some((t) => /Related policies:/.test(t.content)));

console.log('Low confidence');
const low = searchKnowledge('data', KB); // only a weak body hit in K3
check('weak-only match → low-confidence (no asserted policy)', low.kind === 'low-confidence');
check('low-confidence offers closest topics', low.turns[0].titles.length >= 1);

console.log('No match');
check('no overlap → none', searchKnowledge('helicopter', KB).kind === 'none');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All knowledge-retrieval checks passed.');
