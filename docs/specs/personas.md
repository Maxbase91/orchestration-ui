# Personas & Access Model — Procurement Orchestration Platform

**Purpose.** Define each user persona: who they are, what they see, what they can access, what
they actually *do*, and how complex the experience is for them — **in Release 1** (the current
read/classify/recommend/route scope) **and in the end state** (live execution + automation). Use this
to size onboarding, training, permissions, and where to invest UX effort per persona.

This is grounded in the implemented access model: roles (`src/config/roles.ts`), route guards
(`src/App.tsx`), the role-based landing widgets (`src/features/dashboard/widget-registry.tsx`), and the
front-door / approval flows. Standardised and organisation-agnostic — no client- or sector-specific framing.

> **Scope reminder (R1).** The front door **classifies, recommends and routes**; it does **not** execute
> upstream writes. Users act through **deep-links**, and the **determination screen is the R1 endpoint**.
> The assistant **proposes** actions (confirm-before-act). End-state lifts that boundary to live execution.

---

## 1. The six personas at a glance

| Persona (role id) | Who they are | Primary job | R1 complexity | End-state complexity |
|---|---|---|---|---|
| **Requestor / End User** (`service-owner`) | Any business user who needs to buy something | Describe a need → get a routed determination → track it | **Low** — occasional, guided, conversational | **Low** — even more automated; most needs self-serve |
| **Strategic Procurement Manager** (`procurement-manager`) | Owns the demand pipeline & sourcing strategy | Oversee demand, steer sourcing, approve, manage suppliers/contracts | **High** — daily power user, control tower | **High** — orchestrates more, executes live |
| **Vendor Manager** (`vendor-manager`) | Owns supplier validation, risk & compliance | Validate demands, run sourcing, manage supplier risk | **Medium-High** — specialist | **High** — live screening/risk integrations |
| **Procurement Operations Lead** (`operations-lead`) | Owns operational throughput | Keep workflows healthy, clear bottlenecks, hit SLAs | **Medium-High** — operations cockpit | **Medium** — more is automated/self-healing |
| **Admin / Platform Owner** (`admin`) | Configures the platform | Set rules, thresholds, workflows, users, AI agents, policies | **High / Expert** — configuration & governance | **Expert** — governs live integrations + models |
| **Supplier (External)** (`supplier`) | A third-party vendor | Self-service: onboard, respond to sourcing, submit invoices | **Low-Medium** — isolated portal | **Medium** — deeper two-way integration |

**Two audiences, two surfaces.** Five **internal** roles share the main app shell; the **supplier** is
external and lands in an **isolated portal** (`/portal/*`) — it never sees internal screens.

---

## 2. Access matrix (what each persona can reach)

Derived from the route guards in `src/App.tsx`. ✓ = full access · — = no access · ↪ = redirected.

| Area | Requestor | Proc. Manager | Vendor Mgr | Ops Lead | Admin | Supplier |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Landing / dashboard** (`/`) | ✓ | ✓ | ✓ | ✓ | ✓ | ↪ portal |
| **Requests** (intake, list, detail) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Approvals & tasks** | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Workflows & pipeline** | — | ✓ | — | ✓ | ✓ | — |
| **Sourcing & evaluation** | — | ✓ | ✓ | — | ✓ | — |
| **Suppliers** (directory, risk, onboarding) | — | ✓ | ✓ | ✓ | ✓ | — |
| **Contracts** | — | ✓ | — | ✓ | ✓ | — |
| **Purchasing** (PO, receipt, invoice, match, pay) | — | ✓ | — | ✓ | ✓ | — |
| **Analytics & reports** | — | ✓ | — | ✓ | ✓ | — |
| **Admin config** (`/admin/*`) | — | — | — | — | ✓ | — |
| **Notifications · Settings · Help/Assistant** | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Supplier portal** (`/portal/*`) | — | — | — | — | — | ✓ |

**Read at a glance:** the **Requestor** is the most contained internal role (intake + their own
requests/approvals only). The **Procurement Manager** and **Admin** are the widest. The **Supplier** is
walled off in its own portal.

---

## 3. Persona deep-dives

