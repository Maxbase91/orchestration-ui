// An offline stand-in for Supabase's REST API, for browser tests.
//
// Why this exists: the browser suites all need a reachable Supabase project, so
// in any sandbox without egress to it (or without credentials) they cannot run
// at all — which is precisely how a crash on the request detail reached
// production. This intercepts `**/rest/v1/**` inside Playwright and answers from
// in-memory fixtures, so a full screen can be driven with no network and no
// database.
//
// It implements the slice of PostgREST that supabase-js actually emits from this
// codebase: column filters, ordering, limit, single-object responses, and the
// three write verbs. Anything it does not understand is reported rather than
// silently ignored — a filter quietly dropped would make a test pass against
// rows the app would never have received.

/** Rows are DB-shaped (snake_case), exactly as PostgREST returns them. */
export const FIXTURES = {
  users: [
    { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD', is_ooo: false },
    { id: 'u02', name: 'Marc Aubert', email: 'marc.aubert@company.com', role: 'requester', department: 'Operations', initials: 'MA', is_ooo: false },
    { id: 'u05', name: 'Sofia Ricci', email: 'sofia.ricci@company.com', role: 'approver', department: 'Finance', initials: 'SR', is_ooo: false },
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
      status: 'published', category: 'risk',
      trigger_stages: ['risk'], trigger_conditions: [],
      fields: [
        { id: 'f1', fieldType: 'textarea', label: 'Scope of the engagement', required: true, prePopulateFrom: 'sow.scope' },
        { id: 'f2', fieldType: 'textarea', label: 'Deliverables', required: false, prePopulateFrom: 'sow.deliverables' },
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
  suppliers: [],
  contracts: [],
  audit_entries: [],
};

/** Parameters that shape the result rather than filter it. */
const CONTROL = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function compare(rowValue, op, raw) {
  // PostgREST sends `null` unquoted and strings sometimes quoted.
  const literal = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  const asNumber = Number(literal);
  const value = literal === 'null' ? null : Number.isNaN(asNumber) || literal === '' ? literal : asNumber;
  switch (op) {
    case 'eq': return String(rowValue) === String(value);
    case 'neq': return String(rowValue) !== String(value);
    case 'gt': return rowValue > value;
    case 'gte': return rowValue >= value;
    case 'lt': return rowValue < value;
    case 'lte': return rowValue <= value;
    case 'is': return literal === 'null' ? rowValue == null : String(rowValue) === literal;
    case 'in': {
      const set = literal.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
      return set.includes(String(rowValue));
    }
    case 'like':
    case 'ilike': {
      const pattern = new RegExp(`^${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      return pattern.test(String(rowValue ?? ''));
    }
    case 'cs': // contains, for array/jsonb columns
      return Array.isArray(rowValue) && literal.replace(/^\{|\}$/g, '').split(',').every((v) => rowValue.includes(v));
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
export async function installSupabaseStub(target, overrides = {}) {
  const tables = structuredClone(FIXTURES);
  for (const [name, rows] of Object.entries(overrides)) tables[name] = structuredClone(rows);
  const unsupported = [];

  await target.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/rest/v1/')[1]?.split('/')[0] ?? '';
    // An unknown table answers empty rather than 404: a screen reading a table
    // this fixture set does not model should render its empty state, not crash.
    tables[table] ??= [];
    let rows = tables[table];

    const filters = [...url.searchParams.entries()].filter(([k]) => !CONTROL.has(k));
    const matches = (row) =>
      filters.every(([column, expr]) => {
        const [op, ...rest] = expr.split('.');
        const verdict = compare(row[column], op, rest.join('.'));
        if (verdict === null) {
          unsupported.push(`${table}?${column}=${expr}`);
          return true;
        }
        return verdict;
      });

    const method = request.method();
    let body = [];
    if (method === 'GET' || method === 'HEAD') {
      body = rows.filter(matches);
    } else if (method === 'POST') {
      const posted = JSON.parse(request.postData() || '[]');
      const incoming = Array.isArray(posted) ? posted : [posted];
      const merge = (request.headers()['prefer'] ?? '').includes('merge-duplicates');
      const conflictKey = url.searchParams.get('on_conflict');
      for (const record of incoming) {
        const existing = merge && conflictKey
          ? rows.find((r) => String(r[conflictKey]) === String(record[conflictKey]))
          : undefined;
        if (existing) Object.assign(existing, record);
        else rows.push({ ...record });
      }
      body = incoming.map((record) =>
        (conflictKey && rows.find((r) => String(r[conflictKey]) === String(record[conflictKey]))) ?? record);
    } else if (method === 'PATCH') {
      const patch = JSON.parse(request.postData() || '{}');
      body = rows.filter(matches);
      for (const row of body) Object.assign(row, patch);
    } else if (method === 'DELETE') {
      body = rows.filter(matches);
      tables[table] = rows.filter((r) => !body.includes(r));
      rows = tables[table];
    }

    const order = url.searchParams.get('order');
    if (order && body.length) {
      const [column, direction] = order.split('.');
      body = [...body].sort((a, b) =>
        a[column] === b[column] ? 0 : (a[column] > b[column] ? 1 : -1) * (direction === 'desc' ? -1 : 1));
    }
    const limit = url.searchParams.get('limit');
    if (limit) body = body.slice(0, Number(limit));

    // `.single()` / `.maybeSingle()` ask for one object. Zero rows is PGRST116,
    // which supabase-js turns into `data: null` for maybeSingle and an error for
    // single — the same distinction the real API makes.
    const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object+json');
    if (wantsObject) {
      if (body.length === 0) {
        await route.fulfill({
          status: 406,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST116', message: 'Results contain 0 rows', details: null, hint: null }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body[0]) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(body.length - 1, 0)}/${body.length}` },
      body: JSON.stringify(body),
    });
  });

  return { tables, unsupported };
}
