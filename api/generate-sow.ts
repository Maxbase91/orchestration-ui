import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLLM } from '../src/lib/llm.js';

export const config = { maxDuration: 60 };

// ── Category-specific guidance ────────────────────────────────────────────────

const CATEGORY_GUIDANCE: Record<string, string> = {
  consulting: `
- Objective: frame the business problem, strategic context, and success criteria (2–3 sentences).
- Scope: define engagement boundaries, included/excluded work streams, and geography.
- Deliverables: numbered list of tangible outputs (reports, designs, prototypes, workshops, roadmaps).
- Timeline: phased schedule — Discovery / Analysis / Design / Implementation / Handover — with durations.
- Resources: supplier team composition (Partner, Director, Senior Consultant, Analyst) + client-side RACI.
- Acceptance Criteria: measurable KPIs (e.g., "Target Operating Model approved by ExCo", "ROI modelled ≥3x", "Roadmap validated by 3 business units").
- Pricing Model: T&M-with-cap or fixed-fee-per-phase; specify rate card bands if T&M.
- Dependencies: client data access, sponsor commitment, steering committee cadence.`,

  services: `
- Objective: operational need and service outcome (e.g., "maintain site cleanliness to ISO 9001 standard").
- Scope: locations, frequency, coverage hours, exclusions.
- Deliverables: regular service output — e.g., "Daily clean Mon–Fri", "Monthly compliance report".
- Timeline: contract start/end, mobilisation period, review milestones.
- Resources: FTE/headcount, supervisor, client contact.
- Acceptance Criteria: measurable SLAs (response times, KPIs, audit scores, customer satisfaction).
- Pricing Model: monthly fixed fee, rate card, or activity-based; include CPI uplift clause.
- Dependencies: site access, client onboarding checklist, incumbent transition.`,

  software: `
- Objective: business capability being unlocked (e.g., "replace legacy ERP with cloud-native platform").
- Scope: modules/features in scope, user count, integrations, data migration.
- Deliverables: licences/subscriptions, implementation, training, documentation, SLAs.
- Timeline: procurement → contract → onboarding → go-live → hypercare.
- Resources: vendor CSM, implementation partner, client IT owner.
- Acceptance Criteria: UAT sign-off, security review passed, uptime SLA (e.g., 99.9%), data protection addendum signed.
- Pricing Model: per-seat SaaS, enterprise licence, or consumption-based; renewal terms.
- Dependencies: IT architecture approval, DPA, infosec review, SSO integration.`,

  goods: `
- Objective: physical need and business justification.
- Scope: item specification, quantity, quality standards (ISO, CE, etc.).
- Deliverables: numbered list of SKUs with specifications and quantities.
- Timeline: order → lead time → delivery → inspection → acceptance.
- Resources: procurement contact, receiving warehouse, QA inspector.
- Acceptance Criteria: items match spec, pass incoming inspection, delivered to location by date.
- Pricing Model: unit price, volume discount thresholds, Incoterms (DDP/DAP).
- Dependencies: warehouse availability, import/customs requirements.`,

  default: `
- Write each section as a professional, specific, multi-sentence paragraph.
- Deliverables must be a numbered list.
- Acceptance Criteria must include at least 2 measurable KPIs or pass/fail tests.
- Timeline must reference phases or milestones, not just a single date.
- Pricing Model must state the commercial structure (fixed, T&M, subscription, etc.).`,
};

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
      ? `${capturedAnswers.scope}. In scope: end-to-end delivery of all agreed workstreams. Out of scope: ongoing operational support beyond the contract period unless separately agreed in writing.`
      : `Full lifecycle ${cat} delivery for "${title}". In scope: design, delivery, and handover. Out of scope: post-handover operational support.`,
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
    mock = false,
  } = req.body ?? {};

  const guidance = CATEGORY_GUIDANCE[category] ?? CATEGORY_GUIDANCE.default;

  // Mock path (deterministic, no LLM call)
  if (mock || process.env.VITE_ASSISTANT_PROVIDER === 'mock') {
    const sections = mockGenerate(category, title, value, capturedAnswers as Record<string, string>);
    const narrative = `This ${category} engagement, "${title}", has been structured to deliver clear, measurable outcomes. The scope has been carefully defined to balance ambition with deliverability, with a phased approach ensuring early wins while building toward the full business case.\n\nThe proposed engagement model leverages a structured ${category} methodology, adapted to the specific context of this organisation. Key success factors include strong executive sponsorship, timely access to data and stakeholders, and a clearly defined change management approach alongside the core delivery workstreams.\n\nFinancially, the engagement is structured at ${value ? `€${Number(value).toLocaleString()}` : 'the agreed budget'} with milestone-based payments to align supplier incentives with delivery outcomes. The acceptance criteria are designed to be objective and measurable, ensuring both parties have clarity on what "done" looks like.\n\nThis Statement of Work represents a best-practice framework for engagements of this type. It should be reviewed by all key stakeholders before contract signature and updated to reflect any agreed changes to scope.`;
    const { checks, score } = runQualityChecks(sections);
    return res.status(200).json({ sections, narrative, qualityScore: score, qualityChecks: checks });
  }

  const systemPrompt = `You are an expert procurement category manager drafting a professional Statement of Work (SOW).

TASK: Generate a complete, detailed, professional SOW JSON for the request described below.

CATEGORY-SPECIFIC GUIDANCE:
${guidance}

RULES:
1. Each section must be MULTI-SENTENCE and SPECIFIC — never echo the user's exact words verbatim. Expand, enrich, and make professional.
2. Infer sensible defaults for any section not explicitly covered in the captured answers — clearly note AI-drafted content.
3. Write in third person, formal English, present tense.
4. Deliverables MUST be a numbered list.
5. Acceptance Criteria MUST include at least 2 measurable conditions (% targets, KPIs, sign-off gates).
6. Timeline MUST name phases with approximate durations.
7. Output ONLY valid JSON — no markdown, no commentary outside the JSON.

OUTPUT FORMAT (JSON only):
{
  "sections": {
    "objective": "...",
    "scope": "...",
    "deliverables": "1. ...\n2. ...\n3. ...",
    "timeline": "Phase 1...",
    "resources": "...",
    "acceptanceCriteria": "1. ...\n2. ...",
    "pricingModel": "...",
    "location": "...",
    "dependencies": "..."
  },
  "narrative": "<3–4 paragraph executive summary synthesising the full SOW>"
}`;

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
      temperature: 0.5,
      maxTokens: 3000,
      jsonMode: true,
    });

    const parsed = JSON.parse(raw) as { sections: Record<string, string>; narrative: string };
    const { checks, score } = runQualityChecks(parsed.sections ?? {});

    return res.status(200).json({
      sections: parsed.sections,
      narrative: parsed.narrative,
      qualityScore: score,
      qualityChecks: checks,
    });
  } catch (e) {
    // LLM failed — fall back to mock
    console.warn('[generate-sow] LLM failed, using mock fallback:', e);
    const sections = mockGenerate(category, title, value as number, capturedAnswers as Record<string, string>);
    const narrative = `This ${category} engagement has been automatically drafted based on the available context. Please review all sections and update as needed before finalising the Statement of Work.`;
    const { checks, score } = runQualityChecks(sections);
    return res.status(200).json({ sections, narrative, qualityScore: score, qualityChecks: checks });
  }
}