### 3.1 Requestor / End User — `service-owner` · complexity: **Low**

**About.** A non-procurement business user (any department) who occasionally needs to buy something and
should *not* need to understand procurement mechanics. The whole front door is designed to keep this
persona's complexity low.

**Landing.** Decluttered, action-first: **My Requests** (their open demands, with "actions required"
flags), Quick Stats, Expiring Contracts, AI Insights. Quick actions: *New Request, Track a Request, My
Approvals, Ask AI, Browse Catalogue*.

**What they do in R1.**
- **Intake**: describe the need in free text → the staged funnel derives the path (catalogue → contract →
  full service description) and asks only the residual questions criteria demand. No category picking, no
  manual SOW generation — it's conversational (INT-/CLS-/CHK-/RSK-/DET- capabilities).
- **Determination**: receive the routed outcome (buying channel, materiality, contract/sourcing type,
  approval-to-source, next-steps with deep-links) — **the endpoint**. They act via the deep-links.
- **Track**: follow status; respond to "refer back / request change"; give approvals where they're the
  budget owner.
- **Ask the assistant** policy questions (grounded answers) and look up their own items.

**End-state.** Even lower friction: more demands fully self-serve (catalogue/transactable contract
auto-complete), the assistant *executes* the routed steps (confirm-before-act) instead of deep-linking,
and proactive nudges ("your contract expires in 30 days — renew?").

**Why complexity stays Low.** They touch one journey (intake → track), guided end-to-end. This is the
persona R1 most protects from complexity.

---

### 3.2 Strategic Procurement Manager — `procurement-manager` · complexity: **High**

**About.** The platform's power user and daily driver — owns the demand pipeline and sourcing strategy.
Also the **default approver** for most steps in R1 (Finance-Approver / Category-Manager approvals resolve
to this persona).

**Landing.** Control-tower: **Attention Required** first, then KPI strip (Open Demand, Cycle Time,
Compliance), Demand Pipeline, AI Insights. Quick actions: *New Request, All Requests, Active Workflows,
Supplier Directory, Spend Overview, Bottlenecks*.

**What they access.** Nearly everything operational: Requests, Approvals, **Workflows & Pipeline,
Sourcing, Suppliers, Contracts, Purchasing, Analytics** — not Admin config.

