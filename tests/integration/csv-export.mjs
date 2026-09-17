#!/usr/bin/env node
// CSV export is one implementation, and it survives a euro sign.
//
// There were two copies of `downloadCsv` — exports-page.tsx and
// report-builder-page.tsx — identical but for how each guarded the empty case,
// and the audit log was about to be a third. All of them shared one defect: no
// byte-order mark, so Excel reads the file as the local single-byte encoding
// and every `€`, `ü` and `§` arrives mangled. On a euro-denominated store with
// names like "Anna Müller" that is most exports, and it is the kind of thing
// nobody files a bug for — they retype the file.
//
// The audit log's Export button is the other half: it rendered, it was
// clickable, and it had no `onClick` at all, on the screen whose entire purpose
// is producing evidence.
// Run: npm run test:csv-export

import { readFileSync } from 'node:fs';
import { toCsv, datedFilename } from '../../src/lib/csv.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
};

console.log('Quoting follows RFC 4180');
const rows = [
  { id: 'A-1', detail: 'plain', amount: '1000' },
  { id: 'A-2', detail: 'has, comma', amount: '2000' },
  { id: 'A-3', detail: 'has "quotes"', amount: '3000' },
  { id: 'A-4', detail: 'has\nnewline', amount: '4000' },
];
const csv = toCsv(rows);
check('a plain value is not quoted', /^A-1,plain,1000$/m.test(csv), csv.split('\r\n')[1]);
check('a comma forces quoting', csv.includes('"has, comma"'));
check('a quote is doubled and wrapped', csv.includes('"has ""quotes"""'));
check('a newline forces quoting', csv.includes('"has\nnewline"'));
check('the header row comes first', csv.startsWith('id,detail,amount'));
check('lines are CRLF, which is what Excel expects', csv.includes('\r\n') && !/[^\r]\n[^n]/.test(csv.replace('has\nnewline', 'x')));

console.log('\nColumns are explicit when it matters');
// Reading headers off row zero silently drops any key the first row lacks —
// which is how a column disappears for every row because one row was sparse.
const sparse = [{ a: '1' }, { a: '2', b: 'only here' }];
check('row zero alone loses the later column', !toCsv(sparse).includes('only here'));
check('naming the columns keeps it', toCsv(sparse, ['a', 'b']).includes('only here'));
check('a missing value is empty, not "undefined"',
  toCsv(sparse, ['a', 'b']).split('\r\n')[1] === '1,');

console.log('\nNothing to export produces nothing');
check('no rows → empty string', toCsv([]) === '');
check('rows with no columns → empty string', toCsv([{}]) === '');

console.log('\nThe filename is dated and sortable');
check('ISO date, csv extension',
  datedFilename('audit-log', new Date('2026-09-17T12:00:00Z')) === 'audit-log-2026-09-17.csv',
  datedFilename('audit-log', new Date('2026-09-17T12:00:00Z')));

console.log('\nOne implementation, and it writes the BOM');
const csvModule = read('src/lib/csv.ts');
check('the download path prefixes U+FEFF', /\\uFEFF\$\{csv\}/.test(csvModule),
  'without it Excel mangles every € in the file');
for (const page of [
  'src/features/analytics/exports-page.tsx',
  'src/features/analytics/report-builder-page.tsx',
  'src/features/settings/audit-log-page.tsx',
]) {
  const source = read(page);
  check(`${page.split('/').pop()} uses the shared helper`,
    /from '@\/lib\/csv'/.test(source) && !/function downloadCsv/.test(source),
    'a local copy is a copy that will not get the next fix');
}

console.log('\nThe audit export actually exports');
const audit = read('src/features/settings/audit-log-page.tsx');
check('the Export button has a handler', /onClick=\{handleExport\}/.test(audit),
  'it rendered and did nothing');
// The page, or the whole table, would both be wrong: one is an arbitrary 25
// rows, the other ignores the filters the admin just set.
check('it exports the filtered set, not the page', /downloadCsv\([\s\S]{0,120}filtered\.map/.test(audit));
check('it is disabled when there is nothing to export', /disabled=\{filtered\.length === 0\}/.test(audit));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All csv-export checks passed.');
