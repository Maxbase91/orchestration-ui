# Procurement Orchestration Platform — Functional Specification

**Version:** 1.1
**Date:** 26 September 2026
**Status:** Approved
**Classification:** Business-Facing — No Technical Implementation Detail

> **What this document is:** the detailed reference for what each part of the platform does for
> the people who use it. Why the platform exists and what Release 1 includes is the
> [PRD](../PRD.md); how it is built is [ARCHITECTURE.md](../ARCHITECTURE.md); the requirement
> numbers are in [requirements/](requirements/). It describes only what the platform does today —
> anything planned says so.

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
- **Manual classification and routing:** Category assignment and approval routing are error-prone and slow. The platform reads the demand with AI, and configured rules decide the buying channel and the approvers.
- **Compliance gaps:** Policy checks, risk assessments, and approval thresholds are often missed. The platform enforces them systematically at every stage.
- **Lack of visibility:** Stakeholders cannot see where their request is or why it is stuck. The platform provides real-time tracking, bottleneck detection, and SLA monitoring.
- **Disconnected systems:** Procurement, sourcing, contracting, and finance tools operate in silos. The platform holds the records in one place, and reads each one through a connector layer that live connections to those systems will replace (Release 2).
- **Slow cycle times:** Manual handoffs between stages cause delays. The platform moves each request through its channel's stages, tracks each stage against its deadline, and shows what is overdue and where work is stuck.

### 1.4 Key Capabilities

- **One front door.** A Home box that answers status and policy questions in place and starts a request for anything to buy (§3.1); a New request conversation that reads the demand, checks the catalogue and existing contracts first, decides the buying channel and asks only what that channel needs (§4.2); and a catalogue with a basket (§4.5)
- **Workflow orchestration.** Each buying channel's lifecycle is a configurable workflow — stages, owners, deadlines in working days, gates and branches — and every request moves through the stages its channel runs (§5)
- **Compliance by rule.** Policy checks, materiality and risk, approval to source and the approvers are decided by configured rules against governed thresholds, and recorded as the request's compliance record; a check that did not run is reported as not run (§6)
- **Supplier lifecycle.** A directory and profile, onboarding with gates, risk assessments, and a supplier portal for sourcing responses and invoices (§7)
- **Sourcing, contracts, purchasing and payment.** Sourcing events raised from a request, scored and awarded back to it (§8); a contract register with renewals (§9); internal purchase orders, goods receipt, invoices worked through review, match and approval, and payment tracking — nothing is sent to a supplier, an ERP or a bank (§10)
- **Analytics** — dashboards, and a home dashboard per role (§3.2, §11)
- **An assistant** that takes the same route as the Home box, answers from the knowledge base and the records a person may see, acts only on confirmation, and hands over to support (§3.5, §18)
- **Configuration, not code.** The thresholds, rules, approval chains, workflows, forms, categories and agents are changed in Admin, without a release (§14)

---

## 2. User Roles & Permissions

### 2.1 Role Definitions

#### Requestor / End User (Service Owner)

The business user who needs to procure something. They describe what they need, order from the catalogue, track their requests, answer questions from the procurement team, and decide the approvals assigned to them. Their sidebar shows their own requests.

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

The system administrator who configures the platform (§14): the thresholds, categories, routing rules, approval chains, workflows, forms, the service description, the knowledge base, AI agents, reference data and users, with System Health and the Audit Log. They also see the operational screens — requests, approvals, workflows, sourcing, suppliers, contracts, purchasing and analytics — but do not buy: New Request and the Catalogue are not in their sidebar.

**Typical users:** Procurement system administrators, IT admins supporting procurement.

### 2.2 What each role is shown

The sidebar each role is shown ([navigation](../../src/config/navigation.ts)):

| Area | Requester | Procurement Manager | Vendor Manager | Operations Lead | Admin | Supplier |
|---|---|---|---|---|---|---|
| Home | ✓ | ✓ | ✓ | ✓ | ✓ | Portal (§7.6) |
| Buy something — New Request, Catalogue | ✓ | ✓ | – | – | – | – |
| My Requests | ✓ | ✓ | ✓ | ✓ | – | – |
| All Requests | – | ✓ | ✓ | ✓ | ✓ | – |
| My Approvals, Delegation, My Tasks | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Team Tasks | – | ✓ | – | ✓ | – | – |
| Orchestration — Workflows (Active, Monitor, Bottlenecks & Alerts), Pipeline (Demand, Sourcing) | – | ✓ | – | ✓ | ✓ | – |
| Sourcing — Active Events, New Event, Templates, Evaluation Centre | – | ✓ | ✓ | – | ✓ | – |
| Suppliers — Directory, Onboarding Pipeline, Risk & Compliance, Supplier Portal Admin, Messages | – | ✓ | ✓ | ✓ | ✓ | – |
| Contracts — Active, Renewals & Expiries, Templates | – | ✓ | – | ✓ | ✓ | – |
| Purchasing — Open POs, Goods Receipt, Invoice Queue, Three-Way Match, Payment Tracker | – | ✓ | – | ✓ | ✓ | – |
| Analytics — the four dashboards, Report Builder, Scheduled Reports, Exports | – | ✓ | – | ✓ | ✓ | – |
| Admin (§14) | – | – | – | – | ✓ | – |
| Help — AI Assistant, Knowledge Base, Contact Support | ✓ | ✓ | ✓ | ✓ | ✓ | Assistant only |
| Help — Ticket Inbox | – | ✓ | – | ✓ | ✓ | – |

**Access in Release 1.** The role is chosen with a role switcher — a simulation for
demonstrations and acceptance testing, not an access boundary: there is no authentication yet
([ADR-0003](../adr/0003-private-neon-database-migration.md)). The pages behind the sidebar are
guarded by broader role groups — every internal role, for example, can open New Request from the
Home box or a quick action — and only the personal lists are filtered to the person: My
Requests, My Approvals, My Tasks. An internal role that reaches any other list sees all of its
records. A supplier is always sent to the portal.

---

## 3. Home Page & Navigation

### 3.1 The Home box

The home page opens with one box — **What do you need?** — for anything a person has in mind:
something to buy, a policy question, or where a request is, asked in their own words. Example
questions sit beneath it.

What is typed takes the platform's one **question route**, the same one the assistant takes
(§3.5), in this order:

1. **A status question** — a record named by its id ("where is REQ-2026-0012?") or the person's
   own items ("what's waiting for me?", "where are my requests?"). It is answered in place, from
   the Status Answers agent's configuration (§12.1): only the details that agent may state, and
   only the records the person's role may ask about.
2. **A catalogue item** — when the demand's category is one the catalogue may serve and catalogue
   items are named in it. Up to three items are shown with their price, unit, supplier and lead
   time, each with **Order this**, which puts it into the basket on the Catalogue page (§4.5). The
   box says that an order up to the catalogue auto-approval threshold becomes a purchase order
   straight away, and offers *Not what you need? Describe it in full* and *Browse the whole
   catalogue*.
3. **A policy question** — phrased as a question ("do I need three quotes for a €40,000 order?").
   It is answered in place: the direct answer the configuration gives, and the knowledge-base
   article that states the rule, its figures taken from the live configuration. *This is
   something I need to buy* takes the words to New request instead.
4. **Something to buy** — a stated wish to buy, order, hire or engage, or a phrase naming
   something the configured categories recognise ("cleaning services for the Berlin office"). The
   box says it will check the catalogue and existing contracts first and then ask only what is
   still needed; **Start the request** opens New request with the words as the first message.
   Nothing is created until the request is submitted.
5. **Anything else** opens the assistant with the words.

Every outcome is shown first as an **Understood as** card — *Something to buy*, *A catalogue
item*, *A policy question* or *A status question* — so the person sees how their words were read
before anything opens. A status or policy answer offers *Ask a follow-up*, which continues in the
assistant.

### 3.2 Customisable Dashboard

Below the Home box (§3.1) each internal role has a dashboard. A requester and a procurement
manager also see *Know exactly what you want?* beside the box, which opens the Catalogue.

**The attention band** sits above the widgets and cannot be moved or removed: the approvals
waiting on the person, their overdue items and the requests referred back to them. It appears
only when there is something in it — and never disappears because a read failed.

**The widgets.** With **Customise**, a person adds widgets from the library, drags them into
order, removes them, and chooses their quick actions; the layout is kept per role. The widgets:

| Widget | What it shows | Available to |
|---|---|---|
| My Active Requests | The person's open requests and where each is | All internal roles |
| Requests by Stage | How many requests sit in each active stage, each a click through | All internal roles |
| Attention Required | Overdue and referred-back items | All internal roles |
| Pipeline Insights | Counts derived from the live requests and suppliers — rules, not a model | All internal roles |
| Recent Activity | The latest events | All internal roles |
| Expiring Contracts | Contracts in their renewal window, soonest first | All internal roles |
| Mentions | Comments where someone @-mentioned the person, unread first | All internal roles |
| Monthly Summary | Requests submitted, approved and completed this month — *approved* and *completed* read from each request's current stage | All internal roles |
| AI Assistant | Opens the assistant | All internal roles |
| Open pipeline | Requests in an active intake or procurement stage | Procurement Manager, Operations Lead, Admin |
| Active Sourcing | Live sourcing events | Procurement Manager, Operations Lead, Admin |
| Avg Cycle Time | Average processing time of completed requests | Procurement Manager, Operations Lead, Admin |
| Compliance rate | The first-time-right rate of the latest month with completed requests | Procurement Manager, Operations Lead, Admin |
| Demand Pipeline | Requests by workflow stage | Procurement Manager, Operations Lead, Admin |
| Open Purchase Orders | POs awaiting delivery or closure, overdue first | Procurement Manager, Operations Lead, Admin |
| Invoice Exceptions | Disputed, unmatched or overdue invoices needing a decision | Procurement Manager, Operations Lead, Admin |
| Workflow Health | Active workflows, how many are stuck, average processing days | Procurement Manager, Operations Lead, Admin |
| Suppliers Blocking Work | Suppliers whose onboarding or screening is incomplete, each gating sourcing, contracting or a PO | Procurement Manager, Vendor Manager, Operations Lead, Admin |
| Supplier Risk Alerts | Suppliers with elevated risk ratings | Procurement Manager, Vendor Manager, Admin |
| Validation Queue | Requests awaiting validation | Procurement Manager, Vendor Manager |
| Team Workload | Requests per team member | Procurement Manager, Operations Lead |
| SLA Tracker | Requests approaching or past their stage deadline | Procurement Manager, Operations Lead |
| System Health | People with open work, requests raised, and whether the data store responds | Admin |

**Default layouts by role:**

