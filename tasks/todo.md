# Fix the identified defects, then make the front door configurable

Asked by the product owner (2026-09-23): fix every defect identified in the
intake/channel review first; make the hard-coded elements configurable **in the
existing admin tabs — no new admin sections**; remove "step by step" from the
screens; show the supplier as a request attribute ("Supplier: name" or
"Currently unknown") with the category's preferred suppliers, and invite those
preferred suppliers to sourcing.

## Phase 1 — the mock
- [x] Channel page: remove the step-by-step list
- [x] Supplier attribute + "Preferred suppliers for this category" in the right panels

## Phase 2 — defects (each: fix, guard test verified by reinstating, docs)
- [x] D1 WF-001 never reaches Sourcing after Approval. Auto-Route's two exits
      ("Needs Approval" / "Direct to Sourcing") are not conditions, so the engine
      always takes Approval, and Approval → Contracting. Live: 3 requests went
      approval → contracting. Fix the graph (seed + live): Approval → Sourcing.
      Vendor Onboarding stays before Sourcing — it is for a supplier the
      requester named, so it can be invited to market.
- [x] D2 WF-003 "Parallel Checks" has three unconditioned exits; the engine takes
      the first, so Financial Check and SRA never run. Make them sequential.
- [x] D3 Contract call-off shares WF-006 (business-led), which includes vendor
      onboarding. Author a Contract Call-Off template (no onboarding; risk only
      when the assessment cannot be reused) and move the channel claim to it.
- [x] D4 How you'll buy claims "no catalogue item covers what was described" /
      "we found possible coverage" when nothing was described.
- [x] D5 Create PO falls back to supplier `SUP-001` when the request has none.
- [x] Guard: no template may have a node with more than one exit the engine
      cannot tell apart (extend diagnoseTemplate + test).

Also found and fixed in Phase 2: every workflow signal (outcome, riskRequired,
onboardingRequired) evaluated false, so a REJECTED approval took "Approved";
WF-002/003/004 had no Rejected branch; governed checkout hard-wired WF-001 for
call-offs and trusted the browser's channel; 13 live requests re-pointed.

## Phase 3 — configurable in the EXISTING admin tabs
- [x] Workflows: channel headline + description on the template (replaces the
      hard-coded BUYING_CHANNEL_PLAIN).
- [ ] Workflows: "what the requester does" per stage.
- [x] Categories: preferred suppliers per category; supplier tags per category
      (replaces the recommender's hard-coded keyword map).
- [x] Categories: commodity codes per category (replaces category-code.ts tables).
- [ ] Service description: front-door prompt, examples and door copy; the
      "one detail decides it" question; residual risk question wording;
      per-category writing guidance (replaces CATEGORY_GUIDANCE in generate-sow).
- [x] Decisioning thresholds: competitive-sourcing exempt categories (was a
      code default in supplier-preference.ts); category lists as checklists.
- [ ] Decisioning thresholds: direct call-off limit (wired into the call-off
      checks, not just stored).
- [ ] Decisioning thresholds: preferred-supplier override needs a reason +
      category-manager approval.
- [ ] Database: catalogue items (save/delete hooks exist, nothing uses them).

## Phase 4 — supplier on screen, preferred suppliers invited
- [x] Intake side panel and request detail: "Supplier: name / Currently unknown"
      + "Preferred suppliers for this category".
- [x] Creating a sourcing event invites the category's preferred suppliers.

## Found while verifying (2026-09-24)
- [x] Submit refused a full request with no need-by date or cost centre that
      Details had let through; the conversation promised both could wait, and a
      skipped date could not be entered anywhere. One shared list now.
- [x] Approver avatars rendered every word's initial ("CM—RFoAM").

## Verification
tsc, lint, `test:all`, the offline browser suites, each new guard verified by
reinstating its defect; live backfills idempotent and read back.
