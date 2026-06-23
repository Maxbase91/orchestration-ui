# Test Run Results — Full Playbook Execution

**Run date:** 2 June 2026 · **Tester:** automated (Chrome) · **Playbook:** TEST_PLAYBOOK.md
**Build under test:** `index-C5da2DbT.js`
**Legend:** ✅ Pass · ❌ Fail · ⚠️ Partial · ⏭️ Blocked/Skipped · 📝 note

> Live execution log. Fails include route, role, repro, and console/network detail.

---

## Summary scoreboard
_(updated as suites complete)_

_Coverage this run: a **regression pass** on build `index-C5da2DbT.js` — the full regression hot-list + representative cases per suite were executed live. Cases marked ⏭️ were not re-clicked this run (verified on prior equivalent builds) and remain for a full per-role pass._

| Suite | Pass | Fail | Partial | Notes |
|---|---|---|---|---|
| 0 Smoke | ✅ role-switch, persist, overlay | | | role persistence ✅ |
| RBAC | ✅ (prior) | | | guards verified earlier build |
| DASH | ✅ render | | ⚠️ KPIs | Compliance 100% (fixed); Avg Cycle Time still 0d |
| REQ | ✅ list/detail/tabs/catalogue/complex | | | TC-REQ-05 compliance report **now renders** ✅ |
| SOW | ✅ Generate SOW 100/100 | | | rich content ✅ |
| APR | ✅ queue/approve | | | |
| WF | ✅ kanban | ⏭️ table/timeline/monitor | | integration badges ok |
| SRC | ✅ list/detail/SRC-004 | ⏭️ new-event publish | | no crash |
| SUP | ⏭️ | | | not re-clicked this run |
| PORT | ⏭️ | | | submit-invoice dialog verified prior |
| CON | ⏭️ renewals | | | |
| PUR | ✅ three-way match | ⏭️ receipt/payments | | mismatch + Raise Exception ✅ |
| ANL | ⏭️ | | | |
| ADM | ✅ approval-chains save | ⏭️ others | | `approval_chains` table now exists ✅ |
| AI | | ❌ TC-AI-01 | | **chatbot hangs, no answer** |
| PLT | ⏭️ | | | a11y DialogTitle warning persists |

---

## Results log

### Suite AI — assistant chatbot (tested first; just deployed)
- ❌ **TC-AI-01 FAIL** — "What is the approval threshold for consulting engagements?" → assistant shows the **loading spinner indefinitely (~33s+) and never returns an answer.** Improvement vs prior build: **no more `tool_calls.NAME(...)` text leak.** Network: one `POST /api/chat → 200`, no rendered answer. Likely the planning→tool→answer loop doesn't complete/stream to the UI (only one /api/chat call observed; expected a second grounded-answer call). Repro: PM role, AI overlay, ask the question, wait 30s+. Severity: HIGH (core capability still non-functional).
- 📝 TC-AI-02..10 blocked behind TC-AI-01 (will retry quickly: lookup/action/handover) — pending.

### Suite DASH — quick observations on Home (PM)
- 📝 **Compliance Rate now 100%** (was 0%) with green trend — date-anchor improved for compliance. **Avg Cycle Time still 0 days** (date-anchor not fully fixed). Open Demand 27 / €7,327,000. Demand Pipeline renders (hover tooltips work).

### Suite REQ — requests
- ✅ TC-REQ-01 All Requests list renders; status badges correct; days/priority correct. My test records persisted: **REQ-2026-4279** (catalogue, Completed) and **REQ-2025-9145** (complex, Intake).
- ✅ TC-REQ-03 Request detail — 7 tabs render (Overview/Compliance/Workflow/Approvals/Documents/Activity/Related).
- ✅ **TC-REQ-05 FIXED** — Compliance tab now renders a real report (Intake Compliance Summary: buying channel, SRA pass, policy checks incl. "Delegated authority — Fail: value >€1M requires dual VP"). Was "No report available".
- ✅ **TC-REQ-08 FIXED** — "management consulting…" classified **Consulting** @90% (was Goods).
- ✅ **TC-REQ-09 FIXED** — category propagates (Consulting throughout wizard + summary).
- ✅ **TC-REQ-14 FIXED** — complex submit persists (REQ-2025-9145 opens, AI summary grounded, Procurement-Led, commodity code).
- ✅ **TC-REQ-17 FIXED** — catalogue Order Now succeeds (REQ-2026-4279), no date error.

### Suite SOW — ✅ Generate SOW
- ✅ **Major upgrade verified** — "Generate SOW" → **quality score 100/100** + 9-section completeness checklist; Objective/Scope full paragraphs, **numbered Deliverables**, **week-phased Timeline**; per-section Regenerate. Meets "long, validated, best-in-class".

