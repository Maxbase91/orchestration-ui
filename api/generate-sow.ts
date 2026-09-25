import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLLM } from './_llm.js';
import { getServiceDescriptionTemplate } from './_sd-template.js';
import {
  composeNarrativeFromSections,
  requiredSectionsFor,
} from '../src/lib/procurement/service-description-config.js';
import { loadPolicyConfig } from './_policy.js';
import { renderSystemPrompt, builtInGuidanceFor } from '../src/lib/procurement/service-description-defaults.js';

export const config = { maxDuration: 60 };


// ── Quality checks ────────────────────────────────────────────────────────────

interface QualityCheck {
  section: string;
  passed: boolean;
  issue: string | null;
}

function runQualityChecks(
  sections: Record<string, string>,
): { checks: QualityCheck[]; score: number } {
  const checks: QualityCheck[] = [];

  const add = (section: string, passed: boolean, issue: string | null) =>
    checks.push({ section, passed, issue });

  // Each section must be non-trivial (>40 chars)
  for (const [key, val] of Object.entries(sections)) {
    if (!val || val.trim().length < 40) {
      add(key, false, `Section is too short or empty — add detail.`);
    } else {
      add(key, true, null);
    }
  }

  // Deliverables must look like a list
  const deliv = sections.deliverables ?? '';
  if (deliv && !/\d\.|•|-|\*/.test(deliv)) {
    const idx = checks.findIndex((c) => c.section === 'deliverables');
    if (idx >= 0 && checks[idx].passed) {
      checks[idx] = { section: 'deliverables', passed: false, issue: 'Deliverables should be a numbered or bulleted list.' };
    }
  }

  // Acceptance criteria must mention measurable elements
  const ac = sections.acceptanceCriteria ?? '';
  if (ac && !/\d+%|\bKPI\b|\bSLA\b|\bmeasur|\bsign-off|\bapprove|\btest|\bvalidat/.test(ac.toLowerCase())) {
    const idx = checks.findIndex((c) => c.section === 'acceptanceCriteria');
    if (idx >= 0 && checks[idx].passed) {
      checks[idx] = { section: 'acceptanceCriteria', passed: false, issue: 'Acceptance criteria should include measurable KPIs, SLAs, or specific sign-off conditions.' };
    }
  }

  // Timeline must mention phases or dates
  const timeline = sections.timeline ?? '';
  if (timeline && !/phase|week|month|quarter|Q[1-4]|sprint|milestone|\d{4}/.test(timeline.toLowerCase())) {
    const idx = checks.findIndex((c) => c.section === 'timeline');
    if (idx >= 0 && checks[idx].passed) {
      checks[idx] = { section: 'timeline', passed: false, issue: 'Timeline should reference phases, durations, or milestone dates.' };
    }
  }

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;

  return { checks, score };
}

// ── Mock provider ─────────────────────────────────────────────────────────────


