# Documentation

**One home per fact.** Each kind of fact has exactly one document that owns it;
every other document links there instead of restating it. When a fact changes,
the Definition of Done ([AGENTS.md](../AGENTS.md) rule 6) says to update its
home — and only its home.

| Kind of fact | Its home |
|---|---|
| Why the platform exists, who it is for, its principles, what Release 1 includes and leaves out | [PRD.md](PRD.md) |
| How it is built — the system, runtime, code map, data path, decision engines, configuration, AI, security, testing approach, known architectural gaps | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Why a boundary is where it is | [adr/](adr/) — one record per decision |
| The rules for working in the repo, and the Definition of Done | [AGENTS.md](../AGENTS.md) (`CLAUDE.md` imports it) |
| What a screen does, in business terms | [specs/functional-specification.md](specs/functional-specification.md) |
| The numbered requirements and acceptance criteria per domain | [specs/requirements/](specs/requirements/) |
| What an Admin item is for, where it is stored and what reads it | [specs/admin-map.md](specs/admin-map.md) |
| How a screen looks and behaves | [specs/design-document.md](specs/design-document.md) |
| Who the personas are | [specs/personas.md](specs/personas.md), [specs/personas-business.md](specs/personas-business.md) |
| Where Release 1 stands, area by area, and what is next | [roadmap/R1_BACKLOG_FIT_GAP.md](roadmap/R1_BACKLOG_FIT_GAP.md) |
| The stories still to deliver, with acceptance criteria | [roadmap/PRODUCT_BACKLOG.md](roadmap/PRODUCT_BACKLOG.md) |
| Every automated suite and what it covers; the manual regression suites | [testing/TEST_PLAYBOOK.md](testing/TEST_PLAYBOOK.md) |
| How one module works | That module's own `README.md` |
| Setting up, commands, environment variables, deployment | The root [README](../README.md) |

**How current each is.** The functional specification was checked against the code, section by
section, on 2026-09-26: it says what the platform does, marks each demonstration surface
"— a demonstration" and each wrong behaviour "Known defect". The design document and the numbered
requirements have not had that check yet, and may still describe screens as they once were —
where they disagree with the functional specification, the specification is right.

The areas under `docs/`:

```
docs/
├── PRD.md        what and why
├── ARCHITECTURE.md  how
├── specs/        what the product does — functional + UX specs, domain requirements, the admin map
├── roadmap/      where it stands — fit/gap and the build roadmap, the delivery backlog
├── testing/      how we verify — the test playbook (the automated catalogue + manual suites)
├── adr/          why it is built this way — architecture decision records
└── archive/      point-in-time audits, assessments, and resolved fix-logs (historical)
```

**Specs**, **roadmap**, **testing** and **adr** are living documents kept current;
**archive** holds point-in-time audits and resolved fix-logs, kept for history
(not maintained).

`ui-audit.md` sits at the top level rather than in `archive/`: it is the working
list for the UI redesign, and its findings are open until each is fixed and
frozen by a guard.

## specs/ — what the product is
| Doc | What it covers |
|---|---|
| [functional-specification.md](specs/functional-specification.md) | What each screen does, in business terms (S2C, P2P, supplier portal, admin) — the detailed feature reference behind the PRD. |
| [personas.md](specs/personas.md) | The 6 personas — who each is, what they see/access/do, and complexity per persona, in R1 and end-state. Incl. the route-guard access matrix. |
| [personas-business.md](specs/personas-business.md) | Plain-language, stakeholder-ready version of the personas — for sponsors, business, and change/training teams. |
| [design-document.md](specs/design-document.md) | UX / design specification and screen designs. |
| [admin-map.md](specs/admin-map.md) | Every Admin item — what it is for, where it is stored, what reads it, and what the 2026-09-25 review removed. |
| [requirements/](specs/requirements/) | Detailed requirements by domain, numbered `00`–`14` (intake, workflow, approvals, suppliers, sourcing, contracts, P2P, analytics, admin, AI assistant, data model, APIs). |

