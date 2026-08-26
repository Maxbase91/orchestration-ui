#!/usr/bin/env node
// Verifies the deterministic SOW narrative is synthesised from the service
// description, not from fixed boilerplate.
//
// Regression guard: both non-LLM paths in api/generate-sow.ts used to return a
// static template interpolating only category/title/value, so the Narrative
// Summary read the same for every request and ignored the captured answers.
//
// Self-contained — mirrors composeNarrative() in api/generate-sow.ts. Keep in sync.
// Run: node tests/integration/sow-narrative.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

function composeNarrative(sections, meta) {
  const cat = meta.category || 'services';
  const val = meta.value ? `€${Number(meta.value).toLocaleString()}` : 'a value still to be confirmed';
  const paragraphs = [];

  const opening = meta.title
    ? `This ${cat} engagement — "${meta.title}" — is valued at ${val}.`
    : `This ${cat} engagement is valued at ${val}.`;
  paragraphs.push(sections.objective ? `${opening} ${sections.objective}` : opening);

  if (sections.scope) paragraphs.push(sections.scope);

  const delivery = [sections.deliverables, sections.timeline].filter(Boolean).join('\n\n');
  if (delivery) paragraphs.push(delivery);

  const commercial = [sections.resources, sections.acceptanceCriteria, sections.pricingModel]
    .filter(Boolean)
    .join('\n\n');
  if (commercial) paragraphs.push(commercial);

  if (meta.unpolished) {
    paragraphs.push(
      'Drafted directly from the captured intake answers without AI polishing. Review each section before contract signature.',
    );
  }

  return paragraphs.join('\n\n');
}

const meta = { category: 'consulting', title: 'Target operating model review', value: 120000 };

const sectionsA = {
  objective: 'Define a target operating model for the shared services function.',
  scope: 'Current-state assessment, future-state design, and a phased transition plan.',
  deliverables: '1. Current-state report\n2. Future-state blueprint\n3. Transition roadmap',
  timeline: 'Phase 1 — Discovery (3 weeks). Phase 2 — Design (5 weeks).',
  resources: 'Supplier: engagement lead plus two consultants. Client: process owners.',
  acceptanceCriteria: '1. Steering group sign-off.\n2. All processes mapped to level 3.',
  pricingModel: 'Fixed fee, milestone-based.',
};

const sectionsB = {
  objective: 'Replace the end-of-life warehouse conveyor control system.',
  scope: 'Hardware replacement, PLC reprogramming, and commissioning across two sites.',
  deliverables: '1. Site survey\n2. Installed controllers\n3. Commissioning certificate',
};

console.log('Narrative derives from the service description');
const a = composeNarrative(sectionsA, meta);
check('includes the captured objective', a.includes(sectionsA.objective));
check('includes the captured scope', a.includes(sectionsA.scope));
check('includes the captured deliverables', a.includes(sectionsA.deliverables));
check('includes the captured timeline', a.includes(sectionsA.timeline));
check('includes the captured resources', a.includes(sectionsA.resources));
check('includes the captured acceptance criteria', a.includes(sectionsA.acceptanceCriteria));
check('includes the captured pricing model', a.includes(sectionsA.pricingModel));
check('names the title', a.includes('Target operating model review'));
check('formats the value', a.includes('€120,000'));

console.log('\nDistinct service descriptions produce distinct narratives');
const b = composeNarrative(sectionsB, { category: 'goods', title: 'Conveyor controls', value: 90000 });
check('two different SDs do not yield the same narrative', a !== b);
check('narrative B carries B objective, not A', b.includes(sectionsB.objective) && !b.includes(sectionsA.objective));

console.log('\nOld boilerplate is gone');
for (const phrase of [
  'balance ambition with deliverability',
  'strong executive sponsorship',
  'represents a best-practice framework',
  'has been automatically drafted based on the available context',
]) {
  check(`no boilerplate: "${phrase}"`, !a.includes(phrase) && !b.includes(phrase));
}

console.log('\nDegrades gracefully');
const empty = composeNarrative({}, { category: '', title: '', value: 0 });
check('no sections → still a sentence, no crash', empty.length > 0 && empty.includes('services'));
check('no value → does not print €0', !empty.includes('€0') && empty.includes('value still to be confirmed'));
const partial = composeNarrative({ objective: 'Only an objective.' }, meta);
check('partial sections → no empty paragraphs', !partial.includes('\n\n\n') && partial.includes('Only an objective.'));

console.log('\nLLM-failure path flags itself');
const fallback = composeNarrative(sectionsA, { ...meta, unpolished: true });
check('carries the review caveat', fallback.includes('without AI polishing'));
check('mock path carries no caveat', !a.includes('without AI polishing'));
check('caveat does not replace the captured content', fallback.includes(sectionsA.objective));

console.log(failures === 0 ? '\n\x1b[32mAll checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
