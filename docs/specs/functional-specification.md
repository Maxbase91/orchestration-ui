# Procurement Orchestration Platform — Functional Specification

**Version:** 1.0
**Date:** 6 April 2026
**Status:** Approved
**Classification:** Business-Facing — No Technical Implementation Detail

---

## 1. Executive Summary

### 1.1 What the Platform Is

The Procurement Orchestration Platform is an enterprise procurement management system that orchestrates the full lifecycle of procurement requests — from initial demand intake through sourcing, contracting, purchase order creation, goods receipt, invoicing, and payment. It serves as the single point of control for all procurement activity across an organisation, replacing fragmented manual processes with a unified, AI-assisted digital workflow.

### 1.2 Who It Is For

The platform serves six distinct user groups:

- **Business requestors** (service owners) who need to buy goods, services, or software
- **Strategic procurement managers** who manage the demand pipeline and sourcing strategy
- **Vendor managers** who validate requests and oversee supplier compliance
- **Procurement operations leads** who ensure workflows run smoothly and SLAs are met
- **External suppliers** who interact through a self-service portal
- **Platform administrators** who configure rules, workflows, forms, and policies

### 1.3 Problems It Solves

- **Fragmented intake:** Procurement requests arrive via email, phone, and spreadsheets. The platform provides a single, intelligent intake channel.
- **Manual classification and routing:** Category assignment and approval routing are error-prone and slow. The platform uses AI to classify and route requests automatically.
- **Compliance gaps:** Policy checks, risk assessments, and approval thresholds are often missed. The platform enforces them systematically at every stage.
- **Lack of visibility:** Stakeholders cannot see where their request is or why it is stuck. The platform provides real-time tracking, bottleneck detection, and SLA monitoring.
- **Disconnected systems:** Procurement, sourcing, contracting, and finance tools operate in silos. The platform integrates with external systems and provides a unified view.
- **Slow cycle times:** Manual handoffs between stages cause delays. The platform automates transitions, escalates overdue items, and predicts processing times.

### 1.4 Key Capabilities

- **AI-powered request intake** with natural language understanding, automatic category classification, and guided service description generation
- **End-to-end workflow orchestration** across 10 procurement stages with configurable routing rules, approval chains, and SLA tracking
- **Automated compliance enforcement** including budget validation, supplier risk checks, policy adherence, duplicate detection, and a dedicated AI compliance agent
- **Full supplier lifecycle management** from onboarding through risk assessment, performance tracking, and an external self-service portal
- **Integrated sourcing and evaluation** with event management, side-by-side supplier comparison, weighted scoring, and AI-assisted evaluation
- **Real-time analytics and reporting** with four dashboards, six KPI trackers, a drag-and-drop report builder, and scheduled report distribution

---

## 2. User Roles & Permissions

### 2.1 Role Definitions

#### Requestor / End User (Service Owner)

The business user who needs to procure something. They initiate requests, track their progress, respond to queries from the procurement team, and confirm receipt of goods or services. They see only their own requests and relevant approvals.

**Typical users:** Department heads, project managers, team leads, budget owners.

#### Strategic Procurement Manager

The procurement professional who manages the demand pipeline and sourcing strategy. They have full visibility of all requests, can create and manage sourcing events, assign work to team members, and access analytics. They are responsible for strategic supplier relationships and spend management.

**Typical users:** Category managers, senior procurement officers, head of procurement.

#### Vendor Manager

The specialist responsible for supplier validation and compliance. They review incoming requests for supplier eligibility, manage supplier risk assessments, oversee onboarding, and handle supplier communications. They have access to the full supplier directory and risk dashboards.

**Typical users:** Supplier relationship managers, vendor compliance officers.

#### Procurement Operations Lead

The operational manager who ensures workflows run efficiently. They monitor active workflows, identify bottlenecks, manage SLA compliance, and handle escalations. They have access to workflow monitoring tools and operational dashboards.

**Typical users:** Procurement operations managers, process excellence leads.

#### Supplier (External)

An external supplier who accesses the platform through a dedicated self-service portal. They can manage their company profile, complete onboarding steps, respond to sourcing events, submit invoices, and communicate with the procurement team. They cannot see any internal procurement data.

**Typical users:** Supplier account managers, sales representatives, contract administrators.

#### Admin / Platform Owner

The system administrator who configures the platform. They manage routing rules, approval chains, form templates, workflow designs, user accounts, AI agent settings, and policies. They have full access to all features including system health monitoring and audit logs.

**Typical users:** Procurement system administrators, IT admins supporting procurement.

### 2.2 Permission Matrix

| Feature Area | Requestor | Procurement Manager | Vendor Manager | Operations Lead | Supplier | Admin |
|---|---|---|---|---|---|---|
| Home Dashboard | Own view | Full view | Validation view | Operations view | Portal view | System view |
| My Requests | Yes | Yes | Yes | Yes | No | No |
| All Requests | No | Yes | Yes | Yes | No | Yes |
| New Request | Yes | Yes | No | No | No | No |
| Approvals | Own | All | All | All | No | All |
| Tasks | Own | Own + Team | Own | Own + Team | No | Own |
| Active Workflows | No | Yes | No | Yes | No | Yes |
| Workflow Monitor | No | Yes | No | Yes | No | Yes |
| Bottlenecks & Alerts | No | Yes | No | Yes | No | Yes |
| Demand Pipeline | No | Yes | No | Yes | No | Yes |
| Sourcing Events | No | Yes | Yes | No | No | Yes |
| Evaluation Centre | No | Yes | Yes | No | No | Yes |
| Supplier Directory | No | Yes | Yes | Yes | No | Yes |
| Onboarding Pipeline | No | Yes | Yes | Yes | No | Yes |
| Risk & Compliance | No | Yes | Yes | Yes | No | Yes |
| Supplier Messages | No | Yes | Yes | Yes | No | Yes |
| Contract Register | No | Yes | No | Yes | No | Yes |
| Purchase Orders | No | Yes | No | Yes | No | Yes |
| Invoices | No | Yes | No | Yes | No | Yes |
| Analytics Dashboards | No | Yes | No | Yes | No | Yes |
| Report Builder | No | Yes | No | Yes | No | Yes |
| Routing Rules | No | No | No | No | No | Yes |
| Form Builder | No | No | No | No | No | Yes |
| Workflow Designer | No | No | No | No | No | Yes |
| Approval Chains | No | No | No | No | No | Yes |
| AI Agent Configuration | No | No | No | No | No | Yes |
| Policy Management | No | No | No | No | No | Yes |
| User Management | No | No | No | No | No | Yes |
| System Health | No | No | No | No | No | Yes |
| Audit Log | No | No | No | No | No | Yes |
| AI Assistant | Yes | Yes | Yes | Yes | Yes | Yes |
| Knowledge Base | Yes | Yes | Yes | Yes | Yes | Yes |
| Supplier Portal | No | No | No | No | Yes | No |

---

## 3. Home Page & Navigation

### 3.1 Smart Command Bar

The home page features a prominent command bar at the top where users can type natural language queries. The system detects the user's intent and responds accordingly:

- **Buy intent:** When a user types something like "buy paper" or "I need new laptops", the system detects this as a purchase intent. If the item matches a catalogue product, matching products are displayed inline with prices, quantities, and an "Add to Cart" button. If it is not a catalogue item, the system navigates to the New Request wizard with pre-populated fields.

- **Lookup intent:** When a user types "where is REQ-2024-0001" or "check my requests", the system navigates to the appropriate tracking page.

- **Policy intent:** When a user types "what is the approval threshold" or "consulting policy", the system surfaces relevant policy information from the knowledge base.

- **Create intent:** When a user types "new request" or "onboard a supplier", the system navigates to the corresponding creation wizard.

The command bar shows up to 3 matching catalogue items inline with product name, description, price, and a quick-add button. For example, typing "coffee" displays "Coffee Beans 1kg — Premium Arabica blend, medium roast — EUR 22.00/bag" with an instant order option.

### 3.2 Customisable Dashboard

Each role sees a personalised dashboard with drag-and-drop widgets. Users can rearrange widgets, add new ones from a widget library, and remove those they do not need. The platform provides 18 widget types:

| Widget | Description | Available To |
|---|---|---|
| My Active Requests | List of the user's open requests with status tracking | All internal users |
| Open Demand | Count and total value of open demand items with trend sparkline | Procurement Manager, Operations Lead, Admin |
| Active Sourcing | Number of active sourcing events | Procurement Manager, Operations Lead, Admin |
| Avg Cycle Time | Average request processing duration in days with trend | Procurement Manager, Operations Lead, Admin |
| Compliance Rate | Policy compliance percentage with trend | Procurement Manager, Operations Lead, Admin |
| Demand Pipeline | Bar chart showing requests by workflow stage | Procurement Manager, Operations Lead, Admin |
| Team Workload | Request distribution per team member | Procurement Manager, Operations Lead |
| Attention Required | Overdue and referred-back items needing action | All internal users |
| AI Insights | AI-generated strategic procurement insights | All internal users |
| Validation Queue | Requests awaiting validation review | Vendor Manager, Procurement Manager |
| Workflow Health | Active workflows, stuck count, average processing days | Operations Lead, Procurement Manager, Admin |
| Recent Activity | Latest platform events and updates | All internal users |
| SLA Tracker | Requests approaching or past SLA deadlines | Operations Lead, Procurement Manager |
| System Health | Platform health and integration status | Admin only |
| Expiring Contracts | Contracts expiring within 90 days | All internal users |
| Supplier Risk Alerts | Suppliers with elevated risk ratings | Vendor Manager, Procurement Manager, Admin |
| Monthly Summary | Requests submitted, approved, and completed this month | All users |
| AI Assistant | Quick access to the procurement AI assistant | All users |

**Default layouts by role:**

- **Requestor:** Monthly Summary, My Active Requests, Recent Activity, AI Assistant, AI Insights, Expiring Contracts
- **Procurement Manager:** Open Demand, Active Sourcing, Avg Cycle Time, Compliance Rate, Demand Pipeline, Team Workload, Attention Required, AI Insights
- **Vendor Manager:** Validation Queue, Monthly Summary, Supplier Risk Alerts, Recent Activity, AI Insights
- **Operations Lead:** Workflow Health, SLA Tracker, Attention Required, AI Insights, Recent Activity
- **Admin:** System Health, Monthly Summary, Workflow Health, Supplier Risk Alerts, AI Insights

