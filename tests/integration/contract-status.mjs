#!/usr/bin/env node
// A contract's status from its dates (2026-09-26).
//
// The status column was written once and never moved: 12 of 30 live contracts
// were past their end date while recorded active or expiring, and the
// register, the supplier counts and the renewals page each trusted it — while
// four screens applied their own "90 days" for expiring and the checkout
// expired a contract at midnight UTC on its last day. One rule now: in force
// through the end date, expiring within the renewal window (the Decisioning
// threshold `contractExpiryBufferDays`), read by the contracts view in SQL and
// by lib/procurement/contract-status.ts in TypeScript.
//
// This suite holds the rule, the two copies of it to one answer where it can
// without a database (the view's live answer is test:derived), and every
// screen to reading it rather than a number of its own.
//
// Run: node --import tsx/esm tests/integration/contract-status.mjs

import { readFileSync } from 'node:fs';
import { contractStatusOn, daysUntilEnd, isoToday } from '../../src/lib/procurement/contract-status.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import { evaluateGovernedCheckout } from '../../src/lib/procurement/governed-checkout.ts';
import { mapDbToContract, mapContractToDb } from '../../src/lib/db/mappers.ts';

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

const TODAY = '2026-09-26';
const day = (offset) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const WINDOW = 60;

console.log('\nThe rule');
check('in force on its last day: expiring, not expired', contractStatusOn('active', day(0), WINDOW, TODAY) === 'expiring');
check('expired from the day after', contractStatusOn('active', day(-1), WINDOW, TODAY) === 'expired');
check('expiring on the last day of the window', contractStatusOn('active', day(WINDOW), WINDOW, TODAY) === 'expiring');
check('active the day before the window opens', contractStatusOn('active', day(WINDOW + 1), WINDOW, TODAY) === 'active');
check('a recorded "expiring" far from its end is active', contractStatusOn('expiring', day(400), WINDOW, TODAY) === 'active');
check('a recorded "expiring" past its end is expired', contractStatusOn('expiring', day(-30), WINDOW, TODAY) === 'expired');
check('draft, under review and terminated stay as recorded, whatever the date',
  ['draft', 'under-review', 'terminated'].every((s) => contractStatusOn(s, day(-10), WINDOW, TODAY) === s
    && contractStatusOn(s, day(10), WINDOW, TODAY) === s));
check('an expiry recorded early stays recorded', contractStatusOn('expired', day(300), WINDOW, TODAY) === 'expired');
check('no readable end date leaves the record as it is',
  contractStatusOn('active', '', WINDOW, TODAY) === 'active' && contractStatusOn('active', 'soon', WINDOW, TODAY) === 'active');
check('the window is the governed number, not a constant',
  contractStatusOn('active', day(80), 90, TODAY) === 'expiring' && contractStatusOn('active', day(80), 60, TODAY) === 'active');

console.log('\nDays are calendar days');
check('0 on the last day, -1 the day after', daysUntilEnd(day(0), TODAY) === 0 && daysUntilEnd(day(-1), TODAY) === -1);
check('a timestamp on the end date is read as its day', daysUntilEnd(`${day(5)}T17:30:00Z`, TODAY) === 5);
check('no date, no number', daysUntilEnd(undefined, TODAY) === null && daysUntilEnd('31/12/2026', TODAY) === null);
check('today is the UTC calendar date — the database\'s current_date',
  isoToday(new Date('2026-09-26T23:30:00Z')) === '2026-09-26' && isoToday(new Date('2026-09-27T00:10:00+02:00')) === '2026-09-26');

console.log('\nThe checkout agrees: in force through the last day');
const supplier = { id: 'SUP-1', name: 'Example Supplier', riskRating: 'low', screeningStatus: 'clear' };
const baseContract = { id: 'CON-1', title: 'Example agreement', supplierId: 'SUP-1', supplierName: 'Example Supplier', value: 10000, startDate: '2025-01-01', endDate: day(0), status: 'active', ownerId: 'u1', ownerName: 'Owner', department: 'Procurement', category: 'Goods', utilisationPercentage: 10, linkedRequestIds: [] };
const profile = { userId: 'u1', defaultCurrency: 'EUR', costCentre: 'CC-1', budgetOwner: 'Budget', accountType: 'expense', defaultShipToLocationId: 'office' };
const risk = { id: 'RISK-1', title: 'Supplier risk', subjectType: 'supplier', supplierId: 'SUP-1', contractId: 'CON-1', category: 'goods', riskLevel: 'low', score: 1, status: 'completed', assessorId: 'u2', assessorName: 'Risk', assessedAt: '2026-01-01', validUntil: '2027-01-01', summary: '', mitigations: [], reusable: true, linkedRequestIds: [], createdAt: '2026-01-01' };
const line = { description: 'Laptop', quantity: 1, unit: 'each', unitPrice: 500, supplierId: 'SUP-1', contractId: 'CON-1', commodityCode: '43211500' };
const reference = { activeCostCentreIds: ['CC-1'], activeDeliveryLocationIds: ['office'] };
const checkout = (contract, now) => evaluateGovernedCheckout({
  route: 'catalogue', lines: [line], supplier, contract, riskAssessment: risk, profile, ...reference, purpose: 'Test', now,
});
const EXPIRED = 'The selected contract is expired or not active.';
check('late on its last day the contract is still in force',
  !checkout(baseContract, new Date(`${TODAY}T22:00:00Z`)).errors.includes(EXPIRED));