- **Requester:** My Active Requests, Requests by Stage, Monthly Summary, Expiring Contracts, Pipeline Insights
- **Procurement Manager:** Attention Required, Open pipeline, Avg Cycle Time, Compliance rate, Open Purchase Orders, Invoice Exceptions, Demand Pipeline, Pipeline Insights
- **Vendor Manager:** Validation Queue, Suppliers Blocking Work, Monthly Summary, Mentions, Supplier Risk Alerts, Recent Activity, Pipeline Insights
- **Operations Lead:** Workflow Health, SLA Tracker, Attention Required, Open Purchase Orders, Mentions, Pipeline Insights, Recent Activity
- **Admin:** System Health, Monthly Summary, Workflow Health, Suppliers Blocking Work, Invoice Exceptions, Supplier Risk Alerts, Pipeline Insights

### 3.3 Quick Actions

A row of quick-action buttons sits above the widgets, tailored to the role:

- **Requester:** New Request, Track a Request, My Approvals, Ask AI Assistant, Browse Catalogue
- **Procurement Manager:** New Request, All Requests, Active Workflows, Supplier Directory, Spend Overview, Bottlenecks
- **Vendor Manager:** All Requests, Risk & Compliance, Supplier Directory, Messages, My Approvals
- **Operations Lead:** Active Workflows, Bottlenecks, All Requests, My Tasks
- **Admin:** Routing Rules, Workflow Designer, User Management, Spend Overview

Under **Customise**, a person chooses which of the actions available to their role appear.

### 3.4 Navigation Structure

The left sidebar's groups, each item shown to the roles in §2.2:

1. **Home**
2. **Buy something** — New Request, Catalogue
3. **Work** — Requests (My, All), Approvals (My Approvals, Delegation), Tasks (My, Team)
4. **Orchestration** — Workflows (Active, Monitor, Bottlenecks & Alerts), Pipeline (Demand, Sourcing)
5. **Sourcing** — Events (Active, New Event, Templates, Evaluation Centre)
6. **Suppliers** — Directory (All Suppliers, Onboarding Pipeline, Risk & Compliance, Supplier Portal Admin, Messages)
7. **Contracts** — Contract Register (Active Contracts, Renewals & Expiries, Templates)
8. **Purchasing** — Purchase Orders (Open POs, Goods Receipt), Invoices (Invoice Queue, Three-Way Match, Payment Tracker)
9. **Analytics** — Dashboards (Spend Overview, Compliance KPIs, Pipeline & Cycle Time, Supplier Performance), Reports (Report Builder, Scheduled Reports, Exports)
10. **Admin** — Database, Categories, Cost Centres, Delivery Locations, Support SLAs, Routing Rules, Decisioning Thresholds, Service Description, Form Builder, Approval Chains, Workflow Designer, AI Agent Configuration, KB Management, AI Analytics, User Management, System Health, Audit Log
11. **Help** — AI Assistant, Knowledge Base, Contact Support, Ticket Inbox

### 3.5 AI Assistant

The assistant is a chat panel, opened from a button present on every screen or from Help → AI
Assistant. Each person's conversations are kept, titled from their first question.

- **It takes the same route as the Home box** (§3.1). A first message that is a status, catalogue,
  policy or buying question gets the same answer, and the same next step, as it would on Home. A
  later message counts as something to buy only when it says it wants something — "and for
  consulting?" asks about consulting, it does not order it.
- **It answers the rest with the language model**, which must answer through its tools: the
  knowledge base (figures taken from the live configuration), the records the person's role may
  see, and lists of them. It cites where an answer came from, and says so plainly when it cannot
  ground one.
- **It proposes and acts only on confirmation.** A change — marking yourself out of office,
  setting a delegate, reassigning a request, asking for a risk reassessment, a contract renewal, a
  PO change or a payment escalation — is shown as a confirmation card first. Confirmed, it is
  written together with an audit entry, or the assistant says plainly why it cannot be done here
  (adding a watcher; substituting an approver, where Delegate on the approval card is the way).
  It never writes to an upstream system.
- **It starts a request** by taking a buying need to New request with the person's words; nothing
  is created until the requester submits.
- **It hands over to a person**: asking for a human raises a support ticket carrying the whole
  conversation, which the support team works in the Ticket Inbox (§18).

---

## 4. Request Intake & Management

### 4.1 Starting a request

A request starts on **New request** (§4.2). The Home box (§3.1), the assistant (§3.5) and *Start
renewal* on a contract all arrive there the same way — with the words as the conversation's first
message — and the conversation reads and classifies them itself: a category is never carried in
from a link. A catalogue item is ordered on the Catalogue page instead (§4.5), with no request.

### 4.2 New Request — the conversation, then the Channel page

One page for every demand (the Intake Prototype's Door 1, since 26 September
2026), organised around one rule: **every question is asked before any
conclusion is shown**. Requirement-level detail, with the FR numbers, is in
`docs/specs/requirements/01-intake-new-request.md`; the module's own README
(`src/features/requests/README.md`) says which code decides what.

The conversation runs in three phases, in one transcript with one reply box:

1. **What you need.** The requester says what they need in their own words,
   pastes a brief or attaches a PDF/DOCX (or arrives from Home with their words
   already typed). The assistant reads it back — "That sounds like *category* —
   *code*. Is that right?" — with the other likely codes, "None of these codes",
   and "describe it again". There is no category to pick: Goods/Services is
   internal routing metadata.
2. **How it is bought.** The catalogue and the contracts are checked first, and
   both results are reported in one turn. Then the way to buy is offered, headed
   in the channel's own words (its workflow template's, edited in Admin →
   Workflows): a catalogue item — naming the words it matched on — which is
   ordered on the Catalogue page; a contract to call off, with its supplier, end
   date, ceiling left and the direct call-off limit; or, when nothing covers the
   demand, a new request, on its own. If one detail would settle which contract
   covers it, the assistant asks for that detail.
3. **What it needs.** A call-off's details — value, dates, who it is for, the
   purpose, where it goes, what it is charged to — are filled from the words and
   the profile first, and the rest asked one at a time. A new request's service
   description is asked next (see §4.3), then the supplier (the category's
   preferred suppliers named, "go to market" an explicit answer, a supplier off
   the list asked why), then the one or two risk questions the supplier and the
   description decide, as Yes/No. A section the demand's signals make
   mandatory (Admin → Service Description, §14.11) is asked for too, and its
   answer is required; the question says why.

**Known defect:** naming a supplier the directory does not hold adds it to the
directory at once, as a prospective supplier (§7.1) — before submit, although
the Home box and the conversation say nothing is created until then.

Beside the conversation, **Your request** fills in as it goes: every value with
where it came from (from you · derived · drafted — check it · still to come),
the inputs edited in place, and "N of M known" counting what the route needs —
its required sections the same set the Channel page counts.
It reaches M of M exactly when **Buying channel confirmed** appears — which it
does only when submit would accept the request, the conversation having named
anything still missing (a need-by date, a cost centre) and where to add it.

**The Channel page** then shows how it will be bought: the channel's headline
and sentence, every stage of its template in order with *You are here / Applies
/ If … / Skipped* and why, what the requester does at each stage, what is being
submitted, who sourcing will invite, and the checks — why this channel, risk,
the approvers submit will write — with the workings and an Export one click
down. Save as draft and Submit are there; Back to the conversation returns to it
as it was left. Submitting creates the request atomically and enters it in the
first stage that needs action; the confirmation shows what happens next.

### 4.3 AI-Guided Service Description

A new request's service description is asked in the conversation. The assistant:

1. **Asks questions one at a time** in natural language, adapting based on previous answers — the engine chooses which question is next and when the description is complete; the model only phrases the question in the requester's own terms.
2. **Extracts structured data** from conversational responses. For example, if the user says "We need this done by end of Q2 and the budget is around 450K", the system extracts the delivery date and value.
3. **Carries forward what it already knows** — a value, a supplier or a date named earlier is never asked again.
4. **Pushes back once** on an answer that does not answer the question, offering a drafted answer where it can ground one in what was said, and **gives up** on a date or a budget after two unreadable answers rather than asking forever.

The AI provides category-specific examples and prompts. For a consulting request, it might ask: "What is the primary objective of this engagement?", with an example beneath it. The description is written up automatically once it is captured — there is no "Generate" button — and each section can be edited in place on the right.

### 4.4 Service Description (Statement of Work)

A new request's service description is written up from the conversation (§4.3). Its sections,
which of them are asked, the questions and the prompt that writes them are configured in Admin →
Service Description (§14), per category, with a default for categories without their own. The
default has ten sections — **Objective**, **Scope**, **Exclusions**, **Deliverables**,
**Timeline**, **Resources**, **Acceptance Criteria**, **Pricing Model**, **Location** (written up,
not asked) and **Dependencies** — plus a **narrative summary** that reads them as prose.

The request detail page shows the sections and the narrative, with **Copy Summary**. A sourcing
event raised from the request starts from the sections the template nominates (§8.1).

### 4.5 Catalogue — Door 2

`/catalogue` is where catalogue items are ordered, with no request form. Everything on it is
stored data or configuration:

- **The catalogues** are the ones the items belong to, each with its item count; a search spans
  them all. Each item shows its name, description, price and unit, supplier, the agreement it is
  bought under, and its lead time. Items, prices and catalogues are maintained in Admin →
  Database (§14).