### 3.3 Quick Actions

Below the command bar, the dashboard displays a row of quick-action buttons tailored to the user's role. These provide one-click access to the most common tasks:

- **Requestor:** New Request, Track a Request, My Approvals, Ask AI Assistant, Browse Catalogue
- **Procurement Manager:** New Request, All Requests, Active Workflows, Supplier Directory, Spend Overview, Bottlenecks
- **Vendor Manager:** All Requests, Risk & Compliance, Supplier Directory, Messages, My Approvals
- **Operations Lead:** Active Workflows, Bottlenecks, All Requests, My Tasks
- **Admin:** Routing Rules, Workflow Designer, User Management, Spend Overview

Users can customise which quick actions appear in their dashboard.

### 3.4 Navigation Structure

The left sidebar organises the platform into the following groups, with items filtered by the user's role:

1. **Home** — Home page (all users)
2. **Work** — Requests (My/All/New), Approvals (My/Delegation), Tasks (My/Team)
3. **Orchestration** — Workflows (Active/Monitor/Bottlenecks), Pipeline (Demand/Sourcing)
4. **Sourcing** — Events (Active/New/Templates/Evaluation Centre)
5. **Suppliers** — Directory (All/Onboarding Pipeline/Risk & Compliance/Portal Admin/Messages)
6. **Contracts** — Register (Active/Renewals & Expiries/Templates)
7. **Purchasing** — Purchase Orders (Open POs/Goods Receipt), Invoices (Queue/Three-Way Match/Payment Tracker)
8. **Analytics** — Dashboards (Spend/Compliance/Pipeline/Supplier Performance), Reports (Builder/Scheduled/Exports)
9. **Admin** — Routing Rules, Form Builder, Approval Chains, Workflow Designer, AI Agent Configuration, Policy Management, User Management, System Health, Audit Log
10. **Help** — AI Assistant, Knowledge Base, Contact Support

### 3.5 AI Assistant

A floating chat button is accessible from any screen in the platform. When opened, it provides a conversational interface where users can ask questions in natural language. The assistant understands 62 distinct query patterns and responds with:

- Contextual answers about procurement processes, policies, and data
- Direct navigation links to relevant pages (for example, "Open My Approvals Queue" or "View Bottlenecks & Alerts")
- Actionable suggestions for next steps
- Real-time data summaries (such as spend figures, overdue counts, or contract status)

For example, asking "What invoices are pending?" returns: "14 invoices in the system: 2 under review, 1 disputed (Accenture EUR 85K — no matching PO), 1 scheduled for payment. Total pending: EUR 428K." along with clickable links to the Invoice Queue, Three-Way Match, and Payment Tracker.

---

## 4. Request Intake & Management

### 4.1 Smart Command Bar (Detailed)

The home page command bar serves as the primary entry point for all procurement activity. When a user begins typing, the system performs real-time intent detection:

**Buy intent examples:**
- "buy paper" — Detects as catalogue item. Shows "A4 Paper 500 sheets — EUR 5.00/pack" inline with quantity selector and order button.
- "I need 50 new laptops" — Detects as bulk goods purchase (above catalogue threshold). Navigates to New Request wizard with category pre-set to "Goods" and buying channel to "Procurement-Led".
- "order coffee beans" — Detects as catalogue item. Shows "Coffee Beans 1kg — Premium Arabica blend, medium roast — EUR 22.00/bag" with quick ordering.

**Lookup intent examples:**
- "where is my cloud hosting request" — Navigates to REQ-2024-0001 detail page.
- "show overdue requests" — Navigates to Bottlenecks & Alerts page.

**Policy intent examples:**
- "what is the approval limit for consulting" — Returns policy information: "All consulting engagements require Procurement-Led procurement regardless of value."
- "who approves requests over 1 million" — Returns approval chain information.

The system uses keyword matching with stop-word filtering to identify catalogue matches. Stop words such as "I", "want", "to", "buy", "need", "some", "the", "please" are excluded from the search, allowing natural phrasing.

### 4.2 New Request Wizard (5 Steps)

The request creation process follows a guided 5-step wizard:

#### Step 1: Category Selection

The user sees 8 procurement categories displayed as selectable cards:

1. **Catalogue** — Pre-approved items available for direct ordering. Fast track, 2-3 days. Examples: office supplies, IT peripherals, standard monitors under EUR 500, catering items, safety equipment, standard furniture.
2. **Goods** — Physical products requiring formal procurement. Examples: bulk laptop orders, servers, custom furniture, industrial equipment.
3. **Services** — Ongoing operational services from external providers. Examples: facilities management, cleaning, catering services, training programmes, logistics.
4. **Software** — Software licences, SaaS subscriptions, cloud services. Examples: Salesforce, AWS, Microsoft 365, cybersecurity tools.
5. **Consulting** — Professional advisory and project-based intellectual services. Examples: management consulting, IT consulting, audit support, legal advisory.
6. **Contingent Labour** — Temporary workers and contractors working under company direction. Examples: IT contractors, interim managers, administrative temps.
7. **Contract Renewal** — Extending or renewing an existing supplier contract.
8. **Supplier Onboarding** — Registering and qualifying a new supplier.

**AI Classification:** If the user is unsure, they can type a natural language description in the command area. The AI Category Classifier (94.2% accuracy) analyses the text and suggests the most appropriate category with an explanation. For example, typing "We need someone to review our cybersecurity posture" would suggest "Consulting" with the reasoning: "One-off advisory work with the provider bringing their own methodology falls under Consulting, not Services."

**Key distinctions the AI enforces:**
- "Business consulting" is classified as Consulting, not Goods
- "IT consulting" is classified as Consulting, not Software
- "I need a laptop" is classified as Catalogue (standard ThinkPad available)
- "50 custom laptops" is classified as Goods (bulk/custom)
- "Cleaning service" is classified as Services
- "SAP license" is classified as Software
- "Temp developer" is classified as Contingent Labour

If the user selects "Catalogue", they proceed to the catalogue browsing step. For all other categories, they proceed to Step 2.

#### Step 2: Details & Intake

This step offers three parallel intake methods — the user can choose whichever suits them:

**Option A: AI-Guided Chat Intake** (default for services, consulting, and contingent labour)

An AI-powered conversational interface asks questions one at a time to build a complete request specification. The AI extracts structured data from natural language responses and progressively fills in the request form fields. See Section 4.3 for full details.

**Option B: Traditional Form**

A conventional form with the following fields:
- Title (text, required)
- Description (textarea, required)
- Estimated Value (number, required, in EUR)
- Priority (select: Low / Medium / High / Urgent)
- Supplier (optional, searchable dropdown of existing suppliers)
- Delivery Date (date picker, required)
- Cost Centre (text, required)
- Budget Owner (text, required)
- Business Justification (textarea, required)
- Urgency Flag (checkbox with justification field)

**Option C: Catalogue Browse** (only if category is Catalogue)

A browsable catalogue interface. See Section 4.5 for full details.

Fields are pre-populated from context where possible. For example, if the user mentioned "AWS" in the command bar, the supplier field is pre-set to "Amazon Web Services (AWS)" and the category to "Software".

#### Step 3: Compliance & Risk Checks

Before the request can proceed, the system runs automated compliance checks. These happen in real time while the user watches, with each check displaying a pass/fail indicator:

1. **Buying Channel Determination** — The system evaluates the request category, value, and supplier to determine the correct buying channel (Catalogue, Direct PO, Business-Led, Procurement-Led, or Framework Call-Off). The reasoning is displayed.

2. **Supplier Risk Assessment (SRA) Check** — If a supplier is specified, the system checks whether they have a valid SRA. Statuses: Valid, Expiring (within 90 days), Expired, or Not Assessed.

3. **Policy Checks** — The system evaluates 4-5 policy rules specific to the request:
   - Budget pre-approval
   - Delegated authority limits
   - Competitive sourcing requirements
   - Category-specific policies (e.g., consulting engagement policy, data protection assessment)
   - Business justification completeness

4. **Duplicate Detection** — The system scans existing active and archived requests for similarity. If a duplicate is detected (above 78% similarity), a warning is shown.

5. **Risk Flags** — Any special risk considerations are highlighted (e.g., "High-value contract: requires dual sign-off").

Additionally, a **Smart Assessment** panel provides:
- **Vendor Match:** Whether an existing supplier is available or a new supplier is needed
- **Contract Coverage:** Whether an active contract covers this engagement
- **SRA Status:** Current assessment status and expiry date
- **Estimated Processing Path:** Which workflow stages will be required, which can be skipped, and the estimated number of days to completion

#### Step 4: Routing Preview

The system displays the predicted workflow path for the request, showing:

- The buying channel assigned (e.g., "Procurement-Led Sourcing")
- The approval chain that will apply (e.g., "Category Manager > Finance > VP Procurement")
- Each workflow stage the request will pass through, with estimated days per stage
- The total estimated processing time
- Any stages that can be skipped based on the request characteristics (e.g., sourcing may be skipped if an existing framework agreement covers the need)

The routing is determined by the platform's routing rules engine (see Section 14.1).

#### Step 5: Confirmation

A summary page showing all captured information:
- Request title, description, category, and priority
- Estimated value and currency
- Supplier (if specified)
- Buying channel and approval path
- Compliance check results
- Service description (if applicable)

The user reviews and submits the request. Upon submission, the request enters the "Intake" stage and appears in the relevant queues.

### 4.3 AI-Guided Chat Intake

For categories where a detailed specification is important (services, consulting, contingent labour, and complex goods), the platform offers an AI-guided conversational intake. The AI assistant:

1. **Asks questions one at a time** in natural language, adapting based on previous answers.
2. **Extracts structured data** from conversational responses. For example, if the user says "We need this done by end of Q2 and the budget is around 450K", the system extracts the delivery date and value.
3. **Pre-populates from context** — if the user already selected a supplier or mentioned a value, the AI skips those questions.
4. **Offers two modes:**
   - **Detailed SOW mode** — Builds a comprehensive 9-section Statement of Work (see Section 4.4)
   - **Quick essentials mode** — Captures only the minimum required fields for rapid submission

