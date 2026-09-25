#!/usr/bin/env node
// The policy knowledge base, linked to the configuration it describes.
//
// The built-in entries restated governed figures and had drifted from them
// (catalogue auto-approval "under €500" against a governed €1,000; approval
// bands matching no chain). Entries now reference the figures, and this suite
// holds that: every reference names something, every governed amount in the
// text is a reference or explicitly marked as policy text, both the browser
// and the server render through the same code, and the live table matches.
//
// Run: npm run test:knowledge-links
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import { knowledgeBase } from '../../src/data/knowledge-base.ts';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import { CURRENCY_POLICY_KEYS } from '../../src/lib/procurement/policy-tokens.ts';
import {
  knowledgeLinks, renderKnowledgeBody, stripKnowledgeTokens, availableKnowledgeTokens,
} from '../../src/lib/procurement/knowledge-links.ts';
import { directPolicyAnswer, parseAmount } from '../../src/lib/procurement/policy-answers.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const categoryIds = new Set(DEFAULT_CATEGORY_TAXONOMY.map((c) => c.id));
// The live chains' shape: bands as literals and policy references.
const CHAINS = [
  { id: 'chain-2', name: 'Fast-Track', minValue: null, maxValue: '10000', steps: [{ role: 'Category Manager' }] },
  { id: 'chain-1', name: 'Standard', minValue: '10000', maxValue: 'policy:budgetApprovalThreshold', steps: [{ role: 'Budget Owner' }, { role: 'Finance' }] },
  { id: 'chain-4', name: 'Board-Level', minValue: 'policy:delegatedAuthorityThreshold', maxValue: null, steps: [{ role: 'CFO' }] },
  { id: 'chain-compliance', name: 'Compliance Escalation', minValue: null, maxValue: null, steps: [{ role: 'Legal' }] },
];
const ctx = {
  policy: DEFAULT_POLICY_CONFIG,
  approvalChains: CHAINS,
  preferredSuppliers: { consulting: ['Beta Advisory', 'Alpha Partners'] },
  categoryLabels: Object.fromEntries(DEFAULT_CATEGORY_TAXONOMY.map((c) => [c.id, c.label])),
};

console.log('References resolve');
const rendered = renderKnowledgeBody('{{policy:competitiveSourcingThreshold}} · {{policy:minCompetitiveQuotes}} · {{policy:contractUtilisationHeadroom}} · {{policy:contractExpiryBufferDays}}', ctx);
check('a threshold renders in its unit', rendered.text === '€25,000 · 3 · 95% · 60 days', rendered.text);
check('a category list renders as labels',
  renderKnowledgeBody('{{policy:competitiveSourcingExemptCategories}}', ctx).text === ctx.categoryLabels['contingent-labour']);
check('preferred suppliers render as names', renderKnowledgeBody('{{preferred-suppliers:consulting}}', ctx).text === 'Beta Advisory and Alpha Partners');
check('a category with none set says so', /none set/.test(renderKnowledgeBody('{{preferred-suppliers:goods}}', ctx).text));
const chains = renderKnowledgeBody('{{approval-chains}}', ctx).text;
check('approval chains list lowest band first', chains.indexOf('Fast-Track') < chains.indexOf('Standard') && chains.indexOf('Standard') < chains.indexOf('Board-Level'), chains);
check('a band follows its governed threshold', /€10,000 – €100,000: Standard/.test(chains), chains);
check('a chain reached only by a routing rule is not listed by value', !/Compliance Escalation/.test(chains));
const moved = renderKnowledgeBody('{{policy:catalogueAutoApprovalThreshold}}', { ...ctx, policy: { ...ctx.policy, catalogueAutoApprovalThreshold: 2500 } }).text;
check('changing the threshold changes the answer', moved === '€2,500', moved);
const bad = renderKnowledgeBody('{{policy:noSuchKey}} and {{whatever}}', ctx);
check('a reference that names nothing is reported, not silently dropped', bad.unresolved.length === 2 && bad.text.includes('{{policy:noSuchKey}}'));
check('an unknown category is flagged when the categories are known', knowledgeLinks('{{preferred-suppliers:nope}}', categoryIds)[0].valid === false);
check('references are not scored as words', !/policy/.test(stripKnowledgeTokens('{{policy:competitiveSourcingThreshold}}')));
check('every offered reference renders', availableKnowledgeTokens([...categoryIds]).every((t) => renderKnowledgeBody(t.token, ctx).unresolved.length === 0));

console.log('\nPolicy questions the platform decides are answered from its configuration');
check('amounts are read in the ways people write them',
  parseAmount('€40,000') === 40000 && parseAmount('40k') === 40000 && parseAmount('EUR 1.2m') === 1200000 && parseAmount('40,000 euros') === 40000 && parseAmount('no amount') === null);
