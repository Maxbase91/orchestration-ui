#!/usr/bin/env node
// The governance read available at capture time.
//
// The service description is written at wizard step 3; materiality, risk and
// sourcing are determined at steps 4-5. So generation saw only category, title,
// value, supplier, timeline, captured answers and commodity code — none of the
// signals that decide what a description has to cover. It wrote the same
// document for a €4k stationery order and a material, competitively-sourced,
// high-sensitivity engagement.
//
// Self-contained — mirrors src/lib/procurement/demand-signals.ts and the
// requiredWhen conditions in service-description-defaults.ts. Keep in sync.
// Run: npm run test:demand-signals

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors demand-signals.ts ───────────────────────────────────────────────

function inferDataSensitivity(sow) {
  const blob = [sow?.objective, sow?.scope, sow?.deliverables, sow?.resources, sow?.narrative]
    .filter(Boolean).join(' ').toLowerCase();
  if (!blob) return 'medium';
  const critical = ['payment data', 'card data', 'pci', 'health data', 'medical records', 'classified', 'state secret'];
  const high = ['personal data', 'pii', 'gdpr', 'customer data', 'confidential', 'financial records', 'payroll', 'employee data', 'ip address'];
  const medium = ['internal', 'proprietary', 'commercial', 'contract terms', 'supplier data'];
  const low = ['public', 'marketing', 'brochure', 'website content'];
  if (critical.some((k) => blob.includes(k))) return 'critical';
  if (high.some((k) => blob.includes(k))) return 'high';
  if (medium.some((k) => blob.includes(k))) return 'medium';
  if (low.some((k) => blob.includes(k))) return 'low';
  return 'medium';
}

const POLICY = {
  materialityValueThreshold: 1_000_000,
  riskHighValue: 250_000,
  riskMediumValue: 50_000,
  competitiveSourcingThreshold: 25_000,
  preferredMinPerformance: 75,
};

const LEVEL = { standard: 0, important: 1, critical: 2 };
const CRITICALITY = ['standard', 'important', 'critical'];

// mirrors materiality.ts — highest-attribute-wins
function determineMateriality({ dataSensitivity, riskRating, value }, config) {
  let level = 0;
  const reasons = [];
  const raise = (to, reason) => { if (to > 0) reasons.push(reason); level = Math.max(level, to); };
  if (dataSensitivity === 'critical') raise(2, 'Critical data classification');
  else if (dataSensitivity === 'high') raise(1, 'High data sensitivity');
  if (riskRating === 'critical') raise(2, 'Critical supplier risk rating');
  else if (riskRating === 'high') raise(1, 'High supplier risk rating');
  if ((value ?? 0) >= config.materialityValueThreshold) raise(1, 'Value at/above the materiality threshold');
  const criticality = CRITICALITY[level];
  return { criticality, material: LEVEL[criticality] >= 1, reasons };
}

// mirrors risk-segmentation.ts — highest-attribute-wins
function determineInherentRisk({ dataSensitivity, supplierRiskRating, value }, config) {
  const drivers = [];
  let tier = 'low';
  const rank = { low: 0, medium: 1, high: 2, critical: 3 };
  const raise = (t, why) => { drivers.push(why); if (rank[t] > rank[tier]) tier = t; };
  if (dataSensitivity === 'critical') raise('critical', 'Critical data classification');
  else if (dataSensitivity === 'high') raise('high', 'High data sensitivity');
  else if (dataSensitivity === 'medium') raise('medium', 'Medium data sensitivity');
  if (supplierRiskRating === 'critical') raise('critical', 'Critical supplier risk');
  else if (supplierRiskRating === 'high') raise('high', 'High supplier risk');
  if ((value ?? 0) >= config.riskHighValue) raise('high', 'Value in the high band');
  else if ((value ?? 0) >= config.riskMediumValue) raise('medium', 'Value in the medium band');
  return { tier, drivers };
}

function isPreferredSupplier(s) {
  if (!s) return false;
  if (typeof s.preferred === 'boolean') return s.preferred;
  return false;
}