The AI provides category-specific examples and prompts. For a consulting request, it might ask: "What is the primary objective of this engagement? For example: 'Conduct a cybersecurity audit to identify vulnerabilities and provide remediation recommendations.'"

### 4.4 Service Description (Statement of Work)

For services, consulting, and complex procurement categories, the system generates a structured service description with 9 sections:

1. **Objective** — What the engagement aims to achieve. Example: "Migrate on-premise infrastructure to AWS cloud to reduce operational costs and improve scalability."
2. **Scope** — What is in scope and explicitly out of scope. Example: "In scope: infrastructure assessment, migration planning, execution for 45 workloads. Out of scope: application refactoring, end-user training."
3. **Deliverables** — Numbered list of expected outputs. Example: "1) Infrastructure assessment report, 2) Migration strategy and roadmap, 3) Migration execution, 4) Post-migration validation report, 5) Operational runbook."
4. **Timeline** — Phased timeline with durations. Example: "6 months: Discovery (weeks 1-4), Planning (weeks 5-8), Migration (weeks 9-20), Validation (weeks 21-24)."
5. **Resources** — Required team composition. Example: "AWS Certified Solutions Architect (lead), 2 Cloud Engineers, DevOps specialist, Project Manager."
6. **Acceptance Criteria** — How success will be measured. Example: "All 45 workloads migrated and operational. Zero data loss. Performance baseline met or exceeded."
7. **Pricing Model** — Commercial structure. Example: "Fixed price for discovery and planning. T&M for migration execution with monthly cap."
8. **Location** — Where work will be performed. Example: "Hybrid — on-site for discovery workshops, remote for execution."
9. **Dependencies** — Prerequisites and assumptions. Example: "Access to current infrastructure documentation. Maintenance windows for migration."

The AI generates a **narrative summary** that combines all 9 sections into readable prose. This narrative includes a copy button for easy transfer to other documents. The service description is carried through the entire workflow and displayed on the request detail page.

### 4.5 Catalogue Purchasing

When a user selects the Catalogue category or triggers a catalogue match from the command bar, they enter a streamlined purchasing flow.

**Six sub-catalogues are available:**

| Catalogue | Items | Example Products |
|---|---|---|
| IT Equipment | 8 items | ThinkPad T14 (EUR 1,299), Dell 27" Monitor (EUR 449), Logitech Keyboard (EUR 109), USB-C Hub (EUR 59), Wireless Mouse (EUR 49), Webcam (EUR 89), Headset (EUR 179), Ethernet Cable (EUR 12) |
| Office Supplies | 8 items | A4 Paper (EUR 5/pack), Pens (EUR 8/pack), Sticky Notes (EUR 4/pack), Toner Cartridge (EUR 45), Binder Clips (EUR 3/pack), Whiteboard Markers (EUR 12/pack), File Folders (EUR 15/pack), Desk Organizer (EUR 22) |
| Furniture | 6 items | Electric Standing Desk (EUR 699), Ergonomic Chair (EUR 549), Dual Monitor Arm (EUR 89), Bookshelf (EUR 199), Magnetic Whiteboard (EUR 129), Filing Cabinet (EUR 249) |
| Safety & PPE | 5 items | Safety Gloves (EUR 25/pack), Hard Hat (EUR 35), Hi-Vis Vest (EUR 15), First Aid Kit (EUR 45), Safety Glasses (EUR 18) |
| Catering & Pantry | 5 items | Coffee Beans 1kg (EUR 22), Tea Selection Box (EUR 15), Water Dispenser (EUR 89), Paper Cups (EUR 8/pack), Snack Box (EUR 35) |
| Print & Stationery | 5 items | Business Cards 500 (EUR 35), Letterhead 100 sheets (EUR 28), Envelopes (EUR 12/pack), Custom Rubber Stamps (EUR 18), Laminating Pouches (EUR 15/pack) |

Each catalogue item displays: name, description, unit price, unit of measure, supplier name, and lead time (1-14 days depending on item).

**Ordering flow:**
1. Browse or search the catalogue
2. Select items and set quantities
3. Items are added to a cart with running total
4. For orders under EUR 5,000 — no approval needed; fast-track processing
5. For orders between EUR 5,000 and EUR 25,000 — line manager approval required
6. Submit order — a purchase order is generated automatically

Approximately 37 items are available across 6 catalogues from pre-approved suppliers.

### 4.6 Request Detail Page

Each procurement request has a comprehensive detail page with 8 tabs:

#### Overview Tab
- Request header: title, ID, status badge, priority indicator, category tag, value
- Lifecycle stepper showing all 10 stages (Draft, Intake, Validation, Approval, Sourcing, Contracting, PO, Receipt, Invoice, Payment, Completed) with the current stage highlighted and completed stages checked
- Key information cards: requestor, owner, supplier, contract, PO reference, cost centre, budget owner, commodity code, buying channel, delivery date, days in current stage, SLA deadline
- Service description display (if applicable) with all 9 structured sections and the narrative summary with copy button
- Business justification

#### Compliance Tab
- Intake compliance results: buying channel determination with reasoning, SRA check, policy checks, duplicate detection, risk flags
- AI Compliance Report from the PR Compliance Reviewer agent (see Section 6.3): decision (Approved/Needs Review/Rejected), confidence score, 6-category review with pass/fail/warning indicators, detailed findings, and recommendation

#### Workflow Tab
- Visual workflow diagram showing all stages with the current position highlighted
- Stage history table: each transition with date, handler, action taken, and notes
- System integration timeline showing when external systems were engaged, their status, and reference IDs
- Current stage details with assigned handler and SLA countdown

#### Comments Tab
- Threaded conversation timeline with internal and external comments
- Comment input with rich text support
- Attachment capability
- Internal/external visibility toggle (internal comments are hidden from suppliers)

#### Approvals Tab
- List of all approval entries for the request
- Each entry shows: approver name, role, status (Pending/Approved/Rejected/Delegated), requested date, responded date, and comments
- Delegation information if an approver is out of office

#### Documents Tab
- List of all documents attached to the request
- Upload capability
- Document type indicators (quote, contract, invoice, specification, etc.)

#### Related Tab
- Linked entities: related contracts, purchase orders, invoices, other requests, sourcing events, and supplier profile
- Each linked entity is clickable and navigates to its detail page

#### Audit Tab
- Immutable chronological log of every action taken on the request
- Entry types: system actions, human actions, AI decisions, warnings, and blocking events
- Each entry shows: timestamp, user/system, action description, and detail

---

## 5. Workflow Orchestration

### 5.1 Active Workflows

The Active Workflows page provides three views of all in-flight procurement requests:

#### Kanban Board View
Requests displayed as cards arranged in columns by workflow stage. Users can drag and drop cards between stages (where permitted by their role) to advance or reassign requests. Each card shows: request title, ID, value, priority badge, days in stage, owner avatar, and overdue indicator.

#### Table View
A sortable, filterable, searchable table of all active requests. Columns include: ID, title, category, status, priority, value, owner, supplier, days in stage, SLA status, and last updated. Supports multi-column sorting and advanced filtering.

#### Timeline View (Gantt-Style)
A horizontal timeline showing each request as a bar spanning its active period. Stages are colour-coded. This view is useful for spotting requests that have been in a single stage for an unusually long time.

**Quick filters available across all views:**
- Stuck > 5 days — Requests that have not progressed in 5 or more days
- My Action — Requests where the current user is the assigned handler
- High Value — Requests above EUR 100,000
- Escalated — Requests that have been escalated
- Overdue — Requests past their SLA deadline

### 5.2 Workflow Monitor & Bottlenecks

#### Bottleneck Dashboard
Displays average days per stage across all active requests, highlighting stages where requests tend to stall. For example, if the average time in the "Approval" stage is 12 days against a 7-day SLA, this stage is flagged red.

#### SLA Tracker
A countdown display for each active request showing time remaining until SLA breach. Colour-coded: green (on track), amber (at risk — within 48 hours), red (breached).

#### Heatmap
A matrix visualization showing stages on one axis and weeks on the other. Cell colour intensity represents the number of requests in each stage during each week. This reveals seasonal patterns and persistent bottlenecks.

#### AI Bottleneck Analysis
The AI analyses workflow data and generates recommendations. For example: "Approval stage average has increased from 5 to 12 days over the past 6 weeks. Root cause: 67% of pending approvals are assigned to Robert Fischer, who is currently out of office. Recommendation: Activate delegation to Dr. Katrin Bauer for all pending items."

#### Stuck Requests Table
A filtered table showing only requests that have exceeded their SLA or have been in the same stage for more than 5 days. Each row includes an escalation action button allowing the user to escalate, reassign, or send a reminder.

### 5.3 Workflow Actions

At each stage of the workflow, authorised users can perform the following actions:

- **Approve** — Advance the request to the next stage. Records the approver, timestamp, and any comments.
- **Reject** — Block the request from proceeding. Requires a reason. The request moves to "Cancelled" status.
- **Refer Back** — Return the request to a previous stage for rework. The refer-back count is incremented and tracked.
- **Reassign** — Transfer ownership to a different user. Records the reassignment in the audit trail.
- **Escalate** — Flag the request for senior management attention. Triggers a notification to the escalation target.
- **Cancel** — Terminate the request entirely. Requires a cancellation reason.

Every action is persisted with a full audit trail including: who performed the action, when, the previous and new stage, and any comments or reasons provided.

### 5.4 Clickable Step Details

Each step in the workflow can be expanded to reveal comprehensive information:

- **Handler:** Name, role, and department of the person responsible for that step
- **Action Taken:** Description of what was done (e.g., "Validated buying channel, commodity code, and supplier eligibility")
- **Decision:** Outcome (Approved/Rejected/Referred Back/Escalated/Completed), reason, and any conditions
- **System Integration:** Which external system was engaged, its reference ID, and current status
- **Forms Completed:** Which forms were filled in during that step, with field-level detail
- **Documents Added:** Files uploaded or generated during that step
- **Comments:** Internal and external comments made during that step
- **Duration:** When the step started, when it completed, and total days in the step
- **SLA Status:** Whether the step was completed on track, at risk, or in breach

---

