#!/usr/bin/env node
// A supplier's screening, risk assessment and onboarding are recorded only on
// evidence (2026-09-26).
//
// The Risk tab's "Approve risk" wrote screening *clear* and the SRA *valid*
// with nothing behind either, "Refer back" wrote *flagged* on the same nothing,
// both reset a completed supplier's onboarding, and the rationale they asked
// for — like the onboarding pipeline's completion note — was thrown away. A
// pass recorded for a check nobody ran is worse than no record (AGENTS.md rule
// 3). This suite holds the rules in lib/procurement/supplier-evidence.ts and
// holds the screens to them.
//
// Run: node --import tsx/esm tests/integration/supplier-evidence.mjs

import { readFileSync } from 'node:fs';
import {
  linkableAssessments, onboardingCompletionBlock, planAssessmentLink, planOnboardingCompletion,
  planScreeningRecord, portalOnboardingStatus,
} from '../../src/lib/procurement/supplier-evidence.ts';
import { mapDbToSupplier, mapSupplierToDb } from '../../src/lib/db/mappers.ts';

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const TODAY = '2026-09-26';

console.log('\nA screening result names the screening behind it');
const screening = (over = {}) => planScreeningRecord({ result: 'clear', reference: 'Screening provider · case 4471', performedOn: '2026-09-20', ...over }, TODAY);
check('with a reference and a day, clear is recorded — with both', (() => {
  const plan = screening();
  return plan.ok && plan.patch.screeningStatus === 'clear' && plan.patch.screeningReference === 'Screening provider · case 4471'
    && plan.patch.screeningDate === '2026-09-20';
})());
check('without a reference it is refused', !screening({ reference: '   ' }).ok);
check('a screening dated after today is refused', !screening({ performedOn: '2026-09-27' }).ok);
check('a result other than clear or flagged is refused', !screening({ result: 'approved' }).ok);
check('flagged is recorded the same way', screening({ result: 'flagged' }).ok && screening({ result: 'flagged' }).patch.screeningStatus === 'flagged');
check('it never touches onboarding or the SRA',
  (() => { const p = screening().patch; return !('onboardingStatus' in p) && !('sraStatus' in p); })());
check('the audit entry says what was recorded and on what',
  /Screening clear — Screening provider · case 4471, performed 2026-09-20/.test(screening().audit.detail));

console.log('\nThe SRA stands on a completed, in-date assessment of this supplier');
const assessment = (over = {}) => ({
  id: 'RA-100', title: 'Annual supplier assessment', subjectType: 'supplier', supplierId: 'SUP-001', category: 'security',
  riskLevel: 'low', score: 20, status: 'completed', assessorId: 'u2', assessorName: 'Risk Analyst', assessedAt: '2026-06-01',
  validUntil: '2027-06-01', summary: '', mitigations: [], reusable: true, linkedRequestIds: [], ...over,
});
check('a completed, in-date assessment sets the SRA valid, with its expiry and id', (() => {
  const plan = planAssessmentLink(assessment(), 'SUP-001', TODAY);
  return plan.ok && plan.patch.sraStatus === 'valid' && plan.patch.sraExpiryDate === '2027-06-01' && plan.patch.sraAssessmentId === 'RA-100';
})());
check('none chosen is refused', !planAssessmentLink(undefined, 'SUP-001', TODAY).ok);
check('another supplier\'s assessment is refused', !planAssessmentLink(assessment({ supplierId: 'SUP-002' }), 'SUP-001', TODAY).ok);
check('a draft or in-review assessment is refused',
  !planAssessmentLink(assessment({ status: 'draft' }), 'SUP-001', TODAY).ok && !planAssessmentLink(assessment({ status: 'in-review' }), 'SUP-001', TODAY).ok);