function computeDemandSignals(input, config = POLICY) {
  const drivers = [];
  const dataSensitivity = inferDataSensitivity(input.sow);
  if (input.sow && Object.values(input.sow).some((v) => v?.trim())) {
    drivers.push(`Data sensitivity read as ${dataSensitivity} from the description`);
  } else {
    drivers.push('Data sensitivity defaulted to medium — nothing described yet');
  }
  const supplierRisk = input.supplier?.riskRating;
  if (supplierRisk) drivers.push(`Supplier risk rating is ${supplierRisk}`);

  const m = determineMateriality({ dataSensitivity, riskRating: supplierRisk, value: input.value }, config);
  drivers.push(...m.reasons);
  const risk = determineInherentRisk({ dataSensitivity, supplierRiskRating: supplierRisk, value: input.value }, config);
  drivers.push(...risk.drivers);

  const isPreferred = isPreferredSupplier(input.supplier);
  const competitiveSourcingRequired =
    input.value >= config.competitiveSourcingThreshold && !isPreferred;
  if (competitiveSourcingRequired) drivers.push('Competitive sourcing applies at this value');

  const sourcingTypeHint = input.contractCovered
    ? 'call-off'
    : competitiveSourcingRequired ? 'competitive'
    : input.value > 0 ? 'none' : 'unknown';

  return {
    materiality: m.criticality, material: m.material,
    inherentRiskTier: risk.tier, dataSensitivity,
    competitiveSourcingRequired, sourcingTypeHint, drivers, preliminary: true,
  };
}

// ── mirrors the requiredWhen conditions in service-description-defaults.ts ──

const SECTIONS = [
  { id: 'objective', label: 'Objective' },
  { id: 'scope', label: 'Scope', requiredWhen: [{ field: 'materiality', operator: 'in', value: 'important,critical' }] },
  { id: 'deliverables', label: 'Deliverables', requiredWhen: [{ field: 'sourcingType', operator: '==', value: 'competitive' }] },
  { id: 'timeline', label: 'Timeline' },
  { id: 'resources', label: 'Resources', requiredWhen: [{ field: 'dataSensitivity', operator: 'in', value: 'high,critical' }] },
  { id: 'acceptanceCriteria', label: 'Acceptance Criteria', requiredWhen: [{ field: 'materiality', operator: 'in', value: 'important,critical' }] },
  { id: 'pricingModel', label: 'Pricing Model' },
  { id: 'location', label: 'Location' },
  { id: 'dependencies', label: 'Dependencies', requiredWhen: [{ field: 'dataSensitivity', operator: 'in', value: 'high,critical' }] },
];

function evaluate(condition, ctx) {
  const lhs = ctx[condition.field];
  if (condition.operator === 'in') {
    return String(condition.value).split(',').map((x) => x.trim().toLowerCase())
      .includes(String(lhs ?? '').toLowerCase());
  }
  if (condition.operator === '==') return String(lhs ?? '').toLowerCase() === String(condition.value).toLowerCase();
  return false;
}
const requiredSectionsFor = (sections, ctx) =>
  sections.filter((s) => s.requiredWhen?.length && s.requiredWhen.every((c) => evaluate(c, ctx))).map((s) => s.id);
const ctxFrom = (sig, category, value) => ({
  category, value,
  materiality: sig.materiality, riskTier: sig.inherentRiskTier,
  dataSensitivity: sig.dataSensitivity, sourcingType: sig.sourcingTypeHint,
});
const gapsAgainstFinal = (required, sections) => required.filter((id) => !sections[id]?.trim());

// ── the move ────────────────────────────────────────────────────────────────

console.log('inferDataSensitivity moved out of step-compliance.tsx intact');
check('payment data → critical', inferDataSensitivity({ scope: 'processing card data' }) === 'critical');
check('GDPR / personal data → high', inferDataSensitivity({ scope: 'handles personal data under GDPR' }) === 'high');
check('proprietary/internal → medium', inferDataSensitivity({ objective: 'internal proprietary tooling' }) === 'medium');
check('public marketing → low', inferDataSensitivity({ objective: 'public marketing brochure' }) === 'low');
check('all five fields are scanned, not just scope',
  inferDataSensitivity({ narrative: 'includes payroll records' }) === 'high');
// Both `medium` defaults are conservative on purpose and easy to "fix" wrongly.
check('an EMPTY description defaults to medium, not none',
  inferDataSensitivity(null) === 'medium' && inferDataSensitivity({}) === 'medium');
check('a described engagement matching nothing is medium, not low',
  inferDataSensitivity({ scope: 'repaint the loading bay' }) === 'medium');

// ── the read ────────────────────────────────────────────────────────────────

console.log('\nThe capture-time read');
const stationery = computeDemandSignals({ category: 'goods', value: 4_000, sow: { objective: 'public marketing brochure' } });
check('a small low-sensitivity order is standard', stationery.materiality === 'standard');
check('and not material', stationery.material === false);
check('and does not require competitive sourcing', stationery.competitiveSourcingRequired === false);