## 6. Compliance & Risk

### 6.1 Intake Compliance Checks

When a request is submitted, the system automatically performs the following compliance checks:

**Buying Channel Classification**
The system evaluates the request's category, value, and supplier to determine the correct buying channel:
- **Catalogue** — Pre-approved items under EUR 5,000
- **Direct PO** — Low-value services under EUR 10,000 with existing supplier
- **Business-Led** — Goods or renewals under EUR 25,000-50,000
- **Framework Call-Off** — Items covered by an existing framework agreement
- **Procurement-Led** — High-value items, consulting engagements, or items requiring competitive sourcing

The system provides a plain-language explanation of why the channel was selected. For example: "Value (EUR 480,000) exceeds EUR 100K threshold and category is Software — Procurement-Led Sourcing required."

**Supplier Risk Assessment (SRA) Status Check**
If a supplier is identified, the system checks:
- Whether the supplier has a valid SRA on file
- When the SRA expires
- Whether the SRA is approaching expiry (within 90 days)
- Whether re-assessment is needed

**Policy Checks (4-5 per request)**
The specific checks vary by category. Common checks include:
- Budget pre-approval confirmed by budget owner
- Value within delegated authority limits
- Competitive sourcing requirement satisfied (or waiver justification)
- Category-specific policies (e.g., data protection assessment for cloud services, consulting engagement policy for advisory work)
- Business justification completeness and quality

**Duplicate Detection**
The system compares the new request against all active and recently archived requests. It evaluates similarity based on title, description, supplier, category, and value. If similarity exceeds a threshold, a warning is displayed with a link to the potential duplicate.

**Risk Flags**
Special conditions that require attention:
- High-value contract requiring dual sign-off
- New supplier requiring onboarding
- Supplier in high-risk jurisdiction
- SRA expired or expiring

### 6.2 Smart Assessment

The Smart Assessment panel provides a quick-read summary of the request's procurement path:

- **Vendor Match:** "Existing supplier — Amazon Web Services (AWS), SUP-006" or "New supplier — onboarding required"
- **Contract Coverage:** "Active contract found — CON-006, valid until 2027-06-30" or "No active contract — sourcing required"
- **SRA Status:** "SRA valid until 2026-01-31. Supplier fully assessed with low risk rating." or "SRA expired — renewal required before proceeding"
- **Estimated Processing Path:** "Intake > Validation > Approval > Contracting > PO > Receipt > Invoice > Payment. Sourcing skipped (existing framework). Estimated: 18 days."

### 6.3 PR Compliance Agent

The PR Compliance Reviewer is an AI agent (96.1% accuracy, 534 decisions made) that performs a comprehensive 6-category review of each request before purchase order creation:

**Review Categories:**

1. **Budget** — Validates budget availability, checks quarterly allocation thresholds, confirms budget code and GL account
2. **Contract** — Verifies contract coverage, checks framework agreement validity, confirms call-off permissions
3. **Supplier Compliance** — Validates SRA status, checks sanctions screening, reviews supplier certifications
4. **Policy** — Confirms delegated authority, validates buying channel compliance, checks category-specific policies
5. **Risk** — Evaluates supplier risk rating, assesses concentration risk, reviews adverse findings
6. **Value** — Benchmarks pricing against market rates, compares with historical spend, checks rate card compliance

**Output:**
- **Decision:** Approved / Needs Review / Rejected
- **Confidence Score:** Percentage indicating the agent's confidence in the decision (e.g., 97.2%)
- **Detailed Findings:** Each check is listed with its status (Pass, Fail, Warning, Info), detail text, and severity (Critical, High, Medium, Low)
- **Recommendation:** A plain-language recommendation (e.g., "All compliance checks passed. Recommend proceeding to PO creation without additional review.")

**Example findings for a high-value request:**
- Budget availability: PASS — "Budget confirmed, EUR 480,000 within approved IT capex envelope for FY2024."
- Contract coverage: PASS — "Active contract found (CON-006), valid until 2026-03-31."
- SRA status: PASS — "SRA valid until 2025-12-15. Supplier fully assessed."
- Delegated authority: PASS — "Value within delegated authority for Head of Engineering."
- Supplier risk rating: PASS — "Supplier risk rating: Low. No adverse findings in last 12 months."
- Market benchmark: PASS — "Pricing within market benchmark plus or minus 10% based on Gartner cloud pricing index."

### 6.4 Configurable Forms

The platform includes 8 form templates across 4 categories, containing 72 fields total and supporting 11 field types:

**Form Templates:**

| Form | Category | Trigger Stage | Fields | Purpose |
|---|---|---|---|---|
| Risk Assessment Triage | Risk | Validation | 9 fields | Quick triage to determine if a full SRA is needed |
| Full Risk Questionnaire | Risk | Validation | 13 fields | Comprehensive supplier risk assessment |
| Vendor Onboarding Form | Procurement | Supplier Onboarding | 10 fields | Captures vendor master data for ERP registration |
| Contract Intake Form | Procurement | Contracting | 10 fields | Collects commercial and legal parameters for contract drafting |
| Budget Approval Form | Compliance | Approval | 7 fields | Budget validation and manager sign-off |
| IT Security Assessment | Risk | Validation (Software only) | 10 fields | Security review for SaaS and cloud procurement |
| Goods Receipt Confirmation | Operations | Receipt | 6 fields | Confirms receipt and inspection against PO |
| Change Request Form | Procurement | Multiple stages | 6 fields | Documents changes to scope, timeline, or cost |

**11 Field Types Supported:**
Text, Textarea, Number, Select (dropdown), Multi-Select, Radio buttons, Checkbox, Date picker, File Upload, Separator (visual divider), Info Text (read-only information display)

**Pre-Population:** Forms can be configured to pre-populate fields from request context. For example, the Risk Assessment Triage form auto-fills the SRA status from the supplier record and the estimated annual spend from the request value.

**Conditional Display:** Forms can be configured to appear only when specific conditions are met. For example, the IT Security Assessment form only appears when the request category is "Software".

---

## 7. Supplier Management

### 7.1 Supplier Directory

The Supplier Directory provides a searchable, filterable view of all 23 registered suppliers. Two view modes are available:

**Card Grid View:** Each supplier displayed as a card showing company name, country flag, risk rating badge, active contracts count, 12-month spend, onboarding status, and tier indicator.

**Table View:** Sortable columns for all supplier attributes.

**Filters available:**
- Risk rating: Low, Medium, High, Critical
- SRA status: Valid, Expiring, Expired, Not Assessed
- Onboarding status: Completed, In Progress, Not Started
- Tier: 1, 2, 3
- Country
- Category
- Screening status: Clear, Flagged, Pending

### 7.2 Supplier Profile (360-Degree View)

Each supplier has a comprehensive profile page with 7 tabs:

**Overview Tab:**
- Company information: legal name, country, address, DUNS number
- Primary contact details
- AI-generated summary card highlighting key facts and risks
- Risk rating badge, SRA status with expiry date, screening status
- Tier classification
- Categories served

**Contracts Tab:**
- List of all contracts with the supplier
- Status, value, start/end dates, utilisation percentage
- Direct links to contract detail pages

**Risk Tab:**
- Current risk rating with trend
- SRA assessment history
- Certification list with expiry dates and status (Valid, Expiring, Expired)
- Sanctions screening results
- Adverse media alerts

**Spend Tab:**
- 3-year spend history displayed as a bar chart
- Spend breakdown by category
- Year-over-year comparison

**Performance Tab:**
- Performance score (0-100)
- Scorecard dimensions: quality, delivery, responsiveness, compliance, value
- Historical performance trend

**Documents Tab:**
- All documents associated with the supplier: contracts, certificates, risk assessments, onboarding documents

**Activity Tab:**
- Timeline of all interactions: requests, contract events, risk assessments, communications

### 7.3 Onboarding Pipeline

A 3-column kanban board showing the supplier onboarding pipeline:

- **Not Started** — Suppliers who have been identified but not yet begun onboarding (e.g., GreenEnergy GmbH)
- **In Progress** — Suppliers currently going through the onboarding process (e.g., Databricks, TechBridge Solutions)
- **Completed** — Fully onboarded suppliers with all checks passed

Each card shows supplier name, country, risk rating, and the number of onboarding steps completed.

### 7.4 Risk & Compliance

A dedicated risk management view providing:

- **Risk Rating Table:** All suppliers listed with their risk rating, SRA status, SRA expiry date, screening status, and certification status. Rows are colour-coded by risk level.
- **Expiry Alerts:** Suppliers with SRAs expiring within 30, 60, or 90 days
- **SRA Coverage Tracking:** Percentage of active suppliers with valid SRAs
- **Certification Management:** Grid showing which suppliers hold which certifications (ISO 27001, ISO 9001, SOC 2, etc.) and their expiry status

### 7.5 Supplier Messaging

A threaded messaging interface for communicating with suppliers:

- Conversations can be linked to specific requests, invoices, or contracts
- Messages support attachments
- Internal notes can be added that are not visible to the supplier
- Message history is searchable

### 7.6 Supplier Portal (External Self-Service)

Suppliers access the platform through a separate portal with its own layout and horizontal navigation. The portal includes:

**Portal Dashboard:**
- Overview of the supplier's current activity: open sourcing events, pending invoices, onboarding status, recent messages

**Profile Management:**
- View and update company information, contacts, banking details, and certifications
- Upload supporting documents

**Onboarding Wizard (6 Steps):**
1. Company information — Legal name, trade name, address, DUNS
2. Financial details — Bank account, payment terms, tax ID
3. Compliance — Certifications, insurance, sanctions declaration
4. Risk questionnaire — Data handling, business continuity, subcontractor usage
5. Document upload — Required certificates, financial statements, insurance certificates
6. Review and submit — Summary of all provided information for final submission

**Sourcing Events:**
- View active sourcing events the supplier has been invited to
- Download specifications and questionnaires
- Submit bids and responses
- View Q&A boards

**Invoices:**
- Submit invoices against purchase orders
- Track invoice status (Submitted, Under Review, Matched, Approved, Scheduled, Paid, Disputed)
- View payment history

**Documents:**
- Access shared documents, contracts, and specifications
- Upload requested documents

**Messages:**
- View and respond to messages from the procurement team
- Message history and attachment support

