#!/usr/bin/env node
// Vendor onboarding: two gates, not one stage.
//
// Onboarding sat exactly where risk sat before R4 — a synthetic step spliced
// into the intake preview, with no status, no stage in any channel, and no node
// in any template. Its trigger was `!supplierId || !supplierData.complete`
// (stale master data), which fired on nearly every request and meant nothing.
//
// The rule is "a NEW supplier", and it needs two answers at two moments:
//   LIGHT  record exists + screened  → gates SOURCING and RISK COMPLETION
//   FULL   onboarding completed      → gates CONTRACTING, awarded supplier only
//
// Self-contained — mirrors src/lib/workflow/onboarding-stage.ts and the award
// routing in src/lib/db/sourcing-responses.ts. Keep in sync.
// Run: npm run test:onboarding-stage

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors onboarding-stage.ts ─────────────────────────────────────────────

function onboardingState(supplier) {
  if (!supplier) {
    return { outstanding: 'light', lightComplete: false, fullComplete: false,
      reason: 'No supplier has been identified yet.' };
  }
  const screened = supplier.screeningStatus === 'clear';
  const flagged = supplier.screeningStatus === 'flagged';
  const fullComplete = supplier.onboardingStatus === 'completed';
  const lightComplete = screened && !flagged;

  if (flagged) {
    return { outstanding: 'light', lightComplete: false, fullComplete: false,
      reason: `${supplier.name} is flagged by screening and cannot be onboarded until that is resolved.` };
  }
  if (!lightComplete) {
    return { outstanding: 'light', lightComplete: false, fullComplete,
      reason: `${supplier.name} has not cleared screening yet (light onboarding).` };
  }
  if (!fullComplete) {
    return { outstanding: 'full', lightComplete: true, fullComplete: false,
      reason: `${supplier.name} is screened but onboarding is ${supplier.onboardingStatus} — full onboarding is required before contracting.` };
  }
  return { outstanding: 'none', lightComplete: true, fullComplete: true,
    reason: `${supplier.name} is fully onboarded.` };
}

const canEnterSourcing = (s) => !s
  ? { allowed: true, reason: 'No supplier named — the event will go out to market.' }
  : (({ lightComplete, reason }) => ({ allowed: lightComplete, reason }))(onboardingState(s));

const supplierReadyForRiskCompletion = (s) => !s
  ? { allowed: false, reason: 'The risk assessment needs a supplier record — identify or create the supplier first.' }
  : (({ lightComplete, reason }) => ({ allowed: lightComplete, reason }))(onboardingState(s));

const canEnterContracting = (s) => !s
  ? { allowed: false, reason: 'No awarded supplier to contract with.' }
  : (({ fullComplete, reason }) => ({ allowed: fullComplete, reason }))(onboardingState(s));

const isProspective = (s) => Boolean(s?.prospective);
const onboardingRequired = (s) => (!s ? false : isProspective(s) || !onboardingState(s).fullComplete);

// mirrors applyAwardToRequest's stage choice
const POST_SOURCING_STATUS = 'contracting';
function awardDestination(winnerSupplier) {
  return canEnterContracting(winnerSupplier).allowed ? POST_SOURCING_STATUS : 'onboarding';
}

// ── fixtures ────────────────────────────────────────────────────────────────

const onboarded = { id: 'S1', name: 'Established Ltd', screeningStatus: 'clear', onboardingStatus: 'completed' };
const screenedNotOnboarded = { id: 'S2', name: 'Halfway Ltd', screeningStatus: 'clear', onboardingStatus: 'in-progress' };
const prospective = { id: 'S3', name: 'BrandNew Ltd', screeningStatus: 'pending', onboardingStatus: 'not-started', prospective: true };
const flagged = { id: 'S4', name: 'Flagged Ltd', screeningStatus: 'flagged', onboardingStatus: 'not-started' };
// The case the old trigger conflated with a new supplier.
const refreshing = { id: 'S5', name: 'Refresh Ltd', screeningStatus: 'clear', onboardingStatus: 'in-progress' };

console.log('An established supplier clears both gates');
check('nothing outstanding', onboardingState(onboarded).outstanding === 'none');
check('may enter sourcing', canEnterSourcing(onboarded).allowed);
check('risk may be completed', supplierReadyForRiskCompletion(onboarded).allowed);
check('may enter contracting', canEnterContracting(onboarded).allowed);
check('needs no onboarding stage', onboardingRequired(onboarded) === false);