## roadmap/ — what to build
| Doc | What it covers |
|---|---|
| [PRODUCT_BACKLOG.md](roadmap/PRODUCT_BACKLOG.md) | **Delivery backlog.** Epics → features → user stories with acceptance criteria, plus the decision rules and modules behind each feature. Written to be lifted straight into a tracker. |
| [R1_BACKLOG_FIT_GAP.md](roadmap/R1_BACKLOG_FIT_GAP.md) | **Primary roadmap.** Fit/gap of the R1 backlog vs the codebase + the workstream plan. Updated as gaps close. |
| [R1_IMPLEMENTATION_EVIDENCE.md](roadmap/R1_IMPLEMENTATION_EVIDENCE.md) | **R1 evidence index.** Code, schema, tests, ADRs, and live-validation references for every Built roadmap capability. |
| [R1_STORY_FIT_GAP.md](roadmap/R1_STORY_FIT_GAP.md) | Per-story fit/gap detail behind the roadmap, plus the `POL-xx` policy defaults. |
| [REQUIREMENTS_AND_FIT_GAP.md](roadmap/REQUIREMENTS_AND_FIT_GAP.md) | Capability baseline vs market leaders (Zip, Oro, Ariba), scored against the app. |

## testing/ — how we verify
| Doc | What it covers |
|---|---|
| [TEST_PLAYBOOK.md](testing/TEST_PLAYBOOK.md) | Full test scope — the catalogue of every automated `npm run test:*` suite (the one index of them, guarded by `test:workflow-scripts`) and the manual regression suites. |

## adr/ — why it is built this way
Context → Decision → Consequences for the choices that are not obvious from the
code. Read these before changing the boundaries they set.

| ADR | Decision |
|---|---|
| [0001](adr/0001-dual-mode-requester-experience.md) | Dual-mode (Simple/Expert) requester experience. **Superseded by 0008.** |
| [0002](adr/0002-governed-catalogue-checkout.md) | Governed catalogue and call-off checkout creates the internal request → requisition → PO chain. |
| [0003](adr/0003-private-neon-database-migration.md) | The store is a private Neon PostgreSQL database behind `/api/db`. **Defers the identity/authorization model** — the assumption behind most of the platform's remaining security posture. |
| [0004](adr/0004-contract-scope-matching.md) | Contract coverage is matched on structured scope versions, not on category alone. |
| [0005](adr/0005-unified-ai-guided-intake.md) | One AI-guided intake conversation rather than a branching form. |
| [0006](adr/0006-ui-only-lifecycle-e2e.md) | The lifecycle end-to-end proof is driven through the UI. |
| [0007](adr/0007-atomic-intake-and-lifecycle-stabilisation.md) | Intake and every lifecycle transition commit atomically. |
| [0008](adr/0008-one-standardised-requester-ui.md) | One standardised requester UI with progressive disclosure. Supersedes 0001. |
| [0009](adr/0009-catalogue-basket.md) | A catalogue basket is placed as one order per supplier, approved on the basket total, all or nothing. Extends 0002. |
| [0010](adr/0010-submit-decides-again.md) | Submit decides the demand again from stored data and refuses a different answer; the ports it reads get a server side. Extends 0007. |

Implementation evidence for the capabilities these decisions cover is indexed in
[R1_IMPLEMENTATION_EVIDENCE.md](roadmap/R1_IMPLEMENTATION_EVIDENCE.md).

> Live test status is the `test:*` scripts in `package.json`, not a static doc. What each covers: [the test playbook's catalogue](testing/TEST_PLAYBOOK.md#the-automated-suites).

## archive/ — historical (not maintained)
Point-in-time reviews of earlier builds and bug fixes that are now resolved. Kept
for context; **do not treat as current state** — verify against the code and the current
[R1 roadmap](roadmap/R1_BACKLOG_FIT_GAP.md). Archived documents are intentionally not rewritten when
the implementation moves on.

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
