# Admin Control-Plane — Review & Recommendations

**App:** orchestration-ui · **Reviewed:** 1 June 2026 (live + codebase) · **Goal:** make Admin the single place that configures the platform, with every change logically connected to the rest of the app.

This document is about *design coherence*, not bugs. It covers: (1) where Admin already works as a control plane, (2) where config exists but isn't wired through, (3) what should be configurable but is hardcoded, and (4) a prioritized plan — including cross-area connections so the product hangs together.

---

## 1. The core idea: Admin as the control plane

Today the platform has two parallel "sources of truth":

- **Admin/Supabase config** — routing rules, forms, workflow templates, AI agents, KB, users (live, editable).
- **Hardcoded constants** — categories, buying channels, lifecycle stages, SLAs, thresholds, commodity codes, notification types, currency (in `src/data/types.ts`, `src/lib/...`, component code).

The platform's promise ("no-code configuration", design doc §2.5) only half-holds: an admin can edit *instances* (a rule, a form) but not the *vocabulary* those instances are built from (the categories, channels, stages, thresholds they reference). The recommendations below close that gap and make the wiring consistent.

**Verified live this session:** editing a config and saving persists to Supabase (e.g., I set the *Supplier Recommender* agent Active → toast "configuration saved" → persists). Routing rules already drive intake (the wizard shows "Matched routing rule: Consulting engagements"). So the plumbing exists — it just needs to be applied uniformly.

---

## 2. Configurability & connectivity matrix

Legend: Persists = admin edits save to Supabase · Wired = other screens read it at runtime and behaviour changes.

| Admin area | Editable | Persists | Wired downstream | Verdict |
|---|---|---|---|---|
| Routing Rules | ✅ | ✅ | ✅ intake buying-channel + approval-chain (`step-compliance.tsx` → `evaluate-routing-rules.ts`) | **Exemplar — copy this pattern** |
| Form Builder | ✅ | ✅ | ✅ wizard Risk Triage / IT Security + workflow step forms | Wired, but forms mapped to stages by hardcoded ID |
| KB Management | ✅ | ✅ | ✅ AI assistant grounding | Wired |
| AI Agents | ✅ | ✅ | ⚠️ only 2 of 6 consumed (Request Validator, Supplier Recommender), and only as UI show/hide gates | Partial |
| User Management (OOO/delegate) | ✅ | ✅ | ⚠️ OOO shown in approvals; delegation suggested not auto-applied; delegate not always resolved | Partial |
| Workflow Designer | ✅ | ✅ | ⚠️ template shown read-only on request; does NOT drive the lifecycle (stages hardcoded by channel) | Designed-but-not-driven |
| Approval Chains | ✅ | ❌ (local state + toast) | ❌ routing rules reference chains as opaque strings; chain steps never executed | **UI-only** |
| Policy Management | ⚠️ (view/expand; edit is a stub) | ❌ | ❌ display-only; thresholds duplicated in rules/code | **Display-only** |
| System Health / AI Analytics / Audit Log | n/a (monitoring) | reads Supabase | ✅ | Read-only — correct |
| Database admin | ✅ full CRUD | ✅ | ✅ | Wired |

---

## 3. Gap A — "Configurable but not wired" (fix the broken promises first)

**A1. Approval Chains don't persist and aren't executed.** (HIGH)
The editor edits in-memory `initialChains` and toasts "saved"; reload reverts. Routing rules carry an approval path as a *string* (`"category-manager > finance > vp-procurement"`) that nothing parses into actual approval entries.
*Recommendation:* create an `approval_chains` table; have routing rules reference a chain **by id**; at intake, resolve the chain → generate `approval_entries` step-by-step, each approver resolved from role → user (honouring OOO/delegate). This makes "edit a chain in Admin" actually change who approves.

