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
  cost_centre TEXT,
  budget_owner TEXT,
  business_justification TEXT,
  delivery_date DATE,
  is_urgent BOOLEAN DEFAULT false,
  sla_deadline TIMESTAMP,
  days_in_stage INTEGER DEFAULT 0,
  is_overdue BOOLEAN DEFAULT false,
  refer_back_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

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

-- Service Descriptions (SOW)
CREATE TABLE IF NOT EXISTS service_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  objective TEXT,
  scope TEXT,
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

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  author_id TEXT,
  author_name TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- Compliance Reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  agent_id TEXT,
  agent_name TEXT,
  decision TEXT, -- approved, rejected, needs-review
  confidence NUMERIC,
  summary TEXT,
  checks JSONB DEFAULT '[]',
  recommendation TEXT,
  generated_at TIMESTAMP DEFAULT now()
);

-- System Integration Handovers
CREATE TABLE IF NOT EXISTS system_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Form Submissions
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id TEXT,
  form_name TEXT,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  stage TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  field_values JSONB DEFAULT '{}',
  status TEXT DEFAULT 'completed'
);

-- Approval Entries
CREATE TABLE IF NOT EXISTS approval_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMP DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  related_id TEXT
);

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
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stage_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON service_descriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ai_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON compliance_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON system_integrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON form_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON approval_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON risk_assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON audit_entries FOR ALL USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_owner ON requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_request ON stage_history(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_request ON comments(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_request ON ai_conversations(request_id);

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
CREATE INDEX IF NOT EXISTS idx_audit_entries_object ON audit_entries(object_type, object_id);