const quotes = directPolicyAnswer('do I need three quotes for a €40,000 order?', ctx);
check('above the threshold: yes, with the minimum and the exceptions', /^Yes\. At €40,000 you need at least 3 competitive quotes/.test(quotes?.answer ?? '') && /Contingent/i.test(quotes.answer), quotes?.answer);
check('below it: no', /^No\. €10,000 is below the €25,000/.test(directPolicyAnswer('do I need quotes for €10,000?', ctx)?.answer ?? ''));
check('the answer follows the threshold', /€60,000/.test(directPolicyAnswer('do I need quotes for €40,000?', { ...ctx, policy: { ...ctx.policy, competitiveSourcingThreshold: 60000 } })?.answer ?? ''));
check('who approves names the chain whose band holds the value',
  directPolicyAnswer('who approves €40,000?', ctx)?.answer === '€40,000 is approved through the Standard chain: Budget Owner → Finance.');
check('the buying channel follows the business-led ceiling',
  /business-led/.test(directPolicyAnswer('is €30,000 business-led?', ctx)?.answer ?? '') && /procurement-led/.test(directPolicyAnswer('is €80,000 business-led?', ctx)?.answer ?? ''));
check('catalogue auto-approval follows its threshold', /^Yes\. A €800 catalogue order/.test(directPolicyAnswer('is a €800 catalogue order approved automatically?', ctx)?.answer ?? ''));
check('a question the platform does not decide gets no computed answer', directPolicyAnswer('what insurance does a supplier need?', ctx) === null);
const bar = read('src/features/dashboard/components/smart-command-bar.tsx');
const at = (needle) => bar.indexOf(needle);
check('Home asks in order: status, catalogue, policy, then demand',
  at('parseStatusQuestion(query)') > 0 && at('parseStatusQuestion(query)') < at('looksLikePolicyQuestion(query)')
  && at('looksLikePolicyQuestion(query)') < at("localResult.intent === 'new-request'"));

console.log('\nThe built-in entries are linked, and say so where they are not');
for (const entry of knowledgeBase) {
  const invalid = knowledgeLinks(entry.body, categoryIds).filter((l) => !l.valid);
  if (invalid.length) check(`${entry.id} references only real configuration`, false, invalid.map((l) => l.token).join(', '));
}
check('every reference in the built-in entries names real configuration',
  knowledgeBase.every((e) => knowledgeLinks(e.body, categoryIds).every((l) => l.valid)));
// A governed amount typed as a literal is exactly the drift this replaced. It
// may stay only on a line that marks itself as policy text.
const governedAmounts = [...new Set(CURRENCY_POLICY_KEYS.map((k) => DEFAULT_POLICY_CONFIG[k]))]
  .map((n) => `€${n.toLocaleString('en-GB')}`);
const restated = [];
for (const entry of knowledgeBase) {
  for (const line of entry.body.split('\n')) {
    if (/\(policy/.test(line)) continue;
    for (const amount of governedAmounts) {
      if (new RegExp(`${amount.replace(/[€,]/g, (c) => `\\${c}`)}(?![\\d,])`).test(line)) restated.push(`${entry.id}: ${amount} in "${line.slice(0, 60)}"`);
    }
  }
}
check('no governed amount is restated as a literal outside a line marked policy text', restated.length === 0, restated.join(' | '));
const linked = knowledgeBase.filter((e) => knowledgeLinks(e.body).length > 0).map((e) => e.id);
check('the entries that describe governed behaviour are linked',
  ['KB-001', 'KB-002', 'KB-003', 'KB-004', 'KB-005', 'KB-006', 'KB-007', 'KB-010', 'KB-013', 'KB-014', 'KB-019', 'KB-031'].every((id) => linked.includes(id)),
  `linked: ${linked.join(', ')}`);
const all = knowledgeBase.map((e) => e.body).join('\n');
check('no entry describes a retired channel or screen',
  !/direct PO|Direct PO|Policy Management|Select a category|Onboarding Request \(Suppliers/i.test(all));
check('the catalogue entry no longer states its own €500 limit', !/€500 per order/.test(all));

console.log('\nOne renderer, both sides');
check('the browser assistant renders answers from the live configuration',
  /renderKnowledgeBody\(best\.entry\.body, ctx\)/.test(read('src/lib/assistant/capabilities/knowledge.ts')));
const chat = read('api/chat.ts');
check('the server gives the model figures, not references',
  /renderKnowledgeBody\(entry\.body, ctx\)/.test(chat) && /loadKnowledgeContextWith\(db\)/.test(chat));
check('both score on the text without references',
  /stripKnowledgeTokens/.test(chat) && /stripKnowledgeTokens/.test(read('src/lib/assistant/capabilities/knowledge.ts')));
check('the admin page shows linked vs policy text only',
  /Linked to configuration/.test(read('src/features/admin/kb-admin-page.tsx')) && /Policy text only/.test(read('src/features/admin/kb-admin-page.tsx')));
check('the Policy management page (a static third copy) is gone', !read('src/App.tsx').includes('PolicyManagementPage'));

const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nLive');
  const sql = neon(connection);
  const rows = await sql`SELECT id, body FROM knowledge_base`;
  const liveCategories = new Set((await sql`SELECT id FROM procurement_categories`).map((r) => r.id));
  check('the live knowledge base holds the entries (not the code fallback)', rows.length >= knowledgeBase.length, `${rows.length} rows`);
  const broken = rows.filter((r) => knowledgeLinks(r.body, liveCategories).some((l) => !l.valid)).map((r) => r.id);
  check('every live reference names real configuration', broken.length === 0, broken.join(', '));
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All knowledge-link checks passed.');
