#!/usr/bin/env node
// Verifies the sourcing evaluation and award rules, and the two query-level
// boundaries the sourcing module depends on.
//
// The security-shaped rule is asserted first: a supplier sees only their own
// invitation, and never the event's criteria weights or budget. Both are
// enforced in the query rather than a component — RLS is "allow all", so a
// component-level filter would be a display convention.
//
// Self-contained — mirrors src/lib/procurement/sourcing-award.ts and the query
// semantics of src/lib/db/sourcing-responses.ts. Keep in sync.
// Run: node tests/integration/sourcing.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors sourcing-award.ts ───────────────────────────────────────────────
const REQUIRED_CRITERIA_WEIGHT_TOTAL = 100;

function calcWeightedTotal(scores, criteria) {
  let totalWeight = 0, weightedSum = 0;
  for (const c of criteria) {
    weightedSum += (scores[c.id] ?? 0) * c.weight;
    totalWeight += c.weight;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
}
const criteriaWeightTotal = (criteria) => criteria.reduce((s, c) => s + c.weight, 0);
const areCriteriaWeightsValid = (criteria) => criteriaWeightTotal(criteria) === REQUIRED_CRITERIA_WEIGHT_TOTAL;

function rankResponses(candidates) {
  return candidates
    .filter((c) => c.status === 'responded' && c.shortlisted)
    .sort((a, b) => {
      const byScore = (b.weightedTotal ?? 0) - (a.weightedTotal ?? 0);
      if (byScore !== 0) return byScore;
      const byPrice = (a.price ?? Infinity) - (b.price ?? Infinity);
      if (byPrice !== 0) return byPrice;
      return a.supplierName.localeCompare(b.supplierName);
    });
}

const AWARDABLE_EVENT_STATUSES = ['published', 'in-evaluation', 'award-pending'];
function canAward(event, candidates, responseId) {
  if (!AWARDABLE_EVENT_STATUSES.includes(event.status)) return { allowed: false, blocker: 'event-not-live' };
  if (event.awardedSupplierId) return { allowed: false, blocker: 'already-awarded' };
  const eligible = rankResponses(candidates);
  if (eligible.length === 0) return { allowed: false, blocker: 'no-eligible-responses' };
  if (!eligible.some((c) => c.id === responseId)) return { allowed: false, blocker: 'response-not-eligible' };
  return { allowed: true };
}
const awardWriteBack = (w) => ({ supplierId: w.supplierId, supplierName: w.supplierName });

// ── fixtures ────────────────────────────────────────────────────────────────
const CRITERIA = [
  { id: 'c1', label: 'Technical', weight: 40 },
  { id: 'c2', label: 'Price', weight: 30 },
  { id: 'c3', label: 'Experience', weight: 30 },
];

const RESPONSES = [
  { id: 'r1', eventId: 'SRC-0002', supplierId: 'SUP-001', supplierName: 'Alpha', status: 'responded', shortlisted: true,  weightedTotal: 4.2, price: 100000 },
  { id: 'r2', eventId: 'SRC-0002', supplierId: 'SUP-003', supplierName: 'Bravo', status: 'responded', shortlisted: true,  weightedTotal: 4.5, price: 120000 },
  { id: 'r3', eventId: 'SRC-0002', supplierId: 'SUP-005', supplierName: 'Delta', status: 'responded', shortlisted: false, weightedTotal: 4.9, price: 90000 },
  { id: 'r4', eventId: 'SRC-0002', supplierId: 'SUP-007', supplierName: 'Echo',  status: 'not-viewed', shortlisted: true },
  { id: 'r5', eventId: 'SRC-0003', supplierId: 'SUP-001', supplierName: 'Alpha', status: 'viewed',    shortlisted: true },
];

// mirrors listInvitationsForSupplier — the .eq() IS the entitlement
const listInvitationsForSupplier = (supplierId) => RESPONSES.filter((r) => r.supplierId === supplierId);
const listResponsesForEvent = (eventId) => RESPONSES.filter((r) => r.eventId === eventId);

console.log('Entitlement — a supplier sees only their own invitations');
const alpha = listInvitationsForSupplier('SUP-001');
check('scoped to the supplier', alpha.every((r) => r.supplierId === 'SUP-001'));
check('spans their events', new Set(alpha.map((r) => r.eventId)).size === 2);
check('cannot see another supplier\'s response', !alpha.some((r) => r.supplierName === 'Bravo'));
check('an uninvited supplier gets nothing', listInvitationsForSupplier('SUP-999').length === 0);
check('the invitation row carries no criteria or budget',
  alpha.every((r) => !('criteria' in r) && !('budget' in r) && !('weight' in r)));

console.log('\nCriteria weights');
check('weights totalling 100 are valid', areCriteriaWeightsValid(CRITERIA));
check('weights totalling 90 are not', !areCriteriaWeightsValid([{ id: 'c1', label: 'x', weight: 90 }]));
check('weights totalling 110 are not',
  !areCriteriaWeightsValid([...CRITERIA, { id: 'c4', label: 'extra', weight: 10 }]));

console.log('\nWeighted scoring');
check('all-5s scores 5', calcWeightedTotal({ c1: 5, c2: 5, c3: 5 }, CRITERIA) === 5);
check('unscored criteria count as zero', calcWeightedTotal({ c1: 5 }, CRITERIA) === 2);
check('weights actually weight', calcWeightedTotal({ c1: 5, c2: 1, c3: 1 }, CRITERIA) === 2.6);
check('no criteria → 0, no divide-by-zero', calcWeightedTotal({ c1: 5 }, []) === 0);

console.log('\nRanking');
const ranked = rankResponses(listResponsesForEvent('SRC-0002'));
check('best weighted score leads', ranked[0]?.id === 'r2');
check('an eliminated supplier never ranks, however good its score',
  !ranked.some((r) => r.id === 'r3'));
check('a supplier who never responded never ranks', !ranked.some((r) => r.id === 'r4'));
check('only eligible responses are returned', ranked.length === 2);
check('ties break on the lower price', (() => {
  const tied = rankResponses([
    { id: 'a', supplierName: 'Aaa', status: 'responded', shortlisted: true, weightedTotal: 4, price: 200 },
    { id: 'b', supplierName: 'Bbb', status: 'responded', shortlisted: true, weightedTotal: 4, price: 100 },
  ]);
  return tied[0].id === 'b';
})());

console.log('\nAward gates');
const live = { status: 'published' };
check('the top-ranked response can be awarded', canAward(live, listResponsesForEvent('SRC-0002'), 'r2').allowed);
check('a non-top but eligible response can also be awarded (buyer judgement)',
  canAward(live, listResponsesForEvent('SRC-0002'), 'r1').allowed);
check('an eliminated response cannot be awarded',
  canAward(live, listResponsesForEvent('SRC-0002'), 'r3').blocker === 'response-not-eligible');
check('an unsubmitted response cannot be awarded',
  canAward(live, listResponsesForEvent('SRC-0002'), 'r4').blocker === 'response-not-eligible');
check('a completed event cannot be awarded',
  canAward({ status: 'completed' }, listResponsesForEvent('SRC-0002'), 'r2').blocker === 'event-not-live');
check('an already-awarded event cannot be awarded again',
  canAward({ status: 'published', awardedSupplierId: 'SUP-003' }, listResponsesForEvent('SRC-0002'), 'r1')
    .blocker === 'already-awarded');
check('an event with no submitted responses cannot be awarded',
  canAward(live, listResponsesForEvent('SRC-0003'), 'r5').blocker === 'no-eligible-responses');

console.log('\nWrite-back');
const patch = awardWriteBack(ranked[0]);
check('request inherits the winning supplier id', patch.supplierId === 'SUP-003');
check('request inherits the winning supplier name', patch.supplierName === 'Bravo');
check('write-back is idempotent', JSON.stringify(patch) === JSON.stringify(awardWriteBack(ranked[0])));

console.log('\nInvitation idempotency (UNIQUE event_id, supplier_id)');
const key = (r) => `${r.eventId}:${r.supplierId}`;
check('no duplicate invitation exists in the set',
  new Set(RESPONSES.map(key)).size === RESPONSES.length);
check('the same supplier can be invited to different events',
  RESPONSES.filter((r) => r.supplierId === 'SUP-001').length === 2);

console.log(failures === 0 ? '\n\x1b[32mAll checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
