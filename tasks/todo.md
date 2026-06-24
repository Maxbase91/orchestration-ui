# Intake / determination / workflow bug tracker — fix one by one
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
- [~] 7 risk/determination — "risk assessment required" now surfaced; the WORKFLOW STEP wiring lands with item 11
- [x] 8 → e1a4867 (removed the workflow-template picker; template derived + attached silently)
- [x] 9 → 74663e5 (Save as Draft now shows on the determination, step 5)
- [x] 10 → 7efe56a (determination grouped under 4 SectionHeaders; test:ui extended)
- [ ] 11 routing — dynamic workflow steps; replace "intake review by system"; add risk + onboarding steps (with item 7)

Items 1-4 shipped to main (88eae8a). 5-10 done; 7+11 (config-driven routing) is the last group.

NOTE for item 5: the current risk step asks only the mini-IRQ deltas
("privileged/system access?", "critical business service?") — engagement
questions, not an SRA question. Confirm where the "does the supplier have an
SRA" prompt appeared, or I'll reframe the whole step to the need/have-assessment
decision (system-derived) which supersedes it.
