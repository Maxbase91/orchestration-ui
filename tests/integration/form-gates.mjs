#!/usr/bin/env node
// The two form gates cannot disagree.
//
// A form is evidence a stage needs. Two places decide whether it is being
// asked for: the request detail renders it, and the advance action refuses to
// move while a `blocking` one is outstanding. They were separate code, and
// they disagreed — the renderer evaluated `triggerConditions`, the blocking
// gate did not.
//
// A template that was conditional AND blocking therefore stranded every
// request in its stage, including the ones its own conditions EXCLUDE: the
// form never rendered, so it could not be submitted, so the button never
// unlocked. No seeded template is currently both, but `blocking` is a live
// column and the Form Builder can set it.
//
// So the property worth holding is not "both call evalCondition". It is that
// the blocking set is a subset of the triggered set — which is now true by
// construction, and asserted here across a demand grid so it stays true.
import { readFileSync } from 'node:fs';
import {
  triggeredForms, outstandingBlockingForms, outstandingForms,
} from '../../src/lib/forms/form-triggers.ts';
import { DEFAULT_POLICY_CONFIG, resolvePolicyConfig } from '../../src/lib/procurement/policy-config.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };
const CONFIG = DEFAULT_POLICY_CONFIG;

const form = (id, over = {}) => ({
  id, name: id, description: '', status: 'active', category: 'All',
  triggerStages: ['risk'], triggerConditions: [], blocking: false,
  fields: [], version: 1, lastModified: '', createdBy: '',
  ...over,
});

const NONE = new Set();

// ── The strand, reconstructed ──────────────────────────────────────────────
console.log('\nA conditional blocking form does not strand a request it excludes');
const conditionalBlocking = form('F-COND-BLOCK', {
  blocking: true,
  triggerConditions: [{ field: 'category', operator: 'equals', value: 'software' }],
});
const excluded = { category: 'goods', value: 50_000 };
const included = { category: 'software', value: 50_000 };

const blockedOnExcluded = outstandingBlockingForms([conditionalBlocking], NONE, 'risk', excluded, CONFIG);
if (blockedOnExcluded.length !== 0) {
  bad('a goods request is not blocked by a software-only form',
    'this is the strand: the form never renders, so it can never be submitted, so the stage never advances');
} else ok('a request the conditions exclude is not blocked');

const blockedOnIncluded = outstandingBlockingForms([conditionalBlocking], NONE, 'risk', included, CONFIG);
if (blockedOnIncluded.length !== 1) bad('a software request IS blocked by it', JSON.stringify(blockedOnIncluded));
else ok('a request the conditions include is blocked');

// ── The invariant, across a grid ───────────────────────────────────────────
console.log('\nThe blocking set is always a subset of what renders');
const TEMPLATES = [
  form('F-1'),
  form('F-2', { blocking: true }),
  form('F-3', { triggerConditions: [{ field: 'category', operator: 'equals', value: 'software' }] }),
  form('F-4', { blocking: true, triggerConditions: [{ field: 'value', operator: 'greater_than', value: '100000' }] }),
  form('F-5', { blocking: true, triggerConditions: [{ field: 'value', operator: 'greater_than', value: 'policy:budgetApprovalThreshold' }] }),
  form('F-6', { status: 'draft', blocking: true }),
  form('F-7', { triggerStages: ['approval'], blocking: true }),
];
let checked = 0;
let violations = 0;
for (const category of ['software', 'goods', 'services', 'consulting']) {
  for (const value of [0, 50_000, 100_000, 150_000, 1_000_000]) {
    for (const submitted of [NONE, new Set(['F-2']), new Set(['F-2', 'F-4', 'F-5'])]) {
      for (const stage of ['risk', 'approval', 'contracting']) {
        const ctx = { category, value, supplierId: 'SUP-1' };
        const rendered = outstandingForms(TEMPLATES, submitted, stage, ctx, CONFIG);
        const blocking = outstandingBlockingForms(TEMPLATES, submitted, stage, ctx, CONFIG);
        checked += 1;
        const renderedIds = new Set(rendered.map((f) => f.id));
        const stray = blocking.filter((f) => !renderedIds.has(f.id));
        if (stray.length) {
          violations += 1;
          if (violations <= 3) {
            bad(`${category} €${value} at ${stage}`,
              `${stray.map((f) => f.id).join(', ')} blocks but does not render — the stage cannot be advanced or satisfied`);
          }
        }
      }
    }
  }
}
if (violations === 0) ok(`${checked} combinations — nothing ever blocks without rendering`);

