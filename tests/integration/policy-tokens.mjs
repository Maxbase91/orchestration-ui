#!/usr/bin/env node
// Every governed number is nameable, editable, and validated.
//
// `delegatedAuthorityThreshold` was in PolicyConfig, read live by the workflow
// engine's compliance report, and accepted by the server's validator — but
// missing from the admin page's hand-maintained FIELDS array. So it could never
// be edited; and because handleSave rebuilds the override set by iterating that
// same array, saving any *other* field silently ERASED a stored value for it.
// It was worse than invisible.
//
// The page now derives its fields from POLICY_KEY_META, so the two cannot
// drift. These checks hold the remaining seams: the metadata covers every
// numeric key, the server accepts every key, and no threshold that has a
// governed home is still written as a literal in the decisioning code.
import { readFileSync } from 'node:fs';
import {
  NUMERIC_POLICY_KEYS, POLICY_KEY_META, CURRENCY_POLICY_KEYS, CATEGORY_LIST_POLICY_KEYS,
  resolvePolicyValue, resolvePolicyList, describePolicyValue, policyToken, policyKeyHolding,
} from '../../src/lib/procurement/policy-tokens.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import { policyReferences } from '../../src/lib/procurement/policy-references.ts';
import { readdirSync, statSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`);
const bad = (label, detail) => {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${label}`);
  if (detail) console.error(`      ${detail}`);
};

// ── Every numeric key is nameable ──────────────────────────────────────────
console.log('\nEvery numeric policy key has metadata, and vice versa');
const numericFromConfig = Object.entries(DEFAULT_POLICY_CONFIG)
  .filter(([, v]) => typeof v === 'number')
  .map(([k]) => k)
  .sort();
const fromMeta = [...NUMERIC_POLICY_KEYS].sort();
const missingMeta = numericFromConfig.filter((k) => !fromMeta.includes(k));
const orphanMeta = fromMeta.filter((k) => !numericFromConfig.includes(k));
if (missingMeta.length) {
  bad('POLICY_KEY_META covers every numeric key',
    `no metadata for ${missingMeta.join(', ')} — it would be uneditable and erasable on save`);
}
if (orphanMeta.length) bad('POLICY_KEY_META has no orphans', `${orphanMeta.join(', ')} is not on PolicyConfig`);
if (!missingMeta.length && !orphanMeta.length) ok(`${fromMeta.length} numeric keys, all with a label, help text and unit`);