function mockGenerate(
  category: string,
  title: string,
  value: number,
  capturedAnswers: Record<string, string>,
): Record<string, string> {
  const cat = category || 'services';
  const val = value ? `€${value.toLocaleString()}` : 'TBD';

  return {
    objective: capturedAnswers.objective
      ? `${capturedAnswers.objective}. This engagement is critical to delivering the organisation's strategic priorities and is expected to generate significant operational and financial value. A rigorous, structured approach will ensure outcomes are measurable and sustainable.`
      : `Procure ${cat} to address the business need described as: "${title}". The engagement will deliver measurable improvements aligned to organisational KPIs. Success will be defined by stakeholder sign-off and quantified outcomes.`,
    scope: capturedAnswers.scope
      ? `${capturedAnswers.scope}. The agreed workstreams will be delivered end to end.`
      : `Full lifecycle ${cat} delivery for "${title}" covering design, delivery, and handover.`,
    exclusions: capturedAnswers.exclusions
      ? capturedAnswers.exclusions
      : 'Ongoing operational support beyond the agreed delivery period and work outside the confirmed deliverables.',
    deliverables: capturedAnswers.deliverables
      ? capturedAnswers.deliverables
      : `1. Inception and scoping report\n2. Detailed work plan with milestones\n3. Interim progress reviews (bi-weekly)\n4. Final deliverable as agreed\n5. Handover documentation and knowledge transfer`,
    timeline: capturedAnswers.timeline
      ? `${capturedAnswers.timeline}. Phase 1 (Mobilisation): weeks 1–2. Phase 2 (Delivery): weeks 3–8. Phase 3 (Handover & Review): weeks 9–10.`
      : `Phase 1 — Mobilisation (2 weeks): kickoff, access, planning. Phase 2 — Delivery (6–8 weeks): core workstreams. Phase 3 — Handover (2 weeks): documentation, knowledge transfer, sign-off.`,
    resources: capturedAnswers.resources
      ? `${capturedAnswers.resources}. Client responsibilities: executive sponsor, subject matter experts, system access, and timely review and approval of deliverables.`
      : `Supplier team: Lead/Director, 2 Senior Consultants/Engineers, Analyst support as needed. Client team: Sponsor, Project Manager, SMEs per workstream.`,
    acceptanceCriteria: capturedAnswers.acceptanceCriteria
      ? capturedAnswers.acceptanceCriteria
      : `1. All deliverables reviewed and approved by the client steering group within 10 business days of submission.\n2. Quality score ≥ 85% on independent review.\n3. Zero open critical defects at handover.\n4. Handover documentation signed off by client IT/Operations lead.`,
    pricingModel: capturedAnswers.pricingModel
      ? capturedAnswers.pricingModel
      : `Fixed fee of ${val} for the full engagement scope as defined above. Any changes to scope will be governed by the agreed change control process. Payment schedule: 30% on mobilisation, 40% at mid-point milestone, 30% on final sign-off.`,
    location: capturedAnswers.location || `Delivery will be primarily remote with on-site attendance as required (minimum 20% on-site). Travel and expenses charged at cost, subject to client pre-approval above €500 per trip.`,
    dependencies: capturedAnswers.dependencies
      ? capturedAnswers.dependencies
      : `1. Client executive sponsor committed for the full duration.\n2. Access to required systems, data, and stakeholders within 5 business days of contract start.\n3. Steering committee meetings confirmed in advance for project duration.\n4. Any third-party dependencies identified within the first 2 weeks.`,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    category = 'services',
    title = '',
    value = 0,
    supplier = '',
    timeline = '',
    capturedAnswers = {},
    commodityCode = '',
    signals = null,
    mock = false,
  } = req.body ?? {};

  // The admin-configured guidance wins; the built-in text is the fallback, and
  // the Service description tab shows it, so what the model is told is never
  // text an admin cannot see. Resolved by the REQUESTED category: with no row
  // the template is the built-in `default`, which would pick the wrong text.
  const template = await getServiceDescriptionTemplate(category);
  const guidance = template.categoryGuidance || builtInGuidanceFor(category);
  const resolved = { ...template, categoryGuidance: guidance };

  // Which sections this demand's governance read makes mandatory. Config, not a
  // constant: the conditions live on the template and are editable at
  // /admin/service-description. With no signals the list is empty and behaviour
  // is exactly what it was before this existed.
  const sig = (signals ?? {}) as Record<string, unknown>;
  const conditionCtx = {
    category,
    value: value as number,
    materiality: sig.materiality as string | undefined,
    riskTier: sig.inherentRiskTier as string | undefined,
    dataSensitivity: sig.dataSensitivity as string | undefined,
    sourcingType: sig.sourcingTypeHint as string | undefined,
  };
  // The admin's saved thresholds, not the shipped defaults. A `policy:<key>`
  // token on a section's `requiredWhen` is the whole point of the indirection —
  // resolved against DEFAULT_POLICY_CONFIG it silently answered with the
  // shipped number, so raising a threshold at /admin/thresholds moved what the
  // determination screen demanded and not what generation was told to cover.
  const required = signals
    ? requiredSectionsFor(resolved.sections, conditionCtx, await loadPolicyConfig())
    : [];
  const requiredLabels = required.map(
    (id) => resolved.sections.find((x) => x.id === id)?.label ?? id,
  );

  // Rendered into the prompt so the model is told what this specific demand has
  // to cover, and reported back to the client so the determination screen can
  // check the same list rather than a second one of its own.
  const signalsBlock = signals
    ? [
        `Materiality: ${sig.materiality ?? 'unknown'}`,
        `Inherent risk: ${sig.inherentRiskTier ?? 'unknown'}`,
        `Data sensitivity: ${sig.dataSensitivity ?? 'unknown'}`,
        `Sourcing: ${sig.sourcingTypeHint ?? 'unknown'}`,
        requiredLabels.length
          ? `MUST COVER (mandatory for this demand): ${requiredLabels.join(', ')}`
          : 'No section is mandatory beyond the standard set for this demand.',
        'These are a preliminary read taken at capture time; write to them, do not restate them.',
      ].join('\n')
    : '';

  // Mock path (deterministic, no LLM call)
  if (mock || process.env.VITE_ASSISTANT_PROVIDER === 'mock') {
    const sections = mockGenerate(category, title, value, capturedAnswers as Record<string, string>);
    const narrative = composeNarrativeFromSections(sections, resolved.narrativeSections, {
      category, title, value,
    });
    const { checks, score } = runQualityChecks(sections);
    return res.status(200).json({
      sections, narrative, qualityScore: score, qualityChecks: checks, requiredSections: required,
    });
  }

  const systemPrompt = renderSystemPrompt(resolved, signalsBlock);

  const userMessage = `Category: ${category}
Title: ${title}
Estimated value: €${value}
Preferred supplier: ${supplier || 'TBD'}
Timeline hint: ${timeline || 'TBD'}
Commodity code: ${commodityCode || 'TBD'}

Captured answers from intake conversation:
${Object.entries(capturedAnswers as Record<string, string>)
  .filter(([, v]) => v?.trim())
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n') || '(none yet — generate fully from context)'}`;

  try {
    const raw = await callLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: resolved.temperature,
      maxTokens: resolved.maxTokens,
      jsonMode: true,
    });

    const parsed = JSON.parse(raw) as { sections: Record<string, string>; narrative: string };
    const { checks, score } = runQualityChecks(parsed.sections ?? {});

    return res.status(200).json({
      sections: parsed.sections,
      narrative: parsed.narrative,
      qualityScore: score,
      qualityChecks: checks,
      requiredSections: required,
    });
  } catch (e) {
    // LLM failed — fall back to mock
    console.warn('[generate-sow] LLM failed, using mock fallback:', e);
    const sections = mockGenerate(category, title, value as number, capturedAnswers as Record<string, string>);
    const narrative = composeNarrativeFromSections(sections, resolved.narrativeSections, {
      category, title, value: value as number, unpolished: true,
    });
    const { checks, score } = runQualityChecks(sections);
    return res.status(200).json({
      sections, narrative, qualityScore: score, qualityChecks: checks, requiredSections: required,
    });
  }
}