**A2. Workflow Designer doesn't drive the lifecycle.** (HIGH, conceptual)
Templates persist and render as a read-only diagram, but request state follows a hardcoded 9-stage enum + `STAGES_BY_CHANNEL` map. So an admin can "design" a workflow that the engine ignores.
*Recommendation (phased):* (a) short term — set expectations in the UI (the banner already hints this) and let a template at least define *which stages are skipped* per channel; (b) medium term — make the assigned template the source of truth for stage sequence, gates (decision nodes), forms (form nodes), and integration steps, so Designer edits actually re-route the lifecycle.

**A3. AI Agents are gates, not engines, and only 2 are consumed.** (MEDIUM)
Toggling status persists, and the wizard shows/hides the Supplier Recommender + Request Validator cards based on status — good, the connection is real. But Category Classifier, Document Extractor, Spend Anomaly Detector, PR Compliance Reviewer have config screens with no runtime consumer, and the consumed ones gate UI visibility only (the scoring weights, input-source toggles, confidence thresholds are display-only).
*Recommendation:* introduce an `ai_feature_flags`/agent-config contract that every AI flow reads (classifier, extractor, compliance, anomaly, recommender). Gate invocation and feed parameters (scoring weights, confidence threshold, enabled input sources) from the agent record. Then the rich config UI becomes functional, not decorative.

**A4. User OOO/delegate is informational.** (MEDIUM)
OOO shows in approvals and the AI bottleneck note, but rerouting is a manual button and `delegateId` isn't always resolved from the user record.
*Recommendation:* when generating approval entries (see A1), auto-substitute an OOO approver with their `delegateId` and log it to the audit trail; surface it as an AI-suggested action in the assistant.

**A5. Policy Management is a document viewer.** (MEDIUM)
Policies are prose; their thresholds (e.g., SRA validity, value bands, competitive-sourcing minimums) are re-encoded separately in routing rules and component logic, so they can drift.
*Recommendation:* give each policy a small structured "rule" block (thresholds, required approver role, SRA validity months, competitive-quote minimum) that the intake/compliance engine and the AI assistant both read. Policy text stays human-readable; the structured part becomes the single source the rest of the app references.

---

## 4. Gap B — "Should be configurable but is hardcoded" (extend the control plane)

These are the *vocabulary* tables the whole app is built on. Promote each to an Admin-managed table and hydrate at startup.

