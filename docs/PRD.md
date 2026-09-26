# Product requirements — Procurement Orchestration Platform

**What this document is:** why the platform exists, who it is for, what it
commits to, and what Release 1 does and does not include. It is the first thing
to read, and it is kept short on purpose: the detail lives in the documents it
links to, each of which owns one kind of fact (see [the documentation
map](README.md)).

**What it is not:** a feature reference (that is the [functional
specification](specs/functional-specification.md) and the numbered
[requirements](specs/requirements/)), a record of how it is built
([ARCHITECTURE.md](ARCHITECTURE.md)), or the rules for working in the repo
([AGENTS.md](../AGENTS.md)).

---

## 1. Purpose

A **standardised procurement orchestration platform**: one front door for every
procurement need, and the internal system of record behind it. A requester says
what they need; the platform works out what it is, checks whether the catalogue
or an existing contract already covers it, decides how it will be bought, asks
only what that route still needs, and then creates and runs the internal record
— request, purchase requisition, internal purchase order, workflow, sourcing,
approvals — through to receipt, invoice and payment.

The operating model, end to end:

> describe → classify → check → recommend → route → create internal records → track and govern

It is built as a **reusable product**, not for one organisation: nothing in it
names a client or a sector, and everything an organisation would tune — the
thresholds, the routing, the approval chains, the lifecycles, the forms, the
category taxonomy — is configuration.

## 2. The problem

- **Demand arrives everywhere.** Email, calls and spreadsheets, each missing
  something, none of them checked against what already exists — so catalogue
  items get sourced and existing contracts get ignored.
- **Classification and routing are manual.** Which category, which buying
  channel, who approves: decided by whoever picks the request up, differently
  each time.
- **Controls are applied late, or not at all.** Policy checks, risk
  assessments and approval thresholds are found at the end, or recorded as done
  when they were not.
- **Nobody can see where a request is.** Requesters chase; buyers cannot see
  the bottleneck; nobody knows what is overdue.
- **The rules live in people and code.** Changing a threshold or an approver
  means a change request, and the same number is restated in several places
  that drift apart.

## 3. Who it is for

| Persona | What they need from it |
|---|---|
| **Business requester** (service owner) | Say what they need in their own words, see how it will be bought before submitting, and track it without chasing anyone |
| **Procurement manager** | One pipeline of demand, the right channel chosen consistently, sourcing and approvals that run themselves |
| **Vendor manager** | Validation and supplier compliance in one queue, with the evidence behind each request |
| **Operations lead** | Where work is stuck, what is overdue against its SLA, and why |
| **External supplier** | A portal for onboarding, sourcing invitations, invoices and messages |
| **Administrator** | The configuration — thresholds, rules, chains, workflows, forms, categories, agents — changed without a release |

In depth: [personas](specs/personas.md) (what each sees, accesses and does) and
the [plain-language version](specs/personas-business.md) for stakeholders.

## 4. Product principles

These shape every feature. Each is enforced — the rule that holds it is named.

1. **White-label.** No organisation or sector is named anywhere — code,
   labels, knowledge base or docs. Client terms are generalised (a *category
   taxonomy*, a *third-party risk register*). ([AGENTS.md](../AGENTS.md) rule 1)
2. **Own the internal record; defer upstream execution.** The platform owns the
   request → requisition → internal purchase order chain and every record around
   it, in its own store. It does not write to ERP, contract-management, payment,
   supplier-network or risk-provider systems in Release 1: the user is given a
   deep link, and the assistant proposes and never executes an upstream write.
   ([AGENTS.md](../AGENTS.md) rules 2–3, [ADR-0002](adr/0002-governed-catalogue-checkout.md))
3. **Honest records.** Anything that creates a record is decided again on the
   server from stored data, and is idempotent. A check that did not run is never
   recorded as passed — a `pass` written for a screening nobody performed is
   worse than no record at all. ([AGENTS.md](../AGENTS.md) rule 3,
   [ADR-0007](adr/0007-atomic-intake-and-lifecycle-stabilisation.md))
