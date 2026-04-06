# GP Procurement Orchestration Platform — UI Requirements Document v2

## Purpose

This document provides UI and platform requirements for building a working prototype of the GP Procurement Orchestration Platform. The prototype is intended to demonstrate the platform's capabilities during a design workshop with IT. Focus is on UI fidelity and user flows rather than full backend logic. Data can be mocked. The goal is to show what the platform looks and feels like so that stakeholders can react to something tangible.

---

## Design System

### Visual Identity
- **Primary palette:** Navy (#1B2A4A), Medium Blue (#2D5F8A), Amber/Orange (#D4782F)
- **Background:** Light grey (#F3F5F9) for page backgrounds, white (#FFFFFF) for cards and panels
- **Text:** Dark (#1E1E1E) for primary, medium grey (#4A5568) for secondary, light grey (#718096) for labels
- **Status colors:** Red (#B5392E) for alerts/overdue/blocked, Green (#2E7D4F) for complete/approved, Amber (#D4782F) for in-progress/pending, Blue (#2D5F8A) for informational
- **Typography:** Clean sans-serif (Inter, Calibri, or system default). No decorative fonts.
- **Cards:** White background with subtle shadow (blur 4px, opacity 8%), rounded corners (6px)
- **Icons:** Outlined icon style (Lucide or similar), medium blue for navigation, amber for primary actions, red for warnings

### Layout Principles
- Left sidebar navigation (collapsible to icon-only mode), always visible
- Top bar with global search, notifications bell (with badge count), user avatar and role indicator
- Main content area with breadcrumb navigation
- Responsive but optimised for desktop (1440px primary breakpoint)
- Cards, tables, and kanban boards as primary content patterns
- No more than 3 levels of hierarchy on any screen
- Consistent action button placement: primary actions top-right, destructive actions require confirmation

### AI Visual Language
Throughout the platform, AI-powered features should be visually distinct:
- AI suggestions appear in a subtle blue-tinted card with a small sparkle/AI icon
- AI-generated content has a thin blue left-border and "AI-generated" label
- AI confidence indicators shown as percentage or low/medium/high badge
- Users can always override AI suggestions with a single click
- AI explanations available via "Why this suggestion?" expandable text

---

## User Roles

### 1. Service Owner / Requestor
The internal business user who needs to buy something or engage a supplier. They should not need to understand procurement processes. They see a simplified view focused on their requests and actions.

### 2. Strategic Procurement Manager
Manages demand pipeline, oversees sourcing strategy, tracks requests across the portfolio. Needs the orchestration control tower view. Sees everything across their categories.

### 3. Vendor Manager (DVMO)
Validates sourcing requests for form accuracy, correct DEUBA determination, TPRA appropriateness, and strategy alignment. Needs a validation queue and tools to review and refer back requests.

### 4. Procurement Operations Lead
Handles operational queries and keeps workflows moving. Needs the orchestration dashboard, bottleneck alerts, and the ability to reassign or escalate work.

### 5. Supplier (External)
External user who needs to onboard, submit documents, track invoice/payment status, and respond to sourcing events. Sees only the supplier portal.

### 6. Admin / Platform Owner
Configures rules, workflows, approval chains, agent settings, and policies. Sees admin screens and system health.

---

## Navigation Structure

### Left Sidebar Menu

```
Home (role-based dashboard)

WORK
  Requests
    └─ My Requests
    └─ All Requests
    └─ New Request
  Approvals
    └─ My Approvals
    └─ Delegation
  Tasks
    └─ My Tasks
    └─ Team Tasks

ORCHESTRATION
  Workflows
    └─ Active Workflows
    └─ Workflow Monitor
    └─ Bottlenecks & Alerts
  Pipeline
    └─ Demand Pipeline
    └─ Sourcing Pipeline

SOURCING
  Events
    └─ Active Events
    └─ New Event
    └─ Templates
    └─ Evaluation Centre

SUPPLIERS
  Directory
    └─ All Suppliers
    └─ Onboarding Pipeline
    └─ Risk & Compliance
    └─ Supplier Portal Admin

CONTRACTS
  Contract Register
    └─ Active Contracts
    └─ Renewals & Expiries
    └─ Templates

PURCHASING
  Purchase Orders
    └─ Open POs
    └─ Goods Receipt
  Invoices
    └─ Invoice Queue
    └─ Three-Way Match
    └─ Payment Tracker

ANALYTICS
  Dashboards
    └─ Spend Overview
    └─ Compliance KPIs
    └─ Pipeline & Cycle Time
    └─ Supplier Performance
  Reports
    └─ Report Builder
    └─ Scheduled Reports
    └─ Exports

ADMIN (admin role only)
  Routing Rules
  Approval Chains
  Workflow Designer
  AI Agent Configuration
  Policy Management
  User Management
  System Health
  Audit Log

HELP
  AI Assistant (also floating button)
  Knowledge Base
  Contact Support
```

---

## Screen Specifications

---

### 1. HOME — Role-Based Dashboard

**Purpose:** Every user sees a dashboard tailored to their role. Not a one-size-fits-all view.

#### Service Owner / Requestor View:
- **My Active Requests** (card list with status pills): shows their requests with current step highlighted
- **Actions Required** (count badge): approvals or information requests waiting for them
- **Recent Activity**: last 5 events on their requests
- **Quick Actions**: "New Request" (primary button), "Track a Request" (search), "Ask AI Assistant"
- **AI Suggestion Card**: "You have 3 contracts renewing in the next 60 days. Would you like to start renewal requests?"

#### Strategic Procurement Manager View:
- **KPI Row** (4 cards): Open Demand (count + value), Active Sourcing Events, Avg Cycle Time, Compliance Rate
- **Demand Pipeline**: Horizontal bar chart showing requests by stage (Intake → Routing → Approval → Sourcing → Contract → PO)
- **My Team's Workload**: Bar chart showing work assigned per team member
- **Attention Required**: Flagged items — overdue approvals, DEUBA mismatches, blocked workflows
- **AI Insights Panel**: "3 requests have been in approval for >10 days. 2 suppliers have expiring TPRAs this month. Demand for IT consulting is 40% above forecast."

#### Procurement Operations Lead View:
- **Workflow Health** (3 cards): Active Workflows (count), Stuck/Blocked (count, red if > 0), Average Days in Current Step
- **Bottleneck Table**: Requests sorted by days stuck, showing who is holding and why
- **SLA Tracker**: Requests approaching or past SLA, with countdown
- **Unresolved Queries**: Open questions from requestors and suppliers
- **Quick Actions**: Reassign, Escalate, Send Reminder

#### Vendor Manager (DVMO) View:
- **Validation Queue** (primary): Sourcing requests awaiting validation with key fields pre-displayed (DEUBA, TPRA, commodity code, value)
- **Today's Reviews**: Count of items to validate
- **Recently Validated**: Last 10 with outcome (approved, referred back, flagged)
- **AI Pre-Validation Summary**: Each request in queue shows AI assessment — "DEUBA appears correct", "TPRA not linked — requires review", "Commodity code may be incorrect (AI suggests alternative)"

#### Admin View:
- **System Health**: Active users, request volume (today/week/month), API status
- **Configuration Alerts**: Rules with no test coverage, workflows with unused branches
- **Recent Changes**: Audit log of configuration changes made by any admin

---

### 2. NEW REQUEST — Intelligent Intake Form

**Purpose:** The single front door. Solves problem #1. Must be guided, intelligent, and feel effortless.

**Multi-step wizard with progress bar at top (Steps 1-5)**

#### Step 1 — What do you need?
- Large input field with placeholder: "Describe what you need in a few words"
- As user types, AI suggests categories in real-time (dropdown below input)
- Or select from visual category tiles: Goods, Services, Software/IT, Consulting, Contingent Labour, Contract Renewal, Supplier Onboarding
- Each tile shows icon + brief description + estimated timeline
- "Not sure?" button opens AI Assistant in context: "Tell me more about what you need and I'll help you find the right process"
- **AI feature**: If user types "I need to renew the Accenture contract", AI auto-fills: Category = Consulting, Supplier = Accenture, Type = Contract Renewal, and pre-populates known data

#### Step 2 — Request Details
Dynamic form that adapts based on Step 1 selection. Fields appear/hide based on category:
- **Supplier**: Autocomplete from directory. Shows inline: existing contract (yes/no), risk rating (RAG), onboarding status, last spend amount
- **Estimated value**: Number input with currency selector. Triggers different routing rules based on thresholds
- **Business justification**: Text area with AI suggestion: "Based on similar requests, teams typically mention: business need, timeline urgency, alternative options considered"
- **Delivery timeline**: Date picker with "Urgent" toggle (triggers fast-track workflow)
- **Cost centre / Budget owner**: Dropdown with search. Shows remaining budget inline
- **Commodity code**: Searchable dropdown. **AI suggests code** based on description with confidence level. "We think this is [IT Consulting - 81112200]. Is this correct?" with accept/change options
- **Attachments**: Drag-and-drop area. AI reads uploaded documents (SOWs, quotes) and auto-extracts key data (vendor name, value, dates)
- **Related requests**: AI shows "Similar requests in the last 6 months" with links

#### Step 3 — Compliance & Risk Check (Automated)
Runs automatically, results shown to user:
- **DEUBA Determination**: Shows result with explanation: "Based on value (€150k), category (IT Consulting), and supplier status (existing, contracted), this is classified as: GP-Led Sourcing"
- **TPRA Status**: "Supplier has an active risk assessment (valid until [date])" or "A new risk assessment is required. This will be initiated automatically upon submission."
- **Policy Check**: Green checkmarks for passed checks, amber warnings for items requiring attention. "Contract required before PO — existing contract found" or "No existing contract — sourcing event required"
- **Duplicate Check**: AI flags "A similar request was submitted by [name] on [date]. Is this related?" with link

#### Step 4 — Routing Preview & Approvals
Shows the user what will happen:
- **Visual workflow preview**: Simplified flowchart showing the steps this specific request will go through
- **Required approvals**: List of approvers with names, roles, and expected response time
- **Parallel vs sequential**: Shows which approvals run at the same time
- **Estimated total timeline**: "Based on similar requests, this should take approximately 12 business days"
- **Option to add**: Additional reviewers, watchers, or notes for approvers
- "Submit" (primary) and "Save as Draft" (secondary)

#### Step 5 — Confirmation
- Request ID generated and displayed prominently
- Summary card with all submitted details
- Next steps: "Your request will be reviewed by [name] within [X] days"
- Actions: "Track this request" (link), "Share with colleague" (email), "Submit another request"
- **AI follow-up**: "Would you like me to notify you when this reaches approval stage?"

---

### 3. REQUEST DETAIL — Full Lifecycle Tracker

**Purpose:** Complete visibility of any request from intake to payment completion.

**Header Bar:**
- Request ID, Title
- Status pill (colour-coded)
- Priority indicator
- SLA countdown (if applicable)
- Action buttons (context-sensitive): Approve, Reject, Refer Back, Reassign, Escalate, Cancel

**Process Tracker (horizontal stepper — full width):**
Stages: Intake → Validation → Approval → Sourcing → Contracting → Purchase Order → Goods Receipt → Invoice → Payment
- Completed steps: green with checkmark, shows completion date on hover
- Current step: amber with pulse, shows who owns it and how long it's been there
- Future steps: grey outline
- Skipped steps: grey with dash (e.g., sourcing skipped if direct PO)
- Blocked steps: red with warning icon and reason tooltip
- Click any step to jump to that section's detail below

**Main Content Area (tabbed):**

#### Tab: Overview
- Two-column layout
- Left: Request details (all submitted data, editable if in draft)
- Right: AI Summary Card — "This is a €150k IT consulting request for Accenture, routed through GP-Led Sourcing. Currently awaiting Finance approval (day 3 of 5-day SLA). TPRA is valid. No issues flagged."

#### Tab: Workflow & Actions
- **Visual workflow** showing current state (mini version of the routing preview from intake)
- **Action History**: Every action taken on this request, chronologically:
  - Who did what, when, with what outcome
  - System actions (auto-routing, AI classification, automated checks)
  - Timestamps and duration between steps
- **Current Action Owner**: Name, role, contact, days held
- **Refer Back**: Button to send the request back to a previous step with a required comment explaining why
- **Reassign**: Transfer ownership to another team member (with reason)
- **Delegate**: Temporary delegation (with return date)

#### Tab: Comments & Collaboration
- Thread-based comments tied to the request
- Tag specific people with @mentions
- Mark comments as "Internal" (procurement only) or "Visible to requestor"
- Attach files to comments
- AI-suggested responses: "Based on the question, here's a suggested response: [draft]"
- Status updates automatically posted as system comments

#### Tab: Approvals
- List of all required approvals with status: Pending, Approved, Rejected, Delegated
- Each approval shows: Approver name, role, date requested, date responded, comments
- Approval chain visualisation (who's next)
- Remind button (sends nudge to pending approver)
- Escalation option (if past SLA)
- Delegation trail (if approver delegated)

#### Tab: Documents
- All uploaded and generated documents
- Version history for each document
- AI document reader: "This SOW specifies a 12-month engagement at €150k. Key deliverables: [extracted list]"
- Document comparison (if updated versions uploaded)
- E-signature status (if applicable)

#### Tab: Related Items
- Linked contracts (with status and key dates)
- Linked purchase orders
- Risk assessments (TPRA)
- Previous requests for same supplier
- Invoices and payments (once in that stage)

#### Tab: Audit Trail
- Complete, immutable log of every action, system event, data change
- Filterable by: action type, user, date range
- Exportable for compliance

---

### 4. ORCHESTRATION — Active Workflows

**Purpose:** The control tower. This is the orchestration screen that gives Procurement Managers and Ops Leads visibility across everything that's in flight.

**View options (toggle):**

#### Kanban Board View
Columns represent workflow stages: Intake | Validation | Approval | Sourcing | Contracting | PO | Receipt | Invoice | Payment
- Each request is a card showing: ID, Title, Requestor, Value, Days in Stage, Owner, Priority
- Cards colour-coded by status: on-track (white), approaching SLA (amber border), overdue (red border)
- Drag cards between columns (for authorised users) to manually advance/move
- Column headers show: count and total value
- Filter bar: by category, owner, priority, date range, value range, status

#### List/Table View
- Full table with sortable columns: ID, Title, Requestor, Category, Value, Current Stage, Owner, Days in Stage, SLA Status, Priority, DEUBA, Risk
- Inline status pills
- Bulk actions: Select multiple → Reassign, Escalate, Export
- Save custom views (e.g., "My overdue items", "High value pending approval")

#### Timeline View
- Gantt-style view showing each request as a horizontal bar across stages
- Visual representation of how long each step took
- Highlights bottlenecks (expanded bars where requests spent too long)
- Filter by date range to see throughput

**Quick Filters (top bar):**
- Stuck > 5 days (shows count)
- Awaiting my action (shows count)
- High value (> threshold)
- Escalated
- Referred back

---

### 5. ORCHESTRATION — Workflow Monitor & Bottlenecks

**Purpose:** Proactive identification of where workflows are stuck and why.

**Bottleneck Dashboard:**
- **Top Bottleneck Card**: "Finance Approval is the #1 bottleneck this month. 12 requests averaging 8.3 days (SLA: 5 days)"
- **Bottleneck Chart**: Horizontal bar chart showing average days per stage, with SLA target line overlay. Stages exceeding SLA highlighted in red.
- **Stuck Requests Table**: Requests that have exceeded SLA at current stage, sorted by days overdue
  - Columns: Request ID, Title, Stage, Owner, Days in Stage, SLA, Days Overdue, Last Activity
  - Actions per row: Send Reminder, Escalate, Reassign

**AI Bottleneck Analysis:**
- "Finance team has 15 pending approvals. 8 are from [name] who has been out of office since [date]. Suggest: reassign to delegate."
- "Sourcing stage has increased from 5-day average to 9 days this month. Root cause: 60% of requests are missing supplier risk data, causing refer-backs."
- "DVMO validation queue has 22 items. At current throughput (4/day), this will take 5.5 working days to clear."

**Heatmap View:**
- Grid showing stages (columns) vs time periods (rows, by week)
- Cell colour intensity = number of requests in that stage during that week
- Quickly shows where and when congestion occurs

**Escalation Management:**
- List of all escalated items
- Escalation path: who escalated, to whom, when, current status
- Auto-escalation rules status (which are active, which have fired)

---

### 6. ORCHESTRATION — Workflow Detail (Single Workflow Instance)

**Purpose:** Deep dive into one specific workflow to understand exactly where it is, what happened, and what's next.

**Header:**
- Request ID, Title, Current Stage, Owner, Days Active
- Action buttons: Refer Back, Reassign, Escalate, Add Comment, Cancel

**Visual Workflow Map (centre, large):**
- Full flowchart of this specific workflow instance
- Nodes coloured by status: completed (green), current (amber pulse), future (grey), skipped (grey dashed), blocked (red)
- Click any node to see: who handled it, when, what decision was made, any comments
- Branching paths shown clearly (e.g., "routed to GP-Led Sourcing because value > €100k")
- Parallel paths shown side by side (e.g., Legal review + Finance approval running simultaneously)

**Right Panel — Actions & Comments:**

#### Refer Back
- Select which previous step to return to (dropdown showing completed steps)
- Required: reason for refer-back (structured dropdown: "Incomplete information", "Incorrect category", "DEUBA mismatch", "TPRA required", "Other")
- Optional: free-text explanation
- Notification sent to the person at the target step
- Refer-back count shown on the request (tracks how many times it's been returned)

#### Reassign
- Select new owner from team directory
- Required: reason for reassignment
- Previous owner notified
- Full reassignment history visible in audit trail

#### Escalate
- Select escalation level (Team Lead → Department Head → VP)
- Required: reason and urgency level
- Escalation creates a priority flag visible across all views
- Auto-notification to escalation target with full context

#### Comment Thread
- Threaded comments attached to the current workflow step
- @mention team members
- Mark as "Action Required" (creates a task for the mentioned person)
- Attach files
- AI can draft responses: "Suggest a response based on similar refer-backs"

**Bottom Panel — Full Timeline:**
- Every event in chronological order (most recent first)
- Colour-coded: System events (grey), Human actions (blue), AI actions (purple), Warnings (amber), Blocks (red)
- Each entry shows: timestamp, actor (person or system), action, details, duration since last event

---

### 7. APPROVALS — My Approvals Queue

**Purpose:** Dedicated screen for approvers. Approvers should be able to process their queue quickly without navigating into each request individually.

**Queue Layout:**
- Card-based list, one card per pending approval
- Each card shows:
  - Request title, ID, requestor name
  - Value and category
  - Urgency indicator (SLA countdown)
  - AI summary (2-3 sentences): "IT consulting engagement with Accenture for data migration. €150k over 12 months. Budget approved by business unit. TPRA valid. Similar to 3 previous engagements with this supplier."
  - Key data points relevant to the approval decision
  - Quick action buttons directly on the card: Approve (green), Reject (red), Request Info (amber), Delegate (grey)

**Approve with one click** — no navigation required for straightforward approvals

**Reject/Request Info** — expands inline form for comments (required)

**Bulk Actions:**
- Select multiple approvals → Approve All (with confirmation modal showing what will be approved)
- Filter by: urgency, value range, category, requestor

**Delegation Management:**
- "I'm going on leave" button: Set delegate and date range
- Active delegations shown at top of screen
- Delegated items marked with delegate's name
- Auto-return when delegation period ends

**Out-of-Office Awareness:**
- If an approver in any chain is marked OOO, show warning on the request
- AI suggests: "This approval requires [name] who is OOO until [date]. Would you like to route to their delegate [name]?"

---

### 8. SUPPLIER DIRECTORY — Unified Vendor Master

**Purpose:** Single view of all suppliers. Solves the vendor master split problem.

**Search & Filter Bar:**
- Full-text search across supplier name, D&B number, category, country
- Advanced filters: Risk rating (RAG), Contract status (active/expired/none), Onboarding status, Spend tier, Country/region, Category, Compliance status

**View Toggle:** Card Grid | Table | Map (shows suppliers by geography)

**Supplier Card (in grid view):**
- Supplier name and logo
- Country flag
- Risk rating (RAG badge)
- Active contracts count
- Total spend (last 12 months)
- Compliance status (checkmarks for: TPRA, Screening, Certificates)
- Quick actions: View Profile, New Request, Start Onboarding

**Supplier Profile Page (detailed view):**

##### Overview Tab
- Company details: name, address, D&B number, corporate hierarchy (parent/subsidiary)
- Primary contacts with roles
- Categories supplied
- Tier classification
- AI Summary: "Accenture is your 3rd largest supplier by spend (€4.2M last 12 months) across IT Consulting and Professional Services. 5 active contracts. TPRA valid until [date]. No open risk flags. 2 pending requests in pipeline."

##### Contracts Tab
- All contracts with this supplier: title, value, start/end dates, status, owning department
- Renewal alerts (contracts expiring within 90 days highlighted)
- Contract utilisation (% of contract value consumed)
- Link to full contract detail

##### Risk & Compliance Tab
- TPRA status with history
- Screening results (sanctions, PEP, adverse media)
- Certifications and attestations with expiry dates
- ESG/sustainability data
- Risk score trend (chart over time)
- Alerts: "Certificate of insurance expires in 14 days"
- AI: "Based on spending patterns and risk profile, this supplier should be classified as Tier 1 Critical"

##### Spend Tab
- Total spend by year (bar chart)
- Spend by category (pie chart)
- Spend by business unit (table)
- Trend analysis
- Comparison to contracted rates
- AI: "Spend with this supplier has increased 23% YoY. 40% of spend is off-contract."

##### Performance Tab
- KPI scorecard: delivery on time, quality, responsiveness, innovation
- SLA adherence
- Issue history
- Performance trend over time
- Benchmarking against category peers

##### Documents Tab
- All compliance documents, certificates, attestations
- Upload/download with version history
- Expiry tracking with automated reminders
- AI document verification: "This insurance certificate is valid and covers the required amount"

##### Activity Tab
- Full timeline: every interaction, request, contract, payment, risk event
- Filterable by type

---

### 9. SUPPLIER PORTAL — External Self-Service

**Purpose:** Separate application for suppliers. Solves the "no digital entry point" problem.

**Separate login, separate branding** (co-branded: GP + supplier-friendly design)

#### Supplier Home Dashboard
- Welcome: "Welcome back, [Supplier Name]"
- **Action Items** (priority card): Documents due, questionnaires to complete, RFx to respond to, information requests
- **Onboarding Progress** (if in process): Step-by-step progress bar with clear next action
- **Recent Payments**: Last 5 payments with amounts and dates
- **Announcements**: Policy changes, upcoming deadlines, system notices

#### My Profile
- Edit company details, addresses, contacts
- Update bank details (with verification workflow)
- Manage user accounts (multi-role: commercial contact, compliance officer, finance contact)
- Upload/update certifications and compliance documents

#### Onboarding
- Step-by-step wizard:
  1. Company Information (pre-filled from registration, verify/update)
  2. Compliance Documents (checklist of required uploads based on category/risk)
  3. Bank Verification (DUNS, bank details, validation)
  4. Screening (consent and status tracking)
  5. Qualification (questionnaire based on category)
  6. Review & Approval (status tracker)
- Status: which steps are complete, which are pending, what's holding things up
- Chat: direct message to procurement onboarding team

#### Sourcing Events
- **Active Invitations**: RFx events the supplier has been invited to
- **Event Detail**: Requirements, questions, deadline, submission form
- **My Submissions**: Track submitted bids, view results when published
- **Historical**: Past events with outcomes

#### Invoices & Payments
- **Submit Invoice**: Upload invoice against a PO or contract
- **Invoice Status Tracker**: Submitted → Under Review → Approved → Scheduled → Paid
- **Payment History**: Full payment history with remittance details
- **Query**: Raise a query on any invoice/payment without calling procurement

#### Documents & Compliance
- Document library: all submitted documents with status
- Expiry reminders: "Your insurance certificate expires in 21 days"
- Resubmission workflow
- Certification requests from procurement

#### Messages
- Secure messaging with procurement team
- Threaded conversations tied to specific requests, invoices, or onboarding steps
- Notification preferences (email, in-app)

---

### 10. SOURCING — Event Manager

**Purpose:** Native sourcing capability. Covers simple and complex events.

#### Event List
- Table: ID, Title, Category, Type (RFI/RFP/RFQ/Auction), Status, Supplier Count, Deadline, Owner
- Status pills: Draft, Published, In Evaluation, Award Pending, Completed, Cancelled
- Filter by status, type, category, owner, date range
- Quick actions: Duplicate event, Export results

#### New Sourcing Event Wizard
- Step 1: Event details (title, description, category, type, timeline, budget range)
- Step 2: Select suppliers (from directory with filters, or invite new by email)
- Step 3: Requirements (text sections, line items, questionnaire from template library)
- Step 4: Evaluation criteria and scoring weights (configurable matrix)
- Step 5: Review, set notifications, publish

#### Event Detail (Live)
- Overview: key dates, status, supplier response rate
- Supplier response tracking: who's viewed, who's responded, who hasn't
- Send reminders to non-respondents
- Q&A board: suppliers ask questions, procurement posts answers visible to all
- Amendment management: publish changes with notifications

#### Evaluation Centre
- Side-by-side comparison of supplier responses
- Scoring matrix: criteria (rows) x suppliers (columns)
- Individual evaluator scores with consensus view
- AI-assisted scoring: "Based on the response, this supplier meets 8 of 10 requirements. Key gap: no evidence of [X] certification."
- Comment per cell (evaluator can note reasoning)
- Shortlist/eliminate workflow
- Award recommendation with weighted total and justification

---

### 11. CONTRACTS — Lifecycle Management

#### Contract Register
- Table: ID, Title, Supplier, Value, Start/End Date, Status, Owner, Renewal Date
- Status: Draft, Under Review, Active, Expiring, Expired, Terminated
- Alerts for contracts expiring within 30/60/90 days
- Filter by status, supplier, category, value, expiry

#### Contract Detail
- Summary: key terms, dates, value, parties, linked requests
- Document viewer: view contract document inline
- Obligation tracker: key obligations with due dates and status
- Financial tracker: contracted value vs actual spend vs committed
- Renewal management: initiate renewal workflow, track renewal request
- Amendment history: all changes over time
- Related: linked POs, invoices, risk assessments, supplier profile

---

### 12. PURCHASING — Purchase Orders & Invoice Management

#### PO Management
- PO list: ID, Supplier, Value, Status (Draft/Submitted/Acknowledged/Received/Closed), Date
- Create PO from approved request (pre-populated)
- PO detail: line items, delivery schedule, goods receipt tracking
- Change order workflow: modify PO with approval trail

#### Goods Receipt
- Confirm receipt against PO line items
- Partial receipt support
- Quality notes and issue flagging
- Triggers invoice matching

#### Invoice Queue
- Incoming invoices: manual upload or electronic receipt
- AI-assisted data extraction: reads invoice PDF and auto-populates fields (supplier, amount, PO reference, line items)
- Validation status indicators for each field

#### Three-Way Match
- Visual match display: PO ↔ Goods Receipt ↔ Invoice
- Green: matched within tolerance
- Amber: minor variance (shows amount)
- Red: mismatch requiring review
- Auto-approve if within configured tolerance
- Exception workflow for mismatches

#### Payment Tracker
- Payment status by invoice: Matched → Approved → Scheduled → Paid
- Payment run calendar: upcoming scheduled payments
- Supplier payment history

---

### 13. ANALYTICS — Dashboards & KPIs

#### Spend Overview
- Total spend by period (bar chart, trend line)
- Spend by category (treemap or sunburst)
- Spend by supplier (top 20 table with bars)
- Spend by region/country (map visualisation)
- Managed vs unmanaged spend (pie chart)
- Contract vs off-contract spend
- Filters: date range, business unit, category, region

#### Compliance KPIs (Rebecca's evidence built in)
- **Policy Breaches**: 74 potential / 11 confirmed (YTD) — trend chart by month, drill-down by type
- **First Time Right Rate**: 65% (target: 85%) — trend by month, breakdown by category and requestor type
- **DEUBA Accuracy**: percentage correct, breakdown by category, trend
- **TPRA Coverage**: percentage of active suppliers with valid TPRA, gap list
- **Screening Duplication**: suppliers screened in both TPRM and onboarding
- **Average Request Cycle Time**: by type, category, against SLA targets

Each KPI: large number + trend arrow + sparkline + click to drill down

#### Pipeline & Cycle Time
- Funnel visualisation: Intake → Approval → Sourcing → Contract → PO (shows conversion and drop-off)
- Cycle time distribution by stage (box plots)
- Throughput: requests completed per week/month
- Ageing analysis: how many requests are in each age bracket

#### Supplier Performance
- Scorecard: top and bottom performing suppliers
- Performance by category
- Risk vs spend matrix (bubble chart)
- Issue trends

#### Report Builder
- Drag-and-drop report creation
- Available data sources: requests, suppliers, contracts, spend, compliance
- Chart type selector: bar, line, pie, table, scatter
- Filter and group by any field
- Save, schedule, and share reports
- Export: PDF, Excel, CSV

---

### 14. ADMIN — Routing Rules Engine

**Purpose:** Demonstrates that procurement can change buying channel rules without IT.

**Layout:** Three panels — rule list (left), rule editor (centre), test panel (right)

#### Rule List (left)
- Tree structure by category/type
- Each rule shows: name, status (active/draft/disabled), last modified, match count
- Add new rule, duplicate, reorder (drag-and-drop priority)
- Version history per rule

#### Rule Editor (centre)
- Visual builder: IF [conditions] THEN [actions]
- Conditions as cards, add/remove/reorder:
  - Field selector: Value, Category, Supplier Status, Contract Exists, Risk Level, Region, Commodity Code
  - Operator: equals, greater than, less than, contains, is empty, is not empty
  - Value: input field or dropdown (context-sensitive)
  - AND/OR logic between conditions
- Actions:
  - Route to buying channel (dropdown: GP-Led Sourcing, Business-Led, Direct PO, Framework Call-Off, Catalogue)
  - Set approval chain (dropdown of configured chains)
  - Trigger notification
  - Flag for review
- Rule description (auto-generated from conditions in plain English): "If value is greater than €100,000 AND category is IT Consulting AND no existing contract, route to GP-Led Sourcing"

#### Test Panel (right)
- Input: enter sample request parameters (value, category, supplier, etc.)
- Click "Test" → shows which rule fires, resulting buying channel, required approvals
- "Test all rules" → shows rule coverage and potential conflicts
- Highlight: rules that never fire (dead rules)

**No code visible anywhere.**

---

### 15. ADMIN — Workflow Designer

**Visual canvas (full screen mode available):**

#### Node Palette (left sidebar)
- Drag-and-drop nodes:
  - **Start** (entry trigger)
  - **User Task** (manual action by a person)
  - **Approval** (approve/reject decision)
  - **System Action** (automated: send email, update status, create PO)
  - **AI Agent** (automated: classify, validate, recommend, extract data)
  - **Decision/Gateway** (branching: if/else, parallel split, join)
  - **Notification** (email, in-app, SMS)
  - **Timer/Wait** (delay, SLA deadline, schedule)
  - **Sub-workflow** (call another workflow)
  - **End** (completion)

#### Canvas (centre)
- Nodes connected by arrows
- Click node to configure in right panel
- Zoom, pan, minimap for complex workflows
- Snap-to-grid alignment
- Undo/redo

#### Node Configuration (right panel, opens on node click)
- **User Task**: Assign to (role, specific person, or dynamic based on request data), instructions, required fields, timeout (days), escalation on timeout
- **Approval**: Approver (role/person/chain), approval type (single/majority/unanimous), timeout, auto-approve conditions, delegation rules
- **AI Agent**: Select agent (from agent library), input mapping, output mapping, confidence threshold, fallback action if low confidence
- **Decision**: Condition builder (same visual pattern as routing rules), true/false paths
- **Timer**: Duration (hours/days), based on (submission date, last action, specific field), action on expiry

#### Templates
- Save current workflow as template
- Template library with pre-built flows:
  - Standard procurement request
  - Simple sourcing event
  - Supplier onboarding
  - Contract renewal
  - Invoice exception handling
- Import/export workflows

#### Simulation
- "Run simulation" with test data to validate workflow logic
- Shows execution path highlighted on canvas
- Identifies dead paths, infinite loops, missing handlers

---

### 16. ADMIN — AI Agent Configuration

#### Agent Library
- Table: Agent Name, Type, Status (Active/Draft/Disabled), Accuracy (%), Decisions Made, Last Updated
- Types:
  - **Classification**: Categorises requests, assigns commodity codes
  - **Validation**: Checks compliance rules (DEUBA, TPRA linkage, value thresholds)
  - **Extraction**: Reads documents and extracts structured data (SOW parsing, invoice reading)
  - **Recommendation**: Suggests suppliers, buying channels, or actions based on historical data
  - **Knowledge Base**: Answers questions from policy documents and process handbooks
  - **Anomaly Detection**: Flags unusual patterns in spend, requests, or supplier behaviour

#### Agent Configuration Page
- Name, description, type
- **Input Configuration**: What data the agent receives (request fields, documents, supplier data)
- **Logic/Rules**: Varies by type:
  - Classification: Category taxonomy, training examples, confidence threshold
  - Validation: Rules checklist (each rule as a card), action on pass/fail (approve, flag, block, route to reviewer)
  - Knowledge Base: Connected content sources, response tone, escalation threshold
- **Output Configuration**: What the agent produces (classification label, validation result, extracted fields, suggested action)
- **Human Override**: How users can override agent decisions, feedback loop for improvement
- **Test Panel**: Enter sample input, see agent response with confidence score and reasoning
- **Performance Dashboard**: Accuracy over time, override rate, most common corrections

---

### 17. NOTIFICATIONS CENTRE

**Purpose:** Centralised notification management, not just a bell icon.

#### Notification Feed
- Chronological list, grouped by today / yesterday / earlier
- Types (with icons): Approval Request, Status Update, SLA Warning, Escalation, Comment/Mention, System Alert, AI Insight
- Each notification: title, brief description, timestamp, action button
- Mark as read/unread, archive, snooze
- Filter by type

#### Notification Preferences
- Per-channel settings: In-app, Email, Mobile push
- Per-event-type toggles: what do you want to be notified about?
- Quiet hours setting
- Digest option: "Send me a daily summary instead of individual notifications"

---

### 18. AI ASSISTANT — Embedded Intelligence

**Purpose:** Not just a chatbot — AI woven throughout the entire platform.

#### Floating Chat Panel (accessible from any screen)
- Opens as right-side overlay (doesn't navigate away)
- Conversational interface
- Context-aware: knows what screen the user is on

**Sample interactions:**
- "Where is request #1234?" → Shows status, current stage, owner, and next action needed
- "How do I buy software?" → Walks through intake process step by step
- "What is our policy on consulting engagements over €100k?" → Returns policy answer with source link
- "Who is the category manager for IT services?" → Returns contact with option to message them
- "Show me all pending approvals" → Links to approval queue with count
- "What's the status of Accenture's TPRA?" → Shows risk assessment status with details
- "Why was my request referred back?" → Shows the refer-back reason and what needs to change
- "Compare supplier X and supplier Y" → Side-by-side comparison card
- "Summarise this SOW" → Extracts key terms from uploaded document
- "What should I set the commodity code to for cloud hosting?" → Suggests code with confidence

**Inline AI Features (embedded in screens, not just chat):**
- **Smart Form Assistance**: Fields auto-populate based on context and history
- **AI Summaries**: Every request, supplier, and contract has an AI-generated plain-English summary
- **Proactive Alerts**: "This supplier's insurance expires in 14 days and 3 active POs depend on it"
- **Anomaly Flagging**: "This invoice amount is 40% higher than the PO value"
- **Suggested Actions**: "Based on similar requests, you typically approve these within 2 days. Approve now?"
- **Document Intelligence**: Upload any document and AI extracts key information
- **Search Enhancement**: Natural language search across the entire platform ("show me all IT consulting requests over €50k from last quarter that went through GP-Led sourcing")

---

### 19. SETTINGS & USER PREFERENCES

#### Personal Settings
- Profile: name, email, phone, department, role
- Display preferences: theme (light/dark), language, date format, currency default
- Notification preferences (link to notifications settings)
- Saved views and favourites
- API access / integrations (for power users)

#### Delegation & Out-of-Office
- Set delegate for approvals
- Set date range
- Choose: delegate all, or only for specific types/values
- Active delegations list (given and received)
- Auto-return notification

#### Favourites & Saved Searches
- Bookmark any supplier, contract, request, or report
- Save search queries with filters for one-click access
- Pin items to dashboard

---

### 20. AUDIT LOG & COMPLIANCE

**Purpose:** Complete audit trail for regulatory compliance.

#### Audit Log
- Full log of every action on the platform
- Columns: Timestamp, User, Action, Object (Request/Supplier/Contract/Rule), Detail, IP Address
- Filters: date range, user, action type, object type
- Export for compliance reporting

#### Compliance Dashboard
- Policy adherence rates by business unit
- Exception reports: actions that triggered policy overrides
- User access reviews: who has access to what
- Data retention compliance

---

## Data Requirements (Mock Data)

Provide enough mock data to make the prototype feel real:

- **Requests**: 30-40 mock requests across all statuses and stages. Mix of goods, services, software, consulting. Include some with DEUBA flags, some overdue, some referred back, some in various approval stages, some completed. Include a few with full lifecycle (intake through payment).
- **Suppliers**: 20-25 mock suppliers with realistic names, countries, risk ratings, spend data. Include some in onboarding, some with expiring certificates, some flagged for risk, some with full 360 profiles.
- **Contracts**: 15-20 mock contracts linked to suppliers, with various statuses (active, expiring soon, expired, under renewal).
- **Purchase Orders**: 10-15 POs in various states (open, partially received, closed).
- **Invoices**: 10-15 invoices (matched, unmatched, paid, in dispute).
- **Users**: Mock users for each role with realistic names and departments.
- **Routing Rules**: 10-12 pre-configured rules covering common buying channels.
- **Workflows**: 3-4 workflow templates (standard request, sourcing, onboarding, contract renewal).
- **AI Agents**: 4-5 configured agents (classifier, DEUBA validator, document reader, knowledge base, anomaly detector).
- **KPI Data**: 12 months of mock data for all compliance and spend dashboards.
- **Notifications**: 20-30 sample notifications of various types.
- **Comments/Activity**: 50+ mock comments and activity entries across requests.

---

## Technical Notes for Prototype

- Build as a React application (single-page app)
- Use Tailwind CSS for styling
- Use shadcn/ui component library for consistent UI elements
- Recharts for data visualisation
- React DnD or dnd-kit for drag-and-drop (workflow designer, kanban, rule reordering)
- Client-side data only (JSON files or in-memory state). No backend required.
- All navigation should work (clicking between screens). No dead links.
- Forms should accept input and show state changes (submissions, approvals, status updates)
- The admin screens (routing rules, workflow designer) should be interactive (drag-drop, add/remove conditions) even if they don't persist across sessions
- AI features can be simulated with pre-configured responses and mock data

---

## Priority Order for Building

If building incrementally, recommended order:

### Phase 1 — Core Experience (demonstrates the front door and orchestration)
1. Navigation Shell + Role-Based Dashboard
2. New Request (Intake Form) with AI assistance
3. Request Detail / Lifecycle Tracker with comments, refer-back, workflow view
4. Active Workflows (Kanban + Table + Timeline views)
5. Workflow Monitor & Bottlenecks

### Phase 2 — Supplier & Data (demonstrates unified vendor master and portal)
6. Supplier Directory with 360 profile
7. Supplier Portal (external view)
8. Approvals Queue with one-click approve and delegation

### Phase 3 — Configurability (demonstrates no-code admin)
9. Admin — Routing Rules Engine
10. Admin — Workflow Designer
11. Admin — AI Agent Configuration

### Phase 4 — Extended Capabilities (demonstrates native procurement functions)
12. Sourcing Event Manager with Evaluation Centre
13. Contract Lifecycle Management
14. Purchase Orders + Invoice Queue + Three-Way Match

### Phase 5 — Analytics & Platform
15. Analytics Dashboards (Spend, Compliance KPIs, Pipeline)
16. Report Builder
17. Notifications Centre
18. AI Assistant (chat overlay)
19. Settings, Delegation, Audit Log
