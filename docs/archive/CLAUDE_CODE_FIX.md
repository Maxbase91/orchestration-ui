# CLAUDE_CODE_FIX.md — Procurement Orchestration UI (consolidated)

**App:** orchestration-ui · **Tested:** https://orchestration-ui-khaki.vercel.app/ · **Build:** `index-BJwYUd-4.js`
**Last full re-test:** 1 June 2026 · all 6 roles, end-to-end with write actions enabled (request submit, approve, config edits, portal flows).
**Scope:** This single document supersedes AUDIT-REPORT.md. It lists (A) what is now fixed, (B) what is still broken or newly found, with concrete fixes, and (C) coverage. Severity: BLOCKER > CRITICAL > HIGH > MEDIUM > LOW.

---

## A. FIXED & VERIFIED (no action needed)

| Ref | Area | Verified result |
|-----|------|-----------------|
| F14 | New Request wizard | Step 4 Compliance no longer crashes; full Step 1→6 completes. |
| F7 | RBAC route guards | Non-admin direct nav to `/admin/*` redirects to Home. |
| F20 | Three-Way Match | Computes "Mismatch (−€360,000)" / "Minor Variance"; action is "Raise Exception" (not Auto-Approve). |
| F15 | AI confidence | Renders "92% High" / "95% High" / "96% High" across cards (was "0.92% Low"). |
| F6 | Status badge casing | "PO" renders correctly. |
| F19 | Currency | Renewals "Total Renewal Value 0 €" (was £). |
| F8 | Report Builder export | Now "Export CSV" (no "coming soon" stub). |
| F9 | Exports page | Functional: data type, date range, CSV/Excel/PDF toggle, enabled Export, Recent Exports w/ downloads. |
| F21 | Workflow Designer | "Catalogue Purchase" template now renders its node graph (was empty). |
| F3 | Monthly Summary widget | Now non-zero (Admin: 5 submitted / 2 approved). |
| F16 (part) | Request detail | **Compliance** tab added (6 tabs now). *(See B: report still empty, Documents tab still missing.)* |
| Audit Log | Admin | Now has an Export button (was missing). |

**Also confirmed working E2E this run:** Approvals (Approve fires a toast, persists, decrements pending 7→6); all 12 admin pages (Routing Rules+test, Form Builder, Approval Chains, Workflow Designer, AI Agent Configuration incl. per-agent config + performance dashboard, KB Management, AI Analytics, Policy Management, User Management, System Health, Audit Log, Database); Invoice Queue (AI match summary, Matched/Unmatched); Payment Tracker; Supplier Directory + 360 profile; Evaluation Centre scoring matrix.

---

## B. STILL BROKEN / NEWLY FOUND — fixes required

### BLOCKER / HIGH

**1. AI Assistant never returns a grounded answer (F18 — still broken).**
Ask "What is the approval threshold for consulting engagements?" → replies with the literal tool call as text ("I'll search for the relevant policy. / search_knowledge: … / Please wait for the results.") then stalls forever. Network: a single `POST /api/chat → 200`, no follow-up. The built-in KB exists (KB Management confirms), so this is purely the tool-call loop.
*Fix:* In `api/chat.ts` send tool schemas with `tool_choice:"auto"`, detect `tool_calls`, execute the tool (against mock/Supabase), then make a **second** `/api/chat` call with the tool-result message and `tool_choice:"none"` to produce the final answer. Add a guard in `src/lib/assistant/groqProvider.ts`: if assistant text matches `^(search_knowledge|lookup_object|propose_action|create_ticket|start_demand)\s*:` treat as a tool call and execute it. Validate the 4 strawman scenarios in both `mock` and `groq`.