- **The basket** belongs to the person and shows the total, **deliver to** and **charged to**
  (the person's profile first, from the configured delivery locations and cost centres), and asks
  what the order is for. It says what will happen before anything is placed, from the same
  decision the server makes.
- **Placing it.** A basket is placed as **one order per supplier and contract**, each a request,
  a purchase requisition and — when allowed — an internal purchase order, written together: all
  of the orders or none. **Approval is judged on the basket total**, so splitting a basket cannot
  keep it under a threshold ([ADR-0009](../adr/0009-catalogue-basket.md)):
  - up to the **catalogue auto-approval threshold** (a Decisioning threshold), an order is
    approved and its purchase order raised at once;
  - above it, the order waits for approval by the approvers its approval chain names;
  - a supplier risk assessment that has lapsed sends the order to risk review, at any value.
- **Refused**, with the reason: an item with no supplier risk assessment behind it, a supplier
  flagged in screening, an agreement that is no longer active or has no capacity left, an
  inactive delivery location or cost centre, or no purpose.

Everything else that offers a catalogue item — the Home box, the assistant, an item's own page,
and New request's catalogue check — puts it into this basket. No upstream purchasing system is
written.

### 4.6 Request Detail Page

Each request has one page: a header with its title, id, status and actions; the **lifecycle
stepper** — every stage its buying channel runs, the current one highlighted, completed ones
checked, the ones its channel skips shown as skipped — where clicking a stage opens it on the
Workflow tab; and seven tabs.

- **Overview** — the facts, grouped as a reader asks about them: *what* (category, commodity or
  service family, value, buying channel, sourcing type), *who* (requester, who it is bought for,
  current owner, budget owner, cost centre), the *supplier*, and *when* (needed by, days in the
  current stage, created, last updated); then the service description's sections and narrative
  summary with **Copy Summary**, or the business justification when there is none.
- **Compliance** — the one place for every risk and policy signal about the request: the
  determination made at submission (inherent risk, materiality, screening, demand disposition,
  sourcing type, whether a risk assessment is required), the intake policy checks and risk flags,
  risk assessments reused, the supplier's own risk assessment, and — for a catalogue order or a
  call-off — the contract it was called off against and the evidence of the match (§6).
- **Workflow** — the workflow template the request runs on, each stage as a card with its owner,
  deadline and state, the forms it collects (§6.4) and its comments; *What is open* with its
  deadline; and the timeline of recorded hand-overs to upstream systems (§13). The stage actions
  are in the page header (§5.3).
- **Approvals** — each approval with approver, role, status and dates, and how many are complete.
  The current approver can approve, reject with a reason, or ask for more information; approvals
  are decided in order.
- **Documents** — the documents each workflow stage recorded as added, in one list. Download is
  not available yet: there is no document store behind it.
- **Activity** — comments (with @mentions), stage events, audit entries and notifications in one
  timeline, newest first, filtered by kind or to *My actions*.
- **Related** — the linked contract and purchase order, sourcing events raised from the request,
  and the suppliers invited to source it, each opening its own page.

---

## 5. Workflow Orchestration

Each request runs the workflow template that claims its buying channel (§14.3). A request
submitted from New request enters the first stage of that channel that needs action — past Intake
and Vendor Onboarding, and past Risk Assessment unless the intake found an assessment is needed
(§6.1). Each stage has an owner role and a deadline in working days, set when the stage opens.
*Days in stage* counts calendar days since the stage opened.

### 5.1 Active Workflows

Three views of the requests in Intake, Validation, Approval, Sourcing, Contracting, Purchase Order,
Goods Receipt, Invoice and Payment. Requests in Risk Assessment or Vendor Onboarding appear in none
of them, and not on the Monitor (§5.2).

- **Kanban** — a column per stage, with its count and total value. A card shows the id, a priority
  icon, the title, the requester, the value, the owner's initials, days in stage and any open
  hand-over to an upstream system (§13). Its border is red when the stage is overdue and amber
  at four or more days in stage (fixed in code). The board shows where each request is and moves
  nothing: a card opens the request, where its stage action moves it on (§5.3).
- **Table** — id, title, requester, category, value, stage, owner, open hand-over, days in stage
  (amber above five, red above ten), SLA status (*Overdue*; *At Risk* at four or more days in
  stage; *On Track*), priority and buying channel. It is searchable and sorts by one column at a
  time; a row opens the request.
- **Timeline** — a bar per request across the nine stages: the current stage sized by its days in
  stage, later stages grey. Completed stages are drawn at a fixed three days each, not their real
  duration, so their width and colour say nothing about how long they took.

**Filters, across the three views:** *Stuck > 5 days* (despite its label, past the stage
deadline), *Awaiting my action* (the person owns the request), *High value* (€500,000 or more,
fixed in code) and *Escalated* (overdue and marked urgent — not the escalations raised in §5.3);
and dropdowns for category (a fixed list in code: Goods, Services, Software, Consulting,
Contingent Labour), priority and stage.

The board is view-only since 2026-09-26. A card dropped on another column used to move the request
there, checking no role and no gate — past approvals, blocking forms (§6.4) and the onboarding
gates — and the server now refuses any move but the request page's own (§5.3).

### 5.2 Workflow Monitor & Bottlenecks

The Monitor reads the requests in the nine stages above:

- **Top bottleneck** — the stage whose requests have the highest average days in stage. Its
  "SLA target: 5 days" is fixed text, not that stage's deadline.
- **Average days per stage** — a bar per stage, red when the average passes that stage's deadline
  (§14.3). The dashed line marks the Approval stage's deadline only.
- **Stuck requests** — every request past its stage deadline, most overdue first, with its stage,
  owner, deadline in days, days overdue and last activity. **Known defect:** the *Days in Stage*
  column repeats the days overdue.
- **Bottleneck Analysis** — the three stages, of all those the templates use, with the highest
  average days in stage, and how many of their requests are past the deadline. A calculation, not
  a model.
- **SLA Tracker** — each request with a stage deadline, overdue first, plus up to five without one
  that have four or more days in stage. The countdown is green, amber with three days or fewer
  left (fixed in code) and red once overdue.

**Heatmap — a demonstration.** Requests per stage over eight weeks: only the current week is
real; the seven earlier weeks are random numbers drawn around it on every load.

**Bottlenecks & Alerts** repeats the chart, the analysis and the stuck-requests table. **A
demonstration:** its *Escalation Management* list is four sample escalations fixed in code, not
the escalations people raise (§5.3), and the stuck table's Send Reminder, Escalate and Reassign
buttons do nothing.

### 5.3 Workflow Actions

A request's actions are in its page header (§4.6); a completed or cancelled request has none.

**Moving a stage on.** A gated stage has one action for its owner:

| Stage | Action | Who |
|---|---|---|
| Validation | Complete validation | The category's managers (§14.10), or an administrator |
| Risk Assessment | Record risk decision | Vendor managers, administrators — once the supplier record exists and has cleared screening; the assessment itself is not checked |
| Vendor Onboarding | Complete vendor onboarding | Vendor managers, procurement managers, administrators |
| Contracting | Contract signed | Procurement managers, administrators |
| Goods Receipt | Goods received | Operations leads, procurement managers, administrators |
| Invoice, Payment | Invoice matched, Payment released | Operations leads, administrators |

While a blocking form for the stage is outstanding the action is disabled and names the form;
administrators are exempt. A named supplier must exist and have cleared screening before the
request can enter Sourcing. Procurement managers and administrators can **Create sourcing event**
at Sourcing (or open the one raised), which the request leaves when the event is awarded (§8), and
**Create PO** at Purchase Order — it needs a supplier and a delivery date — which the request
leaves when a full goods receipt is recorded (§10).

**Approvals.** *Approve* and *Reject* appear to whoever may act on the earliest open approval step:
their own, one delegated to them, or one open to a role they hold. An approval records who decided
and when; the request moves on only when the last one is in. On the Approvals tab and in My
Approvals (§4.6), a rejection needs a reason and sends the request back to Intake, and an approver
can ask for more information instead; My Approvals also offers *Delegate*.

**Known defect:** the header's *Reject* asks for no reason. It marks the approval rejected; with a
workflow instance the template's *Rejected* branch sends the request to Referred Back, and without
one the request does not move. Only *Cancel request* sets a request to *Cancelled*.

**More:**

- **Refer back** — to a stage the request's channel runs before where it is now: Intake,
  Validation, Approval, Sourcing or Contracting. Never Risk Assessment or Vendor Onboarding, which
  the workflow enters itself when intake or the award calls for them. With a coded reason
  (incomplete information, incorrect category, classification mismatch, risk assessment required,
  other) and optional text; the refer-back count goes up. When there is no earlier stage the dialog
  says so. Procurement managers, vendor managers, operations leads, administrators, and the
  requester on their own request. (Fixed 2026-09-26: the list was the same five stages whatever
  the channel, so "refer back" could send a request forward or into a stage its channel skips.)
- **Reassign** — a new owner and a required reason; the stage is kept. Procurement managers,
  operations leads, administrators.
- **Escalate** — a level (Team Lead, Department Head, VP), an optional urgency and a required
  reason. It adds an *escalated* event to the stage and a notification to the shared feed (§15.1),
  so no one in particular is told; *Critical* also marks the request urgent. Same roles as
  Reassign.
- **Cancel request** — asks why, and the reason goes into the request's history; same roles as
  Refer back. The request stops, on the server and in one step: the approvals still waiting are
  **withdrawn** (not rejected — nobody rejected them — and gone from every queue), its workflow
  ends so nothing moves it on, and it has no deadline. A cancelled or completed request cannot be
  moved to another stage by anything (fixed 2026-09-26: Cancel used to move the request on to its
  next stage, or do nothing, while saying it was cancelled).

The server makes these three moves — refer back, reassign and cancel — and refuses any other it is
asked for, so a stage is left only through the stage's own action, an approval or an award.

**What is recorded.** Stage changes, reassignments and escalations are written to the request's
stage history — when, the stage, its owner, the action and any reason — and shown on the Activity
tab. The history names the stage's owner, not who acted (for an escalation, the owner recorded is
the person escalating). An approval records who decided; decisions taken on the Approvals tab or
in My Approvals also write an audit entry.

**Known defect:** on a request with no workflow instance, a stage entered through the stage
action, an approval or an award gets no deadline, and the person who acted becomes its owner. A
full goods receipt moves a request on without resetting its deadline, so it keeps the Purchase
Order stage's.

### 5.4 Clickable Step Details

The Workflow tab (§4.6) shows each stage of the request's channel as a card — *Completed*, *In
Progress*, *Blocked* (the current stage once overdue), *Pending* or *Skipped*; pending and skipped
cards do not open. A card shows the stage's owner and role, its days and dates, and the last
action or note. Opened, it adds:

- a marker for a refer-back, an escalation or a request for information, with who, when and why;
- on Validation, Risk Assessment, Approval, Sourcing and Contracting, the service description's
  narrative, its quality score and any required sections still empty;
- the stage's forms (§6.4) — filled in on the current stage, read-only once submitted;
- the stage's comments, with a box to add one on the current stage only.

Beside the cards, **What is open** gives the action the stage waits for and its exit criteria, the
owner (or the role, when nobody is assigned), the days held and the deadline: *On track*, *Due
soon* (within 24 hours, fixed in code), *Overdue* or *No SLA set*. Documents are on the Documents
tab, not the stage card.

A stage's department, decision, upstream-system reference and SLA verdict appear only where a
stored step-detail record exists; nothing in the platform writes those records, so only sample
requests show them.

---

## 6. Compliance & Risk

### 6.1 Intake Compliance Checks

During the New request conversation (§4.2) the platform works out a **determination** from the
demand, the chosen supplier, the contracts and the configuration. The Channel page shows it before
submit; submit stores it on the request and as the request's compliance record, both shown on the
Compliance tab (§4.6).

**Submit decides again.** The server works the determination out once more when the requester
submits, from what is stored at that moment — the supplier, its contracts, its reusable risk
assessments, the routing rules, the approval chains and the thresholds in force — and compares it
with what the Channel page showed. When anything the page showed differs — the channel, the
approval chain, sourcing type, a risk or materiality tier, whether a risk assessment is needed,
screening, the disposition, the SRA outcome, a policy check's result, the assessments that can be
reused, vendor onboarding or the risk questions asked — nothing is created. The page stays open,
says what changed ("A risk assessment is now required", "The buying channel is now …"), and shows
the new answer; the requester reviews it and submits again. Otherwise the request and its compliance
record carry the server's determination (fixed 2026-09-26: submit stored what the browser sent, so a
page left open while a supplier's screening or a threshold changed decided the record).

