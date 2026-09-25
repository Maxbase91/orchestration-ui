#!/usr/bin/env node
// Commodity-code mapping: the categories' configured codes, and the resolvers
// that read them.
//
// This suite used to carry its own copy of category-code.ts ("keep in sync"),
// so it tested the copy. It now imports the real module and the seed taxonomy,
// and checks that no code table has crept back in.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import {
  codeBookFromCategories, commodityFieldsFromRow, resolveCategoryCode, keywordHits, normaliseForMatch, EMPTY_CODE_BOOK,
} from '../../src/lib/procurement/category-code.ts';
import { resolveCommodityCandidates } from '../../src/lib/procurement/commodity-candidates.ts';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const book = codeBookFromCategories(DEFAULT_CATEGORY_TAXONOMY);

console.log('Resolving a demand to a code');
const kw = resolveCategoryCode({ text: 'Migrate to AWS cloud hosting' }, book);
check('keyword match resolves code + label', kw?.code === '81112200' && kw.source === 'keyword', JSON.stringify(kw));
check('multiple keyword hits raise confidence', kw?.confidence > 0.7, `conf=${kw?.confidence}`);
const fb = resolveCategoryCode({ text: 'something unmatched xyz', category: 'goods' }, book);
check('no keyword but category → category default', fb?.code === '31160000' && fb.source === 'category-default');
check('category-default confidence is modest', fb?.confidence === 0.5);
const both = resolveCategoryCode({ text: 'strategy consulting engagement', category: 'goods' }, book);
check('keyword wins over category default', both?.code === '80101600' && both.source === 'keyword');
check('no text, no category → null', resolveCategoryCode({}, book) === null);
check('unmatched text, unknown category → null', resolveCategoryCode({ text: 'zzz', category: 'nope' }, book) === null);
check('an empty book resolves nothing', resolveCategoryCode({ text: 'laptop', category: 'goods' }, EMPTY_CODE_BOOK) === null);
check('every seeded category has a default code',
  DEFAULT_CATEGORY_TAXONOMY.every((c) => resolveCategoryCode({ category: c.id }, book)?.source === 'category-default'));

console.log('\nKeywords match at the start of a word');
// Substring matching let "ai" (data analytics) hit campaign, chair and
// maintenance, and "erp" hit enterprise; which code won was table order.
for (const [text, want] of [
  ['maintenance of the building', '80131500'],
  ['office chair replacement', '56101500'],
  ['brand campaign for spring', '80141600'],
]) {
  const got = resolveCategoryCode({ text }, book);
  check(`"${text}" is not coded as data analytics`, got?.code === want, `${got?.code} ${got?.label}`);
}
check('a keyword still matches its longer forms (temp → temporary)',
  keywordHits(normaliseForMatch('temporary developers'), ['temp']) === 1);
check('"erp" is not counted inside "enterprise"',
  keywordHits(normaliseForMatch('enterprise software'), ['sap', 'erp', 'enterprise software']) === 1);
check('an admin typing a capitalised keyword still matches',
  resolveCategoryCode({ text: 'aws hosting' }, codeBookFromCategories([{ id: 'x', commodityCodes: [{ code: '1', label: 'L', keywords: ['AWS'] }] }]))?.code === '1');

console.log('\nTies go to the demand’s own category');
// "storage" is a keyword of both shelving (goods) and records (services).
check('storage in a goods demand → shelving', resolveCategoryCode({ text: 'storage', category: 'goods' }, book)?.code === '24102000');
check('storage in a services demand → records', resolveCategoryCode({ text: 'storage', category: 'services' }, book)?.code === '80161500');
const cand = resolveCommodityCandidates('storage', 'services', book);
check('the first candidate agrees with the headline code', cand[0]?.code === '80161500', JSON.stringify(cand.map((c) => c.code)));

console.log('\nThe book is built from the categories');
check('an inactive category offers no codes',
  codeBookFromCategories([{ id: 'x', active: false, commodityCodes: [{ code: '1', label: 'L', keywords: ['k'] }], defaultCode: { code: '2', label: 'D' } }]).entries.length === 0);
check('a code with no keywords is not in the book (it could never match)',
  codeBookFromCategories([{ id: 'x', commodityCodes: [{ code: '1', label: 'L', keywords: [] }] }]).entries.length === 0);
const fromRow = commodityFieldsFromRow({ commodity_codes: [{ code: ' 1 ', label: 'L', keywords: ['a'] }, { code: '' }, 'junk'], default_code: '9', default_code_label: '' });
check('a store row is read defensively', fromRow.commodityCodes.length === 1 && fromRow.commodityCodes[0].code === '1'
  && fromRow.defaultCode?.code === '9' && fromRow.defaultCode.label === '9', JSON.stringify(fromRow));
check('a row with no default reads as none', commodityFieldsFromRow({}).defaultCode === null);

console.log('\nNo code table remains');
const codeModule = read('src/lib/procurement/category-code.ts');
check('category-code.ts holds no code table', !/KEYWORD_CODES|CATEGORY_DEFAULT_CODES/.test(codeModule));
const handler = read('api/_domains/commodity-match.ts');
check('the commodity-match endpoint reads the codes from the store',
  /FROM procurement_categories/.test(handler) && /codeBookFromCategories/.test(handler));
check('the intake screens resolve against the configured book',
  ['src/features/requests/new-request/step-category.tsx', 'src/features/requests/new-request/step-chat-intake.tsx']
    .every((f) => /useCommodityCodeBook\(\)/.test(read(f))));

const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nLive');
  const sql = neon(connection);
  const rows = await sql`SELECT id, active, commodity_codes, default_code, default_code_label FROM procurement_categories`;
  const liveBook = codeBookFromCategories(rows.map((r) => ({ id: r.id, active: r.active, ...commodityFieldsFromRow(r) })));
  const noDefault = rows.filter((r) => r.active && !r.default_code?.trim()).map((r) => r.id);
  check('every active live category has a default code', noDefault.length === 0, noDefault.join(', '));
  check('live codes a laptop demand as laptops', resolveCategoryCode({ text: 'laptops for new joiners', category: 'goods' }, liveBook)?.code === '43211500');
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All category-code checks passed.');