// ── The server accepts every key ───────────────────────────────────────────
console.log('\nThe server validator accepts every key the admin page offers');
const apiSource = read('api/_domains/policy-config.ts');
// Derived from the defaults, by type. The hand-kept list here omitted keys as
// they were added, and a stored config missing one was then rejected whole.
if (!/const KEYS = Object\.keys\(DEFAULT_POLICY_CONFIG\)/.test(apiSource)) {
  bad('the API key list is derived from the defaults', 'a hand-kept list is how new keys went missing');
} else ok('the API validates every key the config has, by its default\u2019s type');
// And GET merges a stored row key by key rather than all-or-nothing, so adding
// a key cannot revert every saved threshold in the browser.
if (!/configFromRow\(rows\[0\]\)/.test(apiSource) || /isPolicyConfig\(rows\[0\]/.test(apiSource)) {
  bad('GET merges the stored row key by key', 'an older row without the new key would read as all defaults');
} else ok('GET merges the stored row over the defaults, key by key');

// ── Every category-list key is editable ────────────────────────────────────
console.log('\nEvery category-list key has a checklist');
const listFromConfig = Object.entries(DEFAULT_POLICY_CONFIG).filter(([, v]) => Array.isArray(v)).map(([k]) => k).sort();
const listFromMeta = [...CATEGORY_LIST_POLICY_KEYS].sort();
if (JSON.stringify(listFromConfig) !== JSON.stringify(listFromMeta)) {
  bad('CATEGORY_LIST_POLICY_META covers every list key', `config ${listFromConfig.join(', ')} vs meta ${listFromMeta.join(', ')}`);
} else ok(`${listFromMeta.length} category-list keys, all with a label and help text`);

// ── The admin page cannot go back to a hand-maintained list ────────────────
console.log('\nThe admin page derives its fields rather than listing them');
const page = read('src/features/admin/policy-config/policy-config-page.tsx');
if (!/NUMERIC_POLICY_KEYS\.map/.test(page)) {
  bad('FIELDS is derived from NUMERIC_POLICY_KEYS',
    'a hand-maintained array is how delegatedAuthorityThreshold became uneditable');
} else ok('FIELDS is a view over the shared key metadata');
const booleanKeys = Object.entries(DEFAULT_POLICY_CONFIG).filter(([, v]) => typeof v === 'boolean').map(([k]) => k);
const noSwitch = booleanKeys.filter((k) => !page.includes(`id="cfg-${k}"`));
if (noSwitch.length) bad('every on/off key is a switch on the page', `${noSwitch.join(', ')} has no editor`);
else if (!/for \(const key of BOOLEAN_KEYS\)/.test(page)) bad('saving covers every on/off key', 'a switch named by hand is the next one saving forgets');
else ok(`${booleanKeys.length} on/off keys, each a switch, and saving covers them all`);
const unrendered = CATEGORY_LIST_POLICY_KEYS.filter((k) => !page.includes(`policyKey="${k}"`));
if (unrendered.length) bad('every category-list key renders as a checklist', `${unrendered.join(', ')} has no editor`);
else if (!/for \(const key of CATEGORY_LIST_POLICY_KEYS\)/.test(page)) bad('saving covers every category-list key', 'a list named by hand is the next one saving forgets');
else ok('every category-list key is a checklist, and saving covers them all');

// ── Resolution ─────────────────────────────────────────────────────────────
console.log('\nToken resolution');
const t = resolvePolicyValue(policyToken('competitiveSourcingThreshold'), DEFAULT_POLICY_CONFIG);
if (t.value !== '25000' || t.key !== 'competitiveSourcingThreshold' || t.unresolved) {
  bad('a known token resolves to its number', JSON.stringify(t));
} else ok('policy:competitiveSourcingThreshold → 25000');

const lit = resolvePolicyValue('40000', DEFAULT_POLICY_CONFIG);
if (lit.value !== '40000' || lit.key !== null || lit.unresolved) bad('a literal passes through', JSON.stringify(lit));
else ok('a literal passes through untouched');

const unknown = resolvePolicyValue('policy:notAKey', DEFAULT_POLICY_CONFIG);
if (!unknown.unresolved || unknown.value !== 'policy:notAKey') {
  bad('an unknown key is reported, not silently swallowed', JSON.stringify(unknown));
} else ok('an unknown key reports unresolved and keeps the raw value');

// `between` carries two bounds; each must resolve independently.
const band = resolvePolicyList(`${policyToken('riskMediumValue')},${policyToken('approvalFullThreshold')}`, DEFAULT_POLICY_CONFIG);
if (band.value !== '50000,250000' || band.unresolved) bad('a two-bound list resolves per bound', JSON.stringify(band));
else ok('policy:riskMediumValue,policy:approvalFullThreshold → 50000,250000');

if (!describePolicyValue(t).startsWith('€25,000 —')) {
  bad('a resolved value describes itself for the rule summary', describePolicyValue(t));
} else ok(`summaries read "${describePolicyValue(t)}"`);

// ── The nudge only fires on money ──────────────────────────────────────────
console.log('\nThe literal-matches-a-threshold nudge');
if (policyKeyHolding(25_000) !== 'competitiveSourcingThreshold') {
  bad('€25,000 is recognised as a governed amount', String(policyKeyHolding(25_000)));
} else ok('a literal 25000 is recognised as competitiveSourcingThreshold');
// 3 is minCompetitiveQuotes and 60 is a day count — neither is an amount, and
// suggesting them for a value condition would be nonsense.
if (policyKeyHolding(3) !== null || policyKeyHolding(60) !== null) {
  bad('non-currency keys are never suggested for a value condition',
    `3 → ${policyKeyHolding(3)}, 60 → ${policyKeyHolding(60)}`);
} else ok('day counts and quote counts are never offered as amounts');
if (CURRENCY_POLICY_KEYS.length < 5) bad('the currency key list is populated', String(CURRENCY_POLICY_KEYS.length));

// ── No governed number is still a literal in the decisioning code ──────────
console.log('\nThe decisioning code reads the config, not a literal');
const determination = read('src/lib/procurement/intake-determination.ts');
for (const [label, literal] of [['Contract required before PO', '25000'], ['Budget approval required', '100000']]) {
  const idx = determination.indexOf(`label: '${label}'`);
  if (idx < 0) { bad(`the "${label}" check still exists`, 'renamed or removed'); continue; }
  const body = determination.slice(idx, idx + 700);
  if (new RegExp(`\\b${literal}\\b`).test(body)) {
    bad(`"${label}" reads the governed threshold`,
      `still compares against the literal ${literal}; /admin/thresholds would not move it`);
  } else ok(`"${label}" reads the config`);
}

// ── Every threshold says what reads it ──────────────────────────────────────
// The thresholds page shows `usedIn` under each number, so it has to be true
// both ways: a key with a `usedIn` line is read by code, and a key without one
// is read by none — it matters only through configuration that names it (the
// approval-chain bands, for delegatedAuthorityThreshold), and the page warns
// when nothing does. Comments are stripped first: a comment naming a key is
// not a reader, and approval-bands.ts has exactly such a comment.
console.log('\nEvery threshold says what reads it');
const NOT_READERS = [
  'src/lib/procurement/policy-tokens.ts', 'src/lib/procurement/policy-config.ts',
  'src/lib/procurement/policy-references.ts', 'src/features/admin/policy-config/policy-config-page.tsx',
  'api/_domains/policy-config.ts',
  // Seeded configuration and knowledge-base text name keys as tokens; they are
  // references the page lists live, not code that reads the number.
  'src/data/knowledge-base.ts', 'src/data/workflows.ts', 'src/data/routing-rules.ts',
  'src/lib/procurement/service-description-defaults.ts',
];
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(new URL(dir, ROOT))) {
    const rel = `${dir}/${name}`;
    if (statSync(new URL(rel, ROOT)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(name) && !NOT_READERS.includes(rel)) out.push(rel);
  }
  return out;
}
const code = [...sourceFiles('src'), ...sourceFiles('api')].map((rel) => [rel, stripComments(read(rel))]);
for (const key of NUMERIC_POLICY_KEYS) {
  const readers = code.filter(([, src]) => new RegExp(`\\b${key}\\b`).test(src)).map(([rel]) => rel);
  const usedIn = POLICY_KEY_META[key].usedIn;
  if (usedIn && readers.length === 0) bad(`${key} says where it is used`, `"${usedIn}" — but no code reads it`);
  else if (!usedIn && readers.length > 0) bad(`${key} has no used-in line`, `read by ${readers.join(', ')}`);
  else ok(`${key}: ${usedIn ? `read by ${readers.length} file(s)` : 'read by configuration only'}`);
}