**Buying channel.** *Catalogue* when the requester orders a catalogue item (§4.5); *framework
call-off* when the contract check finds a contract that covers the demand at or below the direct
call-off limit (Decisioning Thresholds, §14.9); otherwise *business-led* or *procurement-led*, by
the routing rules (§17.2). The Channel page explains the choice in the matched rule's own
description; the record stores the rule's name. Direct PO and P-card were retired on 2026-09-25.

**The determination:**

| | How it is decided |
|---|---|
| Supplier risk assessment (SRA) | The supplier's recorded status: *valid* passes, *expiring* warns, *expired* or never assessed fails; not applicable with no supplier. *Expiring* is a status held on the supplier record — no expiry window is computed. The Compliance tab shows an SRA as expired once its date has passed. |
| Policy checks | Only while the Request Validator (AI-002, §12.1) is active; otherwise one entry saying they did not run, shown as failed. The same checks for every category: contract required before a PO (contract-required threshold), budget approval (budget approval threshold), SRA valid, competitive sourcing (competitive-sourcing threshold, minimum competitive quotes, categories exempt from competitive quotes) and preferred-supplier routing — plus risk-assessment reuse when a reusable assessment exists. |
| Screening | The supplier's status: clear; pending (complete before award); not yet screened; or flagged, which makes the disposition *refer back*. |
| Materiality | Material when the demand supports a critical service, the data is highly sensitive (read from the service description), the supplier's risk is high or critical, or the value reaches the materiality value threshold. |
| Inherent risk | Low to critical, highest driver wins: critical service, privileged access, data sensitivity, supplier risk, and value against the inherent-risk bands. |
| Risk questions | Up to two, Yes/No: privileged access (categories set to *Ask about privileged access*, or data of medium sensitivity or more) and critical service (the critical-service question threshold, a high- or critical-risk supplier, or highly sensitive data). An unanswered one is recorded as *not answered*. |
| Risk assessment | Required when no completed, in-date assessment of the chosen supplier can be reused — so always when no supplier is named. |
| Vendor onboarding | Needed with no supplier, or one not fully onboarded or holding an expired certification. |
| Contract check | Among the supplier's contracts: transact under one below the contract utilisation headroom, author a SOW under a framework, renew one in its renewal window (the contract renewal window, §14.9), or a new contract. |
| Disposition | *Refer back* (mandatory detail missing, or a supplier flagged in screening), *request change* (a failed policy check), otherwise *proceed*. |

The Channel page's workings also show an operational-risk view (continuity, data handling,
concentration, regulatory, access) and the approval-to-source gate — *light*, or *full* at the
full approval-to-source threshold or for material or high-risk demand. Neither is stored, and the
gate creates no approval.

**Known defect:** the Channel page says a request "will be referred back" or that "a change will
be asked for", but nothing acts on the disposition: the request enters its first stage as usual.

**The compliance record** keeps the channel and the rule behind it, the SRA check, the policy
checks, the reusable assessments and these flags: material, the inherent-risk tier, risk
assessment required, supplier onboarding required, screening blocked, the disposition when it is
not *proceed*, and each risk question's answer. When the workflow engine opens Risk Assessment, it
reuses a matching assessment from the register or raises a draft one. Duplicate detection was
retired on 2026-09-25: nothing searched for duplicates.

### 6.2 Smart Assessment

Retired with the intake's Review step: it re-derived contract coverage with its own fixed €25,000
figure instead of the governed threshold. The contract check on the Channel page (§4.2), and the
Compliance tab's contract position for a call-off (§4.6), replace it.

### 6.3 PR Compliance Agent

Removed on 2026-09-25 with the reports it had stored: four of its six checks — sanctions
screening, contract coverage, the supplier's risk assessment and a market benchmark — were
recorded as passed without being run, under a confidence score nobody measured. The compliance
record (§6.1) holds only checks that ran and says when one did not.

### 6.4 Configurable Forms

A form collects a stage's evidence. Each template (Form Builder, §14.2) has a category, a status,
the stages it belongs to, optional trigger conditions and its fields. An active template appears
on its stage's card (§5.4) when all its conditions hold; a condition tests the request's category,
value, supplier, commodity code, urgency or contract, and can name a Decisioning threshold. Anyone
who can open the request can fill in the current stage's forms; a submission is kept with who
submitted it and when.

- **Blocking** — a blocking form must be submitted before the stage's action unlocks (§5.3);
  administrators are exempt. None of the shipped templates is blocking.
- **Pre-population** — a field can be filled from the request (title, description, category,
  commodity code, value, currency, cost centre, budget owner, business justification, delivery
  date, buying channel, supplier name, PO, contract, request id, beneficiary, the supplier's SRA
  status) or a service-description section, and locked.
- **Shipped templates** — Full Risk Questionnaire and IT Security Assessment (Risk Assessment; the
  second only for Software), Vendor Onboarding Form (Vendor Onboarding), Contract Intake Form
  (Contracting) and Budget Approval Form (Approval). Three templates that never rendered were
  removed on 2026-09-25 with their submissions.
- **Field types** — text, text area, number, select, multi-select, radio, checkbox, date, file
  upload, separator and info text. **Known defect:** a File Upload field shows a drop zone but
  takes no file.

---

## 7. Supplier Management

### 7.1 Supplier Directory

Every supplier, as cards or a table, searched by name, country or category and filtered by risk
rating, contract status, onboarding status, tier and country; active contracts and 12-month spend
are computed from the contracts and invoices. A card's **New Request** opens New request without
the supplier. **Add Supplier** does nothing: a supplier is added in Admin → Database (§14.17), or
created as *prospective* — onboarding not started, screening pending — the moment a requester
names one the directory lacks in New request (§4.2).

### 7.2 Supplier Profile

Tabs for the overview, contracts (not linked; a banner naming any in its renewal window), risk and compliance (supplier risk assessment (SRA) and screening status, certifications),
spend by year, performance, documents and activity. A requester opens it read-only from their
request.

On the Risk & Compliance tab the Vendor Manager and Admin record **evidence**, never a verdict on
nothing (decided 2026-09-26):

- **Record screening result** — *Clear* or *Flagged*, with the **reference** of the screening that
  was performed (the provider and its case or report number) and the day it was performed, which
  cannot be in the future. The platform does not screen suppliers itself, so a result is only
  recorded against the screening it came from; the reference and date show beside the status.
- **Link a risk assessment** — a *completed*, *in-date* risk assessment of this supplier from the
  register; the SRA becomes valid until the assessment's own expiry, and names it. With none in
  the register, the tab says where one is completed.

Neither touches onboarding, and each is written to the audit log with who, when and on what
(§14.8). They replaced *Approve risk* and *Refer back*, which wrote the SRA valid and screening
clear or flagged with nothing assessed or screened, threw the rationale away, and set a completed
supplier's onboarding back to in progress.

**A demonstration:** the *AI Summary* (a sentence assembled from the record), spend by category
(fixed shares), the performance sub-scores and trend (derived from one stored score), documents
(the same placeholders for every supplier; download does nothing) and activity (a fixed timeline).

### 7.3 Onboarding Pipeline

Suppliers in three columns by onboarding status — Not Started, In Progress, Completed. The
Procurement Manager and Admin can **Complete** an in-progress supplier **with a clear screening on
record** (§7.2) — otherwise the card says what it needs — and a completion note saying what was
checked, which is kept in the audit log (§14.8).

### 7.4 Risk & Compliance

Counts of high- and critical-risk suppliers, lapsing SRAs and pending screenings (their trend
arrows are fixed in code), over each supplier's rating, SRA, screening, certifications and tier.

### 7.5 Supplier Messaging — a demonstration

Sample conversations. **Send** shows a message on screen only — it reaches no one and is gone on
reload; **New Message** does nothing.

### 7.6 Supplier Portal

The Supplier role opens the portal (§2.2). There is no supplier sign-in: it always acts for one
fixed supplier.

- **Sourcing** — the supplier's invitations. Opening one marks it viewed and shows the
  requirements, never the criteria, weights or budget; a price, lead time and proposal can be
  submitted and changed until the deadline (§8.1).
- **Invoices** — **Submit Invoice** records an invoice as *Submitted* and *Unmatched*, for the
  supplier of the purchase order it cites, if it cites one (§10.2).
- **Onboarding** — the company details and contact; saving starts onboarding (*In progress*) and
  leaves a completed one completed.
- **Profile** — the record's details, read-only.

**A demonstration:** the dashboard (only its recent invoices are real), the profile's bank details,
the six-step onboarding list, documents (upload and download disabled) and messages (Send does
nothing) — and, in the internal app, **Supplier Portal Admin** (sample figures; settings cannot be
saved).

### 7.7 Onboarding gates

- **Light — the supplier exists and is screened clear.** Needed to complete a request's Risk
  Assessment stage, and to complete a stage into Sourcing when a supplier is named. Only the stage
  action on the request page checks it: a request that reaches Sourcing through its last approval
  is not checked.
- **Full — onboarding Completed.** Checked at award (§8.2): a winner who is not fully onboarded
  sends the request to Vendor Onboarding instead of Contracting. Leaving Vendor Onboarding does
  not check it again.

A channel's workflow can route a request whose supplier is prospective or not fully onboarded
through Vendor Onboarding (§5, §14.3).

---

## 8. Sourcing & Evaluation

An event is *Draft*, *Published*, *In evaluation*, *Award pending*, *Completed* or *Cancelled*; the
platform sets only Draft, Published and Completed, and the rest are set in Admin → Database
(§14.17). An invitation is *Not viewed*, *Viewed*, *Responded* or *Declined*, though a supplier
cannot decline. Nothing is sent to an upstream sourcing system (§13).

### 8.1 Sourcing Events

**From a request.** At a request's Sourcing stage, **Create sourcing event** (Procurement Manager,
Admin) makes a draft from the request. Its requirements and criteria are seeded as Admin → Service
Description sets them (§14.11), and it invites the named supplier, the requester's shortlist and
the category's preferred suppliers (§14.10).

**New Event** is a five-step wizard: details (a category from a list fixed in code; RFI, RFP or
RFQ), suppliers, requirements, criteria weighted and scored 1–5, and review. Publishing needs the
weights to total 100%. A draft published from its event page also needs an invitation and a
requirement, and moves its request to Sourcing.

The event page tracks each invitation's status and price. Responses arrive through the portal
(§7.6) and raise a notification (§15.1); the proposal text and lead time are not shown to the
buyer. **The Q&A Board is a demonstration:** five sample questions, the same on every event.

### 8.2 Evaluation Centre

Lists the published, in-evaluation and award-pending events. Each supplier who has responded is
scored 1–5 per criterion, saved as it is typed; the weighted total is a weighted average in which
an unscored criterion counts as zero, and any supplier can be eliminated. There is no AI scoring
and there are no rounds. The recommendation is the shortlisted responder with the highest total,
a tie going to the lower price.