check('an out-of-date assessment is refused', !planAssessmentLink(assessment({ validUntil: '2026-09-25' }), 'SUP-001', TODAY).ok);
check('the list offers only what can be linked, latest expiry first',
  JSON.stringify(linkableAssessments([
    assessment({ id: 'RA-1', validUntil: '2026-12-01' }), assessment({ id: 'RA-2', status: 'draft' }),
    assessment({ id: 'RA-3', validUntil: '2028-01-01' }), assessment({ id: 'RA-4', supplierId: 'SUP-9' }),
    assessment({ id: 'RA-5', validUntil: '2026-01-01' }),
  ], 'SUP-001', TODAY).map((a) => a.id)) === JSON.stringify(['RA-3', 'RA-1']));

console.log('\nCompleting onboarding needs a clear screening, and keeps its note');
check('pending screening blocks it', onboardingCompletionBlock({ screeningStatus: 'pending' }) !== null
  && !planOnboardingCompletion({ screeningStatus: 'pending', onboardingStatus: 'in-progress' }, 'Documents checked').ok);
check('flagged screening blocks it', !planOnboardingCompletion({ screeningStatus: 'flagged', onboardingStatus: 'in-progress' }, 'Documents checked').ok);
check('with a clear screening and a note it completes, and the note is the audit detail', (() => {
  const plan = planOnboardingCompletion({ screeningStatus: 'clear', onboardingStatus: 'in-progress' }, '  Bank details and insurance verified ');
  return plan.ok && plan.patch.onboardingStatus === 'completed' && plan.audit.detail === 'Bank details and insurance verified';
})());
check('without a note it is refused', !planOnboardingCompletion({ screeningStatus: 'clear', onboardingStatus: 'in-progress' }, ' ').ok);
check('the portal starts onboarding and never takes back a completed one',
  portalOnboardingStatus('not-started') === 'in-progress' && portalOnboardingStatus('in-progress') === 'in-progress'
    && portalOnboardingStatus('completed') === 'completed');

console.log('\nThe evidence is stored, and read back');
const row = mapSupplierToDb({ screeningReference: 'Case 1', screeningDate: '2026-09-20', sraAssessmentId: 'RA-100' });
check('written to its columns', row.screening_reference === 'Case 1' && row.screening_date === '2026-09-20' && row.sra_assessment_id === 'RA-100');
const back = mapDbToSupplier({ id: 'S', name: 'S', screening_reference: 'Case 1', screening_date: '2026-09-20', sra_assessment_id: 'RA-100' });
check('read from them', back.screeningReference === 'Case 1' && back.screeningDate === '2026-09-20' && back.sraAssessmentId === 'RA-100');
const schema = read('db/schema.sql');
check('the columns are in the schema',
  ['screening_reference', 'screening_date', 'sra_assessment_id'].every((c) => schema.includes(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ${c} TEXT`)));

console.log('\nThe screens write only what the rules allow');
const riskTab = read('src/features/suppliers/components/profile-risk-tab.tsx');
check('the Risk tab writes screening and the SRA only through the plans',
  /planScreeningRecord\(/.test(riskTab) && /planAssessmentLink\(/.test(riskTab)
    && !/sraStatus:\s*'valid'/.test(riskTab) && !/screeningStatus:\s*'(clear|flagged)'/.test(riskTab));
check('…and never onboarding', !/onboardingStatus/.test(riskTab));
check('each record is audited', /createAudit\.mutateAsync/.test(riskTab));
const pipeline = read('src/features/suppliers/onboarding-pipeline-page.tsx');
check('the pipeline completes onboarding only through the plan, and audits the note',
  /planOnboardingCompletion\(/.test(pipeline) && /createAudit\.mutateAsync/.test(pipeline) && !/onboardingStatus:\s*'completed'/.test(pipeline));
check('the portal form uses the rule, not a literal in progress',
  /portalOnboardingStatus\(/.test(read('src/features/suppliers/portal/portal-onboarding.tsx'))
    && !/onboardingStatus:\s*'in-progress'/.test(read('src/features/suppliers/portal/portal-onboarding.tsx')));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All supplier-evidence checks passed.');