| Should be Admin-configurable | Today | Why it matters |
|---|---|---|
| **Procurement categories** | enum in `types.ts` | adding a category needs a code change; it should be a setup screen |
| **Buying channels** | enum in `types.ts` | rules reference channels but the list/definitions are fixed |
| **Lifecycle stages + per-channel sequence** | `types.ts` + `buying-channel-stages.ts` | this is the heart of "orchestration"; should be Designer-driven (ties to A2) |
| **SLA targets** (per stage / channel / category) | hardcoded `5` days in components | SLA tracking, bottleneck flags, escalation all depend on this; must be tunable |
| **Approval thresholds / value bands** | duplicated in rules, chains, policies | one "thresholds" table should feed routing, approvals, and policy display |
| **Commodity-code registry** | referenced in rules/forms, no master list | classifier + routing rely on codes; needs a managed taxonomy |
| **Notification types, rules, quiet hours, channels** | enum + component state (not persisted) | preferences reset on reload; no admin control over what triggers what |
| **Sourcing / contract / evaluation templates** | seed/code | admins should manage RFQ/RFP, contract, and scoring templates like forms |
| **Supplier tiers & risk bands, screening cadence** | fixed | core to vendor management policy |
| **Integrations** (SAP, Ariba, Coupa, Sirion, email) | env/config, shown read-only in System Health | an admin "Integrations" page (endpoints, enable/disable, test connection) makes the system-aware story real |
| **Currency / locale** | EUR hardcoded; Settings has a selector that isn't applied | the £ bug earlier was a symptom; wire the setting through `formatCurrency` |
| **Roles & permission matrix** | `roles.ts` + per-item `visibleTo` | an admin permissions screen (role → feature access) would make RBAC visible and editable |
| **Catalogue & sub-catalogues** | editable via Database admin only | give it a first-class Admin screen (it's a buyer-facing surface) |

---

## 5. Recommended Admin information architecture

Group the Admin section so it reads as a control plane, not a list of editors:

- **Taxonomy & Vocabulary** — Categories, Buying Channels, Commodity Codes, Supplier Tiers/Risk Bands, Lifecycle Stages.
- **Policies & Thresholds** — Value bands, SLA targets, Approval Chains, Policy rules (structured + text). *(single source the engine reads)*
- **Automation** — Routing Rules, Workflow Designer, AI Agents, Form Builder. *(the "if this, then that" layer)*
- **Knowledge & Assistant** — KB Management, AI Analytics, assistant action catalogue + role gating.
- **People & Access** — User Management, Roles & Permissions, Delegation/OOO.
- **Integrations & System** — Connectors, System Health, Audit Log, Database, Notifications config.

Add a small **"Used by"/"Affects"** indicator on each editor (Routing Rules already shows match counts; extend the pattern) so an admin can see, before saving, what a change will touch. This is the single biggest "does it make sense / is it connected" win: every config screen states its downstream consumers.

---

## 6. Cross-area logical connections to tighten

These make the product feel like one system rather than separate modules:

1. **Thresholds → everywhere.** One thresholds table should drive routing (channel selection), approval-chain selection, policy display, and the wizard's "VP approval required" notices. Today these are independent.
2. **Stages → SLA → bottlenecks → escalation → notifications.** Define stages + per-stage SLA once; have the workflow monitor, bottleneck heatmap, escalation rules, and SLA-warning notifications all read it. (Also fixes the date-anchored "0 days/expiring" emptiness once stages/SLA are relative.)
3. **AI agents → the flows they power.** Classifier → wizard Step 1; Validator → Step 4 checks; PR Compliance → request Compliance tab (currently never populated); Recommender → Step 4 supplier card; Anomaly → Spend dashboard. Each dashboard "agent" should link to where it acts, and its enable/disable should visibly change that surface.
4. **Policies ↔ KB ↔ Assistant.** The assistant should cite the same policy records Admin manages (not a separate KB copy), so "what's the consulting threshold?" returns the live policy.
5. **Users/roles ↔ approvals ↔ assistant actions.** Role drives nav (done), approval routing (A1), and which assistant actions are offered (the assistant currently doesn't role-gate actions). Wire all three to the one permission matrix.
6. **Suppliers ↔ contracts ↔ requests ↔ spend.** The Database admin shows these relate; surface the same links contextually (a supplier's contracts/requests/spend, a request's contract/PO/invoice) so navigation is consistent everywhere, driven by the same FK config.

---

## 7. Prioritized roadmap

**P1 — make existing config honest (small, high trust gain)**
- Persist Approval Chains to Supabase and execute them at intake (A1).
- Apply the currency setting through `formatCurrency` (A5/§4).
- Persist notification preferences + quiet hours (§4).
- Add "Affects/Used by" labels to each admin editor (§5).

**P2 — extend the vocabulary (medium)**
- Promote thresholds, SLAs, categories, buying channels, commodity codes to Admin tables; point routing/approvals/policies at them (Gap B, connection #1/#2).
- Make AI agent config functional via a shared agent-config contract; wire all 6 agents to their surfaces (A3, connection #3). Populate the request Compliance tab from the PR Compliance agent.

**P3 — orchestration as configuration (larger)**
- Let Workflow Designer templates drive the actual lifecycle (stage sequence, gates, forms, integration steps) per channel/category (A2, connection #2).
- Add Integrations and Roles/Permissions admin screens (§4).

---

## 8. Notes
- I set the *Supplier Recommender* agent to **Active** while verifying the admin→wizard connection (it persisted). Flip it back to *Draft* in Admin → AI Agents if you want it in pilot state.
- This complements the open functional issues in `CLAUDE_CODE_FIX.md` (e.g., the PR Compliance report never rendering and the AI assistant tool-call loop both intersect with connections #3 and #4 above).
