#!/usr/bin/env node
// Verifies the determination export builder.
//
// Self-contained — mirrors src/lib/procurement/determination-export.ts. Keep in
// sync. Run: node tests/integration/determination-export.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'request';
const money = (v, c = 'EUR') => (typeof v !== 'number' ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v));

function buildDeterminationExport(input) {
  const lines = [];
  lines.push(`# Determination${input.requestTitle ? ` — ${input.requestTitle}` : ''}`);
  if (input.generatedAt) lines.push(`_Generated ${input.generatedAt}_`);
  lines.push('');
  lines.push('## Request');
  lines.push(`- Category: ${input.category ?? '—'}`);
  lines.push(`- Estimated value: ${money(input.estimatedValue, input.currency)}`);
  lines.push(`- Supplier: ${input.supplierName ?? 'Not selected'}`);
  lines.push('');
  lines.push('## Determination');
  lines.push(`- Buying channel: **${input.buyingChannel}**`);
  if (input.contractType) lines.push(`- Contract type: **${input.contractType.type}** (${input.contractType.reason})`);
  if (input.sourcingType) lines.push(`- Sourcing type: **${input.sourcingType.type}** (${input.sourcingType.reason})`);
  if (input.contractCoverage) {
    lines.push(`- Contract coverage: **${input.contractCoverage.recommendation}** — ${input.contractCoverage.reason}`);
    for (const c of input.contractCoverage.candidates) lines.push(`  - ${c.title}: ${c.kind}`);
  }
  if (input.materiality) lines.push(`- Materiality: **${input.materiality.material ? `Material — ${input.materiality.criticality}` : 'Not material'}**${input.materiality.material ? ` (${input.materiality.reasons.join('; ')})` : ''}`);
  lines.push('');
  if (input.inherentRisk || input.riskOutcome) {
    lines.push('## Risk');
    if (input.inherentRisk) lines.push(`- Inherent risk: **${input.inherentRisk.tier}** (${input.inherentRisk.drivers.join('; ')})`);
    if (input.riskOutcome) lines.push(`- Assessment outcome: **${input.riskOutcome.decision}** (${input.riskOutcome.reasons[0] ?? ''})`);
    lines.push('');
  }
  if (input.handoffSteps?.length) {
    lines.push('## Next steps', '| Step | System | Status | Link |', '|---|---|---|---|');
    for (const s of input.handoffSteps) lines.push(`| ${s.label} | ${s.system} | ${s.status} | ${s.deepLink ?? '—'} |`);
    lines.push('');
  }
  if (input.policyChecks?.length) {
    lines.push('## Policy checks');
    for (const c of input.policyChecks) lines.push(`- ${c.passed ? '✓' : '⚠'} ${c.label}: ${c.detail}`);
    lines.push('');
  }
  return { markdown: lines.join('\n'), filename: `determination-${slugify(input.requestTitle ?? input.category ?? 'request')}.md` };
}

const full = buildDeterminationExport({
  requestTitle: 'Cloud migration', category: 'software', estimatedValue: 120000, currency: 'EUR',
  supplierName: 'Acme', buyingChannel: 'procurement-led',
  contractType: { type: 'new-msa', reason: 'No existing agreement' },
  sourcingType: { type: 'new-event', reason: 'New sourcing event' },
  contractCoverage: { recommendation: 'author-sow', reason: 'Framework available', candidates: [{ title: 'MSA — Acme', kind: 'framework' }] },
  materiality: { material: true, criticality: 'critical', reasons: ['Critical data sensitivity'] },
  inherentRisk: { tier: 'critical', drivers: ['Highly confidential data'] },
  riskOutcome: { decision: 'new', reasons: ['No reusable assessment covers this engagement'] },
  handoffSteps: [{ label: 'Detailed risk assessment', system: 'Third-party risk register', status: 'required', deepLink: '/suppliers/risk' }],
  policyChecks: [{ label: 'Budget approval required', passed: false, detail: 'VP approval required' }],
  generatedAt: '2026-06-23',
});

console.log('Determination export');
check('has a titled heading', full.markdown.startsWith('# Determination — Cloud migration'));
check('filename is slugified from the title', full.filename === 'determination-cloud-migration.md');
check('request section formats the value as currency', full.markdown.includes('Estimated value: €120,000'));
check('determination section lists the channel', full.markdown.includes('Buying channel: **procurement-led**'));
check('includes contract + sourcing type', full.markdown.includes('Contract type: **new-msa**') && full.markdown.includes('Sourcing type: **new-event**'));
check('includes contract coverage + candidates', full.markdown.includes('Contract coverage: **author-sow**') && full.markdown.includes('MSA — Acme: framework'));
check('materiality reflected when material', full.markdown.includes('Material — critical'));
check('risk section present', full.markdown.includes('## Risk') && full.markdown.includes('Inherent risk: **critical**'));
check('next steps rendered as a table', full.markdown.includes('| Detailed risk assessment | Third-party risk register | required | /suppliers/risk |'));
check('policy checks listed with status glyphs', full.markdown.includes('⚠ Budget approval required'));

const minimal = buildDeterminationExport({ buyingChannel: 'catalogue' });
check('handles missing fields gracefully', minimal.markdown.includes('Supplier: Not selected') && minimal.markdown.includes('Estimated value: —'));
check('falls back to a default filename', minimal.filename === 'determination-request.md');
check('omits risk/next-steps/policy sections when absent', !minimal.markdown.includes('## Risk') && !minimal.markdown.includes('## Next steps'));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All determination-export checks passed.');