console.log('\nThe used-by list finds configuration that names a key');
const sources = {
  rules: [
    { id: 'RR-904', name: 'Under the ceiling', status: 'active', conditions: [{ value: '0,policy:businessLedCeiling' }] },
    { id: 'RR-777', name: 'Switched off', status: 'disabled', conditions: [{ value: 'policy:businessLedCeiling' }] },
    { id: 'RR-778', name: 'Longer name', status: 'active', conditions: [{ value: 'policy:businessLedCeilingX' }] },
  ],
  chains: [
    { id: 'chain-3', name: 'VP-Level', minValue: 'policy:budgetApprovalThreshold', maxValue: 'policy:delegatedAuthorityThreshold' },
    { id: 'chain-4', name: 'Board-Level', minValue: 'policy:delegatedAuthorityThreshold', maxValue: null },
  ],
  templates: [{ id: 'WF-002', name: 'Catalogue', edges: [{ condition: { value: 'policy:catalogueAutoApprovalThreshold' } }, { condition: null }] }],
  forms: [{ id: 'FORM-9', name: 'Security review', status: 'active', triggerConditions: [{ value: 'policy:riskHighValue' }] }],
  serviceDescriptions: [{
    category: 'default', label: 'Default', active: true,
    slots: [{ conditions: [{ value: 'policy:criticalServiceThreshold' }] }],
    sections: [{ requiredWhen: [{ value: 'policy:continuityThreshold' }] }],
  }],
  knowledge: [{ id: 'KB-1', title: 'Who buys what', body: 'Up to {{policy:businessLedCeiling}} the business buys it.' }],
};
const ceiling = policyReferences('businessLedCeiling', sources);
const ids = ceiling.map((r) => r.id).join(',');
if (ids !== 'RR-904,RR-777,KB-1') bad('businessLedCeiling: the between rule, the disabled rule and the article', ids);
else ok('a `between` value and a knowledge-base token are both found');
if (ceiling.find((r) => r.id === 'RR-777')?.active !== false) bad('a disabled rule is marked off');
else ok('a disabled rule is listed, marked off');
if (ceiling.some((r) => r.id === 'RR-778')) bad('a longer key is not a reference to its prefix', 'policy:businessLedCeilingX matched');
else ok('a key does not match a longer key it prefixes');
const authority = policyReferences('delegatedAuthorityThreshold', sources).map((r) => r.label).join(' | ');
if (authority !== 'VP-Level chain, upper end of its band | Board-Level chain, lower end of its band') bad('chain ends are named', authority);
else ok('approval chains say which end of the band the key sets');
for (const [key, kind] of [['catalogueAutoApprovalThreshold', 'workflow'], ['riskHighValue', 'form'], ['criticalServiceThreshold', 'service-description'], ['continuityThreshold', 'service-description']]) {
  const found = policyReferences(key, sources);
  if (found.length !== 1 || found[0].kind !== kind) bad(`${key} is found in the ${kind}`, JSON.stringify(found));
  else ok(`${key} is found in the ${kind}`);
}
if (policyReferences('minCompetitiveQuotes', sources).length !== 0) bad('a key nothing names has no references');
else ok('a key nothing names has no references');

console.log(failures === 0 ? '\n\x1b[32mpolicy-tokens passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