**2. Submitted requests are not persisted (NEW — N1).**
Wizard → Submit shows "Request Submitted Successfully — REQ-2025-2835", but `/requests/REQ-2025-2835` → "Request not found" and it never appears in All Requests; "Track this Request" would 404.
*Fix:* On submit, INSERT into the same Supabase `requests` table the list/detail read; use the returned id on the confirmation; invalidate the requests react-query cache. (Note: Approvals writes DO persist, so the infra works — this path just doesn't insert.)

**3. Sourcing event detail white-screens on missing dates (F22 regressed → NEW N3).**
`/sourcing/SRC-004` (Draft, 0 suppliers) renders a blank white page. Console: `RangeError: Invalid time value` (date-fns `format()` on a null date). Worse than the prior graceful "not found".
*Fix:* Add a `formatDateSafe(value, fallback='—')` helper and use it for every entity date in `event-detail-page.tsx` (and audit other detail pages). Add a **route-level error boundary** around the routed `<Outlet/>` in `app-layout.tsx` so one render error can't blank the whole app.

**4. PR Compliance report never renders (NEW — N7).**
The new **Compliance** tab shows "No compliance report available… generated after the Validation stage" even for requests well past Validation (e.g. REQ-2025-0116, Contracting). The 6-category PR Compliance Reviewer report (spec §6.3, a headline feature) is never shown.
*Fix:* Wire the Compliance tab to the compliance-report data for requests at/after Validation; render decision, confidence, and the 6-category findings. Verify against a Completed request.

**5. AI "Request Summary" shows "Request not found" on every request detail (NEW — N6).**
Overview tab → AI-generated Request Summary card reads "Request not found." on REQ-2025-0114 and REQ-2025-0116 (systematic), although the page itself loads the request.
*Fix:* The summary generator looks the request up via an id/source that misses (likely seed-only data or a different id format). Point it at the same Supabase record the page uses.

**6. Supplier Portal "Submit Invoice" is a dead control (NEW — N8).**
`/portal/invoices` → "Submit Invoice" does nothing (no dialog/form/toast) on repeated clicks.
*Fix:* Wire the button to open the invoice-submission form/dialog and persist on submit (mirrors the internal invoice flow).

### MEDIUM

**7. Date-anchored metrics read empty (F1, F13; F3 partial).**
System date is June 2026 but seed data is 2024–2025, so: dashboard **Avg Cycle Time = 0 days, Compliance Rate = 0%**; Renewals **Expiring <30/<90 days = 0** (14 expired, rows "152d/427d overdue"); System Health "Request Volume (7 days)" empty; several suppliers "Spend 12m €0"; agent "Accuracy Trend" charts empty.
*Fix (one change fixes all):* re-anchor seed dates as offsets from `new Date()` at seed time, OR introduce a single configurable "demo today" used by every KPI/SLA/expiry/cycle-time/trend calc. Ensure some completed requests fall in the trailing window and some contracts expire within 90 days.

**8. Selected role does not persist across reload (NEW — N5).**
Switch to Admin/Vendor Manager/etc., then refresh or open a deep link → reverts to default Procurement Manager (and admin URLs then redirect away).
*Fix:* Wrap the Zustand auth store in `persist` (localStorage) and hydrate `currentRole`/`currentUser` before the first route guard runs.

**9. Request detail still missing the Documents tab (F16 residual).**
Tabs are now Overview, Compliance, Workflow, Approvals, Activity, Related (6). Spec §4.6 wants 8 incl. **Documents** (Comments+Audit appear merged into Activity, Related = the old "Links" — acceptable). Add a Documents tab or confirm the merge is intended.

### LOW

- **N2** New Request Step 4 "workflow template" defaults to "Catalogue Purchase" for a Consulting request — default to the template matching the classified category.
- **F8 residual** Report Builder offers CSV only; spec wants PDF + Excel too (repo has `pptxgenjs`/`docx`; add `xlsx` + PDF) — or relabel.
- **N4 (a11y)** Console: "DialogContent requires a DialogTitle" Radix warning on dialogs — add a (visually-hidden) `DialogTitle`.
- **Payment Tracker** "Paid Date" column shows "--" even for Paid invoices — populate paid date.

---

## C. Coverage & carry-over status

**Deep-tested E2E this run:** New Request wizard (full submit), Approvals (approve persists), Three-Way Match, Report Builder + Exports, Invoice Queue, Payment Tracker, Request detail tabs incl. Compliance, all 12 Admin pages incl. AI Agent Configuration (per-agent), Workflow Designer (all templates), Chatbot (knowledge query), Supplier Portal (dashboard, onboarding, invoices), role switching + route guards, dashboards (5 roles).

**Carry-over items from Run 1:**
- F16 → partially fixed (Compliance tab added; Documents missing; report empty = item B-4).
- F21 → fixed.
- F11 → superseded by N3 (now a date crash on SRC-004).
- F12 (AI-assistant action role-gating) → still cannot be verified live because the chatbot stalls (B-1); re-test once B-1 is fixed. Code review (Run 1) showed actions are not role-gated — keep open.
- **Not re-walked this run (low priority, please verify after fixes):** F4 command-bar live-as-you-type matching (current behavior: Enter + AI analysis, works); F5 catalogue cart qty-display sync; F10 Sourcing New-Event Publish/Save persistence (was toast-only in Run-1 code); F17 All-Requests multi-column sort/advanced filter (sort arrows now present on list headers — confirm they sort).

**Tooling note:** Chrome `find` tool unavailable (org OAuth restriction); used read_page/screenshots/JS. No hard-destructive actions (deletes, permission/sharing changes, fund transfers) were performed.
