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
  ],
  form_submissions: [],
  workflow_instances: [
    { id: 'wi1', request_id: 'REQ-TEST-0001', template_id: 'wf-procurement-led', current_node_ids: ['risk'], status: 'running', variables: {}, created_at: '2026-08-01T09:00:00Z', updated_at: '2026-08-04T09:00:00Z' },
  ],
  comments: [],
  approval_entries: [],
  risk_assessments: [],
  intake_compliance_records: [],
  notifications: [],
  suppliers: [{
    id: 'SUP-CAT-001', name: 'Lenovo', country: 'Germany', country_code: 'DE', risk_rating: 'low',
    active_contracts: 1, total_spend_12m: 0, onboarding_status: 'active', sra_status: 'valid',
    sra_expiry_date: '2027-12-31', screening_status: 'cleared', categories: ['goods'], tier: 2,
  }],
  suppliers_with_derived: [{
    id: 'SUP-CAT-001', name: 'Lenovo', country: 'Germany', country_code: 'DE', risk_rating: 'low',
    active_contracts_live: 1, total_spend_12m_live: 0, onboarding_status: 'active', sra_status: 'valid',
    sra_expiry_date: '2027-12-31', screening_status: 'cleared', categories: ['goods'], tier: 2,
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
    { id: 'goods', label: 'Goods', description: 'Physical products', active: true, timeline_days: 5, sort_order: 1, catalogue_eligible: true },
    { id: 'consulting', label: 'Consulting', description: 'Advisory services', active: true, timeline_days: 15, sort_order: 2, catalogue_eligible: false },
    { id: 'contract-renewal', label: 'Contract Renewal', description: 'Renew an existing agreement', active: true, timeline_days: 12, sort_order: 3, catalogue_eligible: false },
  ],
  audit_entries: [],
  // Minimal admin configuration keeps the routing preview meaningful in an
  // offline browser run: the same labels and value band as the seeded app.
  workflow_templates: [{
    id: 'WF-001', name: 'Standard Procurement', description: 'Standard lifecycle', type: 'procurement',
    nodes: [
      { id: 'n1', type: 'start', label: 'Request Submitted' },
      { id: 'n2', type: 'stage', label: 'Intake', role: 'Business Requestor', slaDays: 1, gate: 'auto' },
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
  approval_chains: [{
    id: 'AC-VP', name: 'VP-Level chain', description: 'Value-banded approval', threshold: '100,000 - 500,000',
    steps: [{ id: 'step-vp', role: 'VP Procurement' }], referenced_by: [],
  }],
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
    case 'is': return literal === 'null' ? rowValue == null : String(rowValue) === literal;
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
 * Install the stub on a Playwright page or context.
 *
 * Returns a handle carrying `unsupported` — filters the stub did not understand.
 * A test should fail on a non-empty list rather than trust its assertions: a
 * dropped filter means the app was answered with rows it never asked for.
 */
export async function installDbStub(target, overrides = {}) {
  const tables = structuredClone(FIXTURES);
  for (const [name, rows] of Object.entries(overrides)) tables[name] = structuredClone(rows);
  const unsupported = [];

  await target.route('**/api/db', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');

    if (payload.operation === 'rpc') {
      // Only the two id sequences are exposed; a deterministic value keeps
      // generated ids stable across a run.
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: `${payload.functionName}-1`, error: null }) });
      return;
    }

    const table = payload.table ?? '';
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
        const incoming = Array.isArray(payload.body) ? payload.body : [payload.body];
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