**The award** cannot be undone, and an event has one. It completes the event, is audited and
notified, and for an event raised from a request makes the winner the request's supplier and moves
the request to Contracting — or to Vendor Onboarding if the winner is not fully onboarded (§7.7).
If the request cannot be updated, the award stands and the event offers **Re-apply award to
request**.

### 8.3 Sourcing Templates — a demonstration

Five template cards with timelines and usage counts fixed in code. **Use Template** opens the empty
wizard; there is no auction or mini-competition.

---

## 9. Contract Management

A contract's dates, value and utilisation are stored on it, and only Admin → Database (§14.17)
creates or changes a contract. A requester can open a contract read-only.

**Its status is read from its dates.** A contract recorded as active is *Active* until its renewal
window opens, *Expiring* while it ends within the window — the contract renewal window, a
Decisioning threshold (§14.9) — and *Expired* from the day after its end date: in force through
its last day. *Draft*, *Under review* and *Terminated* stay as recorded, as does an expiry recorded
early. Every screen, the checkout, New request's contract check and the assistant read the status
this way; the record keeps what was recorded, and Admin → Database shows both where they differ
(decided 2026-09-26: 12 of 30 live contracts were past their end date while recorded active or
expiring).

### 9.1 Contract Register

Tabs **All**, **Active**, **Expiring** and **Expired**, with filters by status, supplier and
category, and the days left beside a contract in its renewal window. No notification is raised for
an expiring contract (§15.1); the **Expiring Contracts** widget (§3.2) lists up to five in their
renewal window, soonest first.

### 9.2 Contract Detail

- **Summary** — the terms, dates, owner and utilisation, and how many requests name the contract.
- **Coverage & Matching** — the service family, scope, deliverables and exclusions that New
  request's contract check matches a demand against (§4.2); a contract without saved coverage is
  never matched. **Preview match** tries example words.
- **Financial** — *actual spend* is the value times the stored utilisation; *committed* is 85% of
  the value, fixed in code.
- **Renewal** — where the contract stands against its renewal window (days until the window
  opens, days left in it, or how long ago it ended), and **Start renewal**, which opens New
  request with "Renew *title* with *supplier*" as the conversation's first message (§4.1).
- **Related** — the purchase orders that name the contract, and their invoices.
- **Obligations** and **Documents** — a demonstration: the same samples on every contract, and
  nothing done there is kept.

**Known defect:** a service family that matches none stored is dropped when coverage is saved.

### 9.3 Contract Templates — a demonstration

Six agreement templates, shown as placeholder text. **Use This Template** closes the preview and
creates nothing.

### 9.4 Renewals & Expiries

Every contract with the days to, or past, its end date; how many are expiring (in their renewal
window) and expired, and the value up for renewal. Its tabs — **All**, **Expiring (within N
days)**, **Expired** — read the status (§9), and each row has **Start renewal**.

---

## 10. Purchasing & Payments

Nothing here is sent to a supplier, an ERP or a bank (§13).

### 10.1 Purchase Orders

An order is raised by catalogue checkout (§4.5) or by **Create PO** on a request at its PO stage
(Procurement Manager, Admin; one line, the request at its value), and starts *Submitted*. A goods
receipt sets *Partially received* or *Received*; *Draft*, *Acknowledged* and *Closed* are set only
in Admin → Database (§14.17).

The PO page shows a status stepper, each line's quantity received against ordered, and **Not
ready to hand off**: what an upstream system would reject, such as a line with no supplier part
number or unit of measure, read from the request's order lines.

**Goods receipt**, not open to requesters, records the quantities received, never more than
ordered; they decide whether it is complete or partial. A complete receipt moves the request out of
its PO stage.

### 10.2 Invoice Management

An invoice is *Submitted*, *Under review*, *Matched*, *Approved*, *Scheduled*, *Paid* or
*Disputed*, with a match of *Matched*, *Partial match*, *Unmatched* or *Variance*. Suppliers enter
invoices in the portal (§7.6); nothing reads data from an invoice document (§12.1).

On the **Invoice Queue** the Operations Lead reviews an invoice, then marks it matched or a
variance (disputed); the Procurement Manager approves it; the Admin schedules and then releases it
as paid.

**Matching is a person's decision:** *Match* compares nothing and *Variance* records no amount,
whatever the queue's "auto-matched within tolerance" card says. An invoice does not move its
request: the request's Invoice and Payment stages are closed on the request (§4.6).

**Three-Way Match is a demonstration:** four fixed scenarios judged against the *Invoice Match
Tolerance* in a person's Settings — not a Decisioning threshold (§14.9). Its buttons do nothing.

### 10.3 Payment Tracker

Each invoice's match, approval and payment state, its progress, and its due and paid dates.
*Scheduled This Week* and *Paid This Month* total every scheduled and every paid invoice, whatever
the date. Nothing is paid: Schedule and Release record the state only, as the tracker tells the
Admin. Overdue invoices are not highlighted.

---

## 11. Analytics & Reporting

### 11.1 Dashboards

Four dashboards, computed live from the platform's own records over the last six months:

- **Spend Overview** — spend year to date, the managed-spend share, the average contract value,
  the monthly spend trend, spend by category (from the value of the requests), the top twenty
  suppliers by spend, and — when AI-004 is active — the spend anomaly checks (§12.1). The average
  contract value's "flat 2%" trend is fixed text, not computed.
- **Compliance KPIs** — the first-time-right rate, supplier risk assessment coverage, policy
  breaches this month (a breach is a request referred back), the average cycle time, the
  refer-back rate, duplicate supplier records, and contract against off-contract spend.
- **Pipeline & Cycle Time** — the request funnel by stage group (intake, approval, sourcing,
  contract, PO and delivery), requests completed, days per stage group, and how long open requests
  have been waiting.
- **Supplier Performance** — each supplier's score in one table, with the five best and the five
  weakest.

### 11.2 KPI Cards

Each KPI card shows its current value, the change on the previous period, and a six-month
sparkline. Cards do not drill down.

### 11.3 Report Builder — a demonstration

The Report Builder charts **sample data**, not the platform's records: a source (requests,
suppliers, contracts, spend, compliance), a title and a chart type (bar, line, pie, table;
*scatter* draws bars), with a CSV export. **Save Report only confirms on screen** — nothing is
stored.

### 11.4 Scheduled Reports and Exports — demonstrations

**Scheduled Reports** lists five sample report definitions with an on/off switch that is not kept;
nothing is scheduled or sent. **Exports** offers sample files, ignores its date fields, and shows a
sample list of recent exports. Neither reads the platform's records.

---

## 12. AI Capabilities

### 12.1 AI Agents

Each agent is a switch on something the platform really does. Its status — active, draft or
disabled — is set in Admin → AI Agent Configuration, and only *active* turns it on. Nothing reports
an accuracy or a count of decisions, because nothing measures them.

| Agent | What it does when active | When it is not active |
|---|---|---|
| **AI-001 Category Classifier** | Reads the demand as the requester wrote it, in New request, and suggests the category — and a title, supplier and value where it can find them — through the language model. It chooses only among the configured categories. | The configured category keywords classify instead, as they do when the model is unavailable |
| **AI-002 Request Validator** | Runs the policy checks the Channel page shows before submit: contract required before a PO, budget approval, the supplier's risk assessment, competitive sourcing and the preferred-supplier rule, each against Decisioning thresholds and the category's preferred suppliers. Rules, not a model. | The checks are reported as not run — never as passed |
| **AI-004 Spend Anomaly Checks** | Flags, on Analytics, open requests at or above the contract-required threshold with no contract behind them, and suppliers with several requests in flight whose combined value is above the budget-approval threshold. Rules, not a model. | The Analytics card says the checks are off |
| **AI-005 Supplier Recommender** | Suggests suppliers in New request when the requester chooses a supplier or adds one to invite: the category's preferred suppliers first, then by category fit, performance score and risk rating. A shortlist, not a decision. | No suggestions; the supplier can still be named |
| **AI-007 Status Answers** | Answers status questions on Home and in the assistant — a request, what is waiting on you, a PO, an invoice, a contract or a supplier. Which details it may state, and whose records each role may ask about, are configured on the agent. | A status question is told that status answers are switched off |

Two agents were removed on 2026-09-25: a document extractor that only relabelled a disabled
upload button, and a compliance reviewer whose report recorded checks as passed that had never
run.

### 12.2 AI-Powered Features

