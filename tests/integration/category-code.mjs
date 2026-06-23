#!/usr/bin/env node
// Verifies category-code mapping (taxonomy translation).
//
// Self-contained — mirrors src/lib/procurement/category-code.ts. Keep in sync.
// Run: node tests/integration/category-code.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const KEYWORD_CODES = [
  { keywords: ['cloud', 'hosting', 'aws', 'azure'], code: '81112200', label: 'Cloud computing services' },
  { keywords: ['consulting', 'advisory', 'strategy'], code: '80101600', label: 'Management consulting' },
  { keywords: ['laptop', 'computer', 'workstation', 'pc'], code: '43211500', label: 'Laptop computers' },
];
const CATEGORY_DEFAULT_CODES = {
  catalogue: { code: '44120000', label: 'Office supplies and stationery' },
  goods: { code: '31160000', label: 'General hardware and goods' },
  services: { code: '80100000', label: 'Business and professional services' },
  software: { code: '43230000', label: 'Software' },
  consulting: { code: '80101600', label: 'Management consulting' },
  'contingent-labour': { code: '80111600', label: 'Temporary staffing services' },
  'contract-renewal': { code: '80100000', label: 'Professional services (renewal)' },
  'supplier-onboarding': { code: '80100000', label: 'Supplier onboarding services' },
};

function matchKeywords(text) {
  const n = text.toLowerCase();
  let best = null;
  for (const e of KEYWORD_CODES) {
    let c = 0;
    for (const k of e.keywords) if (n.includes(k)) c += 1;
    if (c > 0 && (!best || c > best.matchCount)) best = { code: e.code, label: e.label, matchCount: c };
  }
  return best;
}
function resolveCategoryCode(input) {
  const kw = input.text ? matchKeywords(input.text) : null;
  if (kw) return { code: kw.code, label: kw.label, confidence: Math.min(0.97, 0.6 + kw.matchCount * 0.12), source: 'keyword' };
  const fb = input.category ? CATEGORY_DEFAULT_CODES[input.category] : undefined;
  if (fb) return { ...fb, confidence: 0.5, source: 'category-default' };
  return null;
}

console.log('Category-code mapping');
const kw = resolveCategoryCode({ text: 'Migrate to AWS cloud hosting' });
check('keyword match resolves code + label', kw?.code === '81112200' && kw.source === 'keyword');
check('multiple keyword hits raise confidence', kw.confidence > 0.7, `conf=${kw?.confidence}`);

const fb = resolveCategoryCode({ text: 'something unmatched xyz', category: 'goods' });
check('no keyword but category → category default', fb?.code === '31160000' && fb.source === 'category-default');
check('category-default confidence is modest', fb?.confidence === 0.5);

const both = resolveCategoryCode({ text: 'strategy consulting engagement', category: 'goods' });
check('keyword wins over category default', both?.code === '80101600' && both.source === 'keyword');

check('no text, no category → null', resolveCategoryCode({}) === null);
check('unmatched text, unknown category → null', resolveCategoryCode({ text: 'zzz', category: 'nope' }) === null);
check('unmatched text, no category → null', resolveCategoryCode({ text: 'zzz' }) === null);

const canonical = ['catalogue', 'goods', 'services', 'software', 'consulting', 'contingent-labour', 'contract-renewal', 'supplier-onboarding'];
check('every canonical category has a default code',
  canonical.every((c) => resolveCategoryCode({ category: c })?.source === 'category-default'));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All category-code checks passed.');
