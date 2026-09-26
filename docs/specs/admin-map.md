# Admin map — what each item is for, and what reads it

Every item under **Admin** in the sidebar, in menu order. For each: its job, where
it is stored, and what in the platform actually reads it. An item with nothing
reading it would not be here — the review of 2026-09-25 removed what was
hardcoded or unused, and each row says what went.

The rule the configuration follows: **one job per surface, and no surface restates
a fact another owns.** Numbers live in Decisioning Thresholds; rules, chains,
branches, forms and articles *name* them (`policy:<key>`) rather than repeat them.

| Item | What it is for | Stored in | What reads it | Removed or changed (2026-09-25) |
|---|---|---|---|---|
| **Database** | Maintain the records other screens show: suppliers, contracts, risk assessments, purchase orders, invoices, requests, approvals, sourcing events, catalogue items | Each entity's own table, through `/api/db` | The screens for those records | The Workflows tab (a read-only copy of the Workflow Designer) and "Reset session edits" (nothing session-only was left to reset) |
| **Categories** | The demand taxonomy — *what kind of thing* is being bought. Per category: label and description, classifier keywords and order, catalogue eligibility, **commodity codes** (a default code and keyword codes), managers, preferred suppliers, supplier tags | `procurement_categories`, `category_managers`, `category_preferred_suppliers` | Classification (the offline keywords, and the AI classifier's prompt built from label + description); the catalogue check (eligibility); commodity-code resolution; approvals and the validation gate (managers); supplier preference and quotes (preferred suppliers); knowledge-base articles | `icon` (never shown); `timeline_days` (a second "how long" that disagreed with the workflow); the classifier's regex list moved in as keywords |
| **Cost Centres** | What a request is charged to; its **owner** is the Budget Owner who approves | `cost_centres` | The pickers in intake, the catalogue and call-off checkouts and the requester's profile; the governed checkout (rejects an unknown or retired centre); approval derivation | An ownerless centre's Budget Owner step goes to procurement managers. **All 44 seeded centres have no owner** — assigning them is a governance decision, flagged on the page |
| **Delivery Locations** | Where a catalogue or call-off order is delivered | `delivery_locations` | The governed checkout (validates the id, shows the label) | Address and country (read by nothing) |
| **Support SLAs** | How soon a support ticket needs a first response, in hours per priority | `sla_targets` (stage `ticket`) | Ticket creation (`due_at`) and the ticket queue | Was a read-only copy of the workflow's stage SLAs while these rows had no editor. Stage SLAs are set on the stage, in the Workflow Designer |
| **Routing Rules** | *Which buying channel* a demand takes, and optionally a forced approval chain. Checked in priority order; the first active match decides | `routing_rules` | The New request conversation's *how it is bought* phase, the determination behind the Channel page, and the intake submit gate — one evaluator | RR-001, RR-006, RR-011 (could never change an outcome); the `region` and `priority` fields (never supplied / duplicated urgency); categories now from configuration; RR-012 (a high-risk supplier → compliance chain) switched on — it compared a supplier id with a risk scale and could never match |
| **Decisioning Thresholds** | *The numbers* every decision compares against — 19 numbers, 2 category lists, 1 switch. Each shows **where the code uses it** and **the configuration that names it**, read live | `procurement_policy_configs` (via `/api/policy-config`) | Every decision listed under the number on the page; `delegatedAuthorityThreshold` is used only by the approval-chain bands | A catalogue order of exactly the auto-approval threshold is automatic (the checkout held it; the workflow, Home answer and knowledge base all said "up to") |
| **Service Description** | The prompt that generates the service description, the questions intake asks, what is generated, and what a sourcing event starts with | `service_description_templates` (a `default` row; categories without one inherit it) | Generation (`api/generate-sow`), the intake conversation (`api/chat-intake`), sourcing-event seeds, form pre-population | The built-in template is **stored** as the default row — the table was empty, so everything ran on code |
| **Form Builder** | Evidence a workflow stage collects, and whether leaving the stage waits on it | `form_templates`, `form_submissions` | The request's Workflow tab (renders a form on its stage when its conditions hold) and the stage gate (blocking forms) | FORM-001 Risk Assessment Triage, FORM-007 Goods Receipt Confirmation, FORM-008 Change Request and their seeded submissions — none ever rendered. Five forms, all active |
| **Approval Chains** | *Who approves*, over which value band; bands name thresholds. **Roles**: which system role acts as Finance, Legal, CFO, Vendor management… | `approval_chains`, `functional_roles` | Approval derivation (the approvers the Channel page names — the ones submit writes — and the approval stage), Home's "who approves…" answer, the knowledge base's `{{approval-chains}}` | Invented "referenced by" lists; descriptions restating the band; the role map moved from code to the Roles table; nobody may approve their own request |
| **Workflow Designer** | The lifecycle of each buying channel — stages, owner roles, deadlines in working days, gates, branches, and **what the requester does at a stage** | `workflow_templates` (WF-001 procurement-led, WF-002 catalogue, WF-006 business-led, WF-008 call-off) | The workflow engine, the request stepper, SLA deadlines, the "how long" figures shown at intake, the Channel page's step by step ("You: …"), the request's Workflow tab | The side processes WF-003 onboarding and WF-004 renewal (nothing started them; both are ordinary demands now) |
| **AI Agent Configuration** | The switches on what is automated, each described as it works: AI-001 classifier, AI-002 request validator, AI-004 spend anomaly checks, AI-005 supplier recommender, AI-007 status answers (with its attribute and role × object configuration) | `ai_agents` | The New request conversation — reading what is needed (AI-001) and suggesting suppliers (AI-005); the Channel page's policy checks (AI-002); Analytics (AI-004); the Home box and assistant (AI-007) | AI-003 (relabelled a disabled button); AI-006 and its 14 stored reports (its checks were recorded as passes without running); invented accuracy, decision counts, random charts and canned test results |
| **KB Management** | The policy and how-to articles, with governed figures as references; each has a topic and order | `knowledge_base` | The assistant, the Home box's policy answers, and **Help → Knowledge Base** (by topic) | The Help page's own twelve hardcoded articles and its feedback buttons that recorded nothing; six rewritten as entries |
| **AI Analytics** | How the assistant is used: conversations and questions per day, helpful / not-helpful votes | `assistant_conversations`, `chat_feedback` (read only) | — (a report) | — |
| **User Management** | Who uses the platform and in which system role | `users` | Approver resolution (who holds each system role), cost-centre owners and category managers (picked from it), request owners and assignees across the workflow screens | — |
| **System Health** | What happened to the recorded handovers to upstream systems — completed, open, failed | `system_integrations` (read only) | — (a report) | Earlier: invented uptime, error rate, session counts and "Connected" cards |
| **Audit Log** | What happened, and who did it — filter and export as CSV | `audit_entries` | — (a report) | 40 invented entries and an IP column that was always "-" |

## The three questions this answers

**What do Categories do — they don't look like commodity codes?** They are not.
A category is the broad *kind* of demand — consulting, software, goods… — and it
decides routing (consulting and contingent labour are procurement-led), who
validates and approves (the category's managers), whether the catalogue can serve
it, and which suppliers are preferred. **Commodity codes sit beneath each
category**: every category has a default code and keyword codes, and the
commodity code on a request is resolved within its category.

**Are all decisioning thresholds real, and how do they differ from routing rules?**
All 22 are read — each shows where on the page. **Thresholds are the numbers;
routing rules decide what happens.** A rule says "above the budget approval
threshold, procurement-led" and names the threshold rather than typing €100,000,
so moving the number on the thresholds page moves every rule, chain band,
workflow branch and article that names it. The same split holds for approval
chains (who approves over a band) and workflow branches (which stage comes next).

**Is the Form Builder used?** Yes — five forms, each on the workflow stage whose
evidence it collects (risk questionnaire and IT security on the risk stage,
vendor onboarding, contract intake, budget approval). A form renders on the
request's Workflow tab when its stage and conditions hold, and a blocking form
holds the stage until it is submitted. The three that never rendered were
deleted.

## Kept on purpose

- **Built-in fallbacks** (the service-description template, the knowledge base,
  the category seed) remain in code as the fail-open floor for an unreadable
  table, never as the configuration: each table holds the stored rows.
- **The `BuyingChannel` vocabulary** stays in code — it is the type the submit
  gate checks against; which stages a channel runs is data (Workflow Designer).
- **Columns no longer read** (`procurement_categories.icon`/`timeline_days`,
  `delivery_locations.address`/`country_code`, `ai_agents.accuracy`/`decisions_made`,
  `approval_chains.referenced_by`, `intake_compliance_records.duplicate_check`, the
  empty `compliance_reports` table) stay until a separate drop, so a deployed
  older build keeps working — the database rule is add, deploy, backfill, then
  remove.