**The model reads and phrases; rules decide.** A language model is called in the five places
below; which providers and model versions are used is a governed product decision
([ARCHITECTURE.md §7](../ARCHITECTURE.md#7-ai)). Of the five, only the classifier has an agent
switch (AI-001, §12.1); the others run whenever a provider answers. Each has a path without the
model, taken when the provider does not answer.

| Where | What the model does | What rules decide | Without the model |
|---|---|---|---|
| **Reading the demand** (§4.2) | Suggests a category from the configured ones, a title, a supplier and a value, and reads the words as a catalogue item or a new demand, which decides whether a catalogue match is offered | The requester confirms the reading. The commodity code is matched from the category's configured codes. No catalogue item is offered that the catalogue check did not find | The configured category keywords |
| **The service-description conversation** (§4.3) | Phrases the next question, extracts the answers, judges whether an answer addresses the question and drafts one it can ground | The engine chooses the next question and when the description is complete; a reply that is not a single question is replaced by fixed wording | Fixed wording, and rule checks on the answers |
| **Writing the service description** (§4.4) | Writes the configured sections and the narrative from the captured answers, told which sections this demand must cover | A quality score from rule checks: every section at least 40 characters (fixed in code), deliverables as a list, measurable acceptance criteria, a timeline with phases or dates | The sections assembled from the answers, with standard wording where one is missing |
| **Contract match** (§4.2) | When two or more contracts qualify, puts them in order and adds a reason | Which contracts qualify, from their dated scope, and their scores. The model cannot add a contract or promote one that does not qualify, and checkout repeats the match without it | The rules' order |
| **The assistant** (§3.5) | Answers what the Home box's route does not, and only through its tools | What the tools may read and do (below) | An offline assistant that recognises a fixed set of requests |

**Rules, not a model:** the commodity code; the buying channel (routing rules, §14.1 — the reason
shown is the matched rule's description); the Home box's route (§3.1); the policy checks
(AI-002), materiality, inherent risk and whether a risk assessment is needed (§6); supplier
suggestions (AI-005: the category's preferred suppliers first, then category fit, performance and
risk); status answers (AI-007); the spend anomaly checks (AI-004); the bottleneck analysis, which
names the three active stages with the longest average time in stage (§5.2); and reading the text
of an attached PDF or DOCX. Stage deadlines are set per stage (§14.3); nothing predicts how long a
stage will take.

**The assistant's tools.** It searches the knowledge base; looks up a record or lists records by
filter — only the records and details the Status Answers agent allows the person's role; proposes
an action; raises a support ticket when the person asks for a human; takes a buying need to New
request; and remembers a fact the person gives it (a delegate, cost centre, department or
preferred supplier) for their later conversations. **Confirm before act:** a proposed change is a
confirmation card, nothing changes until the person confirms, and the change is then written with
an audit entry (§14.8). Nothing is written upstream. Every answer can be voted helpful or not
helpful; the votes, which do not record the voter, are counted in AI Analytics (§14.16).

**Known defect:** when the server refuses or fails a confirmed action — its answer says nothing
was changed — the chat shows the offline assistant's reply instead: "This action has already been
executed or has expired", or, for a proposal the offline assistant made, "Done" for out of office,
a delegate or a watcher, although nothing was written.

### 12.3 AI Visual Language

- **Model output is named in words and confirmed by choice.** The conversation says which layer
  read the demand — "Read by the category classifier." or "Matched on the configured category
  keywords." — and offers the reading for confirmation: *Yes*, another likely code, *None of these
  codes*, or describe it again. A drafted answer is offered with *Use this*, and the written-up
  service description is edited in place (§4.2–§4.4).
- **No confidence figures.** The model returns none, and the platform does not invent one.
- **The *AI-generated* card** — a tinted card with the sparkle icon and that label — appears on the
  supplier profile, the Invoice Queue and the Workflow Monitor. Only the Invoice Queue's can be
  dismissed, which hides it until the page is opened again; nothing offers Accept or Override on AI
  output.
- **The sparkle icon** also marks the Home box, the assistant and the spend anomaly checks: it is
  the assistant's mark, not a sign that a model wrote what it sits on.

**Known defect:** the cards labelled *AI-generated* hold text built by fixed templates from the
record, not by a model — the supplier profile's **AI Summary**, **Risk Classification** and
**Spend Insight**, the Invoice Queue's **Invoice Matching Summary**, and the Workflow Monitor's
**Top Bottleneck Identified**, which also states a fixed "SLA target: 5 days" and "this month"
whatever the stage's deadline and the period.

---

## 13. System Integrations

### 13.1 No live connections in Release 1

The platform writes to no upstream system — ERP, contract management, risk provider, supplier
network or payments — and reads from none. Sourcing events, risk assessments, contracts,
requisitions and purchase orders are its own records (§7–§10); a purchase order is an internal
one. Where an upstream system would act, the platform shows the step and links to its own page for
it (§13.4), and the assistant proposes but never writes upstream (§3.5). Live connections are
Release 2.

### 13.2 Hand-over records

A hand-over record says that a request was handed to an upstream system at a stage: the system —
**SAP Ariba**, **Coupa Risk Assess**, **Sirion CLM** or **SAP S/4HANA** — the stage, a status, when
it was sent and answered, the external reference and a note. Records show on the request's
lifecycle stepper and Workflow tab (newest first), on Active Workflows (the first one not
completed), and in System Health (§14.7).

**Nothing writes one today.** The records are sample data loaded with the platform. No screen, rule
or workflow step creates one, and a workflow's automated steps (§14.3) are passed over when a
request runs. The four system names are labels on those records, not connections.

The statuses are a fixed list: *Pending hand-over* (grey); *Submitted*, *Awaiting response* and
*Processing* (amber); *Completed* (green); *Error* and *Timeout* (red, Timeout with a clock).
**Nothing moves a record between statuses:** each keeps the status it was loaded with, and there is
no timeout rule.

### 13.3 The connector layer

Each upstream-shaped record has a connector, answered today by the platform's own store:
suppliers, contracts, purchase requests, purchase orders, invoices, risk assessments, catalogue
items, sourcing events, support tickets, and supplier payment details — the last from a fixed data
set in code, not the store. A record read through a connector says where it came from, whether
that source is live and when it was read, so in Release 2 a live connection can replace the
own-store connector without changing the code that reads through it. Today New request's catalogue
and contract checks, its determination and the assistant's lookups read through the connectors;
most other screens and the server's own checks read the store directly, and risk screening, the
category taxonomy and form submissions have no connector yet
([ARCHITECTURE.md §4.4](../ARCHITECTURE.md#44-the-source-connector-layer)).

### 13.4 Hand-off steps

Among the Channel page's workings (§4.2), **Next steps** lists what follows submission — the
supplier's master data when it is incomplete, the risk assessment (reuse, a delta or a full one),
heightened approval and the regulatory register for a material demand, a sourcing event, the
contract (a call-off or a new one) and the purchase requisition — each with the area it belongs
to, whether it is required or recommended, and an **Open** link to the platform's own page for it.
None of them sends anything anywhere.

---

## 14. Administration

Admin is the administrator's; each item has one job. What each is for, where it is stored and
what in the platform reads it is the [admin map](admin-map.md) — the one home for that. This
section says what an administrator can do on each. The numbers every decision compares against
live in one place, Decisioning Thresholds (§14.9); routing rules, approval chains, workflow
branches, forms and knowledge-base articles name them rather than restate them.

### 14.1 Routing Rules Engine

Routing rules decide one thing: whether a demand that no catalogue item or contract covers is
**business-led** or **procurement-led** — and, optionally, an approval chain that applies whatever
the value (§14.4). Catalogue orders and call-offs are not routing outcomes; they come from the
checks in New request (§4.2). One evaluator decides in the conversation, on the Channel page and at
submit.

**How they apply.** Active rules are checked in a stored order — ordinary rules before the
catch-alls; the page does not change it — and the first whose conditions all hold decides. Its
description is the reason the requester is shown. If none matches, the demand is procurement-led by
a fallback fixed in code. As shipped: consulting, contingent labour, urgent demand and a supplier
rated high or critical (which also takes the Compliance Escalation chain) are procurement-led;
after those, a demand above the *Budget approval threshold* is procurement-led, one at or below the
*Business-led ceiling* business-led, and everything else procurement-led.

**The page** has three panels:

- **Rules**, grouped under a label each rule carries, with its name, status and last change.
  *Add Rule* starts a draft; *Delete rule* asks first and says where that demand will go instead.
- **Editor**: the name; the status (active, draft or disabled); the channel; the approval chain —
  *Let the value band decide*, or a chain; and conditions, all of which must hold (there is no OR).
  A condition is a field, an operator and a value:
  - fields — value, category, supplier chosen, the supplier's risk rating, contract exists, the
    demand's risk tier, materiality, commodity code, urgent;
  - operators — equals, does not equal, greater than, less than, contains, starts with, is in,
    between, is empty, is not empty, risk rating is;
  - a value names a Decisioning threshold or is a typed amount, and a typed amount equal to a
    threshold is flagged with the offer to name it; categories are the configured ones.

  A plain-English summary follows the edits. The description the requester sees is not edited
  here: a new rule has none, so its name is shown.
- **Test**: a sample demand run through the same evaluator — which rule matches and the outcome;
  *Test All* shows which active rules fire for it.

Above the panels, the page lists active rules that can never fire — an unknown field, operator or
threshold, no conditions, a chain that does not exist — and warns when some demand matches no rule.

**Known defect:** the test panel offers a fixed list of five categories and has no input for the
supplier's risk rating or materiality, so a rule on either — the high-risk-supplier rule among
them — cannot be tried there.

### 14.2 Form Builder

A form is the evidence a workflow stage collects. It appears on a request's Workflow tab at each
stage it is placed on, when its conditions hold, and a **blocking** form holds the stage until it
is submitted (§4.6, §6.4).

**The page** has three panels:

- **Forms**, grouped by form category (Risk, Procurement, Compliance, Operations), each with its
  name, status, the stages it appears on and its number of fields. *Add Form* starts a draft,
  numbered one past the highest form id in use; *Delete form* asks first.
- **The form**: name, description, status (active, draft or disabled), category, the stages it
  appears on (chosen from the stages the channels run), its conditions — the routing-rule
  vocabulary, which can name a Decisioning threshold, all of which must hold — and **Blocking**. A
  form that can never be asked for (no stage, a stage no channel runs, a condition on something
  nothing supplies, an unknown operator or threshold) is flagged. Fields are added from a menu of
  ten types — text, text area, number, select, radio, checkbox, date, file upload, section header,
  info text — and removed with ×; they cannot be reordered.
- **The field, and a live preview**: the selected field's label, placeholder, help text, whether it
  is required, its width (full or half), the options of a select or radio field, the minimum and
  maximum of a number, the text of an info field, and **Pre-populate from** a request field or a
  service-description section, optionally locked. The preview shows the form as it will appear and
  follows the edits.

*Save Form* writes it. The version shown is a label that saving does not change.

### 14.3 Workflow Designer

A visual canvas for the lifecycle of each buying channel. There are four templates, and each
claims the channels it runs: **Procurement-led** (WF-001), **Catalogue** (WF-002), **Business-led**
(WF-006) and **Call-off** (WF-008). A channel claimed by two templates, or by none, is flagged.

**Node types.** Each node type the palette offers saves as it was drawn:

1. **Start** — where the workflow begins
2. **Stage** — a stage the request sits in, with a label, an owner role, a deadline in working
   days, what leaving it takes (automatic or a manual gate), its purpose, and **what the
   requester does here** (shown on the Channel page)
3. **Decision** — a branch; each outgoing edge carries a condition, which may name a Decisioning
   threshold rather than restate a number (the catalogue template's auto-approval branch does)
4. **System Action**, 5. **AI Agent** and 6. **Notification** — automated steps, saved as
   integration steps and told apart by their kind
7. **End** — completion

A template may also carry an error path (WF-001's *Referred Back*), which is kept when the
template is saved. Approvers are not configured here — approval chains own them
(§14.4) — and neither is waiting: a stage's deadline is.

**Per channel**, the designer also holds the **requester wording** — the headline and the
sentence the conversation and the Channel page use for that way of buying.

**Checks and simulation.** The designer lists what is wrong with a template's branches — a
condition on something nothing supplies, an operator not implemented, a threshold that does not
exist, a labelled branch with no condition, a decision with no default branch, a branch that can
never be reached, an approvable step with no *Rejected* branch — and can run a test request
through the canvas as it stands before it is saved.

### 14.4 Approval Chains

An approval chain says **who approves**: steps in order, each a role, over a **value band**.

**Which chain applies.** A routing rule that names a chain decides, whatever the value; otherwise
the chain whose band holds the request's value — a band includes its lower end and stops short of
its upper end. A chain with no band is reached only through a rule, and when neither applies the
Standard chain does, by a fallback fixed in code. A call-off puts the contract's owner first, and
a supplier chosen outside the category's preferred list adds the category manager when *Category
manager approves a non-preferred supplier* is on (§14.9). The Channel page names the approvers
before submit and submit writes them (§4.2). On the request's Approvals tab only the earliest
outstanding step can be decided (§4.6), and nobody may approve a step of their own request.

**Who holds a role.** *Budget Owner* is the owner of the request's cost centre (§14.14),
*Category Manager* the category's managers (§14.10), *Contract Owner* the contract's owner. When
that record names nobody — and for every other role, such as Finance, Legal, CFO or Vendor
management — the **Roles** panel on this page says which system role acts. A role still named on a
chain step or a workflow stage cannot be deleted. An approver who is out of office with a delegate
is recorded with the delegate, who may act in their place (§14.6).

**The page** lists each chain with its band and number of steps. With *Edit*, an administrator
chooses each step's role from the Roles list, adds a step at the end or removes one (one must
stay), and sets the band's two ends — open, a Decisioning threshold, or a typed amount. The routing
rules that name the chain are listed under it. *Add Chain* starts a chain with no band; *Delete*
asks first. Bands that overlap or leave a gap are flagged above the list. A step is a role and
nothing more: there are no escalation timeouts or delegation rules, and steps cannot be reordered.

**As shipped:**

| Chain | Steps | Band |
|---|---|---|
| Fast-Track | Category Manager | Below €10,000 — an amount typed on the chain, not a Decisioning threshold |
| Standard | Budget Owner › Category Manager › Finance | From €10,000 (typed on the chain) to the *Budget approval threshold* |
| VP-Level | The Standard steps, then VP Procurement | From the *Budget approval threshold* to the *Delegated authority threshold* |
| Board-Level | The VP-Level steps, then CFO and Board | From the *Delegated authority threshold* |
| Compliance Escalation | Supplier Manager › Legal › Category Manager | None — reached only through the high-risk-supplier rule (§14.1) |

**Known defect:** a chain's name and description cannot be edited here, so a new chain stays *New
Chain*.

**Known defect:** a request of exactly the *Budget approval threshold* takes the VP-Level chain,
while the budget-approval check calls it within standard limits — the threshold is defined as
"above this value" (§14.9).

### 14.5 Policy Management (removed)

Removed on 2026-09-25: it was a static copy of the policy text that nothing used. Policy text is maintained in the Knowledge base, whose figures are linked to Decisioning thresholds and approval chains.

### 14.6 User Management

Who uses the platform and in which system role — the directory that approvers, cost-centre owners,
category managers and request owners are picked from. There is no sign-in in Release 1
([ARCHITECTURE.md §8](../ARCHITECTURE.md#8-security-posture)), so nothing records a login.

The page shows how many people there are, how many are active and how many on leave, and a table —
name, email, role, department and status (*Active*, or *On Leave* when the person is marked out of
office) — searched and filtered by role and department. An administrator can **add** a person
(name and email required; the role is Requestor / End User and the department General unless
chosen), **edit a role**, and **remove** a person. The delegate is not shown, and out of office is
not set here.

**Out of office.** A person marks themselves out of office, and names their approval delegate,
through the assistant (§3.5). An approval created for someone who is out of office with a delegate
records the delegate, who may act in their place (§14.4). Approvals already waiting are not moved,
and no notification is sent.

**Known defect:** *Remove* deletes the record outright. It is refused when the person raised or
owns a request, or owns a support ticket or a purchase order; otherwise it also deletes their
assistant conversations, procurement profile and category-manager assignments, and blanks them as
the approver on past approvals.

**Known defect:** nothing turns out of office off — the assistant can only turn it on, and the end
date it is given is stored and never read.

**Known defect:** the Delegation page (Work → Approvals → Delegation; its requirements are in
[Approvals & Delegation](requirements/03-approvals-delegation.md)) keeps delegations on screen
only, starting from a sample entry, and saves nothing. On My Approvals, accepting the out-of-office
warning's delegate only shows "Routed to …"; nothing changes.

### 14.7 System Health

What happened to the hand-overs the platform recorded to upstream systems. There are no live
connections in Release 1, so the page reports no uptime, error rate or sessions: it summarises the
hand-over records, per system and across all of them — completed, still open, failed (an error or
a timeout), the last activity and the mean time to a response — and marks a system with no
hand-overs as unused rather than healthy.

### 14.8 Audit Log

What happened and who did it, newest first, fifteen entries to a page: when, who, the action, the
kind of record and its id, and a description. An administrator can filter by date range, person,
action and kind of record — each offering the values present — and **Export** the filtered entries
as CSV. The page loads the most recent 200 entries, so the filters and the export work within
those, and it refreshes every 30 seconds.

**What writes an entry:**

- an approval decision — approve, reject or ask for information (§4.6);
- inviting suppliers to a sourcing event, and an award (§8);
- work on a support ticket — assignment, status, a reply or an internal note, a link added or
  removed (§18.3);
- a record created, edited or deleted in Admin → Database (§14.17);
- an action confirmed in the assistant, marked as the assistant's (§3.5);
- a supplier's screening result recorded, a risk assessment linked as its SRA, and onboarding
  completed — with the reference, the assessment or the completion note (§7.2, §7.3).

Nothing else does: submitting a request, a stage change (kept in the request's stage history,
§4.6), a comment, a notification, a classification or a change to any other Admin configuration
leaves no entry. Whether an entry came from a person or the assistant is stored, but neither shown
nor filtered.

**Known defect:** the log is not protected — an entry can be changed or deleted by its id through
the data boundary (`/api/db`), as any record on its allowlist can while there is no sign-in
([ARCHITECTURE.md §8](../ARCHITECTURE.md#8-security-posture)).

### 14.9 Decisioning Thresholds

Every number a decision compares against — money thresholds, percentages, scores and days — with
two category lists and one switch. Each shows **where it is used** and **the configuration that
names it** (a routing rule, an approval chain band, a workflow branch, a form, an article), read
live, so an administrator can see what moving it will move. A save is checked whole — a
configuration missing a key or holding the wrong type is refused — and records who changed it
and when.

### 14.10 Categories

The demand taxonomy — *what kind of thing* is being bought. For each category the administrator
sets its label and description (which the AI classifier reads), its classifier keywords and their
order (the keyword classifier's precedence), whether the catalogue may serve it, its **commodity
codes** (a default and keyword codes, resolved within the category), its **managers** (several
allowed; a category without one is flagged, because then only an administrator can move its
requests out of validation), its **preferred suppliers**, and the supplier tags that recognise a supplier as
covering it.

### 14.11 Service Description

Per category, with a default that categories without their own inherit: the **generation
prompt** (the system prompt, per-category guidance, temperature and length); the **components
asked at intake** — each question, whether it is required, and when it is asked (a condition that
can name a Decisioning threshold); **what is generated** — the detailed sections and the compact
narrative; the **risk questions**; and **what a sourcing event starts with** — the sections its
requirements are seeded from and the starting evaluation criteria.

### 14.12 KB Management

The knowledge-base articles the assistant, the Home box and Help → Knowledge Base answer from:
title, body, topic and order. An article names a governed figure as a reference rather than
typing it; each article says whether it is linked to configuration or is policy text only, and a
reference that names nothing is flagged here instead of reaching a requester as a raw token.

### 14.13 Support SLAs

The first-response target for a support ticket, in hours, per priority (§18.3). Stage deadlines
are not here: they are set on each stage in the Workflow Designer (§14.3).

### 14.14 Cost Centres and Delivery Locations

The accounts a request or order can be charged to, with the **owner** of each — the Budget Owner
who approves — and the places an order can be delivered to. Checkout refuses anything not active
here. Neither can be deleted, because orders keep the code: an entry is deactivated instead,
which takes it out of every picker and keeps old records readable.

### 14.15 AI Agent Configuration

The status of each agent (§12.1) — active, draft or disabled — and its description. The Status
Answers agent (AI-007) also carries its configuration: which details it may state for each kind
of record, and whose records each role may ask about.

### 14.16 AI Analytics

A report of how the assistant is used: conversations and questions per day, and the helpful and
not-helpful votes on its answers. Nothing here is set.

### 14.17 Database

Maintains the records other screens show — suppliers, contracts, risk assessments, purchase
orders, invoices, requests, approvals, sourcing events and catalogue items — each in its own table,
with its related records linked both ways.

---

## 15. Notifications

### 15.1 What raises a notification

Three things write a notification:

- **Escalate** on a request (type *escalation*);
- a supplier's sourcing response, and an award (type *status update*);
- a support ticket being raised, answered or resolved (type *status update*).

Nothing else does — a request changing stage, an approval falling due, an SLA breach or a comment
raises no notification. Older rows of other types (approval request, SLA warning, comment, system
alert, AI insight) are seeded examples.

**One shared feed.** A notification has no recipient: everyone sees the same feed, and *Mark all
read* marks it read for everyone.

### 15.2 Where they are read

The **bell** in the top bar shows the unread count and opens **Notifications** — the feed grouped
by date, filtered by type, with mark read and mark all read. Home's **Mentions** widget lists the
comments where someone @-mentioned the person (§3.2).

### 15.3 Preferences

Settings holds notification preferences — in-app, email and mobile push channels, quiet hours
and a daily digest (on by default). **They are saved and read by nothing**: no email or push is
sent, and the in-app choice does not filter the feed.

---

## 16. Data Model

The platform's records live in its own database, and [`db/schema.sql`](../../db/schema.sql) is
their authoritative definition ([ARCHITECTURE.md §4.2](../ARCHITECTURE.md#42-schema-and-change)).
This section names the records, what each holds for the business and how they connect; it does
not list every field. Some values are worked out when read rather than stored: a supplier's active
contracts and twelve-month spend, a request's days in its current stage, and the requests linked
to a contract.

### 16.1 Demand and the buying chain

| Record | What it holds, and what it links to |
|---|---|
| **Request** | The demand: title and description, category and commodity code (with the codes offered), value and currency, priority and urgency, need-by date, cost centre and budget owner, buying channel, current stage and its deadline, refer-back count, and attachments with their text; the requester, who it is for and its owner. It keeps the determination made at submission — sourcing type, approval chain, inherent-risk and materiality tiers, whether a risk assessment is required, the screening outcome and disposition, and why a non-preferred supplier was chosen — and links to its supplier, contract, risk assessment, requisition, purchase order and workflow template |
| **Service description** | For a request: its sections, the narrative, the quality score and checks, and the governance signals that made sections mandatory |
| **Intake compliance record** | For a request: the channel decision, the supplier risk-assessment check, the policy checks ("not run" included), the risk flags and the assessments reused |
| **Purchase requisition** | For a catalogue order or a call-off: status (draft, submitted, pending approval, risk review, contract amendment required, approved, PO created, cancelled), supplier, contract and its scope version, value and dates, purpose, charging and delivery, whether approval, risk review or a contract amendment is needed, and the evidence of the contract match |
| **Request line** | A line of that order: description, quantity, unit and price, supplier, contract, catalogue item, commodity code |
| **Supplier candidate** | A supplier named for a request's sourcing, and whether it is preferred |

A request's stage is one of draft, intake, validation, approval, risk, onboarding, sourcing,
contracting, PO, receipt, invoice, payment, completed, cancelled and referred back; its channel is
procurement-led, business-led, framework call-off or catalogue; its priority low, medium, high or
urgent. Categories are configured (§14.10).

### 16.2 Workflow and approvals

| Record | What it holds, and what it links to |
|---|---|
| **Workflow template** | A channel's lifecycle (§14.3): the channels it claims, its stages (owner role, deadline in working days, gate, purpose, what the requester does), the branches and their conditions, and the requester wording |
| **Workflow instance, stage history, stage detail** | Where a request is in its template; each stage it entered and left, with owner, action and notes; and per stage the handler, decision, forms completed, documents added and deadline status |
| **Approval chain, role** | A chain's steps and value band, and which system role acts as each role (§14.4) |
| **Approval** | One step for one request: its order, role, the person asked or any holder of the role, status (pending, approved, rejected, delegated, information requested, or withdrawn when the request was cancelled first), dates, comments, the delegate, and who actually decided |
| **Form template, form submission** | A stage's form (§14.2); the answers given to it for a request at a stage, and by whom |
| **Comment** | On a request, optionally at a stage: internal or not, @-mentions, and who has read it |

### 16.3 Suppliers, sourcing and contracts

| Record | What it holds, and what it links to |
|---|---|
| **Supplier** | Name, country, address and DUNS number, risk rating (low, medium, high, critical), onboarding, screening status with the screening's reference and date, risk-assessment status with its expiry and the assessment it stands on, the categories it serves, tier, primary contact, certifications, spend history and performance score; whether it is prospective, and the request that brought it in |
| **Risk assessment** | About a supplier or a contract: category (security, financial, operational, data privacy, compliance, ESG), risk level and score, status, assessor, validity, summary, mitigations, the data class it covers, whether it can be reused, and the requests it serves |
| **Sourcing event, response** | An event raised from a request — type, status, budget, dates, requirements and evaluation criteria, the awarded supplier — and each invited supplier's response: status, price, lead time, scores, whether shortlisted, whether awarded (one per event) |
| **Contract** | Supplier, value, dates, the recorded status (draft, under review, active, expiring, expired, terminated) — shown as read from the end date against the renewal window (§9) — owner, department, category, renewal date, utilisation |
| **Contract scope** | What a contract covers, dated: narrative, service family, eligible categories, geographies, business units, call-off requirements, deliverables and exclusions — what the contract match (§4.2) reads |

### 16.4 Purchasing

| Record | What it holds, and what it links to |
|---|---|
| **Purchase order** | Internal: supplier, value, status (draft, submitted, acknowledged, received, partially received, closed), dates, owner, charging and delivery, the request, requisition and contract behind it, and line items with the quantity received |
| **Goods receipt** | What was received against a purchase order, by whom and when |
| **Invoice** | Supplier, amount, status (submitted, under review, matched, approved, scheduled, paid, disputed), dates, the purchase order, and the match — matched, partial match, unmatched or variance — with the variance |
| **Catalogue item** | Name, description, price and unit, catalogue, supplier and part number, the contract it is bought under, the risk assessment behind it, commodity code, lead time, availability |

Supplier payment and banking details are not in the database: they are read from a fixed data set
in code (§13.3).

### 16.5 Support and the assistant

| Record | What it holds, and what it links to |
|---|---|
| **Support ticket** | Summary, context and the conversation it was raised from, category, priority, status, owner, due time, resolution; its replies and internal notes; links to the records it concerns (§18) |
| **Assistant conversation, vote** | A person's conversations with the assistant; a helpful or not-helpful vote on an answer |
| **Preferences** | Per person: facts the assistant was asked to remember, an out-of-office end date, notification settings |
| **Notification** | One shared feed (§15) |
| **Audit entry** | §14.8 |
| **Hand-over record** | §13.2 |

### 16.6 Configuration

| Record | What it holds |
|---|---|
| **Person** | Name, email, system role, department, country; out of office and delegate (§14.6) |
| **Decisioning thresholds** | One record of every governed number, the category lists and the switch, with who changed it last (§14.9) |
| **Routing rule** | Conditions, channel, optional chain, status and order (§14.1) |
| **Category** | Label, description, keywords and their order, catalogue eligibility, commodity codes, supplier tags; its managers and preferred suppliers (§14.10) |
| **Service-description template** | Per category, with a default (§14.11) |
| **Knowledge-base article** | Title, body, topic and order (§14.12) |
| **AI agent** | Status and description, and the Status Answers agent's configuration (§14.15) |
| **Cost centre, delivery location, procurement profile, support SLA** | §14.13, §14.14; a procurement profile holds a person's checkout defaults |

Three older records are read by nothing: the compliance reports of the retired compliance reviewer
(§12.1), monthly KPI snapshots, and an earlier per-request assistant history.

---

## 17. Classification & Routing Rules

### 17.1 Procurement Categories

Categories are configuration: Admin → Categories (§14.10) holds each one's label, description,
keywords and their order, commodity codes, and whether the catalogue may serve it. As shipped:

| Category | Covers | Catalogue may serve it |
|---|---|---|
| Catalogue Purchase | Standard catalogue items — office supplies, peripherals, stationery. Marks catalogue-type demand; a request is not classified into it (below). | Yes |
| Goods | Physical products: hardware, equipment, furniture, raw materials, branded merchandise | Yes |
| Services | Ongoing operational services: cleaning, catering, facilities, security, translation, travel management, HR administration, managed print, maintenance, payroll | No |
| Software / IT | Software licences, SaaS and PaaS, cloud platforms, subscriptions, APIs and IT tools | No |
| Consulting | Advisory and project work: strategy, operating model, transformation, organisational design, change and programme management, business cases, assessments, audits, due diligence, feasibility studies | No |
| Contingent Labour | Temporary staff, contractors, interim roles and IT staffing working under the buyer's direction | No |

**How New request classifies a demand (§4.2):**

1. With AI-001 active (§12.1), the language model chooses among the active categories from their
   labels and descriptions.
2. Otherwise, or when the model does not answer, the keywords decide: the first category, in the
   configured order, one of whose keywords begins a word in the demand; if none, Goods. As
   shipped, Consulting is tried before Services, and Goods last.
3. *Catalogue Purchase* is taken as a signal to check the catalogue, not as the category: the
   demand is classified again without it. An answer that is not an active category falls back to
   the keywords.
4. The commodity code is the category's configured code whose keywords best match the description
   (the demand's own category wins a tie), else the category's default code. The requester
   confirms it or picks another.

Renewals and new suppliers are not categories. *Contract renewal* and *Supplier onboarding* were
retired on 2026-09-25 and kept inactive, so older requests keep them. A renewal is classified by
what is being bought, and the contract check recognises it when the covering contract is expiring;
*Start renewal* on a contract opens New request with the demand written (§4.1). A new supplier is
the Vendor Onboarding stage inside the request.

### 17.2 Buying Channel Determination Logic

Catalogue and framework call-off come first, and only from a match: a catalogue item the requester
orders (§4.5), or a contract that covers the demand at or below the direct call-off limit (§14.9).
Every other demand goes to the routing rules (§14.1), which choose business-led or
procurement-led.

Rules are tried in priority order, then by id. The first active rule whose conditions all hold
decides the channel, and may name an approval chain. A condition can test the category, value,
supplier chosen, the supplier's risk rating, whether a covering contract was found, the inherent
risk tier, materiality, the commodity code or the urgent flag, and can name a Decisioning
threshold. If no rule matches, the request is procurement-led — fixed in code.

The shipped rules, in the order they are tried:

| Rule | When | Channel |
|---|---|---|
| RR-003 | The category is Consulting | Procurement-led |
| RR-010 | The request is marked urgent | Procurement-led |
| RR-012 | The chosen supplier's risk rating is high or critical | Procurement-led, Compliance Escalation chain |
| RR-013 | The category is Contingent Labour | Procurement-led |
| RR-902 | The value is above the budget approval threshold | Procurement-led |
| RR-904 | The value is at or below the business-led ceiling | Business-led |
| RR-905 | Any other demand | Procurement-led |

A business-led request is bought by the business itself, and still passes approval and, before
the purchase order, Contracting with Legal (§14.3).

### 17.3 Threshold Rules

Who approves is set by approval chains (§14.4). A routing rule can name a chain — RR-012 names
*Compliance Escalation*: supplier manager, legal, then category manager. Otherwise the chain whose
value band holds the request's value applies, the lower bound included and the upper excluded. As
shipped:

| Value | Approvers | Bounds |
|---|---|---|
| Below €10,000 | Category manager | €10,000 is written into the band, not a Decisioning threshold |
| €10,000 up to the budget approval threshold | Budget owner, category manager, finance | Upper bound names the budget approval threshold |
| Budget approval threshold up to the delegated authority threshold | As above, plus VP Procurement | Both bounds name thresholds |
| The delegated authority threshold and above | As above, plus CFO and Board | Lower bound names the delegated authority threshold |

A contract call-off asks the contract's owner first. A supplier outside the category's preferred
list adds the category manager when *Category manager approves a non-preferred supplier* is on
(§14.9) and the chain does not already ask them. A catalogue order or call-off needs no approval up
to the catalogue auto-approval threshold (§4.5).

---

## 18. Help and Support

Help is in every role's sidebar: **AI Assistant** (§3.5), **Knowledge Base**, **Contact Support**,
and — for the roles that work tickets (administrator, procurement manager, operations lead) —
**Ticket Inbox**.

### 18.1 Knowledge Base

The policy and how-to articles, grouped by topic in the configured order — the same entries the
assistant and the Home box answer from. An article's figures (a threshold, the approval chains, a
category's preferred suppliers) are references to the configuration, rendered as it stands, so an
article cannot drift from what the platform does. Articles are edited in Admin → KB Management
(§14.12).

### 18.2 Contact Support

A person raises a ticket with a category (General, Technical, Billing, Feature Request, Bug
Report), a priority (Low, Medium, High), a subject and a description, and sees their own tickets
with the replies on them. The page suggests trying the assistant first. Asking the assistant for a
person raises a ticket too, carrying the whole conversation (§3.5).

Beside the form the page shows a fixed *Support Information* panel — an email address, business
hours, a response time and an emergency number. **These are placeholder text, not
configuration**: the response time there is not the configured Support SLAs.

### 18.3 Ticket Inbox and SLAs

Every ticket is given a **first-response deadline** when it is created, from the Support SLAs
configured per priority (§14.13); a changed target applies to new tickets. The inbox shows the
queue in standing views — **Unassigned** first, **Breaching** (at risk or past the deadline),
**Mine**, **All open** and **All** — filtered by priority and category, and each ticket's SLA state is
worked out as the queue is read, so a ticket that crosses its deadline reads as breached without a
refresh.

A ticket opens in a drawer beside the queue: what it is about — links to the requests, purchase
orders, suppliers, contracts and invoices concerned, picked from the records rather than typed —
then the actions (assign, forward with a handover note, change status, reply) and the thread.
Statuses: open, in progress, waiting on the user, resolved, cancelled.

---

*End of Functional Specification*