check('the day after, it is refused',
  checkout(baseContract, new Date(`${day(1)}T08:00:00Z`)).errors.includes(EXPIRED));

console.log('\nThe record keeps what was recorded');
const row = { id: 'CON-9', title: 'T', status: 'active', status_live: 'expired', end_date: day(-3), value: 1, utilisation_percentage: 0 };
const mapped = mapDbToContract(row);
check('a read shows the live status and keeps the recorded one', mapped.status === 'expired' && mapped.recordedStatus === 'active');
check('writing it back writes the recorded status, never the date\'s reading',
  mapContractToDb(mapped).status === 'active');
check('an edit to the recorded status is what is written',
  mapContractToDb({ ...mapped, recordedStatus: 'terminated' }).status === 'terminated');
check('a row without a live status (a write\'s echo) shows as recorded',
  mapDbToContract({ ...row, status_live: undefined }).status === 'active');

console.log('\nThe SQL applies the same rule, against the same number');
const schema = read('db/schema.sql');
const view = schema.slice(schema.indexOf('CREATE VIEW contracts_with_derived'), schema.indexOf(') w;', schema.indexOf('CREATE VIEW contracts_with_derived')) + 4);
check('the view reads the renewal window from the policy row', /config->>'contractExpiryBufferDays'/.test(view));
const floor = Number((view.match(/contractExpiryBufferDays'\)::numeric\)::int[\s\S]*?\),\s*(\d+)\s*\)\s*AS days/) ?? [])[1]);
check('its floor for an unreadable policy row is the shipped default',
  floor === DEFAULT_POLICY_CONFIG.contractExpiryBufferDays, `view ${floor}, default ${DEFAULT_POLICY_CONFIG.contractExpiryBufferDays}`);
check('expired is strictly before today; expiring is up to today plus the window',
  /LEFT\(co\.end_date, 10\) < to_char\(current_date, 'YYYY-MM-DD'\) THEN 'expired'/.test(view)
  && /LEFT\(co\.end_date, 10\) <= to_char\(current_date \+ w\.days, 'YYYY-MM-DD'\) THEN 'expiring'/.test(view));
check('only active and expiring are read from the date', /WHEN co\.status IN \('active', 'expiring'\)/.test(view) && /ELSE co\.status/.test(view));
check('the view comes after the policy table it reads',
  schema.indexOf('CREATE TABLE IF NOT EXISTS procurement_policy_configs') < schema.indexOf('CREATE VIEW contracts_with_derived'));
const suppliersView = schema.slice(schema.indexOf('CREATE VIEW suppliers_with_derived'), schema.indexOf('GROUP BY supplier_id', schema.indexOf('CREATE VIEW suppliers_with_derived')));
check('a supplier\'s active contracts leave out the ones past their end date',
  /LEFT\(end_date, 10\) < to_char\(current_date, 'YYYY-MM-DD'\)/.test(suppliersView));

console.log('\nEvery reader takes the live status and the governed window');
const screens = {
  'src/features/contracts/renewals-page.tsx': 'Renewals & Expiries',
  'src/features/contracts/contract-register-page.tsx': 'the register',
  'src/features/dashboard/widgets/widget-expiring-contracts.tsx': 'the Expiring Contracts widget',
  'src/features/suppliers/components/profile-contracts-tab.tsx': 'the supplier profile',
  'src/features/contracts/contract-detail-page.tsx': 'the contract page',
};
for (const [file, name] of Object.entries(screens)) {
  const src = read(file);
  // Code only: comments, ISO dates and Tailwind opacities (`bg-muted/30`) aside.
  check(`${name} counts no days of its own`, !/(?<!\/)\b(30|60|90)\b(?![-.\d%])(?!\s*(MB|KB))/.test(src.replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/'20\d\d-\d\d-\d\d'/g, '')),
    file);
}
check('the renewals page reads the window from the thresholds', /contractExpiryBufferDays/.test(read('src/features/contracts/renewals-page.tsx')));
check('the checkout, the contract match and the assistant read the view',
  /FROM contracts_with_derived WHERE id = \$1/.test(read('api/governed-checkout.ts'))
  && /JOIN contracts_with_derived c/.test(read('api/_domains/contract-match.ts'))
  && /from\('contracts_with_derived'\)[\s\S]{0,200}status_live/.test(read('api/chat.ts')));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All contract-status checks passed.');