---

## 8. Sourcing & Evaluation

### 8.1 Sourcing Events

**Event List:**
A table of all sourcing events with status tracking (Draft, Published, Bid Collection, Evaluation, Awarded, Cancelled). Each event shows: title, type, value, number of invited suppliers, number of responses received, deadline, and status.

**New Event Wizard (5 Steps):**
1. **Event Setup** — Title, description, category, estimated value, event type
2. **Requirements** — Specification document, evaluation criteria, weighting
3. **Supplier Selection** — Invite suppliers from the directory
4. **Timeline** — Publication date, Q&A deadline, bid submission deadline, evaluation period
5. **Review & Publish** — Summary review and publication

**Event Detail Page:**
- Event overview with key dates and status
- Q&A board where suppliers can ask questions and the buyer can respond (visible to all invited suppliers)
- Supplier response tracking showing which suppliers have acknowledged, are preparing bids, or have submitted

### 8.2 Evaluation Centre

The Evaluation Centre provides structured tools for comparing and scoring supplier bids:

**Side-by-Side Comparison:**
Supplier responses displayed in parallel columns for easy comparison across all evaluation dimensions.

**Scoring Matrix:**
A grid with evaluation criteria on rows and suppliers on columns. Each cell contains a score. Criteria are weighted and the platform calculates weighted totals automatically.

**AI-Assisted Scoring:**
The AI analyses supplier responses against evaluation criteria and suggests preliminary scores with rationale. Evaluators can accept, adjust, or override AI scores.

**Shortlist / Eliminate Workflow:**
Evaluators can shortlist or eliminate suppliers at each evaluation round. Eliminated suppliers are greyed out but remain visible for audit purposes.

**Award Recommendation:**
Based on the weighted scores, the system generates a ranked recommendation. The winning supplier is highlighted with a recommendation summary explaining the rationale.

### 8.3 Sourcing Templates

5 pre-configured sourcing templates are available:

1. **Simple RFQ (Request for Quotation)** — For straightforward price-based procurement. Minimal evaluation criteria. Best for standardised goods.
2. **Full RFP (Request for Proposal)** — Comprehensive evaluation with technical, commercial, and qualitative criteria. Best for complex services and consulting.
3. **Framework Mini-Competition** — For call-offs under an existing framework agreement. Simplified process with pre-qualified suppliers.
4. **Reverse Auction** — Price-focused competitive bidding where suppliers bid downward. Best for commoditised goods with clear specifications.
5. **Expression of Interest** — Pre-qualification stage to identify potential suppliers before a formal sourcing event.

---

## 9. Contract Management

### 9.1 Contract Register

The Contract Register lists all 18 contracts with the following information:
- Contract ID and title
- Supplier name
- Total value
- Start and end dates
- Status: Draft, Under Review, Active, Expiring, Expired, Terminated
- Owner name and department
- Category
- Utilisation percentage (spend against contract value)

**Status Filters:**
- All Contracts (18)
- Active (9)
- Expiring within 90 days (3: Siemens IoT Platform, WPP Marketing Services, Sodexo Catering)
- Expired (1: SAP S/4HANA Enterprise License)
- Under Review (2: Capgemini DevOps, Microsoft 365 Enterprise)
- Draft (1: Cushman & Wakefield Facilities Management)

**Renewal Alerts:**
The system automatically generates alerts at 30, 60, and 90 days before contract expiry. These appear as notifications and are displayed on the Expiring Contracts dashboard widget.

### 9.2 Contract Detail

Each contract has a detail page with the following sections:

- **Summary:** Title, parties, value, dates, status, owner, category, linked request IDs
- **Financial:** Contract value versus actual spend, utilisation percentage displayed as a progress bar, spend trend chart
- **Obligations:** Key obligations of each party (populated from the Contract Intake Form)
- **Renewal:** Renewal date, auto-renewal flag, renewal terms, recommended action (renew, renegotiate, or recompete)
- **Documents:** All contract-related documents (signed agreement, amendments, schedules)
- **Related:** Linked requests, purchase orders, invoices, and supplier profile

### 9.3 Contract Templates

6 contract templates are available for use when creating new contracts:

1. **Standard Services Agreement** — For ongoing operational service engagements
2. **Software License Agreement** — For SaaS subscriptions and software licences
3. **Consulting Agreement** — For advisory and project-based engagements
4. **Non-Disclosure Agreement (NDA)** — For confidentiality protection during pre-engagement discussions
5. **Master Services Agreement (MSA)** — Framework agreement establishing overarching terms for multiple engagements
6. **Statement of Work (SOW)** — Project-specific scope and deliverables document, typically under an existing MSA

---

## 10. Purchasing & Payments

### 10.1 Purchase Orders

**PO List:**
13 purchase orders tracked with the following statuses:
- **Draft** (3) — PO created but not yet submitted to supplier
- **Submitted** (1) — PO sent to supplier, awaiting acknowledgement
- **Acknowledged** (1) — Supplier confirmed receipt of PO
- **Partially Received** (2) — Some line items received
- **Received** (2) — All line items received
- **Closed** (4) — PO fully received and reconciled

**PO Detail:**
Each purchase order shows:
- PO ID, supplier, value, status, creation date, delivery date
- Contract reference (if applicable)
- Request reference
- Line items table: description, quantity ordered, unit price, quantity received, line total
- Delivery status indicator per line item

**Goods Receipt Confirmation:**
When goods or services are received, the requestor or operations team completes the Goods Receipt Confirmation form. This captures: PO reference, items received description, quantity, condition on arrival (Good, Minor Damage, Major Damage, Rejected), quality rating (1-5), and notes. This data feeds into the three-way match process.

### 10.2 Invoice Management

**Invoice Queue:**
14 invoices tracked across 7 statuses:
- **Submitted** (2) — Invoice received from supplier, awaiting review
- **Under Review** (2) — Invoice being reviewed by accounts payable
- **Matched** (1) — Invoice matched against PO and goods receipt
- **Approved** (2) — Invoice approved for payment
- **Scheduled** (1) — Payment scheduled with bank
- **Paid** (5) — Payment completed
- **Disputed** (1) — Invoice has a discrepancy requiring resolution

**AI Data Extraction:**
When invoices are submitted, the Document Extractor AI agent (89.5% accuracy) automatically extracts key data: supplier name, invoice number, date, amount, line items, tax amounts, and payment terms. This eliminates manual data entry.

**Three-Way Match:**
The system automatically matches invoices against purchase orders and goods receipts:
- **Matched** — Invoice amount matches PO and goods receipt exactly
- **Partial Match** — Invoice covers only some line items (e.g., partial delivery)
- **Unmatched** — No matching PO found (e.g., INV-011 from Accenture for EUR 85,000 with no corresponding PO)
- **Variance** — Amounts do not match exactly. The variance amount is calculated and displayed. (e.g., INV-002 from AWS shows a EUR 2,400 variance against PO-001)

Unmatched invoices are flagged for manual review. Variances above a configurable threshold require approval.

### 10.3 Payment Tracker

The payment lifecycle tracks invoices through four stages:

1. **Matched** — Invoice successfully matched to PO and receipt
2. **Approved** — Invoice approved for payment by authorised approver
3. **Scheduled** — Payment scheduled with bank for the next payment run
4. **Paid** — Payment executed and confirmed

Each invoice shows its current position in the payment lifecycle, the due date, and days until or past the due date. Overdue payments are highlighted.

---

## 11. Analytics & Reporting

### 11.1 Dashboards

Four analytics dashboards provide comprehensive insight into procurement performance:

**Spend Overview:**
- Total spend trend (monthly, quarterly, annual)
- Managed versus unmanaged spend ratio
- Spend by category breakdown (pie/bar chart)
- Spend by supplier (top 10)
- Spend by department
- Year-over-year comparison

**Compliance KPIs:**
- Overall compliance rate trend (82.5% in January 2024 to 91.0% in December 2024)
- Policy breach count trend (8 per month down to 2)
- First-time-right rate trend (68% to 85%)
- SRA coverage percentage
- Buying channel compliance breakdown

**Pipeline & Cycle Time:**
- Average cycle time trend (42 days down to 29 days over 12 months)
- Requests submitted versus completed per month
- Open demand count and value
- Active sourcing events
- Stage-by-stage cycle time analysis

**Supplier Performance:**
- Supplier performance scores (ranked table)
- Performance trend over time
- Category-level performance comparison
- Risk rating distribution across supplier base

### 11.2 KPI Cards

6 primary KPIs are tracked with sparkline trends and drill-down capability:

| KPI | Latest Value | Trend Direction |
|---|---|---|
| Open Demand | 28 requests | Increasing |
| Active Sourcing | 12 events | Increasing |
| Avg Cycle Time | 29 days | Decreasing (improving) |
| Compliance Rate | 91.0% | Increasing (improving) |
| Total Spend (monthly) | EUR 4,800,000 | Increasing |
| Managed Spend | EUR 4,250,000 (88.5%) | Increasing (improving) |

Each KPI card shows: current value, percentage change from previous period, 12-month sparkline trend, and a drill-down link to the detailed dashboard.

12 months of historical data are maintained (January 2024 through December 2024) supporting trend analysis and year-over-year comparison.

### 11.3 Report Builder

A visual report creation tool allowing users to build custom reports:

- **Data Source Selection:** Choose from requests, suppliers, contracts, invoices, purchase orders, spend, or KPI data
- **Chart Type Selector:** Bar, line, pie, area, scatter, table, or number card
- **Drag-and-Drop Configuration:** Select dimensions (x-axis), measures (y-axis), filters, and groupings
- **Live Preview:** Report updates in real-time as configuration changes
- **Export Options:** PDF, Excel (spreadsheet), and CSV formats

### 11.4 Scheduled Reports

5 pre-configured scheduled reports are available:

| Report | Frequency | Description |
|---|---|---|
| Weekly Pipeline Summary | Weekly (Monday) | Open demand, active sourcing, stuck requests, upcoming deadlines |
| Monthly Spend Report | Monthly (1st) | Total spend, managed spend ratio, category breakdown, top suppliers |
| Quarterly Compliance Review | Quarterly | Compliance rate, policy breaches, SRA coverage, audit findings |
| Contract Expiry Alert | Monthly (15th) | Contracts expiring in next 90 days with renewal recommendations |
| Supplier Performance Scorecard | Quarterly | Performance scores, risk ratings, certification status for all active suppliers |

