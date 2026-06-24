#!/usr/bin/env node
// Verifies the dynamic demand-conversation engine (INT-03 / INT-10).
//
// Self-contained — mirrors src/lib/procurement/demand-conversation.ts. Keep in
// sync. Run: node tests/integration/demand-conversation.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// Thresholds mirror DEFAULT_POLICY_CONFIG.
const DEFAULT_CONFIG = { criticalServiceThreshold: 100_000, continuityThreshold: 250_000 };
const TIME_BASED = new Set(['services', 'consulting', 'contingent-labour']);
const OUTCOME = new Set(['services', 'consulting', 'software']);

const ALL_SLOTS = [
  { id: 'title', kind: 'request', field: 'title', required: true },
  { id: 'value', kind: 'request', field: 'estimatedValue', required: true },
  { id: 'deliveryDate', kind: 'request', field: 'deliveryDate', required: false },
  { id: 'objective', kind: 'sow', field: 'objective', required: true },
  { id: 'scope', kind: 'sow', field: 'scope', required: true },
  { id: 'deliverables', kind: 'sow', field: 'deliverables', required: true },
  { id: 'resources', kind: 'sow', field: 'resources', required: true },
  { id: 'timeline', kind: 'sow', field: 'timeline', required: false, appliesWhen: (c) => TIME_BASED.has(c.category) },
  { id: 'acceptanceCriteria', kind: 'sow', field: 'acceptanceCriteria', required: false, appliesWhen: (c) => OUTCOME.has(c.category) },
  { id: 'pricingModel', kind: 'sow', field: 'pricingModel', required: false, appliesWhen: (c, cfg) => (c.estimatedValue ?? 0) >= cfg.criticalServiceThreshold },
  { id: 'dependencies', kind: 'sow', field: 'dependencies', required: false, appliesWhen: (c, cfg) => (c.estimatedValue ?? 0) >= cfg.continuityThreshold },
];
const REQUIRED = ['title', 'value', 'objective', 'scope', 'deliverables', 'resources'];

function filled(slot, ctx) {
  if (slot.kind === 'request') {
    if (slot.field === 'estimatedValue') return (ctx.estimatedValue ?? 0) > 0;
    if (slot.field === 'title') return !!(ctx.title && ctx.title.trim());
    return !!(ctx.deliveryDate && ctx.deliveryDate.trim());
  }
  return !!(ctx.sow[slot.field] && ctx.sow[slot.field].trim());
}
function agenda(ctx, cfg = DEFAULT_CONFIG) {
  return ALL_SLOTS.filter((s) => !filled(s, ctx) && (!s.appliesWhen || s.appliesWhen(ctx, cfg)));
}
const nextId = (ctx, cfg) => { const a = agenda(ctx, cfg); return a.length ? a[0].id : null; };
const agendaIds = (ctx, cfg) => agenda(ctx, cfg).map((s) => s.id);
const isComplete = (ctx, cfg) => agenda(ctx, cfg).length === 0;
const requiredFilled = (ctx) => ALL_SLOTS.filter((s) => REQUIRED.includes(s.id)).every((s) => filled(s, ctx));

const ctxOf = (over = {}) => ({ category: 'goods', sow: {}, ...over });

console.log('Canonical order + carry-forward');
check('empty demand → first question is title', nextId(ctxOf()) === 'title');
check('title known → next is value', nextId(ctxOf({ title: 'X' })) === 'value');
check('title+value known → next is deliveryDate', nextId(ctxOf({ title: 'X', estimatedValue: 5000 })) === 'deliveryDate');
check('title+value+date → next is objective', nextId(ctxOf({ title: 'X', estimatedValue: 5000, deliveryDate: '2026-09-01' })) === 'objective');
check('already-answered slot is never re-asked', !agendaIds(ctxOf({ title: 'X' })).includes('title'));

console.log('Completeness (agenda empty)');
const goodsDone = ctxOf({ title: 'X', estimatedValue: 5000, deliveryDate: '2026-09-01', sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' } });
check('low-value goods complete after the essentials', isComplete(goodsDone));
check('missing a core SOW field → not complete', !isComplete(ctxOf({ title: 'X', estimatedValue: 5000, sow: { objective: 'o', scope: 's', deliverables: 'd' } })));

console.log('Category branching');
check('software asks acceptance criteria', agendaIds(ctxOf({ category: 'software' })).includes('acceptanceCriteria'));
check('software does NOT ask timeline', !agendaIds(ctxOf({ category: 'software' })).includes('timeline'));
check('contingent-labour asks timeline', agendaIds(ctxOf({ category: 'contingent-labour' })).includes('timeline'));
check('contingent-labour does NOT ask acceptance criteria', !agendaIds(ctxOf({ category: 'contingent-labour' })).includes('acceptanceCriteria'));
check('consulting asks both timeline and acceptance', (() => { const a = agendaIds(ctxOf({ category: 'consulting' })); return a.includes('timeline') && a.includes('acceptanceCriteria'); })());
check('goods asks neither timeline nor acceptance', (() => { const a = agendaIds(ctxOf({ category: 'goods' })); return !a.includes('timeline') && !a.includes('acceptanceCriteria'); })());

console.log('Value-triggered branching (vs real thresholds)');
check('value ≥ criticalServiceThreshold asks pricing model', agendaIds(ctxOf({ estimatedValue: 100_000 })).includes('pricingModel'));
check('value below criticalServiceThreshold does not', !agendaIds(ctxOf({ estimatedValue: 99_999 })).includes('pricingModel'));
check('value ≥ continuityThreshold asks dependencies', agendaIds(ctxOf({ estimatedValue: 250_000 })).includes('dependencies'));
check('value below continuityThreshold does not', !agendaIds(ctxOf({ estimatedValue: 249_999 })).includes('dependencies'));

console.log('Prior-answer adaptivity (compound)');
check('high-value consulting asks the extra slots', (() => {
  const a = agendaIds(ctxOf({ category: 'consulting', estimatedValue: 500_000 }));
  return a.includes('timeline') && a.includes('acceptanceCriteria') && a.includes('pricingModel') && a.includes('dependencies');
})());
check('conditional slots never block the required minimum', (() => {
  const c = ctxOf({ category: 'consulting', estimatedValue: 500_000, title: 'X', deliveryDate: '2026-09-01', sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' } });
  return requiredFilled(c) && !isComplete(c); // required done, but enrichment slots remain
})());

console.log('Never-ask invariant (location + beneficiary)');
check('no slot id is country/beneficiary', !ALL_SLOTS.some((s) => /country|benefic/i.test(s.id) || /country|benefic/i.test(s.field)));
check('setting requesterCountry/beneficiary does not change the agenda', (() => {
  const a = agendaIds(ctxOf());
  const b = agendaIds(ctxOf({ requesterCountry: 'Germany', beneficiaryName: 'Anna Müller' }));
  return JSON.stringify(a) === JSON.stringify(b);
})());

console.log('Config-awareness');
check('lowering criticalServiceThreshold pulls pricing model in for a mid-value demand', (() => {
  const ctx = ctxOf({ estimatedValue: 20_000 });
  const before = agendaIds(ctx).includes('pricingModel'); // default 100k → false
  const after = agendaIds(ctx, { criticalServiceThreshold: 10_000, continuityThreshold: 250_000 }).includes('pricingModel');
  return !before && after;
})());

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All demand-conversation checks passed.');