const major = computeDemandSignals({
  category: 'consulting', value: 400_000,
  supplier: { riskRating: 'high' },
  sow: { scope: 'processing customer data under GDPR' },
});
check('a high-risk high-sensitivity engagement is material', major.material === true);
check('its inherent risk is high', major.inherentRiskTier === 'high', major.inherentRiskTier);
check('it requires competitive sourcing', major.competitiveSourcingRequired === true);
check('sourcing reads as competitive', major.sourcingTypeHint === 'competitive');

console.log('\nIt invents nothing');
check('every read names its drivers', major.drivers.length > 0);
check('the supplier risk driver is named', major.drivers.some((d) => /supplier risk/i.test(d)));
check('the sensitivity driver names where it came from',
  major.drivers.some((d) => /from the description/i.test(d)));
check('an undescribed demand SAYS it defaulted rather than claiming a reading',
  computeDemandSignals({ category: 'goods', value: 0 }).drivers
    .some((d) => /defaulted to medium/i.test(d)));
check('a valueless, undescribed demand leaves sourcing unknown, not "none"',
  computeDemandSignals({ category: 'goods', value: 0 }).sourcingTypeHint === 'unknown');
check('the read marks itself preliminary', major.preliminary === true);
check('a covered demand reads as a call-off',
  computeDemandSignals({ category: 'services', value: 60_000, contractCovered: true }).sourcingTypeHint === 'call-off');

console.log('\nRequired sections follow the signals, from config');
const majorRequired = requiredSectionsFor(SECTIONS, ctxFrom(major, 'consulting', 400_000));
check('a material engagement must state scope', majorRequired.includes('scope'));
check('and measurable acceptance criteria', majorRequired.includes('acceptanceCriteria'));
check('competitive sourcing demands deliverables', majorRequired.includes('deliverables'));
check('high sensitivity demands resources and dependencies',
  majorRequired.includes('resources') && majorRequired.includes('dependencies'));

const smallRequired = requiredSectionsFor(SECTIONS, ctxFrom(stationery, 'goods', 4_000));
check('a small order is required to state nothing extra', smallRequired.length === 0,
  smallRequired.join(', '));
check('the two demands genuinely differ', majorRequired.length > smallRequired.length);

console.log('\nUnknown signals do not create requirements');
// The failure mode worth guarding: treating "we don't know yet" as "it applies".
const unknown = requiredSectionsFor(SECTIONS, { category: 'services', value: 0 });
check('a context with no signals requires nothing', unknown.length === 0, unknown.join(', '));

console.log('\nGaps are reported against what was actually captured');
check('a missing required section is reported',
  gapsAgainstFinal(majorRequired, { scope: 'x', deliverables: 'y' }).length > 0);
check('a whitespace-only section counts as missing',
  gapsAgainstFinal(['scope'], { scope: '   ' }).length === 1);
check('a fully covered description reports no gap',
  gapsAgainstFinal(['scope', 'deliverables'], { scope: 'x', deliverables: 'y' }).length === 0);
check('nothing required means nothing to report',
  gapsAgainstFinal([], {}).length === 0);

console.log('\nA service description carries non-string members');
//
// Reported live as: "r?.trim is not a function. (In 'r?.trim()', 'r?.trim' is
// undefined)". `Object.values(sow).some((v) => v?.trim())` assumed every value
// was a string, but a service-description record also carries a quality score
// (number), quality checks (array), signals and capture flags (objects). One of
// those reaching the signal read took the screen down.
const hasText = (sow) => Object.values(sow).some((v) => typeof v === 'string' && v.trim());

check('a description with text is detected', hasText({ objective: 'a target operating model' }));
check('an empty description is not', hasText({ objective: '', scope: '   ' }) === false);
// The values that caused the crash.
for (const [label, extra] of [
  ['a quality score (number)', { qualityScore: 82 }],
  ['quality checks (array)', { qualityChecks: [{ section: 'scope', passed: true, issue: null }] }],
  ['signals (object)', { signals: { materiality: 'important' } }],
  ['capture flags (object)', { captureFlags: { objective: 'assistant-drafted' } }],
]) {
  let threw = false;
  try { hasText({ objective: 'a real objective', ...extra }); } catch { threw = true; }
  check(`${label} does not throw`, threw === false);
  check(`${label} alone is not mistaken for text`,
    hasText({ objective: '', ...extra }) === false);
}

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All demand-signals checks passed.');
process.exit(failures === 0 ? 0 : 1);