Each report can be configured with:
- Distribution list (email recipients)
- Frequency (daily, weekly, monthly, quarterly)
- Enable/disable toggle
- Custom date range

---

## 12. AI Capabilities

### 12.1 AI Agents

The platform employs 6 AI agents, each specialising in a specific aspect of procurement intelligence:

| Agent | Type | Accuracy | Decisions Made | Status | Function |
|---|---|---|---|---|---|
| Category Classifier | Classification | 94.2% | 1,247 | Active | Classifies requests into categories and assigns commodity codes based on title, description, and historical patterns. Trained on 3 years of procurement data. |
| Request Validator | Validation | 91.8% | 892 | Active | Validates requests for completeness, policy compliance, and data quality. Checks for missing fields, budget availability, duplicates, and policy violations. |
| Document Extractor | Extraction | 89.5% | 2,340 | Active | Extracts key data from uploaded documents including invoices, contracts, quotes, and proposals. Identifies supplier names, amounts, dates, terms, and line items. |
| Spend Anomaly Detector | Anomaly Detection | 87.3% | 156 | Active | Monitors spending patterns across categories, suppliers, and cost centres. Detects unusual spend spikes, off-contract purchasing, invoice duplicates, and price variance outliers. |
| Supplier Recommender | Recommendation | 78.6% | 45 | Draft (Pilot) | Recommends optimal suppliers based on category match, performance scores, risk ratings, and pricing history. Currently below production accuracy threshold. |
| PR Compliance Reviewer | Validation | 96.1% | 534 | Active | Reviews purchase requisitions before PO creation across 6 compliance categories. Produces a compliance report with pass/fail decision and detailed findings. |

### 12.2 AI-Powered Features

**Intake Intelligence:**
- **Category Detection:** When a user describes what they need in natural language, the AI identifies the correct procurement category and explains its reasoning. For example, "I need a cybersecurity consultant" is classified as Consulting with the note: "Professional advisory engagement where the provider brings their own methodology."
- **Commodity Code Assignment:** The AI assigns the appropriate commodity code from the UNSPSC taxonomy. For example, cloud hosting is assigned code 81112200 (Cloud computing services).
- **Service Description Generation:** For consulting and services categories, the AI conducts a conversational intake and generates a structured 9-section Statement of Work.
- **Buying Channel Suggestion:** Based on category, value, and supplier, the AI suggests the appropriate buying channel with reasoning.

**Compliance Automation:**
- **PR Compliance Review:** The 6-category automated compliance review described in Section 6.3.
- **Risk Triage:** Automated determination of whether a full supplier risk assessment is required based on spend level, data sensitivity, and jurisdiction.
- **Policy Checks:** Automated validation against configurable policy rules at the point of request submission.

**Operational Intelligence:**
- **Bottleneck Analysis:** The AI identifies workflow stages causing delays, analyses root causes, and recommends remediation actions.
- **SLA Prediction:** Based on historical processing times, the AI estimates how long each remaining stage will take for a given request.
- **Spend Anomaly Alerts:** Automated detection of unusual spending patterns with explanatory context.

**AI Assistant Chat (62 Response Patterns):**
The conversational AI assistant covers queries across the following domains:
- Request creation and tracking
- Approval management
- Supplier information and risk
- Spend and budget queries
- Contract management
- Invoice and payment tracking
- Workflow and pipeline status
- Policy and process guidance
- Catalogue ordering
- Supplier onboarding
- Sourcing events
- Report navigation

Each response includes actionable navigation links. For example, asking about supplier risk generates links to the Compliance KPI Dashboard, Supplier Risk & Compliance page, and Policy Management.

**Smart Command Bar (Natural Language to Action):**
As described in Section 4.1, the command bar translates natural language input into platform actions, including real-time catalogue search results.

### 12.3 AI Visual Language

AI-generated content throughout the platform follows a consistent visual language:

- **Blue-tinted cards** distinguish AI-generated insights from human-entered data
- **Sparkle icon** marks all AI-generated content, recommendations, and suggestions
- **Confidence badges** display the AI's confidence level as a percentage (e.g., "94.2% confident")
- **Accept / Dismiss / Override controls** appear on every AI recommendation, allowing users to:
  - Accept the AI's suggestion and apply it
  - Dismiss the suggestion (with optional reason)
  - Override with a manual value

This ensures transparency — users always know when they are looking at AI-generated content and always have the ability to override it.

---

## 13. System Integrations

### 13.1 External Systems

The platform integrates with 4 external systems, each serving a specific purpose at specific workflow stages:

#### SAP Ariba
- **Purpose:** Sourcing event management and supplier bid collection
- **Engaged at stage:** Sourcing
- **What it does:** RFx events are created in SAP Ariba, suppliers are invited to bid, and responses are collected. The platform tracks the Ariba event reference and bid status.
- **Example:** For REQ-2024-0006 (Data Analytics Platform), an RFx event was created in Ariba with 3 suppliers invited.

#### Coupa Risk Assess
- **Purpose:** Supplier risk assessment and due diligence
- **Engaged at stage:** Validation
- **What it does:** Supplier profiles are submitted for automated risk scoring. The system returns a risk score and assessment report.
- **Example:** For REQ-2024-0001 (Cloud Hosting Migration), a risk assessment for AWS returned "Risk score: Low (12/100)."

#### Sirion CLM (Contract Lifecycle Management)
- **Purpose:** Contract drafting, review, and execution
- **Engaged at stage:** Contracting
- **What it does:** Contract documents are generated using templates, reviewed by legal, red-lined, and executed. The platform tracks the Sirion reference and review status.
- **Example:** For REQ-2024-0013 (Microsoft E5 Upgrade), the license agreement is under legal review in Sirion CLM.

#### SAP S/4HANA
- **Purpose:** Purchase order creation and financial processing
- **Engaged at stage:** PO Creation
- **What it does:** Purchase orders are created in the ERP system with the correct supplier, line items, and financial coding. The platform receives the SAP PO number as confirmation.
- **Example:** For REQ-2024-0016 (Laptop Refresh), PO 4500012089 for 350 ThinkPad laptops was created in SAP.

### 13.2 Integration Status Lifecycle

Each integration interaction passes through 7 possible states, each with a distinct visual indicator:

| Status | Description | Visual |
|---|---|---|
| Pending Handover | Data prepared but not yet sent to external system | Grey |
| Submitted | Data sent to external system, awaiting acknowledgement | Blue |
| Awaiting Response | External system acknowledged, processing not yet complete | Amber |
| Processing | External system actively working on the request | Blue (animated) |
| Completed | External system returned a successful result with reference ID | Green |
| Error | External system returned an error or could not process | Red |
| Timeout | No response received within the expected timeframe (30 days) | Red (with clock) |

The integration timeline on each request's Workflow tab shows all system interactions chronologically, making it clear when handoffs occurred and whether external systems are causing delays.

---

## 14. Administration

### 14.1 Routing Rules Engine

The Routing Rules Engine determines how requests are classified and routed through the workflow. It uses a 3-panel editor:

**Panel 1: Rule List**
A table of all 12 routing rules showing: rule name, status (Active/Draft/Disabled), category, match count (how many times the rule has been triggered), and last modified date.

**Panel 2: Visual Rule Builder**
An interactive condition builder with IF/THEN logic:

- **IF** conditions: field, operator, value. Supports AND/OR grouping.
  - Fields: category, value, priority, supplier, commodity code, urgency flag, supplier risk rating
  - Operators: equals, not equals, greater than, less than, between, in (list), starts with, contains
- **THEN** actions: buying channel assignment and approval chain definition

**Panel 3: Test Panel**
A simulation area where administrators can input test request data and see which rule would match and what routing would result.

**12 Pre-Configured Rules:**

| Rule | Conditions | Buying Channel | Approval Chain |
|---|---|---|---|
| High-value IT software | Software AND value > EUR 100K | Procurement-Led | Category Manager > Finance > VP Procurement |
| Low-value catalogue purchases | Goods AND value < EUR 5K | Catalogue | Line Manager |
| Consulting engagements | Category = Consulting | Procurement-Led | Category Manager > Finance > VP Procurement |
| Contingent labour — framework | Contingent Labour AND supplier in [Randstad, Hays] | Framework Call-Off | Category Manager > Finance |
| Contract renewals under EUR 50K | Contract Renewal AND value < EUR 50K | Business-Led | Category Manager |
| Mega-deal threshold (> EUR 1M) | Value > EUR 1M | Procurement-Led | Category Manager > Finance > VP Procurement > CPO |
| IT hardware — catalogue eligible | Goods AND commodity code starts with 432 AND value < EUR 25K | Catalogue | Line Manager > Category Manager |
| Supplier onboarding flow | Category = Supplier Onboarding | Procurement-Led | Supplier Manager > Compliance > Category Manager |
| Facilities services — direct PO | Services AND commodity code starts with 761 AND value < EUR 10K | Direct PO | Line Manager |
| Urgent request fast-track | Priority = Urgent AND Urgency Flag = true | Procurement-Led | Category Manager > VP Procurement |
| Marketing services — mid-tier (Draft) | Services AND commodity code starts with 8014 AND value between EUR 50K-250K | Procurement-Led | Category Manager > Finance |
| High-risk supplier override (Disabled) | Supplier risk rating in [High, Critical] | Procurement-Led | Supplier Manager > Compliance > VP Procurement > CPO |

### 14.2 Form Builder

The Form Builder allows administrators to create and modify form templates using a 3-panel editor:

**Panel 1: Form List**
A table of all 8 form templates with: name, category, status (Active/Draft/Disabled), trigger stages, field count, version number, and last modified date.

**Panel 2: Field Editor**
A drag-and-drop interface for adding and configuring form fields:
- Drag field types from a palette (11 types available)
- Configure each field: label, placeholder text, help text, required flag, validation rules, default value, pre-population source, display width (full or half)
- Reorder fields by dragging
- Add conditional display logic

**Panel 3: Live Preview**
A real-time preview of how the form will appear to users, updating as fields are added or modified.

