// An offline stand-in for the application's database endpoint, for browser tests.
//
// Why this exists: the browser suites need a reachable database, so in any
// sandbox without egress (or without credentials) they cannot run at all —
// which is precisely how a crash on the request detail reached production. This
// intercepts `POST /api/db` inside Playwright and answers from in-memory
// fixtures, so a full screen can be driven with no network and no database.
//
// It speaks the same `RequestPayload` the browser client sends
// (src/lib/neon-compatible-client.ts): an operation, a table, filters, orders,
// a limit and the single/count modifiers. Anything it does not understand is
// reported rather than silently ignored — a filter quietly dropped would make a
// test pass against rows the app would never have received.

/** Rows are DB-shaped (snake_case), exactly as PostgREST returns them. */
export const FIXTURES = {
  users: [
    { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD', is_ooo: false },
    { id: 'u02', name: 'Marc Aubert', email: 'marc.aubert@company.com', role: 'requester', department: 'Operations', initials: 'MA', is_ooo: false },
    { id: 'u05', name: 'Sofia Ricci', email: 'sofia.ricci@company.com', role: 'approver', department: 'Finance', initials: 'SR', is_ooo: false },
    { id: 'u3', name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'vendor-manager', department: 'Supplier Management', initials: 'SC', is_ooo: false },
    // An external supplier user, so any screen that must not offer one has
    // something to exclude. Without a supplier in the fixtures, a "suppliers are
    // filtered out" assertion passes whether or not the filter exists.
    { id: 'u13', name: 'David Schneider', email: 'david.schneider@external.com', role: 'supplier', department: 'Accenture (External)', initials: 'DS', is_ooo: false },
  ],
  requests: [
    {
      id: 'REQ-TEST-0001',
      title: 'Advisory support for a supplier consolidation programme',
      description: 'External advisory support to consolidate a fragmented supplier base.',
      category: 'consulting',
      status: 'risk',
      priority: 'high',
      value: 240000,
      currency: 'EUR',
      requestor_id: 'u02',
      owner_id: 'u11',
      supplier_id: null,
      supplier_name: null,
      contract_id: null,
      po_id: null,
      // Procurement-led is the longest stage list, so the workflow tab renders
      // the most step cards — the surface that crashed.
      buying_channel: 'procurement-led',
      // The template its channel runs on, so the Workflow tab draws the
      // attached template's table — owner, SLA and what the requester does.
      workflow_template_id: 'WF-001',
      commodity_code: 'CON-ADV',
      commodity_code_label: 'Advisory services',
      business_justification: 'Consolidating suppliers is expected to reduce tail spend.',
      is_urgent: false,
      days_in_stage: 3,
      is_overdue: false,
      refer_back_count: 0,
      created_at: '2026-08-01T09:00:00Z',
      updated_at: '2026-08-20T09:00:00Z',
    },
  ],
  // The row at the centre of the regression. Beside its ten text columns it
  // carries a number, two arrays and two objects — every non-string type the
  // table can hold — because a call site that walks the record as if it were a
  // map of strings throws on the first one it meets.
  service_descriptions: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      request_id: 'REQ-TEST-0001',
      objective: 'Reduce the supplier base for indirect categories by a third.',
      scope: 'Spend analysis, supplier segmentation and a consolidation roadmap.',
      deliverables: 'Baseline report, segmentation model, roadmap with owners.',
      timeline: 'Twelve weeks from kick-off.',
      resources: 'One engagement lead and two analysts.',
      acceptance_criteria: 'Roadmap signed off by the category leads.',
      pricing_model: 'Fixed fee, milestone-based.',
      location: 'Remote with two on-site workshops.',
      dependencies: 'Access to the spend cube and category owners.',
      narrative: 'An advisory engagement to consolidate the indirect supplier base.',
      quality_score: 82,
      quality_checks: [{ id: 'objective', label: 'Objective', passed: true }],
      signals: { materiality: 'material', sourcingRoute: 'competitive' },
      required_sections: ['objective', 'scope', 'deliverables', 'acceptanceCriteria'],
      capture_flags: { objective: 'answered', resources: 'assistant-drafted', dependencies: 'weak' },
      created_at: '2026-08-01T09:05:00Z',
    },
  ],
  stage_history: [
    { id: 'sh1', request_id: 'REQ-TEST-0001', stage: 'intake', entered_at: '2026-08-01T09:00:00Z', completed_at: '2026-08-02T09:00:00Z', owner_id: 'u02', action: 'submitted', notes: null },
    { id: 'sh2', request_id: 'REQ-TEST-0001', stage: 'validation', entered_at: '2026-08-02T09:00:00Z', completed_at: '2026-08-04T09:00:00Z', owner_id: 'u11', action: 'validated', notes: null },
    { id: 'sh3', request_id: 'REQ-TEST-0001', stage: 'risk', entered_at: '2026-08-04T09:00:00Z', completed_at: null, owner_id: 'u11', action: null, notes: null },
  ],
  workflow_step_details: [
    {
      id: 'wsd1', request_id: 'REQ-TEST-0001', stage: 'intake',
      handler: { type: 'human', name: 'Marc Aubert', role: 'requester' },
      action: 'Submitted the request',
      decision: null, system_involvement: null,
      forms_completed: [], documents_added: [], comments: [],
      duration: { value: 1, unit: 'days' }, sla_status: 'on-track',
    },
  ],
  // A form mapped to a service-description section: this is what makes the step
  // card build a pre-populate context at all, and so what triggered the crash.
  form_templates: [
    {
      id: 'FT-RISK-1', name: 'Third-party risk questionnaire', description: 'Risk stage intake',
      status: 'active', category: 'risk',
      trigger_stages: ['risk'], trigger_conditions: [],
      fields: [
        { id: 'f1', fieldType: 'textarea', label: 'Scope of the engagement', required: true, prePopulateFrom: 'sow.scope' },
        { id: 'f2', fieldType: 'textarea', label: 'Deliverables', required: false, prePopulateFrom: 'sow.deliverables' },
      ],
      version: '1.0', last_modified: '2026-08-01', created_by: 'u11',
    },
    // A draft form on the same stage — forStage() must exclude it (only
    // 'active' forms are ever offered to a requester). Regression for the
    // bug where a template's status was never checked at all.
    {
      id: 'FT-RISK-2-DRAFT', name: 'Draft-only risk addendum', description: 'Not yet published',
      status: 'draft', category: 'risk',
      trigger_stages: ['risk'], trigger_conditions: [],
      fields: [
        { id: 'f1', fieldType: 'text', label: 'Should never be offered', required: false },
      ],
      version: '1.0', last_modified: '2026-08-01', created_by: 'u11',
    },
    // Conditional AND blocking, on a category this request is NOT. The strand:
    // the blocking gate used to filter on status/blocking/stage without ever
    // evaluating triggerConditions, while the renderer did — so this template
    // held the stage shut for a request it never applied to, and the form it
    // wanted was never shown. Both gates share one predicate now; this fixture
    // is here so the strand cannot come back unnoticed.
    {
      id: 'FT-RISK-3-SOFTWARE-ONLY', name: 'Software licensing addendum', description: 'Software demand only',
      status: 'active', category: 'risk', blocking: true,
      trigger_stages: ['risk'],
      trigger_conditions: [{ field: 'category', operator: 'equals', value: 'software' }],
      fields: [
        { id: 'f1', fieldType: 'text', label: 'Licence metric', required: true },
      ],
      version: '1.0', last_modified: '2026-09-15', created_by: 'u11',
    },
  ],
  form_submissions: [],
  workflow_instances: [
    { id: 'wi1', request_id: 'REQ-TEST-0001', template_id: 'wf-procurement-led', current_node_ids: ['risk'], status: 'running', variables: {}, created_at: '2026-08-01T09:00:00Z', updated_at: '2026-08-04T09:00:00Z' },
  ],
  comments: [],
  // Two decisions for the admin persona (u11), so the approvals queue can be
  // driven offline: one pending and actionable, one already approved. The
  // pending one is deliberately high-value — the amount is the fact that screen
  // exists to present, and it was not a field on the card until this phase.
  // Who acts as each role (configuration since 2026-09-25). A fixture subset of
  // src/data/functional-roles.ts — this file is plain JS for suites run with
  // plain node, so it cannot import the seed.
  functional_roles: [
    { name: 'Budget Owner', acts_as: 'procurement-manager', description: '', sort_order: 1 },
    { name: 'Category Manager', acts_as: 'procurement-manager', description: '', sort_order: 2 },
    { name: 'Contract Owner', acts_as: 'procurement-manager', description: '', sort_order: 3 },
    { name: 'Finance', acts_as: 'procurement-manager', description: '', sort_order: 10 },
    { name: 'VP Procurement', acts_as: 'admin', description: '', sort_order: 11 },
    { name: 'CFO', acts_as: 'admin', description: '', sort_order: 12 },
    { name: 'Board', acts_as: 'admin', description: '', sort_order: 13 },
    { name: 'Supplier Manager', acts_as: 'vendor-manager', description: '', sort_order: 14 },
    { name: 'Legal', acts_as: 'procurement-manager', description: '', sort_order: 15 },
    { name: 'Third-party risk', acts_as: 'vendor-manager', description: '', sort_order: 25 },
    { name: 'Vendor management', acts_as: 'vendor-manager', description: '', sort_order: 26 },
  ],
  approval_entries: [
    {
      id: 'APR-TEST-1', request_id: 'REQ-TEST-0001', approver_id: 'u11',
      approver_name: 'Christine Dupont', approver_role: 'VP Procurement',
      status: 'pending', requested_at: '2026-09-15T09:00:00Z',
      step_order: 3, assignment_mode: 'role',
    },
    {
      id: 'APR-TEST-2', request_id: 'REQ-TEST-0001', approver_id: 'u11',
      approver_name: 'Christine Dupont', approver_role: 'Budget Owner',
      status: 'approved', requested_at: '2026-09-12T09:00:00Z',
      responded_at: '2026-09-13T11:20:00Z', comments: 'Budget confirmed against CC-TEST.',
      step_order: 2, assignment_mode: 'person',
      decided_by: 'u11', decided_by_name: 'Christine Dupont',
    },
  ],
  risk_assessments: [],
  intake_compliance_records: [],
  notifications: [],
  suppliers: [{
    id: 'SUP-CAT-001', name: 'Lenovo', country: 'Germany', country_code: 'DE', risk_rating: 'low',
    active_contracts: 1, total_spend_12m: 0, onboarding_status: 'active', sra_status: 'valid',
    sra_expiry_date: '2027-12-31', screening_status: 'cleared', categories: ['goods'], tier: 2,
  }, {
    // Preferred for consulting (category_preferred_suppliers below), so the
    // request detail can show the category's list beside a request whose own
    // supplier is still unknown.
    id: 'SUP-ADV-001', name: 'Advisory Partner A', country: 'Ireland', country_code: 'IE', risk_rating: 'low',
    active_contracts: 1, total_spend_12m: 0, onboarding_status: 'active', sra_status: 'valid',
    sra_expiry_date: '2027-12-31', screening_status: 'cleared', categories: ['Management Consulting'], tier: 1,
  }],
  suppliers_with_derived: [{
    id: 'SUP-CAT-001', name: 'Lenovo', country: 'Germany', country_code: 'DE', risk_rating: 'low',
    active_contracts_live: 1, total_spend_12m_live: 0, onboarding_status: 'active', sra_status: 'valid',
    sra_expiry_date: '2027-12-31', screening_status: 'cleared', categories: ['goods'], tier: 2,
  }, {
    id: 'SUP-ADV-001', name: 'Advisory Partner A', country: 'Ireland', country_code: 'IE', risk_rating: 'low',
    active_contracts_live: 1, total_spend_12m_live: 0, onboarding_status: 'active', sra_status: 'valid',
    sra_expiry_date: '2027-12-31', screening_status: 'cleared', categories: ['Management Consulting'], tier: 1,
  }],
  contracts: [{
    id: 'CON-CAT-001', title: 'IT Equipment Framework', supplier_id: 'SUP-CAT-001', supplier_name: 'Lenovo',
    value: 1000000, start_date: '2025-01-01', end_date: '2027-12-31', status: 'active', owner_id: 'u11',
    owner_name: 'Christine Dupont', department: 'IT', category: 'goods', utilisation_percentage: 10,
    linked_request_ids: [],
  }],
  contracts_with_derived: [{
    id: 'CON-CAT-001', title: 'IT Equipment Framework', supplier_id: 'SUP-CAT-001', supplier_name: 'Lenovo',
    value: 1000000, start_date: '2025-01-01', end_date: '2027-12-31', status: 'active', owner_id: 'u11',
    owner_name: 'Christine Dupont', department: 'IT', category: 'goods', utilisation_percentage: 10,
    linked_request_ids_live: [],
  }],
  risk_assessments: [{
    id: 'RSK-CAT-001', title: 'Lenovo supplier assessment', subject_type: 'supplier', supplier_id: 'SUP-CAT-001',
    contract_id: 'CON-CAT-001', category: 'operational', risk_level: 'low', score: 10, status: 'completed',
    assessor_id: 'u11', assessor_name: 'Christine Dupont', assessed_at: '2026-01-01', valid_until: '2027-12-31',
    summary: 'Valid supplier assessment', mitigations: [], reusable: true, linked_request_ids: [],
  }],
  request_supplier_candidates: [],
  cost_centres: [
    { id: 'CC-ENG-001', label: 'Engineering 1', description: '', owner: '', active: true, sort_order: 1 },
    { id: 'CC-IT-001', label: 'Information Technology 1', description: '', owner: '', active: true, sort_order: 2 },
    { id: 'CC-RETIRED-001', label: 'Retired centre', description: '', owner: '', active: false, sort_order: 3 },
  ],
  delivery_locations: [
    { id: 'office', label: 'Head office', address: '', country_code: '', active: true, sort_order: 1 },
    { id: 'warehouse', label: 'Central warehouse', address: '', country_code: '', active: true, sort_order: 2 },
    { id: 'closed-site', label: 'Closed site', address: '', country_code: '', active: false, sort_order: 3 },
  ],
  procurement_categories: [
    // Goods and consulting carry commodity codes; services carries none, the
    // state the categories screen flags. The classifier keywords and their
    // order (consulting before services; goods last, the default) are a subset
    // of the seed's — the stub is what classifies a demand in these suites.
    { id: 'consulting', label: 'Consulting', description: 'Advisory services', active: true, sort_order: 1, catalogue_eligible: false,
      classification_keywords: ['consult', 'advisory', 'strategy', 'audit', 'transformation', 'operating model', 'due diligence', 'feasibility', 'business case', 'roadmap', 'market research'],
      commodity_codes: [], default_code: '80101600', default_code_label: 'Management consulting' },
    { id: 'services', label: 'Services', description: 'Operational services', active: true, sort_order: 2, catalogue_eligible: false,
      classification_keywords: ['service', 'cleaning', 'catering', 'maintenance', 'travel', 'translation', 'facilities', 'payroll', 'helpdesk'] },
    { id: 'software', label: 'Software / IT', description: 'Licences, SaaS, cloud', active: true, sort_order: 3, catalogue_eligible: false,
      classification_keywords: ['software', 'saas', 'licence', 'license', 'cloud', 'platform', 'subscription', 'apps', 'application'] },
    { id: 'goods', label: 'Goods', description: 'Physical products', active: true, sort_order: 6, catalogue_eligible: true,
      classification_keywords: ['hardware', 'equipment', 'laptop', 'computer', 'workstation', 'furniture', 'desk', 'chair', 'paper', 'toner', 'cards'],
      commodity_codes: [{ code: '43211500', label: 'Laptop computers', keywords: ['laptop', 'workstation'] }],
      default_code: '31160000', default_code_label: 'General hardware and goods' },
  ],
  // Consulting has two managers and goods has one, so the multi-manager display
  // and the single case are both exercised; services has none, which is
  // the state the screen must warn about — with no manager, nobody but an admin
  // can move that category's requests out of validation.
  category_preferred_suppliers: [
    { category_id: 'consulting', supplier_id: 'SUP-ADV-001' },
  ],
  category_managers: [
    { category_id: 'consulting', user_id: 'u11' },
    { category_id: 'consulting', user_id: 'u3' },
    { category_id: 'goods', user_id: 'u3' },
    { category_id: 'software', user_id: 'u1' },
  ],
  // Handover records for /admin/health. Deliberately NOT all green: one
  // completed, one open and one timed out, because the page this replaces
  // showed four "Connected" cards over a store that looked exactly like this.
  system_integrations: [
    { id: 'SI-1', request_id: 'REQ-TEST-0001', system: 'ariba', system_label: 'SAP Ariba', status: 'completed', submitted_at: '2026-09-01T09:00:00Z', responded_at: '2026-09-01T10:00:00Z', reference_id: 'AR-1', stage: 'sourcing', detail: 'Event published' },
    { id: 'SI-2', request_id: 'REQ-TEST-0001', system: 'ariba', system_label: 'SAP Ariba', status: 'timeout', submitted_at: '2026-09-03T09:00:00Z', responded_at: null, reference_id: null, stage: 'sourcing', detail: 'No response within the agreed window' },
    { id: 'SI-3', request_id: 'REQ-TEST-0001', system: 'sirion', system_label: 'Sirion CLM', status: 'awaiting-response', submitted_at: '2026-09-05T09:00:00Z', responded_at: null, reference_id: 'SI-9', stage: 'contracting', detail: 'Contract sent for signature' },
  ],
  audit_entries: [],
  // Minimal admin configuration keeps the routing preview meaningful in an
  // offline browser run: the same labels and value band as the seeded app.
  workflow_templates: [{
    id: 'WF-001', name: 'Standard Procurement', description: 'Standard lifecycle', type: 'procurement',
    // The template claims the channel whose lifecycle it defines. Without this
    // the derived stage map is empty and the request detail renders no stages
    // at all — the same class of miss as leaving a chain with only its display
    // label when bands became structured.
    channels: ['procurement-led'],
    // What the requester reads about the channel, as live WF-001 carries it.
    requester_headline: 'Procurement runs a sourcing exercise',
    requester_description: 'A buyer takes this on, approaches the market and negotiates on your behalf.',
    nodes: [
      { id: 'n1', type: 'start', label: 'Request Submitted' },
      { id: 'n2', type: 'stage', label: 'Intake', role: 'Business Requestor', slaDays: 1, gate: 'auto', requesterAction: 'Describe what you need and submit it.' },
      { id: 'n3', type: 'stage', label: 'Validation', role: 'Category Manager', slaDays: 3, gate: 'manual' },
      { id: 'n3-risk', type: 'stage', label: 'Risk Assessment', role: 'Third-party risk', slaDays: 7, gate: 'manual' },
      { id: 'n3-vendor', type: 'stage', label: 'Vendor Onboarding', role: 'Supplier Manager', slaDays: 7, gate: 'manual' },
      { id: 'n4', type: 'decision', label: 'Auto-Route' },
      { id: 'n5', type: 'stage', label: 'Approval', role: 'Approver', slaDays: 5, gate: 'manual' },
      { id: 'n6', type: 'stage', label: 'Sourcing', role: 'Procurement Lead', slaDays: 20, gate: 'manual' },
      { id: 'n7', type: 'stage', label: 'Contracting', role: 'Legal', slaDays: 10, gate: 'manual' },
    ],
    edges: [],
  }],
  approval_chains: [
    {
      // Structured bounds, as the table holds them. `threshold` is a display
      // label now and is never parsed — leaving this fixture with only the
      // label made resolveBand return null, so no chain was selected and the
      // review step rendered no approvers at all.
      id: 'AC-VP', name: 'VP-Level chain', description: 'Value-banded approval',
      threshold: 'Below €500,000', min_value: null, max_value: '500000',
      steps: [{ id: 'step-vp', role: 'VP Procurement' }], referenced_by: [],
    },
    // Unbanded, so it is reachable only by a rule naming it. A chain with no
    // parseable band used to be read as [0, Infinity) and shadow every banded
    // chain behind it, so having one in the fixtures is the point.
    {
      id: 'chain-compliance', name: 'Compliance Escalation', description: 'Supplier manager, then legal, then category manager.',
      threshold: 'By routing rule only',
      steps: [{ id: 'cs1', role: 'Supplier Manager' }, { id: 'cs2', role: 'Legal' }], referenced_by: ['RR-T2'],
    },
  ],
  routing_rules: [
    {
      id: 'RR-T1', name: 'High-value software', status: 'active', category: 'Software',
      conditions: [
        { field: 'category', operator: 'equals', value: 'software' },
        // A governed threshold rather than a literal — the editor must render
        // the picker and name the threshold, not print the raw token.
        { field: 'value', operator: 'greater_than', value: 'policy:budgetApprovalThreshold' },
      ],
      action: { buyingChannel: 'procurement-led', approvalChain: '' },
      description: 'Software above the budget approval threshold goes procurement-led.',
      last_modified: '2026-09-13T10:00:00Z',
    },
    {
      id: 'RR-T2', name: 'Compliance escalation', status: 'active', category: 'Risk',
      conditions: [{ field: 'category', operator: 'equals', value: 'contingent-labour' }],
      action: { buyingChannel: 'procurement-led', approvalChain: 'chain-compliance' },
      description: 'Contingent labour goes through compliance regardless of value.',
      last_modified: '2026-09-13T10:00:00Z',
    },
  ],
};

