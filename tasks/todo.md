# Intake / determination / workflow bug tracker — fix one by one

## Release-blocker remediation — 2026-08-28
- [x] Confirm the production AI function's required environment-key names without exposing values; Vercel access is required to set them.
- [x] Persist the actual `approval_chains.id` selected for the request value and prove foreign-key persistence with a self-cleaning test.
- [x] Make the AI endpoint return a controlled service error when its configuration is unavailable; add regression coverage.
- [x] Correct the deployed-test URL/configuration and stale renewal assertion.
- [x] Update the root README, testing playbook, roadmap, and relevant module documentation; run typecheck, lint, build, and focused tests.

## Production AI verification — 2026-08-28
- [x] Correct the AI-agent integration test's false cache-buster assumption, replace the retired Groq model, and verify the active classifier path after cache expiry (Production `test:ai-agents`: 16 passed, 0 failed).

Reference demand: "I need consultants for a promptathon"

| # | Area | Issue | Status |
|---|------|-------|--------|
| 1 | SOW panel/chat | Examples should appear in the CHAT (the assistant's question), not the right panel | ☐ |
| 2 | SOW panel | Rename "Statement of Work" → "Service description components" | ☐ |
| 3 | SOW/chat | Examples must be DYNAMIC by category (engine already has the hook — extend to all slots) | ☐ |
| 4 | Key facts | "Supplier" is always Pending (selected later). Only show when actually known | ☐ |
| 5 | Risk step | "Does the supplier have an SRA?" makes no sense — user can't know. Reframe to the Excel flow: do you NEED a risk assessment? do you HAVE one to reuse? (system-derived where possible) | ☐ |
| 6 | Risk step | Vendor onboarding missing from the smart assessment | ☐ |
| 7 | Risk/determination | A risk assessment is missing as a STEP — when none can be reused, performing one is a key step | ☐ |
| 8 | Workflow | Workflow should NOT be selectable — it is predefined from the input | ☐ |
| 9 | Determination | "Save as draft" missing on the determination step | ☐ |
| 10 | Determination | Page is unstructured (recommended suppliers + many sections) — needs a clearer structure | ☐ |
| 11 | Routing | Workflow steps should be DYNAMIC from gathered info. "Intake review by system" is confusing (what does the system do? is it submit?). Risk + vendor onboarding missing from the steps | ☐ |

## Progress
- [x] 1+2+3 → 3dc97b4 (examples in chat, dynamic by category; panel renamed "Service description components")
- [x] 4 → 88eae8a (dropped always-pending Supplier key-fact; chip when named/matched)
- [x] 5 → 0625116 (SRA questionnaire replaced by a DERIVED summary — attributes + reasons, no questions)
- [x] 6 → b5b3459 (vendor onboarding card in the Smart Assessment; tone from onboardingStatus)
- [x] 7+11 → (this commit) config-driven Routing: lifecycle from the attached template's stage nodes + dynamic Risk assessment / Vendor onboarding steps (composeWorkflowSteps, test:workflow-steps); approvers from the value-banded approval chain (resolveApprover); timeline from category.timelineDays; reviewers from the directory. Removed all hardcoded steps/approvers/timeline/reviewers. Fixes "intake review by system"
- [x] 8 → e1a4867 (removed the workflow-template picker; template derived + attached silently)
- [x] 9 → 74663e5 (Save as Draft now shows on the determination, step 5)
- [x] 10 → 7efe56a (determination grouped under 4 SectionHeaders; test:ui extended)
- [x] 11 routing — done with item 7 (see above)

Items 1-4 shipped to main (88eae8a). 5-11 all done — the intake bug tracker is complete.

NOTE for item 5: the current risk step asks only the mini-IRQ deltas
("privileged/system access?", "critical business service?") — engagement
questions, not an SRA question. Confirm where the "does the supplier have an
SRA" prompt appeared, or I'll reframe the whole step to the need/have-assessment
decision (system-derived) which supersedes it.
## Full UI E2E verification — 2026-08-28

- [x] Run the latest-code full route sweep (73 local routes; 30 representative deployed mobile routes).
- [x] Run all available browser/UI interaction suites against the latest code.
- [x] Exercise navigation, submenu visibility, route availability, and key user journeys.
- [x] Submit temporary requests through the UI and verify explicit cleanup.
- [x] Record passed, failed, skipped, and unavailable checks with evidence.

UI closeout notes: route sweep and focused UI suites passed. The deployed
interaction suite reproduced an assistant supplier-lookup reliability failure
once per run; direct sequential reproduction showed an intermittent fallback
message after a successful lookup. The mobile pass found horizontal overflow on
`/help/support` (407px document width at a 375px viewport). The walkthrough
harness was updated to accept valid catalogue-skipping paths and now correctly
returns non-zero on scenario failures; its high-value critical scenario still
needs answer-by-question handling because positional answers can populate the
wrong dynamic slots. Temporary catalogue requests created by these runs were
removed explicitly.

## E2E QA pass fixes — 2026-08-29
- [x] `api/chat-intake` returned `500 FUNCTION_INVOCATION_FAILED` on every call in production — the
      intake wizard's LLM-driven chat silently ran on its offline fallback with no signal. Root cause:
      `src/lib/procurement/demand-conversation.ts:18-19` imported two sibling modules without a `.js`
      extension. `tsc -b` and `vercel dev` both pass regardless — only Vercel's real per-function build
      catches it. Verified by running `npx vercel build`, inspecting the emitted
      `.vercel/output/functions/api/chat-intake.func` bundle directly, and executing it with Node's real
      ESM loader (`ERR_MODULE_NOT_FOUND` before the fix, clean handler execution after). Also fixed three
      latent (currently-inert, type-only) extensionless imports elsewhere in the same reachable graph
      (`service-description-config.ts`, `service-description-defaults.ts`, `knowledgeBase.ts`) so the new
      regression test is a genuine clean gate. New test: `npm run test:api-imports` — statically walks
      every `api/*.ts` entrypoint's import graph and fails on any relative import missing its extension.
- [x] The floating AI assistant button (`fixed bottom-6 right-6`, global on every route) could sit
      directly on top of the wizard's Next/Submit button on wide steps, making it unclickable —
      confirmed via `elementFromPoint` across the button before the fix. Fixed by reserving bottom
      clearance on both layouts' scrollable `<main>` (`app-layout.tsx`, `supplier-portal-layout.tsx`,
      `p-6` → `p-6 pb-24`) so content can never reach the FAB's fixed footprint, verified geometrically
      (16px clear gap at max scroll) and via a new generic assertion in `npm run test:ui`.
