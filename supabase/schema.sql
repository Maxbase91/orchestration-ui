-- Procurement Orchestration Platform — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables

-- Users (no auth, just identity for role switching)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  department TEXT,
  initials TEXT,
  is_ooo BOOLEAN DEFAULT false,
  delegate_id TEXT,
  country TEXT,
  country_code TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Procurement Requests
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT DEFAULT 'medium',
  value NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  requestor_id TEXT REFERENCES users(id),
  owner_id TEXT REFERENCES users(id),
  supplier_id TEXT,
  supplier_name TEXT,
  contract_id TEXT,
  po_id TEXT,
  buying_channel TEXT,
  commodity_code TEXT,
  commodity_code_label TEXT,
  commodity_candidates JSONB,
  commodity_classification_confirmed BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  cost_centre TEXT,
  budget_owner TEXT,
  business_justification TEXT,
  delivery_date DATE,
  is_urgent BOOLEAN DEFAULT false,
  sla_deadline TIMESTAMP,
  days_in_stage INTEGER DEFAULT 0,
  is_overdue BOOLEAN DEFAULT false,
  refer_back_count INTEGER DEFAULT 0,
  workflow_template_id TEXT,
  requester_country TEXT,
  requester_country_code TEXT,
  beneficiary_id TEXT,
  beneficiary_name TEXT,
  beneficiary_country TEXT,
  beneficiary_country_code TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Add workflow_template_id on existing deployments.
DO $$ BEGIN
  ALTER TABLE requests ADD COLUMN workflow_template_id TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE requests
    ADD CONSTRAINT requests_workflow_template_id_fkey
    FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;  -- workflow_templates created later in file
END $$;

-- Requester location (auto-derived from the requestor's profile) on existing
-- deployments. Nullable capture fields — no backfill, no constraints.
DO $$ BEGIN ALTER TABLE users ADD COLUMN country TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN country_code TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requests ADD COLUMN requester_country TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requests ADD COLUMN requester_country_code TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
-- Beneficiary ("buying for") — defaults to the requestor; another user when on-behalf-of.
DO $$ BEGIN ALTER TABLE requests ADD COLUMN beneficiary_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requests ADD COLUMN beneficiary_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requests ADD COLUMN beneficiary_country TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requests ADD COLUMN beneficiary_country_code TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requests ADD COLUMN commodity_candidates JSONB; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requests ADD COLUMN commodity_classification_confirmed BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requests ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Stage History
CREATE TABLE IF NOT EXISTS stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  entered_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  owner_id TEXT,
  action TEXT,
  notes TEXT
);

-- Natural composite key so the seed can upsert without duplicating rows on re-run.
-- (request_id, stage) alone is not unique — e.g. refer-back cycles re-enter 'sourcing'.
-- Fully idempotent: drops both the constraint and any orphaned backing index
-- before re-adding, so re-runs work regardless of prior partial state.
ALTER TABLE stage_history DROP CONSTRAINT IF EXISTS stage_history_natural_key;
DROP INDEX IF EXISTS stage_history_natural_key;
ALTER TABLE stage_history
  ADD CONSTRAINT stage_history_natural_key
  UNIQUE (request_id, stage, entered_at);

-- Service Descriptions (SOW)
CREATE TABLE IF NOT EXISTS service_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  objective TEXT,
  scope TEXT,
  exclusions TEXT,
  deliverables TEXT,
  timeline TEXT,
  resources TEXT,
  acceptance_criteria TEXT,
  pricing_model TEXT,
  location TEXT,
  dependencies TEXT,
  narrative TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Quality metadata is written by the adaptive intake gate and shown to
-- reviewers. These additive columns keep older environments compatible.
ALTER TABLE service_descriptions ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE service_descriptions ADD COLUMN IF NOT EXISTS quality_checks JSONB;
ALTER TABLE service_descriptions ADD COLUMN IF NOT EXISTS exclusions TEXT;

-- AI Conversations (chat intake transcripts)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  extracted_data JSONB,
  category TEXT,
  status TEXT DEFAULT 'in-progress',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Assistant conversations (user-scoped support/knowledge assistant history).
-- This is separate from request-bound ai_conversations so the full-page
-- assistant can retain a reusable conversation list without a request.
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments (TEXT PK so mock IDs like CMT-001 round-trip through the seed idempotently)
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  author_id TEXT,
  author_name TEXT,
  author_initials TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_initials TEXT;

-- Optional stage attribution + @-mention recipients. Stage is TEXT so
-- it matches the RequestStatus enum values exactly. Mentions stores
-- user IDs (not names) so renames don't break notifications.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';

-- Per-user read-marker side table, used by the dashboard Mentions
-- widget to distinguish unread mentions without mutating the comments
-- row itself. Composite PK means one row per (comment, user) pair.
CREATE TABLE IF NOT EXISTS comment_reads (
  comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  read_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE comment_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON comment_reads;
CREATE POLICY "Allow all" ON comment_reads FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_comments_stage ON comments(stage);
CREATE INDEX IF NOT EXISTS idx_comment_reads_user ON comment_reads(user_id);

-- Migrate existing deployments from UUID PK to TEXT PK. Safe because all mock IDs are TEXT-shaped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE comments ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE comments ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

-- Compliance Reports (one per request — use request_id as the natural key)
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  agent_id TEXT,
  agent_name TEXT,
  decision TEXT, -- approved, rejected, needs-review
  confidence NUMERIC,
  summary TEXT,
  checks JSONB DEFAULT '[]',
  recommendation TEXT,
  generated_at TIMESTAMP DEFAULT now()
);