### 14.3 Workflow Designer

A visual canvas for designing procurement workflows:

**10 Node Types:**
1. **Start** — Entry point of the workflow
2. **Stage** — A processing step (e.g., Intake, Validation, Approval)
3. **Decision** — A branching point with conditions (e.g., "Value > EUR 1M?")
4. **Parallel** — Splits the workflow into concurrent paths (e.g., running sanctions screening and financial checks simultaneously)
5. **Approval** — A step requiring human sign-off
6. **Integration** — A handoff to an external system
7. **Form** — A step requiring form completion
8. **Timer** — A wait step with SLA deadline
9. **Error** — An exception path (e.g., Referred Back, Rejected)
10. **End** — Completion of the workflow

**Design interaction:**
- Drag nodes from a palette onto the canvas
- Click to configure each node (set label, assign handler role, define conditions, attach forms)
- Connect nodes with edges by clicking and dragging
- Label edges with transition conditions (e.g., "Approved", "Rejected", "> EUR 5K")

**Template Library (4 Templates):**

1. **Standard Procurement** — Full end-to-end workflow: Request Submitted > Intake > Validation > Auto-Route (decision) > Approval or Direct to Sourcing > Contracting > PO Creation > Receipt > Invoice > Payment > Completed. Includes a Referred Back error path.

2. **Catalogue Purchase** — Simplified workflow: Catalogue Order > Auto-Validate > Value Check (decision: > EUR 5K requires Manager Approval, < EUR 5K goes to Auto-PO) > PO Created > Receipt > Complete.

3. **Supplier Onboarding** — Multi-step workflow with parallel processing: Onboarding Request > Initial Review > Due Diligence > Parallel Checks (Sanctions Screening + Financial Check + SRA Assessment) > Risk Decision > Compliance Approval > System Setup > Active Supplier. Includes a Rejected error path.

4. **Contract Renewal** — Decision-based workflow: Renewal Trigger > Performance Review > Renew or Recompete (decision) > Either Market Benchmark then Sourcing (RFP), or Negotiation then Approval > Contract Execution > Active Contract.

**Simulation Mode:**
Administrators can run a test request through a workflow design to verify that routing, conditions, and transitions work correctly before deploying to production.

### 14.4 Approval Chains

4 pre-configured approval chains determine who must approve requests at different value thresholds:

| Chain | Steps | Used When |
|---|---|---|
| Standard | Line Manager > Category Manager > Finance | Default for most requests EUR 5K-100K |
| Fast-Track | Category Manager > VP Procurement | Urgent requests; skips finance step |
| VP-Level | Category Manager > Finance > VP Procurement | High-value requests EUR 100K-1M |
| Board-Level | Category Manager > Finance > VP Procurement > CPO | Requests exceeding EUR 1M |

Each chain is visually editable with a step editor showing: step number, approver role, escalation timeout, and delegation rules.

### 14.5 Policy Management

8 policies managed with version control:

Policies govern procurement behaviour across the organisation. Each policy record includes: title, version, status (Active/Draft/Archived), effective date, owner, category, and full-text content.

Policies cover areas such as:
- Delegated authority limits
- Competitive sourcing requirements
- Consulting engagement rules
- Contingent labour policy
- Data protection assessment requirements
- Contract renewal procedures
- Supplier risk management
- Catalogue purchasing limits

Administrators can view the full text of each policy, create new versions, and track version history.

### 14.6 User Management

A user management table showing all 12 platform users with:
- Name, email, role, department
- Active/inactive status
- Out-of-office flag and delegate assignment
- Last login date

Administrators can:
- Assign or change user roles
- Set up out-of-office status with automatic delegation
- Activate or deactivate accounts

**Out-of-Office Management:**
When a user is marked as out of office, all their pending approvals and tasks are automatically delegated to their designated delegate. The platform tracks which items were delegated and generates notifications. Currently, Thomas Weber (delegated to Anna Muller) and Robert Fischer (delegated to Dr. Katrin Bauer) have active delegations.

### 14.7 System Health

A monitoring dashboard showing:
- **Integration Status:** Real-time status of all 4 external system connections (SAP Ariba, Coupa Risk, Sirion CLM, SAP S/4HANA)
- **Uptime Metrics:** Platform availability percentage
- **Error Log:** Recent system errors with severity, timestamp, and detail
- **Response Time:** Average response times for key operations

### 14.8 Audit Log

An immutable, chronological log of every significant action taken in the platform:

- **User actions:** Request created, approved, rejected, escalated, reassigned, commented
- **System actions:** Workflow transitions, SLA breach detected, notification sent
- **AI actions:** Classification made, compliance review generated, anomaly detected
- **Warning events:** SRA expiring, budget threshold exceeded, duplicate detected
- **Blocking events:** Compliance check failed, sanctions screening flagged

Each entry shows: timestamp, user/system identifier, action type (system/human/AI/warning/block), object type and ID, and detailed description.

Filters available: date range, user, action type, object type, severity.

---

## 15. Notifications

### 15.1 Notification Types

The platform generates 7 types of notifications:

| Type | Description | Example |
|---|---|---|
| Approval Request | A request requires the user's approval | "Approval required: Org design transformation — McKinsey engagement for EUR 1.85M requires VP-level approval." |
| Status Update | A request has moved to a new stage | "Request moved to contracting — REQ-2024-0013 (Microsoft 365 E5 upgrade) has moved to contracting stage." |
| SLA Warning | A request is approaching or has exceeded its SLA | "SLA breach: ERP integration middleware — REQ-2024-0006 has been in sourcing for 42 days, exceeding the 30-day SLA." |
| Escalation | A request has been escalated due to inaction or urgency | "Escalation: Java developers request overdue — REQ-2024-0007 approval has exceeded SLA by 19 days." |
| Comment | Someone has commented on a request the user is involved with | "New comment on AWS cloud migration — Elena Petrova commented: 'Final migration report attached.'" |
| System Alert | A system event requires attention | "Contract expiring: Siemens IoT Platform — CON-008 expires on 2025-02-28. Renewal action required within 30 days." |
| AI Insight | An AI agent has generated a notable finding | "AI: Potential duplicate request detected — REQ-2024-0022 has 78% similarity with an archived request from 2023." |

### 15.2 Notification Preferences

Users can configure notification preferences per channel:
- **In-App:** Notifications appear in the notification bell in the top navigation bar. Unread count is shown as a badge.
- **Email:** Notifications sent to the user's registered email address
- **Push:** Browser push notifications for urgent items

### 15.3 Quiet Hours & Digest

- **Quiet Hours:** Users can set hours during which non-urgent notifications are suppressed
- **Daily Digest:** Instead of individual notifications, users can opt to receive a single daily summary email

---

## 16. Data Model

### 16.1 Core Entities and Business Fields

**Procurement Request**
The central entity around which the platform operates.
- Request ID, title, description
- Category (Goods, Services, Software, Consulting, Contingent Labour, Contract Renewal, Supplier Onboarding, Catalogue)
- Status (Draft, Intake, Validation, Approval, Sourcing, Contracting, PO, Receipt, Invoice, Payment, Completed, Cancelled, Referred Back)
- Priority (Low, Medium, High, Urgent)
- Estimated value and currency
- Requestor, owner (assigned procurement handler)
- Supplier reference, contract reference, PO reference
- Buying channel (Procurement-Led, Business-Led, Direct PO, Framework Call-Off, Catalogue)
- Commodity code and label
- Cost centre, budget owner
- Business justification
- Delivery date, urgency flag
- Days in current stage, overdue indicator, refer-back count
- SLA deadline
- Created and updated timestamps

**User**
- User ID, name, email
- Role, department
- Initials, avatar
- Out-of-office flag, delegate reference

**Supplier**
- Supplier ID, company name
- Country, address, DUNS number
- Risk rating (Low, Medium, High, Critical)
- Active contracts count, 12-month total spend
- Onboarding status (Completed, In Progress, Not Started)
- SRA status (Valid, Expiring, Expired, Not Assessed), SRA expiry date
- Screening status (Clear, Flagged, Pending)
- Categories served, tier (1, 2, 3)
- Primary contact name and email
- Certifications (name, expiry date, status)
- Spend history (3 years)
- Performance score (0-100)

**Contract**
- Contract ID, title
- Supplier reference
- Total value, start date, end date
- Status (Draft, Under Review, Active, Expiring, Expired, Terminated)
- Owner, department, category
- Renewal date, utilisation percentage
- Linked request IDs

**Purchase Order**
- PO ID, supplier reference
- Total value, status (Draft, Submitted, Acknowledged, Received, Partially Received, Closed)
- Created date, delivery date
- Contract reference, request reference
- Line items (description, quantity, unit price, received quantity)

**Invoice**
- Invoice ID, supplier reference
- Amount, currency
- Status (Submitted, Under Review, Matched, Approved, Scheduled, Paid, Disputed)
- Invoice date, due date, paid date
- PO reference
- Match status (Matched, Partial Match, Unmatched, Variance)
- Match variance amount

**Stage History**
- Request reference, stage name
- Entered at, completed at
- Owner (handler at that stage)
- Action taken, notes

**Approval Entry**
- Approval ID, request reference
- Approver name, role
- Status (Pending, Approved, Rejected, Delegated)
- Requested at, responded at
- Comments, delegation target

**Comment**
- Comment ID, request reference
- Author name and initials
- Content, timestamp
- Internal/external visibility flag
- Attachments

**Compliance Report**
- Request reference, agent ID
- Decision (Approved, Needs Review, Rejected)
- Confidence score
- Summary, recommendation
- Individual checks (category, check name, status, detail, severity)

**Notification**
- Notification ID, type
- Title, description
- Timestamp, read status
- Action URL, related entity reference

**Routing Rule**
- Rule ID, name, status
- Conditions (field, operator, value)
- Action (buying channel, approval chain)
- Description, match count, category

**Form Template**
- Form ID, name, description
- Status, category, version
- Trigger stages, trigger conditions
- Fields (type, label, required, options, validation, pre-population)

**Workflow Template**
- Workflow ID, name, description, type
- Nodes (ID, type, label, position)
- Edges (source, target, label)

