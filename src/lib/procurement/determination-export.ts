// Determination export.
//
// Serialises the determination (the R1 endpoint) into a structured, portable
// document — every outcome and downstream step in one place, suitable for
// download or hand-off. Pure and standardised; no organisation- or
// product-specific framing.

export interface DeterminationExportInput {
  requestTitle?: string;
  category?: string;
  estimatedValue?: number;
  currency?: string;
  supplierName?: string;
  buyingChannel: string;
  contractType?: { type: string; reason: string };
  sourcingType?: { type: string; reason: string };
  materiality?: { material: boolean; criticality: string; reasons: string[] };
  inherentRisk?: { tier: string; drivers: string[] };
  operationalRisk?: { overall: string; dimensions: { label: string; rating: string; reason: string }[] };
  riskOutcome?: { decision: string; reasons: string[] };
  approvalToSource?: { tier: string; rationale: string; gates: { label: string; reason: string }[] };
  handoffSteps?: { label: string; system: string; status: string; deepLink?: string }[];
  policyChecks?: { label: string; passed: boolean; detail: string }[];
  /** ISO date stamp, supplied by the caller (kept out of the pure function). */
  generatedAt?: string;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'request';
}

function money(value?: number, currency = 'EUR'): string {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

/** Build a structured Markdown export of the determination + a filename. */
export function buildDeterminationExport(input: DeterminationExportInput): { markdown: string; filename: string } {
  const lines: string[] = [];
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
  if (input.materiality) {
    lines.push(`- Materiality: **${input.materiality.material ? `Material — ${input.materiality.criticality}` : 'Not material'}**${input.materiality.material ? ` (${input.materiality.reasons.join('; ')})` : ''}`);
  }
  lines.push('');

  if (input.inherentRisk || input.operationalRisk || input.riskOutcome) {
    lines.push('## Risk');
    if (input.inherentRisk) lines.push(`- Inherent risk: **${input.inherentRisk.tier}** (${input.inherentRisk.drivers.join('; ')})`);
    if (input.operationalRisk) {
      lines.push(`- Preliminary operational risk: **${input.operationalRisk.overall}**`);
      for (const d of input.operationalRisk.dimensions) {
        lines.push(`  - ${d.label}: ${d.rating} (${d.reason})`);
      }
    }
    if (input.riskOutcome) lines.push(`- Assessment outcome: **${input.riskOutcome.decision}** (${input.riskOutcome.reasons[0] ?? ''})`);
    lines.push('');
  }

  if (input.approvalToSource) {
    lines.push('## Approval to source');
    lines.push(`- Gate: **${input.approvalToSource.tier === 'none' ? 'not required' : input.approvalToSource.tier}** — ${input.approvalToSource.rationale}`);
    for (const g of input.approvalToSource.gates) {
      lines.push(`  - ${g.label}: ${g.reason}`);
    }
    lines.push('');
  }

  if (input.handoffSteps && input.handoffSteps.length > 0) {
    lines.push('## Next steps');
    lines.push('| Step | System | Status | Link |');
    lines.push('|---|---|---|---|');
    for (const s of input.handoffSteps) {
      lines.push(`| ${s.label} | ${s.system} | ${s.status} | ${s.deepLink ?? '—'} |`);
    }
    lines.push('');
  }

  if (input.policyChecks && input.policyChecks.length > 0) {
    lines.push('## Policy checks');
    for (const c of input.policyChecks) {
      lines.push(`- ${c.passed ? '✓' : '⚠'} ${c.label}: ${c.detail}`);
    }
    lines.push('');
  }

  const markdown = lines.join('\n');
  const filename = `determination-${slugify(input.requestTitle ?? input.category ?? 'request')}.md`;
  return { markdown, filename };
}