function compare(rowValue, op, raw) {
  // Values arrive typed from the payload; `or()` fragments still arrive as the
  // string tail of `col.op.value`, so both shapes are handled.
  const literal = typeof raw === 'string' && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  const value = literal === 'null' ? null : literal;
  switch (op) {
    case 'eq': return String(rowValue) === String(value);
    case 'neq': return String(rowValue) !== String(value);
    case 'gt': return rowValue > value;
    case 'gte': return rowValue >= value;
    case 'lt': return rowValue < value;
    case 'lte': return rowValue <= value;
    // A typed null arrives as null, not 'null'; matching only the string meant
    // `.is('completed_at', null)` found nothing, so a stage being left was never
    // closed here as it is in the database.
    case 'is': return value === null ? rowValue == null : String(rowValue) === String(value);
    case 'in': {
      const set = Array.isArray(literal)
        ? literal
        : String(literal).replace(/^\(|\)$/g, '').split(',').map((item) => item.replace(/^"|"$/g, ''));
      return set.map(String).includes(String(rowValue));
    }
    case 'like':
    case 'ilike': {
      const pattern = new RegExp(`^${String(literal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      return pattern.test(String(rowValue ?? ''));
    }
    case 'cs': { // containment, for array/jsonb columns
      const wanted = Array.isArray(literal) ? literal : String(literal).replace(/^\{|\}$/g, '').split(',');
      return Array.isArray(rowValue) && wanted.every((item) => rowValue.includes(item));
    }
    default: return null; // "not understood", distinct from "no match"
  }
}

/**
 * A minimal channel template carrying the requester's wording for its channel.
 *
 * The buy-route options read their headline and sentence from the template
 * that claims the channel (Admin → Workflows), so a suite that asserts on that
 * copy has to serve it. The wording is deliberately not the seed's: a check
 * that finds these strings proves the screen read the template, not a table.
 */
/**
 * Workflow templates as the table holds them, from the shipped seed
 * (src/data/workflows.ts, kept equal to live by test:seed-parity). A suite that
 * draws a channel's stages — the Channel page — needs the real graphs; the
 * minimal WF-001 above has no edges, so every stage after the entry would
 * correctly read as skipped. Takes the templates rather than importing them,
 * so the suites that load this file under plain node still can.
 */
export function templateRows(templates) {
  return templates.map((t) => ({
    id: t.id, name: t.name, description: t.description, type: t.type, channels: t.channels ?? [],
    requester_headline: t.requesterHeadline ?? null, requester_description: t.requesterDescription ?? null,
    nodes: t.nodes, edges: t.edges,
  }));
}

export function channelTemplate(id, channel, headline, description) {
  return {
    id, name: `${headline} (fixture)`, description: '', type: 'procurement',
    channels: [channel], requester_headline: headline, requester_description: description,
    nodes: [
      { id: `${id}-start`, type: 'start', label: 'Request Submitted' },
      { id: `${id}-intake`, type: 'stage', label: 'Intake', role: 'Business Requestor', slaDays: 1, gate: 'auto' },
      { id: `${id}-po`, type: 'stage', label: 'PO Created', role: 'Procurement', slaDays: 2, gate: 'auto' },
    ],
    edges: [
      { id: `${id}-e1`, source: `${id}-start`, target: `${id}-intake` },
      { id: `${id}-e2`, source: `${id}-intake`, target: `${id}-po` },
    ],
  };
}

/**
 * Install the stub on a Playwright page or context.
 *
 * `options.fail` is a list of relation names the stub answers with a 500, the
 * shape `/api/db` returns when a read cannot be served. Without it a suite can
 * only reach a screen's loading and loaded states — the *error* state, which is
 * the one the audit found 24 surfaces lacked, would be unreachable in a test
 * and therefore unproven. `db-client` turns a non-ok response into a thrown
 * error, so the query lands in `isError` exactly as it does in production.
 *
 * Returns a handle carrying `unsupported` — filters the stub did not understand.
 * A test should fail on a non-empty list rather than trust its assertions: a
 * dropped filter means the app was answered with rows it never asked for.
 */
export async function installDbStub(target, overrides = {}, options = {}) {
  const tables = structuredClone(FIXTURES);
  for (const [name, rows] of Object.entries(overrides)) tables[name] = structuredClone(rows);
  const unsupported = [];
  const failing = new Set(options.fail ?? []);
  let insertSequence = 0;

  await target.route('**/api/db', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');

    if (payload.table && failing.has(payload.table)) {
      // The message is the endpoint's shape, not a stack trace: the surface
      // under test must render its own words, never the database's.
      await route.fulfill({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ data: null, error: 'Database request failed' }) });
      return;
    }

    if (payload.operation === 'rpc') {
      // Per-function shapes, not `${name}-1`: request ids are now minted here
      // rather than in the wizard, so the confirmation screen renders whatever
      // this returns and a generic value would make an assertion on it
      // meaningless. Deterministic, so ids stay stable across a run.
      const sequences = {
        next_request_id: 'REQ-2026-09001',
        next_ticket_id: 'TKT-9001',
        next_sourcing_event_id: 'SRC-9001',
      };
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: sequences[payload.functionName] ?? `${payload.functionName}-1`, error: null }) });
      return;
    }

    const table = payload.table ?? '';
    // A `*_with_derived` view with no fixture of its own falls back to its base
    // table, with the `_live` columns the real view adds.
    //
    // The database computes these from joins the stub has no way to run. Before
    // this, pointing a read at a new view returned empty and the screen rendered
    // its empty state — which is how requests_with_derived broke
    // test:request-detail-ui the moment src/lib/db/requests.ts started reading
    // it. suppliers_with_derived and contracts_with_derived carry explicit
    // fixtures and are left alone.
    if (!tables[table] && table.endsWith('_with_derived')) {
      const base = table.slice(0, -'_with_derived'.length);
      tables[table] = (tables[base] ?? []).map((row) => ({
        ...row,
        // Not a real elapsed-time computation — enough that a screen reading
        // the live column gets the fixture's number rather than undefined.
        days_in_stage_live: row.days_in_stage ?? 0,
      }));
    }
    // An unknown table answers empty rather than erroring: a screen reading a
    // table this fixture set does not model should render its empty state.
    tables[table] ??= [];
    let rows = tables[table];

    const test = (row, { column, operator, value }) => {
      const verdict = compare(row[column], operator, value);
      if (verdict === null) {
        unsupported.push(`${table}.${column} ${operator}`);
        return true;
      }
      return verdict;
    };
    const matches = (row) => {
      const ands = (payload.filters ?? []).every((filter) => test(row, filter));
      const ors = payload.orFilters?.length ? payload.orFilters.some((filter) => test(row, filter)) : true;
      return ands && ors;
    };

    let body = [];
    let count;
    switch (payload.operation) {
      case 'select':
        body = rows.filter(matches);
        break;
      case 'insert':
      case 'upsert': {
        // Postgres assigns an id and timestamps to a row inserted without
        // them — an assistant conversation, for one — and the app reads them
        // back. A stub that did not would hand back a row with no id, and the
        // caller would give up on it silently.
        const incoming = (Array.isArray(payload.body) ? payload.body : [payload.body]).map((record) =>
          payload.operation === 'insert' && record.id === undefined && (payload.conflict ?? 'id') === 'id'
            ? { id: `${table}-${++insertSequence}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...record }
            : record);
        const keys = (payload.conflict ?? 'id').split(',').map((key) => key.trim());
        for (const record of incoming) {
          const existing = payload.operation === 'upsert'
            ? rows.find((row) => keys.every((key) => String(row[key]) === String(record[key])))
            : undefined;
          if (existing) { if (!payload.ignoreDuplicates) Object.assign(existing, record); }
          else rows.push({ ...record });
        }
        body = incoming.map((record) =>
          rows.find((row) => keys.every((key) => String(row[key]) === String(record[key]))) ?? record);
        break;
      }
      case 'update':
        body = rows.filter(matches);
        for (const row of body) Object.assign(row, payload.body);
        break;
      case 'delete':
        body = rows.filter(matches);
        tables[table] = rows.filter((row) => !body.includes(row));
        rows = tables[table];
        break;
      default:
        unsupported.push(`operation ${payload.operation}`);
    }

    // A view shows its base table. The derived copy above is taken once, on
    // first read, so a write to `requests` left a `requests_with_derived` read
    // earlier stale — and a screen that writes and reads back (the approval
    // decision checks the request moved) saw a row production never returns.
    const view = tables[`${table}_with_derived`];
    if (view && ['insert', 'upsert', 'update', 'delete'].includes(payload.operation)) {
      if (payload.operation === 'delete') {
        const gone = new Set(body.map((row) => row.id));
        tables[`${table}_with_derived`] = view.filter((row) => !gone.has(row.id));
      } else {
        for (const row of body) {
          const mirrored = view.find((candidate) => candidate.id === row.id);
          if (mirrored) Object.assign(mirrored, row);
          else view.push({ ...row });
        }
      }
    }

    for (const { column, ascending } of payload.orders ?? []) {
      body = [...body].sort((a, b) =>
        a[column] === b[column] ? 0 : (a[column] > b[column] ? 1 : -1) * (ascending ? 1 : -1));
    }
    if (payload.limit) body = body.slice(0, payload.limit);

    if (payload.count || payload.head) {
      count = body.length;
      if (payload.head) body = [];
    }

    // `single: 'one'` must match a row and errors otherwise; `'maybe'` returns
    // null. The endpoint makes that distinction, so the stub must too, or a
    // suite would pass against behaviour production does not have.
    if (payload.single) {
      if (!body[0] && payload.single === 'one') {
        await route.fulfill({ status: 500, contentType: 'application/json',
          body: JSON.stringify({ data: null, error: 'Expected exactly one database row, found none' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: body[0] ?? null, error: null }) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(count === undefined ? { data: body, error: null } : { data: body, count, error: null }),
    });
  });

  return { tables, unsupported };
}