// ── A draft or wrong-stage template does neither ───────────────────────────
console.log('\nOnly an active template at this stage counts');
const atRisk = triggeredForms(TEMPLATES, 'risk', { category: 'goods', value: 0 }, CONFIG).map((f) => f.id);
if (atRisk.includes('F-6')) bad('a draft template is not triggered', 'F-6 is draft');
else ok('a draft template is not triggered');
if (atRisk.includes('F-7')) bad('a template for another stage is not triggered', 'F-7 is approval-only');
else ok('a template for another stage is not triggered');

// ── every, not some ────────────────────────────────────────────────────────
console.log('\nConditions are ANDed, as the builder says they are');
const twoConditions = form('F-AND', {
  triggerConditions: [
    { field: 'category', operator: 'equals', value: 'software' },
    { field: 'value', operator: 'greater_than', value: '100000' },
  ],
});
const halfMatch = triggeredForms([twoConditions], 'risk', { category: 'software', value: 50_000 }, CONFIG);
if (halfMatch.length !== 0) {
  bad('one matching condition is not enough',
    'the original was .some() with a true default, so "software AND over €100k" fired on every request');
} else ok('one matching condition of two does not trigger the form');
const bothMatch = triggeredForms([twoConditions], 'risk', { category: 'software', value: 150_000 }, CONFIG);
if (bothMatch.length !== 1) bad('both matching conditions do trigger it', JSON.stringify(bothMatch));
else ok('both conditions matching triggers the form');

const unknownField = form('F-UNKNOWN', {
  triggerConditions: [{ field: 'notAField', operator: 'equals', value: 'x' }],
});
if (triggeredForms([unknownField], 'risk', { category: 'software' }, CONFIG).length !== 0) {
  bad('an unrecognised condition makes the form NOT fire',
    'returning true by default is how one unknown condition made a whole set pass');
} else ok('an unrecognised condition suppresses the form rather than passing it');

// ── Form conditions follow governed thresholds too ─────────────────────────
console.log('\nA form condition can reference a governed threshold');
const governed = TEMPLATES.find((f) => f.id === 'F-5');
const atDefault = triggeredForms([governed], 'risk', { category: 'goods', value: 150_000 }, CONFIG);
const raised = triggeredForms([governed], 'risk', { category: 'goods', value: 150_000 },
  resolvePolicyConfig({ budgetApprovalThreshold: 200_000 }));
if (atDefault.length !== 1) bad('€150k triggers the governed form at the default threshold', JSON.stringify(atDefault));
else if (raised.length !== 0) bad('raising the threshold to €200k stops it triggering at €150k', 'the token is not resolved against the passed config');
else ok('raising budgetApprovalThreshold to €200k takes €150k out of the form condition');

// ── Neither gate may grow its own filter again ─────────────────────────────
console.log('\nNeither gate reimplements the predicate');
const actions = read('src/features/requests/request-detail/components/action-buttons.tsx');
const detail = read('src/features/requests/request-detail/components/step-detail-card.tsx');
if (/allFormTemplates\.filter\(/.test(actions)) {
  bad('the blocking gate does not filter templates itself',
    'its own filter over the same columns is a second chance to forget a condition — which is what happened');
} else ok('the blocking gate defers to outstandingBlockingForms');
if (!/outstandingBlockingForms/.test(actions)) bad('the blocking gate uses the shared predicate');
if (!/outstandingForms/.test(detail)) bad('the renderer uses the shared predicate');
if (/triggerConditions\.(every|some)\(/.test(detail)) {
  bad('the renderer does not evaluate conditions inline', 'it is the shared predicate that must do it');
} else ok('the renderer defers to outstandingForms');
if (!/useFormTriggerContext/.test(actions) || !/useFormTriggerContext/.test(detail)) {
  bad('both gates build the context the same way',
    'it was built inline in the renderer and not at all in the blocking gate');
} else ok('both gates build the trigger context from one hook');

console.log(failures === 0 ? '\n\x1b[32mform-gates passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
