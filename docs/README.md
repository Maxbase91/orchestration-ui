# Documentation

Organised into four areas. **Specs**, **roadmap**, and **testing** are living
documents kept current; **archive** holds point-in-time audits and resolved
fix-logs, kept for history (not maintained).

```
docs/
├── specs/        what the product is — functional + UX specs, domain requirements
├── roadmap/      what to build — fit/gap analysis and the build roadmap
├── testing/      how we verify — the test playbook (manual suites + automated test:*)
└── archive/      point-in-time audits, assessments, and resolved fix-logs (historical)
```

## specs/ — what the product is
| Doc | What it covers |
|---|---|
| [functional-specification.md](specs/functional-specification.md) | The approved functional specification (S2C, P2P, supplier portal, admin). |
| [personas.md](specs/personas.md) | The 6 personas — who each is, what they see/access/do, and complexity per persona, in R1 and end-state. Incl. the route-guard access matrix. |
| [design-document.md](specs/design-document.md) | UX / design specification and screen designs. |
| [requirements/](specs/requirements/) | Detailed requirements by domain, numbered `00`–`14` (intake, workflow, approvals, suppliers, sourcing, contracts, P2P, analytics, admin, AI assistant, data model, APIs). |

## roadmap/ — what to build
| Doc | What it covers |
|---|---|
| [R1_BACKLOG_FIT_GAP.md](roadmap/R1_BACKLOG_FIT_GAP.md) | **Primary roadmap.** Fit/gap of the R1 backlog vs the codebase + the workstream plan. Updated as gaps close. |
| [REQUIREMENTS_AND_FIT_GAP.md](roadmap/REQUIREMENTS_AND_FIT_GAP.md) | Capability baseline vs market leaders (Zip, Oro, Ariba), scored against the app. |

## testing/ — how we verify
| Doc | What it covers |
|---|---|
| [TEST_PLAYBOOK.md](testing/TEST_PLAYBOOK.md) | Full test scope — manual regression suites plus the automated `npm run test:*` suites (integration, UI smoke, full-app sweep, interaction E2E). |

> Live test status is the `test:*` scripts in `package.json`, not a static doc. See the root [README](../README.md#testing).

## archive/ — historical (not maintained)
Point-in-time reviews of earlier builds and bug fixes that are now resolved. Kept
for context; **do not treat as current state** — verify against the code.

| Doc | What it was |
|---|---|
| [IMPLEMENTATION_ASSESSMENT_AND_FIXES.md](archive/IMPLEMENTATION_ASSESSMENT_AND_FIXES.md) | Codebase-verified assessment + execution plan (Jun 2026). |
| [AUDIT-REPORT.md](archive/AUDIT-REPORT.md) | Functional audit of the deployed build (superseded by CLAUDE_CODE_FIX). |
| [CLAUDE_CODE_FIX.md](archive/CLAUDE_CODE_FIX.md) | Consolidated fix list across roles (Jun 2026). |
| [ADMIN_RECOMMENDATIONS.md](archive/ADMIN_RECOMMENDATIONS.md) | Admin control-plane review & recommendations. |
| [CLAUDE_CODE_BRIEF_assistant.md](archive/CLAUDE_CODE_BRIEF_assistant.md) | Build brief for the AI assistant upgrade. |
| [TEST_RESULTS.md](archive/TEST_RESULTS.md) | A dated playbook run (2 Jun 2026 build). |
| [CHATBOT_HANG_FIX.md](archive/CHATBOT_HANG_FIX.md) | Root-cause + fix for the assistant hang (resolved). |
| [CHATBOT_TOOLCALL_FIX.md](archive/CHATBOT_TOOLCALL_FIX.md) | Root-cause + fix for the tool-call text leak (resolved). |