-- System Integration Handovers (TEXT PK for INT-xxx mock IDs)
CREATE TABLE IF NOT EXISTS system_integrations (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  system TEXT NOT NULL, -- ariba, coupa-risk, sirion, sap
  system_label TEXT,
  status TEXT DEFAULT 'pending-handover',
  submitted_at TIMESTAMP,
  responded_at TIMESTAMP,
  reference_id TEXT,
  stage TEXT,
  detail TEXT
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_integrations' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE system_integrations ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE system_integrations ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

-- Form Submissions (TEXT PK for FSUB-xxx mock IDs)
CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  form_template_id TEXT,
  form_name TEXT,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  stage TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  field_values JSONB DEFAULT '{}',
  status TEXT DEFAULT 'completed'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_submissions' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE form_submissions ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE form_submissions ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

-- Approval Entries (TEXT PK so mock IDs like APR-001 round-trip through the seed idempotently)
CREATE TABLE IF NOT EXISTS approval_entries (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  approver_id TEXT,
  approver_name TEXT,
  approver_role TEXT,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT now(),
  responded_at TIMESTAMP,
  comments TEXT,
  delegated_to TEXT
);

-- Migrate existing deployments from UUID PK to TEXT PK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_entries' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE approval_entries ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE approval_entries ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

-- Notifications (TEXT PK so mock IDs like NOT-001 round-trip through the seed idempotently)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMP DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  related_id TEXT
);

-- Migrate existing deployments from UUID PK to TEXT PK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE notifications ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE notifications ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  country_code TEXT,
  risk_rating TEXT DEFAULT 'low',
  active_contracts INTEGER DEFAULT 0,
  total_spend_12m NUMERIC DEFAULT 0,
  onboarding_status TEXT DEFAULT 'not-started',
  sra_status TEXT DEFAULT 'not-assessed',
  sra_expiry_date TEXT,
  screening_status TEXT DEFAULT 'pending',
  categories TEXT[],
  tier INTEGER DEFAULT 3,
  duns TEXT,
  address TEXT,
  primary_contact TEXT,
  primary_contact_email TEXT,
  certifications JSONB DEFAULT '[]',
  spend_history JSONB DEFAULT '[]',
  performance_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- If an existing deployment pre-dates the JSONB columns, add them idempotently.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS spend_history JSONB DEFAULT '[]';

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  supplier_id TEXT,
  supplier_name TEXT,
  value NUMERIC DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'draft',
  owner_id TEXT,
  owner_name TEXT,
  department TEXT,
  category TEXT,
  renewal_date TEXT,
  utilisation_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- Contract coverage is normalized so scope changes can be effective-dated and