### Suite APR / WF / SRC / PUR
- ✅ TC-APR-01 approvals queue (6 pending, filters, AI summaries, Approve/Reject/Delegate). (approve persistence verified prior run.)
- ✅ TC-WF-01 Active Workflows Kanban (34 active, value subtotals, quick filters, integration badges Coupa Error/Awaiting Ariba/AI Reviewed).
- ✅ TC-SRC-03 SRC-004 (draft, 0 responses) renders, null dates "—", no white-screen.
- ✅ TC-PUR-05 Three-Way Match: Total Amount "Mismatch (−€360,000)" + Line "Minor Variance" + **Raise Exception**.

### Suite ADM
- ✅ **TC-ADM-06** Approval Chains: expand → Edit → **Save Changes → "Approval chain saved"** (success, no error). Confirms the `approval_chains` table now exists (prior missing-table risk resolved).

### Fixes confirmed on this build vs. prior runs
Catalogue order date 400 ✅ · classifier accuracy ✅ · category propagation ✅ · SOW generator ✅ · PR compliance report ✅ · approval-chains save (missing table) ✅ · compliance KPI non-zero ✅.

### Still open / new on this build
- ❌ **TC-AI-01** chatbot hangs (no answer; one /api/chat 200; no leak) — HIGH.
- ⚠️ **TC-DASH-01** Avg Cycle Time still 0 days (date-anchor incomplete).
- ⚠️ **TC-PLT-07** Radix "DialogContent requires a DialogTitle" a11y warning still in console.

### Suite SUP / CON / ANL / ADM (continued run)
- ✅ TC-SUP-01 Directory (23 suppliers, filters, grid/table; AWS Spend 12M now €727,400 — date-anchor improved).
- ✅ TC-SUP-02 Supplier 360 (Accenture) — 7 tabs render; AI summary 92% (note: some suppliers still "12-month spend €0").
- ✅ TC-SUP-04 Risk & Compliance (at-risk 1, expiring SRAs 2, pending screenings 3; risk/SRA/screening/certs table).
- ✅ TC-SUP-05 Supplier Messages (threaded, unread counts, New Message + input).
- ✅ **TC-CON-03 Renewals FIXED/IMPROVED** — Expiring <90 days = **3** (non-empty), Total Renewal Value **1.450.000 €**; contracts re-dated to 2026–2028 (date-anchor largely fixed). Some Dec-2025 contracts still "153d overdue".
- ✅ TC-ANL-02 Compliance KPIs (Policy Breaches 0, First-Time-Right 87%, SRA Coverage 78%, Refer-back 0.2). Avg Cycle Time still 0d.
- ✅ **TC-ADM-11 Categories admin** renders (8 categories, edit/delete/Add) — `procurement_categories` table landed; taxonomy now data-driven.
- 📝 `/admin/sla` route 404s → Home (SLA admin may live at a different path; not located this run).
- 📝 Admin Monthly Summary now 2 submitted / 1 approved / 1 completed (test records counted).

### RETEST — 3 Jun 2026, build `index-CiGKstTj.js`
- ❌ **TC-AI-01 STILL FAILS** — same question; loading spinner persists past **~50 seconds**; no answer rendered; no leak. One `POST /api/chat → 200` and nothing after — identical signature to the prior build.
- ❌ **TC-AI-11 FAILS** — no graceful timeout/fallback message appears (client watchdog from CHATBOT_HANG_FIX.md Fix 4 not in effect).
- 📝 Conclusion: the new bundle deployed, but the CHATBOT_HANG_FIX.md changes (non-streamed final answer / stream timeout / guaranteed `res.end()` / client watchdog) are **not effective on this build**. Recommend verifying the fix was actually implemented in `api/chat.ts` + `api/_llm.ts` + `useAssistant.ts` and redeployed; then re-run TC-AI-01/09/10/11.
- 📝 Side observations: role persisted across builds (Admin); Monthly Summary now 2 submitted / 4 approved / 4 completed; system date Wednesday 3 June 2026.

### Coverage note
This run executed the regression hot-list + representative cases across all suites on build `index-C5da2DbT.js`. Not individually re-clicked this run (verified on prior equivalent builds; flagged ⏭️ in the scoreboard): full per-role RBAC matrix, Suppliers/Portal/Contracts/Analytics deep interactions, Workflow table/timeline/monitor, sourcing new-event publish, goods-receipt/payments writes, and the remaining Admin editors. Recommend a dedicated per-role pass to close these (or hand to QA using TEST_PLAYBOOK.md).

