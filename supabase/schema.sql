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

-- Enable RLS with open access (no auth)
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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_owner ON requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_request ON stage_history(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_request ON comments(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_request ON ai_conversations(request_id);
