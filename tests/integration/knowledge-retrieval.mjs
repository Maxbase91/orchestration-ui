#!/usr/bin/env node
// Grounded policy-Q&A retrieval (AST-P), and the pool it retrieves from.
//
// THIS FILE USED TO MIRROR THE MODULE IT TESTS — its own `score`,
// `rankKnowledge` and `searchKnowledge`, under a header saying "keep in sync".
// The copies were faithful, which is why they were useless: the real
// `rankKnowledge` defaulted to the built-in `knowledgeBase` array and every
// caller took the default, so the browser assistant answered from a fixture
// while `/admin/kb` wrote to the `knowledge_base` table. A mirror of the ranking
// function cannot see that the wrong thing is being ranked.
//
// That was the DEFAULT configuration: `mockProvider` is the provider unless
// VITE_ASSISTANT_PROVIDER=groq, and groq-provider falls back to it on every
// failure. So an admin's edit was invisible to the assistant in the normal case
// and in every degraded one.
//
// The ranking checks now drive the real functions. The pool check is the new
// one, and it is the point of the file.
// Run: npm run test:knowledge

import { readFileSync } from 'node:fs';
import {
  rankKnowledge, searchKnowledge, knowledgePool, RELEVANCE_FLOOR,
} from '../../src/lib/assistant/capabilities/knowledge.ts';
import { knowledgeBase } from '../../src/data/knowledge-base.ts';

const ROOT = new URL('../../', import.meta.url);
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// Fixtures: inputs and expected answers, never reimplementations.
const KB = [
  { id: 'K1', title: 'Procurement Approval Thresholds', body: 'Spend up to 10k manager; above needs finance.', tags: ['threshold', 'approval', 'limit', 'spend'], source: 'Policy §3.2' },
  { id: 'K2', title: 'Consulting Services Threshold', body: 'Consulting above 50k requires three quotes.', tags: ['consulting', 'threshold', 'quote'], source: 'Policy §4.1' },
  { id: 'K3', title: 'Supplier Risk Assessment', body: 'An SRA is required annually for tier-1 suppliers handling data.', tags: ['sra', 'risk', 'supplier'], source: 'Policy §7' },
];
const scoreOf = (entry, query) => rankKnowledge(query, [entry])[0]?.score ?? 0;

console.log('Ranking');
check('tag hit ranks the right entry first', rankKnowledge('what is the approval threshold', KB)[0].entry.id === 'K1');
check('tag weighted above title/body', scoreOf(KB[0], 'threshold') === 3);
check('title hit scores 2', scoreOf({ title: 'Catalogue Ordering', body: 'x', tags: [] }, 'catalogue') === 2);
check('body-only hit scores 1', scoreOf({ title: 'Z', body: 'annually reviewed', tags: [] }, 'annually') === 1);
check('irrelevant query → empty ranking', rankKnowledge('weather forecast tomorrow', KB).length === 0);
check('the relevance floor is a real threshold, not zero', RELEVANCE_FLOOR > 0);

// ── The pool ───────────────────────────────────────────────────────────────
console.log('\nThe assistant answers from the admin’s knowledge base');

// Stub the one data path. `knowledgePool` calls `listKnowledgeBase`, which goes
// through src/lib/db-client.ts to /api/db — the single boundary, so intercepting
// fetch is intercepting the whole read rather than a module seam invented here.
const STORED = [
  { id: 'DB1', title: 'Stored Policy', body: 'This entry lives in the database.', tags: ['stored'], source: 'Admin' },
];
const realFetch = globalThis.fetch;
const stubFetch = (rows, { fail = false } = {}) => {
  globalThis.fetch = async () => {
    if (fail) throw new Error('network down');
    return new Response(JSON.stringify({ data: rows, error: null }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
};

try {
  stubFetch(STORED);
  const stored = await knowledgePool();
  check('a stored entry reaches the assistant', stored.some((e) => e.id === 'DB1'),
    stored.map((e) => e.id).join(', '));
  // Replace, not merge: an entry an admin DELETED must stop answering, and a
  // merged pool would keep every built-in answering forever.
  check('the built-in set is replaced, not merged',
    !stored.some((e) => knowledgeBase.some((b) => b.id === e.id)),
    stored.map((e) => e.id).join(', '));

  const answer = await searchKnowledge('stored');
  check('the stored entry is what gets quoted',
    answer.some((t) => t.content === STORED[0].body),
    JSON.stringify(answer).slice(0, 120));

  // An empty table is not a configuration — nobody has populated it yet — so the
  // built-ins still answer. Same rule as api/chat.ts.
  stubFetch([]);
  const empty = await knowledgePool();
  check('an empty table falls back to the built-in set', empty.length === knowledgeBase.length);

  // An unreachable database must not leave the assistant mute.
  stubFetch(null, { fail: true });
  const unreachable = await knowledgePool();
  check('an unreachable database falls back rather than failing',
    unreachable.length === knowledgeBase.length);
} finally {
  globalThis.fetch = realFetch;
}

// The default provider is the one that had the defect, so this is not a
// hypothetical path — it is the path.
const index = readFileSync(new URL('src/lib/assistant/index.ts', ROOT), 'utf8');
check('mock is still the default provider (so this path is the normal one)',
  /VITE_ASSISTANT_PROVIDER === 'groq' \? groqProvider : mockProvider/.test(index));
const groq = readFileSync(new URL('src/lib/assistant/groq-provider.ts', ROOT), 'utf8');
check('and the fallback on failure, so a degraded run reads the same pool',
  /mockProvider\.respond/.test(groq));

// ── Answer shape ───────────────────────────────────────────────────────────
console.log('\nGrounded answer');
stubFetch(KB);
try {
  const g = await searchKnowledge('consulting threshold for quotes');
  check('strong match → grounded answer', g.length > 0 && g[0].type === 'chat-answer');
  check('grounded answer quotes the best entry body', g[0]?.content === KB[1].body, g[0]?.content);
  check('grounded answer carries the source citation', g[0]?.source === 'Policy §4.1');

  console.log('\nRelated citations');
  const multi = await searchKnowledge('threshold'); // matches K1 (tag) and K2 (tag)
  check('cites a related policy when another is strongly relevant',
    multi.some((t) => /Related policies:/.test(t.content ?? '')));

  console.log('\nLow confidence');
  const low = await searchKnowledge('data'); // only a weak body hit in K3
  check('weak-only match → no asserted policy',
    low.length === 1 && /couldn.t find an exact policy match/.test(low[0].content ?? ''),
    JSON.stringify(low).slice(0, 120));
  check('low-confidence offers closest topics', /Supplier Risk Assessment/.test(low[0]?.content ?? ''));

  console.log('\nNo match');
  check('no overlap → nothing to say', (await searchKnowledge('helicopter')).length === 0);
} finally {
  globalThis.fetch = realFetch;
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All knowledge-retrieval checks passed.');