4. **Configuration, not code.** Every number a decision compares against is a
   governed threshold; routing rules, approval chains, workflow branches, forms
   and knowledge-base articles *name* it rather than restate it. Nothing is
   hardcoded that an administrator would expect to change, and nothing is
   configurable that nothing reads. ([ARCHITECTURE.md §6](ARCHITECTURE.md#6-configuration),
   [the admin map](specs/admin-map.md))
5. **Ask before concluding.** Every question is asked before any conclusion is
   shown, and each question says why it is asked. There is one requester
   interface: the evidence behind every conclusion is there for everyone,
   collapsed by default, and anything that blocks a request is never hidden.
   ([ADR-0008](adr/0008-one-standardised-requester-ui.md))
6. **AI assists; the rules decide.** A language model reads the requester's
   words and phrases the questions; which question comes next, which channel a
   demand takes, who approves and whether a record may be written are decided
   by deterministic rules, which also answer when the model is unavailable. The
   models in use are a governed product decision. ([AGENTS.md](../AGENTS.md)
   rule 5)

## 5. Release 1 scope

Release 1 is an internally operated platform on a private database. It owns the
request, purchase requisition, internal purchase order, workflow, sourcing,
supplier, contract, risk, catalogue, ticket, conversation and audit records.

| Area | What Release 1 does | Detail |
|---|---|---|
| **Home — the two doors** | One box that answers what it can in place (where a request is, what policy says, a catalogue item that fits) and starts a request for anything to buy; a second door to the catalogue for those who buy | [Spec §3](specs/functional-specification.md#3-home-page--navigation), [FR-01](specs/requirements/01-intake-new-request.md) |
| **Door 1 — New request** | A conversation: *what you need* (read back as a category and code), *how it is bought* (the catalogue and contracts first, then the channel), *what it needs* (a call-off's details, or the service description, the supplier and the risk questions); the request builds beside it. Then the **Channel page** — every stage it will go through and why, the approvers, the checks — and submit | [Spec §4](specs/functional-specification.md#4-request-intake--management), [FR-01](specs/requirements/01-intake-new-request.md) |
| **Door 2 — the catalogue** | A basket of pre-approved items, placed as one order per supplier and approved on the basket total ([ADR-0009](adr/0009-catalogue-basket.md)) | [Spec §4.5](specs/functional-specification.md#45-catalogue--door-2) |
| **Decisioning** | Classification, the buying channel, materiality and risk, approval to source, contract and sourcing type, policy checks — one determination, recorded as the compliance record | [FR-01](specs/requirements/01-intake-new-request.md), [Spec §6](specs/functional-specification.md#6-compliance--risk) |
| **Lifecycle and workflow** | Request → requisition → internal PO, goods receipt, invoice and three-way match; each buying channel's lifecycle as a workflow template, with stage owners, SLAs and gates; atomic stage transitions | [FR-02](specs/requirements/02-workflow-orchestration.md), [FR-08](specs/requirements/08-procure-to-pay.md) |
| **Approvals** | Approvers derived from the records — value-banded chains, category managers, cost-centre owners, contract owners; delegation | [FR-03](specs/requirements/03-approvals-delegation.md) |
| **Suppliers, sourcing, contracts** | The supplier directory and 360 profile, onboarding gates, the supplier portal; sourcing events raised from a request, scored responses and an award written back; the contract register with renewals | [FR-04](specs/requirements/04-supplier-management.md), [FR-05](specs/requirements/05-supplier-portal.md), [FR-06](specs/requirements/06-sourcing-evaluation.md), [FR-07](specs/requirements/07-contracts.md) |
| **Assistant and knowledge** | The same question route as Home, answers grounded in a knowledge base whose figures are linked to the live configuration, confirmed internal actions that really write, and support hand-off | [FR-11](specs/requirements/11-ai-assistant-knowledge.md) |
| **Support** | A ticket inbox with priority-based first-response SLAs, fed by Contact Support and the assistant | [Spec §18](specs/functional-specification.md#18-help-and-support) |
| **Administration** | The configuration above, each item with one job — what it is for, where it is stored and what reads it | [The admin map](specs/admin-map.md), [FR-10](specs/requirements/10-admin-configuration.md) |
| **Analytics** | Spend, compliance, pipeline and cycle-time dashboards; role-based, customisable home dashboards | [FR-09](specs/requirements/09-analytics-reporting.md) |

**Position against this scope** — what is built, partial or deferred, area by
area — is the [R1 roadmap](roadmap/R1_BACKLOG_FIT_GAP.md), with its [evidence
index](roadmap/R1_IMPLEMENTATION_EVIDENCE.md). The stories and their acceptance
criteria are the [product backlog](roadmap/PRODUCT_BACKLOG.md).

### Not in Release 1

- **Writes to upstream systems** — ERP, contract management, payment, supplier
  networks, risk providers. Their records are held as internal handovers; the
  source-connector layer is the seam that Release 2 fills.
- **External data feeds** — supplier risk, sanctions, financial and ESG
  screening.
- **Punchout, e-signature, and upstream PO, invoice or payment execution.**
- **Authentication and authorization.** The role switcher is a simulation for
  demonstrations and acceptance testing, not an access boundary
  ([ADR-0003](adr/0003-private-neon-database-migration.md)). This must be closed
  before any real pilot.
- **Duplicate-request search.** None exists, and the compliance record says so
  rather than claiming one ran.
- **A data warehouse or spend cube, Teams, vector search.**

## 6. How Release 1 is judged

Release 1 is complete when ([R1 exit
criteria](roadmap/R1_BACKLOG_FIT_GAP.md#r1-exit-criteria)):

- every capability marked Built passes the tests its evidence lists;
- the private database is the only store, and no browser bundle holds a
  database credential;
- internal request, requisition, PO, workflow and sourcing writes are atomic and
  idempotent;
- every route and role-switch path has a documented browser check;
- partial or demonstration surfaces are labelled as such and never imply
  upstream execution;
- external integrations and authentication are explicitly deferred, not shown
  as silently working.

The platform already measures itself in places: classification accuracy and
intake-routing accuracy against labelled sets (`test:classification-eval`,
`test:intake-routing-eval`, with baselines), and cycle time, SLA breaches and
policy compliance on its own dashboards. **No numeric product targets are set
yet** — what "good" is for adoption, cycle time or first-time-right is an open
product decision, not something this document should invent.

## 7. Releases

- **Release 1 (now)** — the internal system of record and its front door,
  hardened: see the [ordered backlog](roadmap/R1_BACKLOG_FIT_GAP.md#ordered-backlog).
- **Release 2** — integrations and enterprise hardening: live connectors
  replacing the own-store ones behind the same ports, upstream execution,
  external risk feeds, authentication (SSO/SCIM, server-derived roles, tenant
  isolation), a data warehouse.

## 8. Decisions

Decisions that set a boundary are recorded as [architecture decision
records](adr/), context → decision → consequences. Delivery-level decisions are
recorded in the requirement or story they govern.