**What they do in R1.**
- Monitor the **demand & sourcing pipeline**; spot stuck/overdue/material demands.
- **Approve** their steps (the determination's approval-to-source gate routes here).
- Review **determinations**, supplier recommendations, contract coverage.
- Drive **sourcing events** and review supplier risk/contracts.

**End-state.** Orchestrates execution live (sourcing/contract/PO actions write to upstream systems),
benchmarking & savings analytics deepen, and more routing is automated so they manage exceptions, not
every demand.

**Why complexity is High.** Broadest surface, daily use, cross-functional decisions — invest the most UX
and training here.

---

### 3.3 Vendor Manager — `vendor-manager` · complexity: **Medium-High**

**About.** The supplier-side specialist: validates sourcing requests and owns supplier risk & compliance.

**Landing.** **Validation Queue** first, plus Quick Stats, Mentions, Supplier Risk, Recent Activity, AI
Insights. Quick actions: *All Requests, Risk & Compliance, Supplier Directory, Messages, My Approvals*.

**What they access.** Requests, Approvals, **Sourcing**, **Suppliers** (directory, risk, onboarding,
messages) — **not** Workflows/Pipeline, Contracts, Purchasing, or Analytics.

**What they do in R1.**
- Work the **validation queue** (permissibility, supplier suitability, screening).
- Own **supplier risk & compliance** views; surface flagged/expiring suppliers (the determination's
  screening + supplier-data checks route here).
- Participate in **sourcing** events and supplier messaging.

**End-state.** Live third-party screening/risk feeds, two-way supplier-portal collaboration, automated
re-assessment cycles.

---

### 3.4 Procurement Operations Lead — `operations-lead` · complexity: **Medium-High**

**About.** Owns operational throughput — keeps the machine running.

**Landing.** Operations cockpit: **Workflow Health**, **SLA Tracker**, Attention Required, Mentions, AI
Insights, Recent Activity. Quick actions: *Active Workflows, Bottlenecks, All Requests, My Tasks*.

**What they access.** Requests, Approvals/Tasks, **Workflows & Pipeline**, **Suppliers**, **Contracts**,
**Purchasing**, **Analytics** — not Sourcing or Admin.

**What they do in R1.**
- Monitor **workflow health, bottlenecks, SLAs**; unblock stuck requests.
- Oversee **purchasing** operations (PO, goods receipt, invoice/three-way match, payment tracking) and
  contract lifecycle.

**End-state.** More self-healing/automated workflows and SLA management; they shift from firefighting to
exception-handling and continuous improvement.

---

### 3.5 Admin / Platform Owner — `admin` · complexity: **High / Expert**

**About.** Configures and governs the platform. Sees everything internal **plus** the entire `/admin/*`
configuration plane (no other role can).

**Landing.** Platform health: System Health, Quick Stats, Workflow Health, Supplier Risk, Mentions, AI
Insights. Quick actions: *Routing Rules, Workflow Designer, User Management, Spend Overview*.

**What they configure (R1, all live and editable).**
- **Decisioning Thresholds** (`/admin/thresholds`) — the governed approval/materiality/risk/sourcing/
  contract thresholds, with a live simulation; **saving drives the live front door**.
- **Routing Rules**, **Approval Chains**, **Workflow Designer**, **Categories/Taxonomy**, **SLA Targets**,
  **Forms**, **AI Agents**, **Policy/KB management**, **Users** (CRUD), **Audit**, **System/AI analytics**.

**End-state.** Governs **live integrations** (connector swap-in), **model selection & governance**
(eval/guardrails), and richer policy/version management. The Expert persona.

**Why complexity is Expert.** Configuration + governance with system-wide blast radius — the persona that
most needs guardrails, simulation-before-save (already there for thresholds), and audit.

---

### 3.6 Supplier (External) — `supplier` · complexity: **Low-Medium**

**About.** A third-party vendor. **Isolated** in the supplier portal (`/portal/*`) with a distinct layout —
never sees any internal screen; the dashboard route redirects them to `/portal`.

**What they see/do in R1 (self-service).** Portal dashboard, **Profile** (incl. their own bank details),
**Onboarding** wizard, **Sourcing** events (respond), **Invoices** (submit), **Documents**, **Messages**.

**End-state.** Deeper two-way integration: live sourcing collaboration, automated onboarding/screening
status, invoice/payment status sync. Sensitive fields (banking/payment) remain masked to internal roles by
default and shown only to entitled roles.

---

## 4. Complexity ladder — where to invest

```
Low ───────────────────────────────────────────────► Expert
Requestor   Supplier   Vendor Mgr / Ops Lead   Proc. Manager   Admin
 (guided)   (portal)     (specialist)           (control tower) (config+governance)
```

- **R1 design intent:** push complexity *down* for the Requestor (the conversational front door does the
  hard work) and *concentrate* it in the Procurement Manager + Admin, who are trained power users.
- **End-state shift:** automation moves work off the Ops Lead and Requestor; the Manager/Admin take on
  live execution and governance — so the *top* of the ladder gets a bit heavier, the *bottom* lighter.

---

## 5. Implementation note — two role namespaces (current state → target)

Today there are **two role models** that are **bridged but not yet unified**:

1. **Six switchable personas** (`src/stores/auth-store.ts`, ids `u1–u6`) — the canonical role holders the
   role-switcher logs you in as, and what approvals resolve to (`approver-resolution.ts`).
2. **The editable users table** (`/admin/users`, ids `u1–u12`) — a larger directory with freeform
   functional roles ("Category Manager", "Finance Approver", …), now full CRUD.

Approvals were wired to bridge these (every approval step resolves to one of the six personas), but the
**role-switcher itself is still driven by the six hardcoded personas, not the users table**. The end-state
target is to **unify them** — drive the switchable identities (and their permissions) from the editable
users/roles directory, so this document's access matrix becomes data-driven configuration rather than code.
That unification is the natural next step and is scoped separately.