**AI Agent**
- Agent ID, name
- Type (Classification, Validation, Extraction, Recommendation, Knowledge Base, Anomaly Detection)
- Status (Active, Draft, Disabled)
- Accuracy percentage, decisions made count
- Description

**Service Description**
- Request reference
- 9 sections: Objective, Scope, Deliverables, Timeline, Resources, Acceptance Criteria, Pricing Model, Location, Dependencies
- Generated narrative summary

**System Integration**
- Integration ID, request reference
- External system name
- Status (Pending Handover, Submitted, Awaiting Response, Processing, Completed, Error, Timeout)
- Submitted at, responded at
- External reference ID
- Workflow stage, detail description

**Catalogue Item**
- Item ID, name, description
- Unit price, unit of measure
- Catalogue ID and name
- Supplier name and reference
- Lead time

### 16.2 Key Relationships

- A **Request** is created by a **User** (requestor) and assigned to a **User** (owner)
- A **Request** may reference a **Supplier**, a **Contract**, and a **Purchase Order**
- A **Request** has multiple **Stage History** entries, **Comments**, **Approval Entries**, and **Form Submissions**
- A **Request** may have one **Compliance Report** and one **Service Description**
- A **Request** may have multiple **System Integration** records
- A **Supplier** has multiple **Contracts** and multiple **Invoices**
- A **Contract** belongs to one **Supplier** and is linked to one or more **Requests**
- A **Purchase Order** belongs to one **Supplier**, may reference one **Contract**, and is linked to one **Request**
- An **Invoice** belongs to one **Supplier** and may reference one **Purchase Order**
- **Routing Rules** determine the buying channel and approval chain for **Requests**
- **Form Templates** are triggered at specific workflow stages for specific **Requests**
- **AI Agents** generate **Compliance Reports** and influence **Request** classification
- **Notifications** reference **Requests**, **Contracts**, **Suppliers**, or **Users**

---

## 17. Classification & Routing Rules

### 17.1 Procurement Categories

8 categories with detailed classification guidance:

#### Catalogue
Pre-approved items available for direct ordering. No sourcing or additional approval needed. Fast track 2-3 days.

**Examples:** Office supplies (paper, pens, toner, folders, sticky notes, binder clips, whiteboard markers, desk organizers), IT peripherals (keyboards, mice, headsets, webcams, cables, USB hubs, monitor arms), standard monitors under EUR 500, catering and pantry items (coffee, tea, water, cups, snack boxes), safety equipment (gloves, hard hats, vests, first aid kits, safety glasses), print and stationery (business cards, envelopes, letterheads), standard furniture under EUR 500, standard laptops when no custom configuration is needed.

**Threshold:** Individual items under EUR 500, total order under EUR 5,000.

**Not Catalogue:** Custom specifications, bulk orders above EUR 5K, items requiring IT configuration, bespoke furniture.

#### Goods
Physical products requiring a formal procurement process. Not available in catalogue or above catalogue thresholds.

**Examples:** Bulk laptop orders (more than 5 units or requiring custom configuration), servers, workstations, networking equipment, custom furniture (standing desks, ergonomic chairs in bulk, office fit-outs), industrial equipment (sensors, IoT devices, machinery, tools), vehicles, warehouse racking, specialised lab equipment.

**Threshold:** Items above EUR 500 per unit, requiring specification, custom configuration, or bulk orders.

**Buying Channel:** Under EUR 25K: business-led. EUR 25K-100K: procurement-led. Above EUR 100K: procurement-led with VP approval.

#### Services
Ongoing operational services delivered by external providers. Not one-off advisory work.

**Examples:** Facilities management (cleaning, maintenance, security, reception), catering services, travel management, fleet management, managed print services, document management, waste management, energy management, training and professional development programmes, logistics, warehousing, distribution.

**Not Services:** One-off advisory or strategy work (that is Consulting). Staff augmentation (that is Contingent Labour).

#### Software
Software licences, SaaS subscriptions, cloud services, and IT platforms.

**Examples:** SaaS platforms (Salesforce, SAP, ServiceNow, Databricks, Workday), cloud infrastructure (AWS, Azure, GCP), software licences (Microsoft 365, Adobe Creative Suite, Atlassian), development tools, databases, API platforms, middleware, cybersecurity tools, SIEM, monitoring platforms, data analytics and BI platforms.

**Not Software:** IT consulting or system implementation services (that is Consulting). Hardware (that is Goods).

#### Consulting
Professional advisory, strategy, and project-based intellectual services. The provider brings their own methodology and expertise.

**Examples:** Management consulting (strategy, transformation, operating model design), IT consulting (system implementation, architecture review, digital transformation), financial advisory (audit support, due diligence, tax advisory, transfer pricing), legal advisory (regulatory, compliance, M&A support), market research, benchmarking, ESG advisory.

**Not Consulting:** Ongoing managed services (that is Services). Staff working under company direction (that is Contingent Labour).

#### Contingent Labour
Temporary workers, contractors, or freelancers working under the company's direction and management.

**Examples:** IT contractors (developers, architects, testers, project managers), interim managers, administrative temps, reception cover, data entry, seasonal workers, event staff.

**Not Contingent Labour:** Consulting firms delivering a project with their own methodology (that is Consulting).

#### Contract Renewal
Extending or renewing an existing supplier contract that is expiring or has expired.

**Examples:** Renewing a supplier agreement, extending a contract term, renegotiating terms and pricing, annual renewal processes.

#### Supplier Onboarding
Registering and qualifying a new supplier or vendor that is not yet in the system.

**Examples:** Adding a new vendor to the approved supplier list, first-time onboarding, registering a new service provider.

### 17.2 Buying Channel Determination Logic

The system determines the buying channel based on three factors: category, value, and supplier context:

| Condition | Buying Channel |
|---|---|
| Category is Catalogue AND value < EUR 5,000 | Catalogue |
| Goods with commodity code starting with 432 AND value < EUR 25K | Catalogue |
| Services with facilities commodity code AND value < EUR 10K | Direct PO |
| Contract renewal AND value < EUR 50K | Business-Led |
| Contingent Labour with framework supplier (Randstad/Hays) | Framework Call-Off |
| Goods AND value EUR 5K-25K | Business-Led |
| Category is Consulting (any value) | Procurement-Led |
| Software AND value > EUR 100K | Procurement-Led |
| Any category AND value > EUR 100K | Procurement-Led |
| Any category AND value > EUR 1M | Procurement-Led + CPO sign-off |
| Priority = Urgent | Procurement-Led (fast-track approval chain) |

### 17.3 Threshold Rules

| Threshold | Approval Requirement |
|---|---|
| Under EUR 5,000 | Line manager only (or no approval for catalogue) |
| EUR 5,000 - EUR 25,000 | Line Manager + Category Manager |
| EUR 25,000 - EUR 100,000 | Category Manager + Finance |
| EUR 100,000 - EUR 500,000 | Category Manager + Finance + VP Procurement |
| EUR 500,000 - EUR 1,000,000 | Category Manager + Finance + VP Procurement (dual VP for consulting) |
| Above EUR 1,000,000 | Category Manager + Finance + VP Procurement + CPO |

---

## 18. Appendix: Mock Data Summary

### 18.1 Entity Record Counts

| Entity | Record Count | Notes |
|---|---|---|
| Procurement Requests | 35 | 5 completed, 30 in various active stages |
| Users | 12 | 2 currently out of office with active delegation |
| Suppliers | 23 | 19 fully onboarded, 2 in progress, 2 not started |
| Contracts | 18 | 9 active, 3 expiring, 1 expired, 2 under review, 2 draft, 1 terminated |
| Purchase Orders | 13 | 4 closed, 2 received, 2 partially received, 1 acknowledged, 1 submitted, 3 draft |
| Invoices | 14 | 5 paid, 2 approved, 2 under review, 2 submitted, 1 matched, 1 scheduled, 1 disputed |
| Catalogue Items | 37 | Across 6 sub-catalogues |
| Routing Rules | 12 | 10 active, 1 draft, 1 disabled |
| Form Templates | 8 | All active, across 4 categories |
| Workflow Templates | 4 | Standard, Catalogue, Onboarding, Renewal |
| AI Agents | 6 | 5 active, 1 in draft/pilot |
| AI Response Patterns | 62 | Across intake, chat, approval, supplier, and general contexts |
| Notifications | 25 | 7 types represented |
| Compliance Reports | 10 | 6 approved, 2 needs-review, 1 rejected, 1 additional |
| Service Descriptions | 5 | Detailed 9-section SOWs |
| System Integrations | 15 | Across 4 external systems |
| Approval Entries | 30 | Various statuses |
| Stage History Entries | ~100 | Tracking all stage transitions |
| Workflow Step Details | 61 | Detailed step-level data |
| Form Submissions | 15 | Completed forms linked to requests |
| Comments | 60 | Internal and external |
| KPI Data Points | 12 | Monthly data for January-December 2024 |

### 18.2 Supplier Distribution

| Attribute | Breakdown |
|---|---|
| By Country | Germany (5), United States (6), United Kingdom (4), France (2), Netherlands (2), Ireland (1), India (1) |
| By Tier | Tier 1: 10 suppliers, Tier 2: 7 suppliers, Tier 3: 6 suppliers |
| By Risk Rating | Low: 17, Medium: 4, High: 2, Critical: 0 |
| By Onboarding Status | Completed: 19, In Progress: 2, Not Started: 2 |
| By SRA Status | Valid: 17, Expiring: 2, Expired: 0, Not Assessed: 4 |

### 18.3 Request Distribution

| Attribute | Breakdown |
|---|---|
| By Status | Completed: 5, Payment: 1, Receipt: 2, Invoice: 1, PO: 3, Contracting: 4, Sourcing: 3, Approval: 5, Validation: 4, Intake: 2, Draft: 1, Cancelled: 2, Referred Back: 2 |
| By Category | Software: 7, Consulting: 8, Services: 5, Goods: 5, Contingent Labour: 4, Contract Renewal: 3, Supplier Onboarding: 2, Catalogue: 1 |
| By Priority | Low: 5, Medium: 12, High: 12, Urgent: 6 |
| By Buying Channel | Procurement-Led: 18, Framework Call-Off: 6, Business-Led: 5, Direct PO: 3, Catalogue: 3 |

---

*End of Functional Specification*