- [x] `npx tsc -b`, `npm run lint` (touched files), `npm run test:api-imports`, `npm run test:ui` (58/58),
      `npm run test:demand-conversation`, `npm run test:intake-guidance`, `npm run test:answer-quality`
      all green. Docs updated: README testing list, TEST_PLAYBOOK.md (regression hot-list, Suite AI
      TC-AI-13, Suite 0 TC-SMK-08b, Suite UI TC-UI-01b), `tasks/lessons.md`.
- [ ] Not committed/pushed yet — production is still on the broken build until this deploys.

## Form-handling bugs + request-detail information ownership — 2026-08-29
- [x] `use-form-templates.ts` `forStage()` ignored template `status` entirely — a `draft`
      form (e.g. "Change Request Form") was still offered to requesters. Fixed: filter to
      `status === 'active'`.
- [x] `step-detail-card.tsx`'s `FormsSection` discarded everything typed into a triggered
      form and faked success (local state + toast only) — `useCreateFormSubmission()`
      already existed, fully wired to a real Supabase insert, with zero callers anywhere
      in the codebase. Wired it in: real persistence, `toast.error` on failure instead of
      silent success.
- [x] Traced the whole request-detail page (header + all 7 tabs, via two parallel Explore
      agents) and defined a single-source-of-truth ownership model — see
      `docs/specs/design-document.md` §5.3. Removed 5 confirmed duplicates:
      header's "latest document" chip (full dupe of Documents), `ComplianceStageSection`
      embedded in Workflow (dupe of Compliance — its unique risk-assessment content
      ported into the Compliance tab, component deleted), the per-stage "Documents Added"
      table in `StepDetailCard` (dupe of Documents), the legacy dead-write
      `WorkflowStepDetail.comments` shown as a second comment box per stage (merged into
      the one real stage-comment thread instead, for display only — no schema change),
      and Related tab's Supplier Risk Assessment card (moved into Compliance).
- [x] Extended `tests/ui/request-detail-e2e.mjs`'s existing "Fill Out Form" check to
      actually submit and verify a real `form_submissions` row lands with the typed
      values, and that a seeded `draft` form template is excluded — 13/13 checks green.
      Fixed a latent stub-fixture bug found in the process: `postgrest-stub.mjs`'s form
      template used `status: 'published'`, a value that was never valid anywhere in the
      real app (`'active'|'draft'|'disabled'`) — harmless only because status was never
      checked before this round.
- [x] `npx tsc -b`, `npm run lint`, `test:request-detail-ui` (13/13), `test:e2e-ui`
      (73/73 routes clean), `test:api-imports`, `test:demand-conversation`,
      `test:intake-guidance`, `test:answer-quality` all green. Live-verified on a real
      request in the browser: submitted a real form, reloaded, confirmed it persisted
      and wasn't re-offered; confirmed the draft form no longer appears at all; confirmed
      Workflow no longer shows Compliance/Documents content; confirmed Related shows
      linkage only and Compliance now carries the supplier risk card.
- [ ] Not committed/pushed yet.