console.log('\nA brand-new supplier is blocked at the LIGHT gate');
check('light onboarding is outstanding', onboardingState(prospective).outstanding === 'light');
check('CANNOT be invited to a sourcing event', canEnterSourcing(prospective).allowed === false);
// The reason the user gave for needing the supplier created early.
check('the risk assessment CANNOT be completed', supplierReadyForRiskCompletion(prospective).allowed === false);
check('and obviously not contracting', canEnterContracting(prospective).allowed === false);
check('the block explains itself', /screening/i.test(canEnterSourcing(prospective).reason));

console.log('\nScreened but not onboarded: through the light gate, held at the full one');
check('light is complete', onboardingState(screenedNotOnboarded).lightComplete === true);
check('MAY be invited to a sourcing event', canEnterSourcing(screenedNotOnboarded).allowed === true);
check('risk MAY be completed', supplierReadyForRiskCompletion(screenedNotOnboarded).allowed === true);
// The point of two gates: paperwork for a vendor who may not win is not
// demanded up front, but a contract with one who cannot be paid is refused.
check('may NOT enter contracting', canEnterContracting(screenedNotOnboarded).allowed === false);
check('full onboarding is what is outstanding', onboardingState(screenedNotOnboarded).outstanding === 'full');

console.log('\nA flagged supplier is stopped, not merely delayed');
check('light never completes while flagged', onboardingState(flagged).lightComplete === false);
check('no sourcing', canEnterSourcing(flagged).allowed === false);
check('no contracting', canEnterContracting(flagged).allowed === false);
check('the reason names screening, not paperwork', /flagged by screening/i.test(onboardingState(flagged).reason));

console.log('\nNo supplier is not the same as an onboarded one');
// Going to market with nobody named is normal and must not be blocked...
check('an unnamed supplier does NOT block sourcing', canEnterSourcing(null).allowed === true);
// ...but the risk assessment has nothing to hang off.
check('an unnamed supplier DOES block risk completion', supplierReadyForRiskCompletion(null).allowed === false);
check('and blocks contracting', canEnterContracting(null).allowed === false);
check('no supplier does not trigger an onboarding stage', onboardingRequired(null) === false);

console.log('\nProspective is not the same as "onboarding incomplete"');
check('a refreshing established supplier is not prospective', isProspective(refreshing) === false);
check('a demand-created supplier is', isProspective(prospective) === true);
// Both need the stage, but for different reasons — the distinction is what the
// old `!supplierId || !complete` trigger destroyed.
check('both still need the onboarding stage',
  onboardingRequired(refreshing) === true && onboardingRequired(prospective) === true);

console.log('\nAward routing honours the full gate');
check('a fully onboarded winner goes straight to contracting',
  awardDestination(onboarded) === 'contracting');
check('a winner mid-onboarding goes to onboarding instead',
  awardDestination(screenedNotOnboarded) === 'onboarding', awardDestination(screenedNotOnboarded));
check('a prospective winner goes to onboarding', awardDestination(prospective) === 'onboarding');
check('a flagged winner never reaches contracting', awardDestination(flagged) !== 'contracting');
// R5's regression: an award must always move the request off sourcing.
check('an award never leaves the request in sourcing',
  [onboarded, screenedNotOnboarded, prospective, flagged]
    .every((s) => awardDestination(s) !== 'sourcing'));

console.log('\nThe channel stage lists carry onboarding');
const STAGES_BY_CHANNEL = {
  'procurement-led': ['intake', 'validation', 'risk', 'onboarding', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment'],
  'business-led': ['intake', 'validation', 'risk', 'onboarding', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  catalogue: ['intake', 'po', 'receipt', 'invoice', 'payment'],
};
check('onboarding sits after risk (it needs the supplier record)',
  STAGES_BY_CHANNEL['procurement-led'].indexOf('onboarding') >
  STAGES_BY_CHANNEL['procurement-led'].indexOf('risk'));
check('and before sourcing (it gates the invitation)',
  STAGES_BY_CHANNEL['procurement-led'].indexOf('onboarding') <
  STAGES_BY_CHANNEL['procurement-led'].indexOf('sourcing'));
check('a catalogue order has no onboarding stage',
  !STAGES_BY_CHANNEL.catalogue.includes('onboarding'));

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All onboarding-stage checks passed.');
process.exit(failures === 0 ? 0 : 1);