-- historical matches can be reproduced without overwriting the contract row.
CREATE TABLE IF NOT EXISTS procurement_service_families (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_deliverable_terms (
  id TEXT PRIMARY KEY,
  service_family_id TEXT REFERENCES procurement_service_families(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_scope_versions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'superseded')),
  scope_narrative TEXT NOT NULL DEFAULT '',
  service_family_id TEXT REFERENCES procurement_service_families(id) ON DELETE SET NULL,
  eligible_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  geographies JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_units JSONB NOT NULL DEFAULT '[]'::jsonb,
  call_off_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  completeness TEXT NOT NULL DEFAULT 'incomplete' CHECK (completeness IN ('complete', 'incomplete')),
  provenance TEXT NOT NULL DEFAULT 'curated' CHECK (provenance IN ('curated', 'inferred', 'owner-entered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_scope_deliverables (
  id TEXT PRIMARY KEY,
  scope_version_id TEXT NOT NULL REFERENCES contract_scope_versions(id) ON DELETE CASCADE,
  deliverable_term_id TEXT REFERENCES procurement_deliverable_terms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS contract_scope_exclusions (
  id TEXT PRIMARY KEY,
  scope_version_id TEXT NOT NULL REFERENCES contract_scope_versions(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS contract_scope_versions_contract_idx ON contract_scope_versions(contract_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS contract_scope_versions_active_idx ON contract_scope_versions(status, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS contract_scope_deliverables_scope_idx ON contract_scope_deliverables(scope_version_id);
CREATE INDEX IF NOT EXISTS contract_scope_exclusions_scope_idx ON contract_scope_exclusions(scope_version_id);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  supplier_id TEXT,
  supplier_name TEXT,
  value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT now(),
  delivery_date TEXT,
  contract_id TEXT,
  request_id TEXT,
  line_items JSONB DEFAULT '[]'
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  supplier_id TEXT,
  supplier_name TEXT,
  amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'submitted',
  invoice_date TEXT,
  due_date TEXT,
  po_id TEXT,
  match_status TEXT DEFAULT 'unmatched',
  match_variance NUMERIC,
  paid_date TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- ── New Wave 1 tables ──────────────────────────────────────────────

-- Risk Assessments (first-class; previously implicit in Supplier + compliance fields)
CREATE TABLE IF NOT EXISTS risk_assessments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('supplier', 'contract')),
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low',
  score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  assessor_id TEXT,
  assessor_name TEXT,
  assessed_at TIMESTAMP,
  valid_until DATE,
  summary TEXT,
  mitigations TEXT[] DEFAULT '{}',
  reusable BOOLEAN DEFAULT false,
  linked_request_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);

-- Workflow Templates (admin-designed node/edge graphs)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]'
);

-- Routing Rules (admin-configurable intake classifier)
CREATE TABLE IF NOT EXISTS routing_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  conditions JSONB NOT NULL DEFAULT '[]',
  action JSONB NOT NULL,
  description TEXT,
  match_count INTEGER DEFAULT 0,
  last_modified TEXT,
  category TEXT
);

-- Catalogue Items (curated goods/services browsable in the intake flow)
CREATE TABLE IF NOT EXISTS catalogue_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  catalogue_id TEXT,
  catalogue_name TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  lead_time TEXT
);

DO $$ BEGIN
  ALTER TABLE requests ADD CONSTRAINT requests_requisition_id_fkey
    FOREIGN KEY (requisition_id) REFERENCES purchase_requisitions(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE requests ADD CONSTRAINT requests_risk_assessment_id_fkey
    FOREIGN KEY (risk_assessment_id) REFERENCES risk_assessments(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_requisition_id_fkey
    FOREIGN KEY (requisition_id) REFERENCES purchase_requisitions(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_risk_assessment_id_fkey
    FOREIGN KEY (risk_assessment_id) REFERENCES risk_assessments(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE catalogue_items ADD CONSTRAINT catalogue_items_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE catalogue_items ADD CONSTRAINT catalogue_items_risk_assessment_id_fkey
    FOREIGN KEY (risk_assessment_id) REFERENCES risk_assessments(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- Workflow Step Details (per-request stage timeline with forms, comments, docs)
CREATE TABLE IF NOT EXISTS workflow_step_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  handler JSONB NOT NULL,
  action TEXT NOT NULL,
  decision JSONB,
  system_involvement JSONB,
  forms_completed JSONB DEFAULT '[]',
  documents_added JSONB DEFAULT '[]',
  comments JSONB DEFAULT '[]',
  duration JSONB NOT NULL,
  sla_status TEXT NOT NULL DEFAULT 'on-track',
  UNIQUE (request_id, stage)
);

-- AI Agents (admin-configurable)
CREATE TABLE IF NOT EXISTS ai_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  accuracy NUMERIC DEFAULT 0,
  decisions_made INTEGER DEFAULT 0,
  last_updated TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- KPI snapshots (one row per month)
CREATE TABLE IF NOT EXISTS kpi_data (
  month TEXT PRIMARY KEY,
  open_demand INTEGER DEFAULT 0,
  active_sourcing INTEGER DEFAULT 0,
  avg_cycle_time NUMERIC DEFAULT 0,
  compliance_rate NUMERIC DEFAULT 0,
  total_spend NUMERIC DEFAULT 0,
  managed_spend NUMERIC DEFAULT 0,
  policy_breaches INTEGER DEFAULT 0,
  first_time_right NUMERIC DEFAULT 0,
  requests_completed INTEGER DEFAULT 0,
  requests_submitted INTEGER DEFAULT 0
);

-- Form Templates (admin-configurable dynamic forms)
CREATE TABLE IF NOT EXISTS form_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  category TEXT,
  trigger_stages TEXT[] DEFAULT '{}',
  trigger_conditions JSONB DEFAULT '[]',
  fields JSONB NOT NULL DEFAULT '[]',
  version TEXT DEFAULT '1.0',
  last_modified TEXT,
  created_by TEXT,
  updated_at TIMESTAMP DEFAULT now()
);

-- Intake Compliance Records (validation-stage output: buying channel, SRA, policy checks, …)
CREATE TABLE IF NOT EXISTS intake_compliance_records (
  request_id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,
  determined_at TIMESTAMP,
  buying_channel JSONB NOT NULL,
  sra_check JSONB NOT NULL,
  policy_checks JSONB NOT NULL DEFAULT '[]',
  duplicate_check JSONB NOT NULL,
  risk_flags TEXT[] DEFAULT '{}',
  matching_risk_assessment_ids TEXT[] DEFAULT '{}'
);

-- Audit Entries (persisted audit log; replaces in-memory array in admin store)
CREATE TABLE IF NOT EXISTS audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT now(),
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  detail TEXT,
  type TEXT DEFAULT 'human',
  request_id TEXT REFERENCES requests(id) ON DELETE SET NULL
);

-- ── FK hardening for existing tables ──────────────────────────────
-- Re-defined as idempotent ALTERs so existing deployments pick them up.
-- Wrapped in DO blocks because PostgreSQL has no "ADD CONSTRAINT IF NOT EXISTS".

DO $$ BEGIN
  ALTER TABLE contracts
    ADD CONSTRAINT contracts_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_po_id_fkey
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE approval_entries
    ADD CONSTRAINT approval_entries_approver_id_fkey
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS with open access (no auth)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_entries ENABLE ROW LEVEL SECURITY;

-- Policies are recreated idempotently so this script can be re-run.
DROP POLICY IF EXISTS "Allow all" ON suppliers;
DROP POLICY IF EXISTS "Allow all" ON contracts;
DROP POLICY IF EXISTS "Allow all" ON purchase_orders;
DROP POLICY IF EXISTS "Allow all" ON invoices;
DROP POLICY IF EXISTS "Allow all" ON users;
DROP POLICY IF EXISTS "Allow all" ON requests;
DROP POLICY IF EXISTS "Allow all" ON stage_history;
DROP POLICY IF EXISTS "Allow all" ON service_descriptions;
DROP POLICY IF EXISTS "Allow all" ON ai_conversations;
DROP POLICY IF EXISTS "Allow all" ON assistant_conversations;
DROP POLICY IF EXISTS "Allow all" ON comments;
DROP POLICY IF EXISTS "Allow all" ON compliance_reports;
DROP POLICY IF EXISTS "Allow all" ON system_integrations;
DROP POLICY IF EXISTS "Allow all" ON form_submissions;
DROP POLICY IF EXISTS "Allow all" ON approval_entries;
DROP POLICY IF EXISTS "Allow all" ON notifications;
DROP POLICY IF EXISTS "Allow all" ON risk_assessments;
DROP POLICY IF EXISTS "Allow all" ON form_templates;
DROP POLICY IF EXISTS "Allow all" ON intake_compliance_records;
DROP POLICY IF EXISTS "Allow all" ON ai_agents;
DROP POLICY IF EXISTS "Allow all" ON kpi_data;
DROP POLICY IF EXISTS "Allow all" ON workflow_templates;
DROP POLICY IF EXISTS "Allow all" ON routing_rules;
DROP POLICY IF EXISTS "Allow all" ON catalogue_items;
DROP POLICY IF EXISTS "Allow all" ON workflow_step_details;
DROP POLICY IF EXISTS "Allow all" ON audit_entries;

CREATE POLICY "Allow all" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stage_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON service_descriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ai_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON assistant_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON compliance_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON system_integrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON form_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON approval_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON risk_assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON form_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON intake_compliance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ai_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON kpi_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON workflow_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON routing_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON catalogue_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON workflow_step_details FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON audit_entries FOR ALL USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_owner ON requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_request ON stage_history(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_request ON comments(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_request ON ai_conversations(request_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user
  ON assistant_conversations(user_id, updated_at DESC);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_suppliers_risk_rating ON suppliers(risk_rating);
CREATE INDEX IF NOT EXISTS idx_suppliers_sra_status ON suppliers(sra_status);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_request ON compliance_reports(request_id);
CREATE INDEX IF NOT EXISTS idx_system_integrations_request ON system_integrations(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_entries_request ON approval_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_form_submissions_request ON form_submissions(request_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_supplier ON risk_assessments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_contract ON risk_assessments(contract_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_status ON risk_assessments(status);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_reusable ON risk_assessments(reusable) WHERE reusable = true;
CREATE INDEX IF NOT EXISTS idx_audit_entries_timestamp ON audit_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_step_details_request ON workflow_step_details(request_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_catalogue ON catalogue_items(catalogue_id);
CREATE INDEX IF NOT EXISTS idx_audit_entries_object ON audit_entries(object_type, object_id);

-- Helper indexes for the derived-fields views below (Phase 3).
CREATE INDEX IF NOT EXISTS idx_contracts_supplier_status ON contracts(supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_date ON invoices(supplier_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_requests_contract ON requests(contract_id) WHERE contract_id IS NOT NULL;

-- ── Derived-fields views (Phase 3) ────────────────────────────────
-- supplier.active_contracts, supplier.total_spend_12m and
-- contract.linked_request_ids are no longer carried as seeded columns;
-- these views recompute them on every read so UI surfaces always
-- reflect live data. Views use security_invoker so base-table RLS
-- policies cascade correctly (requires PG 15+, which Supabase projects
-- launched 2023-07 onward satisfy).

DROP VIEW IF EXISTS suppliers_with_derived CASCADE;
CREATE VIEW suppliers_with_derived
  WITH (security_invoker = true) AS
SELECT
  s.*,
  COALESCE(c.active_contracts, 0)::int       AS active_contracts_live,
  COALESCE(i.total_spend_12m, 0)::numeric    AS total_spend_12m_live
FROM suppliers s
LEFT JOIN (
  SELECT supplier_id, COUNT(*)::int AS active_contracts
  FROM contracts
  WHERE status IN ('active', 'expiring') AND supplier_id IS NOT NULL
  GROUP BY supplier_id
) c ON c.supplier_id = s.id
LEFT JOIN (
  SELECT supplier_id, SUM(amount)::numeric AS total_spend_12m
  FROM invoices
  -- invoice_date is stored as ISO-date TEXT; cast before comparing
  -- against an interval expression. Rows with unparseable dates are
  -- excluded by the NULLIF guard.
  WHERE supplier_id IS NOT NULL
    AND NULLIF(invoice_date, '')::date >= (now() - interval '365 days')::date
  GROUP BY supplier_id
) i ON i.supplier_id = s.id;

DROP VIEW IF EXISTS contracts_with_derived CASCADE;
CREATE VIEW contracts_with_derived
  WITH (security_invoker = true) AS
SELECT
  co.*,
  COALESCE(r.ids, ARRAY[]::text[]) AS linked_request_ids_live
FROM contracts co
LEFT JOIN (
  SELECT contract_id, array_agg(id ORDER BY created_at DESC) AS ids
  FROM requests
  WHERE contract_id IS NOT NULL
  GROUP BY contract_id
) r ON r.contract_id = co.id;

-- ── Dynamic knowledge base ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_base (
  id          text PRIMARY KEY,
  title       text        NOT NULL,
  body        text        NOT NULL,
  source      text        NOT NULL DEFAULT '',
  tags        text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON knowledge_base;
CREATE POLICY "Allow all" ON knowledge_base FOR ALL USING (true) WITH CHECK (true);

-- ── User preferences (session memory) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id    text PRIMARY KEY,
  prefs      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON user_preferences;
CREATE POLICY "Allow all" ON user_preferences FOR ALL USING (true) WITH CHECK (true);

-- ── Governed catalogue / contract checkout ──────────────────────────────────
-- A requisition is the platform-owned audit record between intake and a PO.
-- These tables are additive so existing request/PO records and deep links stay
-- valid while new checkouts gain durable line-level governance evidence.
CREATE TABLE IF NOT EXISTS procurement_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_entity TEXT,
  default_currency TEXT NOT NULL DEFAULT 'EUR',
  cost_centre TEXT,
  budget_owner TEXT,
  account_type TEXT,
  beneficiary_id TEXT,
  approved_ship_to_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_ship_to_location_id TEXT,
  default_commodity_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  route TEXT NOT NULL CHECK (route IN ('catalogue', 'contract-call-off')),
  status TEXT NOT NULL DEFAULT 'draft',
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  risk_assessment_id TEXT REFERENCES risk_assessments(id) ON DELETE SET NULL,
  total_value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  need_by_date DATE,
  service_start_date DATE,
  service_end_date DATE,
  purpose TEXT NOT NULL DEFAULT '',
  cost_centre TEXT,
  budget_owner TEXT,
  account_type TEXT,
  ship_to_location_id TEXT,
  beneficiary_id TEXT,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  risk_review_required BOOLEAN NOT NULL DEFAULT false,
  contract_amendment_required BOOLEAN NOT NULL DEFAULT false,
  contract_scope_version_id TEXT REFERENCES contract_scope_versions(id) ON DELETE SET NULL,
  contract_match_score NUMERIC,
  contract_match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  contract_match_algorithm_version TEXT,
  contract_match_input_fingerprint TEXT,
  idempotency_key TEXT,
  idempotency_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_requisitions_idempotency_idx
  ON purchase_requisitions(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_scope_version_id TEXT;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_match_score NUMERIC;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_match_algorithm_version TEXT;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_match_input_fingerprint TEXT;

-- Server-owned active procurement policy. A singleton row keeps browser
-- previews and transactional checkout on the same configuration without
-- introducing a second policy source.
CREATE TABLE IF NOT EXISTS procurement_policy_configs (
  singleton_key TEXT PRIMARY KEY DEFAULT 'default' CHECK (singleton_key = 'default'),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_lines (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  requisition_id TEXT REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'each',
  unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  catalogue_item_id TEXT REFERENCES catalogue_items(id) ON DELETE SET NULL,
  risk_assessment_id TEXT REFERENCES risk_assessments(id) ON DELETE SET NULL,
  commodity_code TEXT,
  delivery_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE requests ADD COLUMN IF NOT EXISTS requisition_id TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS risk_assessment_id TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS fulfilment_status TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS requisition_id TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS risk_assessment_id TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cost_centre TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS budget_owner TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS ship_to_location_id TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS beneficiary_id TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS contract_id TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS risk_assessment_id TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS commodity_code TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE procurement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "governed_checkout_profiles" ON procurement_profiles;
DROP POLICY IF EXISTS "governed_checkout_requisitions" ON purchase_requisitions;
DROP POLICY IF EXISTS "governed_checkout_lines" ON request_lines;
CREATE POLICY "governed_checkout_profiles" ON procurement_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "governed_checkout_requisitions" ON purchase_requisitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "governed_checkout_lines" ON request_lines FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS request_lines_request_idx ON request_lines(request_id);
CREATE INDEX IF NOT EXISTS request_lines_requisition_idx ON request_lines(requisition_id);
CREATE INDEX IF NOT EXISTS purchase_requisitions_status_idx ON purchase_requisitions(status);

-- ── Chat feedback ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  text        NOT NULL,
  polarity    text        NOT NULL CHECK (polarity IN ('up', 'down')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON chat_feedback;
CREATE POLICY "Allow all" ON chat_feedback FOR ALL USING (true) WITH CHECK (true);

-- ── Tables added in June 2026 sessions ───────────────────────────────────────

-- Workflow engine instances (tracks current node per request)
CREATE TABLE IF NOT EXISTS workflow_instances (
  id               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id       text NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  template_id      text NOT NULL,
  current_node_ids jsonb NOT NULL DEFAULT '[]',
  status           text NOT NULL DEFAULT 'running',
  variables        jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_request ON workflow_instances(request_id);
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wf_instances_all" ON workflow_instances FOR ALL USING (true) WITH CHECK (true);

-- Approval chains configuration
CREATE TABLE IF NOT EXISTS approval_chains (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  threshold     text NOT NULL DEFAULT '',
  steps         jsonb NOT NULL DEFAULT '[]',
  referenced_by jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE approval_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval_chains_all" ON approval_chains FOR ALL USING (true) WITH CHECK (true);

-- SLA targets per stage/channel
CREATE TABLE IF NOT EXISTS sla_targets (
  stage   text NOT NULL,
  channel text NOT NULL DEFAULT 'default',
  days    int  NOT NULL,
  PRIMARY KEY (stage, channel)
);
ALTER TABLE sla_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_targets_all" ON sla_targets FOR ALL USING (true) WITH CHECK (true);

-- Admin-managed procurement categories
CREATE TABLE IF NOT EXISTS procurement_categories (
  id            text PRIMARY KEY,
  label         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  icon          text,
  timeline_days int NOT NULL DEFAULT 5,
  sort_order    int NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  -- Whether demand in this category can be fulfilled from the catalogue.
  -- Defaults FALSE on purpose: an unmapped or newly added category is not
  -- catalogue-eligible until an admin says so. A missed catalogue suggestion
  -- costs one click; a false one routed a consulting demand to business cards.
  catalogue_eligible boolean NOT NULL DEFAULT false
);
ALTER TABLE procurement_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_all" ON procurement_categories FOR ALL USING (true) WITH CHECK (true);

-- Goods receipts for three-way match
CREATE TABLE IF NOT EXISTS goods_receipts (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  po_id       text NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  request_id  text REFERENCES requests(id),
  received_by text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes       text NOT NULL DEFAULT '',
  line_items  jsonb NOT NULL DEFAULT '[]',
  status      text NOT NULL DEFAULT 'complete',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gr_all" ON goods_receipts FOR ALL USING (true) WITH CHECK (true);

-- Sourcing events (RFx)
CREATE TABLE IF NOT EXISTS sourcing_events (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title           text NOT NULL,
  category        text NOT NULL DEFAULT '',
  type            text NOT NULL DEFAULT 'RFP',
  status          text NOT NULL DEFAULT 'draft',
  budget          numeric,
  deadline        date,
  publish_date    date,
  evaluation_date date,
  award_date      date,
  owner_id        text,
  description     text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sourcing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sourcing_events_all" ON sourcing_events FOR ALL USING (true) WITH CHECK (true);

-- Sourcing responses (per-supplier per-event)
CREATE TABLE IF NOT EXISTS sourcing_responses (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id      text NOT NULL REFERENCES sourcing_events(id) ON DELETE CASCADE,
  supplier_id   text,
  supplier_name text NOT NULL,
  status        text NOT NULL DEFAULT 'not-viewed',
  response_date date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sourcing_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sourcing_responses_all" ON sourcing_responses FOR ALL USING (true) WITH CHECK (true);

-- Support tickets — raised from the Contact Support form and from the assistant's
-- handover capability. The platform's own store is the system of record; there is
-- no upstream service desk in this release.
--
-- Backfilled into this file after the fact: the table was created directly against
-- the database and never committed, so a fresh environment provisioned from this
-- schema had no tickets table while the live one did. Columns below mirror the
-- live table exactly — do not "tidy" them without migrating the deployed database.
CREATE TABLE IF NOT EXISTS tickets (
  id         TEXT PRIMARY KEY,
  summary    TEXT NOT NULL,
  context    TEXT NOT NULL,
  status     TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT NOT NULL,
  category   TEXT,
  priority   TEXT DEFAULT 'medium'
);
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON tickets;
CREATE POLICY "allow all" ON tickets FOR ALL USING (true) WITH CHECK (true);

-- Ownership, lifecycle and SLA fields for the support inbox.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_id    TEXT REFERENCES users(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_name  TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source      TEXT DEFAULT 'form';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS due_at      TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution  TEXT;

-- Sequence-backed ticket numbering. Replaces the read-the-maximum generators
-- that each intake path carried: those raced under concurrent submission (two
-- callers read the same maximum, the second insert then failed on the primary
-- key) and mis-ordered past TKT-9999, where lexicographic sorting breaks.
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq AS bigint START WITH 1;
SELECT setval('ticket_number_seq', GREATEST((SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::bigint, 0) FROM tickets), 1));

CREATE OR REPLACE FUNCTION next_ticket_id() RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public AS
$$ SELECT 'TKT-' || lpad(nextval('ticket_number_seq')::text, 4, '0') $$;

-- Threaded correspondence. Mirrors the comments table, which cannot be reused:
-- it is FK-bound to requests(id). is_internal separates agent-only notes from
-- replies the requester is entitled to see — the filter that keeps internal
-- discussion away from external supplier-role users.
CREATE TABLE IF NOT EXISTS ticket_responses (
  id              TEXT PRIMARY KEY,
  ticket_id       TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id       TEXT,
  author_name     TEXT,
  author_initials TEXT,
  body            TEXT NOT NULL,
  is_internal     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ticket_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_responses_all" ON ticket_responses;
CREATE POLICY "ticket_responses_all" ON ticket_responses FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ticket_responses_ticket_idx ON ticket_responses(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS tickets_queue_idx ON tickets(status, owner_id, created_at DESC);

-- Polymorphic ticket references, so whoever picks a ticket up can see what it is
-- about. Many-to-many rather than a column per type: a ticket is routinely about
-- a PO *and* the supplier behind it, and a column-per-type needs a migration for
-- every new object kind. Supersedes the short-lived tickets.request_id.
--
-- object_type uses the same vocabulary as the connector ports (SourceObject), so
-- a reference resolves through the integration layer rather than a hardcoded
-- table lookup per type.
CREATE TABLE IF NOT EXISTS ticket_links (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id   TEXT NOT NULL,
  -- Denormalised display label so the drawer renders a reference without fanning
  -- out a query per link. Captured at link time, not kept in sync afterwards.
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, object_type, object_id)
);
ALTER TABLE ticket_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_links_all" ON ticket_links;
CREATE POLICY "ticket_links_all" ON ticket_links FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ticket_links_ticket_idx ON ticket_links(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_links_object_idx ON ticket_links(object_type, object_id);

ALTER TABLE tickets DROP COLUMN IF EXISTS request_id;

-- Verbatim assistant conversation captured when a ticket is raised from chat.
-- Kept separate from `context` (the model's own summary) so the agent reads what
-- the user actually said: a summary is a paraphrase, and the detail that matters
-- is usually several turns before the user asked for a human.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Ticket SLAs are measured in hours ("within 4 hours"), which the table's
-- original `days` column cannot express. Nullable and additive: existing stage
-- rows keep using `days`, and a row that sets `hours` takes precedence.
ALTER TABLE sla_targets ADD COLUMN IF NOT EXISTS hours INT;

-- Ticket first-response targets, keyed (stage, channel) as the table already is:
-- stage 'ticket', channel = the ticket's priority.
INSERT INTO sla_targets (stage, channel, days, hours) VALUES
  ('ticket', 'high',    1, 4),
  ('ticket', 'medium',  1, 8),
  ('ticket', 'low',     3, 24),
  ('ticket', 'default', 1, 8)
ON CONFLICT (stage, channel) DO UPDATE SET hours = EXCLUDED.hours, days = EXCLUDED.days;

-- ── Sourcing: orchestration linkage ─────────────────────────────────────────
-- The event is raised *from* a request in the sourcing stage. Without this
-- column, status='sourcing' is a label rather than a link. Nullable: a standing
-- category event (a framework refresh) legitimately has no originating request.
ALTER TABLE sourcing_events ADD COLUMN IF NOT EXISTS request_id TEXT REFERENCES requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sourcing_events_request_idx ON sourcing_events(request_id);

-- Wizard fields that were collected and thrown away on publish. jsonb rather
-- than child tables: both lists are authored and read as a whole with the event,
-- and criteria weights must travel with the scores that use them.
ALTER TABLE sourcing_events ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '[]';
ALTER TABLE sourcing_events ADD COLUMN IF NOT EXISTS criteria     jsonb NOT NULL DEFAULT '[]';
ALTER TABLE sourcing_events ADD COLUMN IF NOT EXISTS budget_min   numeric;
ALTER TABLE sourcing_events ADD COLUMN IF NOT EXISTS start_date   date;
ALTER TABLE sourcing_events ADD COLUMN IF NOT EXISTS currency     text NOT NULL DEFAULT 'EUR';
ALTER TABLE sourcing_events ADD COLUMN IF NOT EXISTS awarded_supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL;

-- Sequence-backed event ids. Deliberately NOT reusing next_ticket_id()'s
-- regexp_replace(id,'\D','','g'): existing events carry gen_random_uuid() ids,
-- whose digits that expression would read as an astronomical number and burn
-- the sequence. Only well-formed SRC-nnnn ids set the high-water mark.
CREATE SEQUENCE IF NOT EXISTS sourcing_event_number_seq AS bigint START WITH 1;
SELECT setval('sourcing_event_number_seq', GREATEST(
  (SELECT COALESCE(MAX(substring(id from '^SRC-(\d+)$')::bigint), 0) FROM sourcing_events), 1));

CREATE OR REPLACE FUNCTION next_sourcing_event_id() RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public AS
$$ SELECT 'SRC-' || lpad(nextval('sourcing_event_number_seq')::text, 4, '0') $$;

-- ── Sourcing responses: one row per invited supplier per event ──────────────
-- The row is the invitation AND the response, which is what lets the buyer see
-- "invited but not yet viewed" and lets the portal show a supplier only the
-- events they were actually asked to bid on.
--
-- supplier_id was a bare nullable text. It is the join to the supplier master
-- that makes an invitation addressable from the portal, so it becomes a real FK.
-- Verified 0 rows before setting NOT NULL.
ALTER TABLE sourcing_responses ALTER COLUMN supplier_id SET NOT NULL;
ALTER TABLE sourcing_responses DROP CONSTRAINT IF EXISTS sourcing_responses_supplier_fk;
ALTER TABLE sourcing_responses ADD CONSTRAINT sourcing_responses_supplier_fk
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS invited_at     timestamptz NOT NULL DEFAULT now();
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS viewed_at      timestamptz;
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS submitted_at   timestamptz;
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS price          numeric;
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS currency       text NOT NULL DEFAULT 'EUR';
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS lead_time_days int;
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS narrative      text NOT NULL DEFAULT '';
-- Buyer-side evaluation. scores maps criterionId -> 1..5; weighted_total is
-- denormalised so a queue can rank without re-reading the event's criteria.
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS scores         jsonb NOT NULL DEFAULT '{}';
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS weighted_total numeric;
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS shortlisted    boolean NOT NULL DEFAULT true;
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS awarded        boolean NOT NULL DEFAULT false;
ALTER TABLE sourcing_responses ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

-- Invitations are idempotent: re-publishing an event must not double-invite.
ALTER TABLE sourcing_responses DROP CONSTRAINT IF EXISTS sourcing_responses_event_supplier_key;
ALTER TABLE sourcing_responses ADD CONSTRAINT sourcing_responses_event_supplier_key UNIQUE (event_id, supplier_id);

-- At most one award per event, enforced structurally rather than by the UI.
CREATE UNIQUE INDEX IF NOT EXISTS sourcing_responses_one_award
  ON sourcing_responses(event_id) WHERE awarded;
CREATE INDEX IF NOT EXISTS sourcing_responses_supplier_idx ON sourcing_responses(supplier_id, status);

-- ── Requests: persist the determined sourcing type ──────────────────────────
-- determineSourcingType() has been computed, rendered and exported since DET-09
-- but never stored, so 'new-event' meant nothing once the wizard unmounted.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sourcing_type        TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sourcing_type_reason TEXT;

-- ── Orchestration realignment (R0) ───────────────────────────────────────────
-- The engine has always selected requests.approval_chain, which never existed:
-- PostgREST errored, the error was swallowed, and every request fell through to
-- the literal 'chain-1' regardless of value. Adding the column lets a matched
-- routing rule's chain be persisted; when it is null the engine falls back to
-- the value band, which is the rule the intake preview already shows the user.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS approval_chain TEXT
  REFERENCES approval_chains(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS requests_approval_chain_idx ON requests(approval_chain);

-- ── Persist the intake determination (R3) ────────────────────────────────────
-- The wizard computed materiality, inherent risk, screening and referral from
-- the pure rules modules and discarded all of it at submit; the request carried
-- no record of the decisions the platform made about it.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS inherent_risk_tier TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS materiality_tier TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS risk_assessment_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS screening_outcome TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS referral_disposition TEXT;

CREATE INDEX IF NOT EXISTS requests_risk_idx
  ON requests(risk_assessment_required, inherent_risk_tier);

-- ── Service description configuration (R6) ───────────────────────────────────
-- The generation prompt, the components asked, and what is generated, made
-- admin-editable. A table rather than a store because api/generate-sow.ts and
-- api/chat-intake.ts run serverless: PolicyConfig lives in localStorage, so
-- those routes can never see an admin's overrides.
--
-- Keyed by category with a `default` row; resolution is category-first, then
-- `default`, then the built-in DEFAULT_TEMPLATE in code. Every column may be
-- empty — an empty array means "not configured" and falls back — so the table
-- can be absent entirely and generation behaves exactly as it did before.
CREATE TABLE IF NOT EXISTS service_description_templates (
  category                      TEXT PRIMARY KEY,
  label                         TEXT        NOT NULL DEFAULT '',
  active                        BOOLEAN     NOT NULL DEFAULT true,
  system_prompt                 TEXT        NOT NULL DEFAULT '',
  category_guidance             TEXT        NOT NULL DEFAULT '',
  temperature                   NUMERIC     NOT NULL DEFAULT 0.5,
  max_tokens                    INTEGER     NOT NULL DEFAULT 3000,
  -- The serialised question set (ALL_SLOTS). `appliesWhen` is stored as a
  -- {field,operator,value} condition — the same vocabulary routing_rules and
  -- form_templates.trigger_conditions already use — because a closure cannot
  -- be persisted.
  slots                         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- The detailed output spec: which sections exist, and whether each is asked
  -- for or inferred by the model.
  sections                      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Which sections compose the compact narrative, in order.
  narrative_sections            TEXT[]      NOT NULL DEFAULT '{}',
  -- Downstream reuse: which sections seed a sourcing event's requirements.
  sourcing_requirement_sections TEXT[]      NOT NULL DEFAULT '{}',
  default_criteria              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                    TEXT
);

-- ── Service description: the governance read it was written against (S2) ────
-- quality_score and quality_checks already existed and were null on every live
-- row: the wizard computed them, rendered them, and discarded them at submit,
-- so the quality badge tab-overview.tsx reads had never once appeared.
-- `signals` records the capture-time materiality / risk / sourcing read that
-- steered generation, and `required_sections` what that read made mandatory —
-- so a reviewer sees not only the document but what it had to cover.
ALTER TABLE service_descriptions
  ADD COLUMN IF NOT EXISTS signals jsonb,
  ADD COLUMN IF NOT EXISTS required_sections text[] NOT NULL DEFAULT '{}';

-- ── How each section was captured ───────────────────────────────────────────
-- The intake chat had no validation: whatever the requester typed went into the
-- slot, so "bla" could become the objective of a EUR 500k engagement and the
-- risk assessment, the sourcing event and the contract request all read it.
-- The assistant now challenges a non-answer once and offers a drafted
-- alternative; `capture_flags` records, per section, whether the requester
-- wrote it (`answered`), accepted the assistant's draft (`assistant-drafted`),
-- or answered thinly and was let through anyway (`weak`). Never a hard block —
-- but never invisible either.
ALTER TABLE service_descriptions
  ADD COLUMN IF NOT EXISTS capture_flags jsonb;

-- ── Prospective suppliers (S5) ──────────────────────────────────────────────
-- Vendor onboarding is triggered by "a NEW supplier was selected", and that was
-- inexpressible: the intake picker only offered the directory, so a requester
-- naming an unknown vendor had nowhere to put it and onboarding could never
-- fire. `prospective` is NOT the same as onboarding_status <> 'completed': an
-- established supplier can be mid-data-refresh, whereas a prospective one has
-- never been transacted with — which is what the sourcing invitation and the
-- risk assessment both need to know.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS prospective boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_from_request_id text;

CREATE INDEX IF NOT EXISTS suppliers_prospective_idx
  ON suppliers(prospective, onboarding_status);
