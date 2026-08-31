# R1 Implementation Evidence

**Status:** living release ledger
**Scope:** the current internally operated R1 solution
**Database:** private Neon PostgreSQL through the allowlisted `/api/db` boundary
**Last reviewed:** 30 August 2026

This ledger is the evidence index for the capability statuses in
[`R1_BACKLOG_FIT_GAP.md`](R1_BACKLOG_FIT_GAP.md). A capability is marked **Built** only when an
implementation path and a repeatable verification path are identified. “Built” describes the
internal platform behaviour; it does not imply real authentication, external-system execution, or
production authorization.

## Built capabilities

| ID | Capability | Implementation evidence | Verification | Documentation |
|---|---|---|---|---|
| INT-01/02/04/07/08 | Role-based landing, light intake, drafts, status, notifications | `src/features/dashboard/`, `src/features/requests/`, `src/lib/db/requests.ts`, `src/lib/db/notifications.ts` | `npm run test:intake`, `npm run test:ui`, `npm run test:e2e-ui` | `README.md`, `docs/testing/TEST_PLAYBOOK.md` |
| INT-10 / UX-02 | Adaptive staged intake and Simple requester experience | `src/features/requests/new-request/`, `src/lib/procurement/demand-conversation.ts`, `src/features/dashboard/simple-home-page.tsx` (home-demand handoff and direct route evaluation) | `npm run test:experience-mode`, `npm run test:experience-mode-ui`, `npm run test:intake-guidance-ui` | ADR-0001, `README.md`, `docs/testing/TEST_PLAYBOOK.md` |
| INT-11 / UX-06 | Unified AI-guided demand intake | `src/features/requests/new-request/step-category.tsx`, `step-chat-intake.tsx`, `src/features/dashboard/simple-home-page.tsx`, `src/lib/procurement/intake-seed.ts`, `src/lib/procurement/commodity-candidates.ts`, `src/lib/procurement/intake-guidance-api.ts`, `src/server/api/intake-upload.ts`, `src/server/api/commodity-match.ts`, `src/server/api/intake-guidance.ts`, `src/lib/workflow/engine.ts` | `npm run test:unified-intake`, `npm run test:demand-conversation`, `npm run test:intake-guidance`, `npm run test:ui` | ADR-0005, `src/lib/procurement/SERVICE_DESCRIPTION.md`, `docs/testing/TEST_PLAYBOOK.md` | Broad Goods/Services values remain internal; upload extraction and contextual guidance are best-effort and fall back deterministically. |
| UX-04 | Switchable home designs | `src/features/dashboard/home-designs/` | `npm run test:home-designs` | `README.md`, `docs/testing/TEST_PLAYBOOK.md` |
| UX-05 / PLT | Responsive shell, mobile drawer, keyboard-accessible controls and route guards | `src/components/layout/`, `src/App.tsx`, mode-switch and drawer components | `npm run test:ui`, `npm run test:e2e-ui`, responsive route sweep | `README.md`, `docs/testing/TEST_PLAYBOOK.md` |
| INT-03 / CFG-09/11 | Configurable service-description conversation and quality signals | `src/lib/procurement/demand-conversation.ts`, `src/lib/procurement/service-description-config.ts`, `api/generate-sow.ts`, `service_description_templates` | `npm run test:demand-conversation`, `npm run test:service-description-config`, `npm run test:sow-narrative` | `README.md`, `docs/specs/requirements/01-intake-new-request.md` |
| CLS-01/02/03 | Classification, commodity-code assignment, confidence handling | `src/lib/procurement/classify.ts`, `src/lib/procurement/category-code.ts`, `api/ai.ts` | `npm run test:classification-eval`, `npm run test:category-code`, `npm run test:ai-agents` | `README.md`, `docs/testing/TEST_PLAYBOOK.md` |
| CHK-01/02/05/06 | Catalogue and contract checks | `src/lib/procurement/intake-routing.ts`, `src/lib/procurement/governed-checkout.ts`, connector reads | `npm run test:intake-routing`, `npm run test:governed-checkout`, `npm run test:catalogue-order` | ADR-0002, `src/lib/integrations/README.md` |
| CHK-05 / RTE-06 | Catalogue item detail and governed checkout | `src/features/catalogue/`, `src/lib/procurement/submit-governed-checkout.ts`, `api/governed-checkout.ts`, `purchase_requisitions`, `request_lines`, `procurement_policy_configs` | `npm run test:catalogue-ui`, `npm run test:governed-checkout`, `npm run test:governed-checkout-atomic`, `npm run test:policy-config-server`, `npm run test:catalogue-order` | ADR-0002, `README.md` |
| CHK-07 / CON-05 | Contract-aware demand matching and adaptive clarification | `src/lib/procurement/contract-matching.ts`, `src/server/api/contract-match.ts`, `src/server/api/contract-scope.ts`, `src/features/contracts/contract-detail-page.tsx`, `contract_scope_*` tables and curated Neon backfill | `npm run test:contract-matching`, `npm run test:contract-match-api`, `npm run test:governed-checkout-atomic` | ADR-0004, `docs/specs/requirements/07-contracts.md` | Deterministic rule gate is active; provider reranking is optional and scope metadata must remain maintained. |
| DET-04/05/08/09 / RTE-01/02/03/04/06/07 / P-CARD | Determination, approval-to-source, p-card routing, handoff, supplier-data and disposition | `src/lib/procurement/`, `src/lib/routing/`, determination pages | `npm run test:determination`, `npm run test:p-card`, `npm run test:handoff`, `npm run test:approval-to-source`, `npm run test:referral` | `README.md`, `docs/testing/TEST_PLAYBOOK.md` |
| RSK-01..09 / DET-10 | Risk cascade, materiality, mini-IRQ, reuse and operational risk | `src/lib/procurement/risk*.ts`, `src/lib/procurement/materiality.ts`, risk UI | `npm run test:risk-segmentation`, `npm run test:risk-reuse`, `npm run test:materiality`, `npm run test:operational-risk` | `README.md`, `docs/specs/requirements/13-data-model-validation.md` |
| CFG-01/02/03/08/09/10/11 | Routing, thresholds, approval chains, taxonomy and service-description configuration | `src/features/admin/`, `src/lib/procurement/policy-config.ts`, `src/lib/procurement/policy-config-api.ts`, `src/server/api/policy-config.ts`, `procurement_policy_configs`, `routing_rules`, `approval_chains`, `procurement_categories` | `npm run test:routing-rule-integrity`, `npm run test:policy-config`, `npm run test:policy-config-server`, `npm run test:approval-chain-persistence`, `npm run test:admin-editors` | `README.md`, `docs/specs/requirements/10-admin-configuration.md` |
| PLT / E1..E4 | Internal sourcing event, invitations, responses, scoring and award | `src/features/sourcing/`, `src/lib/db/sourcing-*`, sourcing tables | `npm run test:sourcing`, `npm run test:approval-to-source` | `README.md`, `docs/testing/TEST_PLAYBOOK.md` |
| SUP / RTE-04 | Supplier directory, profile, screening state and conditional onboarding | `src/features/suppliers/`, `src/lib/procurement/supplier-data.ts`, `src/features/suppliers/portal/portal-onboarding.tsx`, onboarding stages | `npm run test:supplier-data`, `npm run test:onboarding-stage`, `npm run test:screening`, `npm run test:ui-lifecycle` | `README.md`, `src/features/suppliers/README.md`, `docs/specs/requirements/04-supplier-management.md` | Supplier-owned company/contact submission is persisted; vendor-manager risk/approval forms remain a hardening gap. |
| WFL / CFG-02 | Workflow instances, stage history, approval entries and configurable templates | `src/lib/workflow/`, `api/workflow-action.ts`, workflow/admin pages | `npm run test:workflow-steps`, `npm run test:orchestration`, `npm run test:lifecycle-consistency` | `docs/specs/requirements/02-workflow-orchestration.md` |
| AST-Q/P/S/X | Assistant lookup, grounded knowledge, support handoff and conversation history | `src/lib/assistant/`, `api/chat.ts`, `api/conversations.ts`, ticket modules | `npm run test:knowledge`, `npm run test:assistant-intents`, `npm run test:tickets`, `npm run test:ticket-sla` | `docs/specs/requirements/11-ai-assistant-knowledge.md` |
| ANA / PLT | Internal KPI, pipeline and cycle-time dashboards | `src/features/analytics/`, `src/features/dashboard/`, KPI data access | `npm run test:kpis`, `npm run test:e2e-ui` | `README.md`, `docs/testing/TEST_PLAYBOOK.md` |
| CON / WS-B | Own-store connectors and private Neon data boundary | `src/lib/integrations/`, `api/db.ts`, `src/lib/neon-compatible-client.ts` | `npm run test:connectors`, `npm run test:neon-migration`, `npm run test:neon-live` | ADR-0003, `src/lib/integrations/README.md` |
| INT-12 / LIF-01 | Atomic full-intake submission and first-stage transition | `src/server/api/intake-submit.ts`, `src/lib/procurement/submit-intake.ts`, dispatcher rewrites in `api/db.ts` and `api/[...route].ts`; request, service-description, compliance, stage-history, workflow-instance and approval-entry writes are transactional | `npm run test:intake-submit`, `npm run test:api-domain-routing`, `npm run test:api-imports`, `npm run test:ui` | `docs/testing/TEST_PLAYBOOK.md`, lifecycle ADRs | Neon live transaction tests require reachable database DNS; the local run was unavailable, while static/API/UI gates passed. |
| LIF-02 / P2P-03 | Receipt and invoice identity consistency | `src/lib/db/goods-receipts.ts`, `src/lib/db/hooks/use-goods-receipts.ts`, `src/features/suppliers/portal/portal-invoices.tsx`, `api/db.ts` JSONB update casts | `npm run test:workflow-steps`, `npm run test:sourcing`, `npm run test:ui` | `docs/testing/TEST_PLAYBOOK.md` | Full deployed receipt-to-payment handoff still needs a fresh live run after deployment. |

## Partial capabilities

| Capability | Current limitation | Next improvement |
|---|---|---|
| Workflow runtime | Template fallback and several multi-write transitions remain; not every admin node is a fully enforced runtime action. Governed checkout itself is atomic. | Make server-side template execution and transactional transitions the single path. |
| Connector coverage | `risk-screening`, `category-taxonomy`, and `form-submission` lack own-store ports; some server consumers use the compatibility adapter directly. | Add ports and route all consumers through them. |
| Assistant and AI governance | Some server paths retain Supabase-shaped access and provider failures can degrade to mock behaviour. | Add explicit Neon repositories, visible fallback state, masking, and metrics. |
| Supplier/contract lifecycle | Obligations, documents, Q&A and some supplier activity/spend panels are simulated or shallow. | Persist the missing records and expose provenance. |
| P2P | Receipt, invoice, matching and payment screens are internally modelled but lack full operational depth and upstream execution. | Add tolerance/configuration depth, exception handling and internal reconciliation. |
| Analytics | Dashboards are live for current internal data, but scheduled reporting and PDF/Excel exports remain incomplete. | Finish export jobs or label them clearly as deferred. |

## Deferred to R2 or later hardening

- Live ERP, CLM, payment, supplier-network, risk-feed, punchout and external catalogue integrations.
- Upstream purchase-order, invoice, contract, payment or supplier writes.
- Enterprise authentication, server-derived identity, production authorization and removal of role switching.
- SSO/SCIM, multi-tenant isolation, formal compliance certification and enterprise data residency controls.

## Live verification record

- Deployed alias: `https://orchestration-ui.vercel.app`.
- Latest verified deployment: commit `0bf9a93`.
- Route sweeps: 66/66 admin/detail, 8/8 supplier, and 9/9 requester routes clean after the latest fixes.
- Neon validation: 44/44 repository tables/functions/governance/orphan checks passed.
- Atomic checkout validation: `npm run test:governed-checkout-atomic` passed for create, replay, conflict and concurrent submission; `npm run test:policy-config-server` passed for save/load/validation and restored the prior policy.
- Catalogue detail and governed-checkout handoff verified; the atomic live test used uniquely prefixed Neon rows and cleaned them up.
- One malformed diagnostic probe queried `procurement_profiles.id` instead of `user_id`; it produced a controlled Vercel error and is not an application defect.

## Current stabilisation run — 31 August 2026

- Build and lint passed; the local Playwright wizard smoke passed all checks,
  including the previously disabled shared-checkout Review order control.
- Dispatcher routing, atomic intake source checks, sourcing, onboarding,
  unified intake and guidance suites passed.
- Neon live validation and the atomic Neon transaction suite were unavailable
  in this environment because the configured Neon hostname could not be
  resolved (`ENOTFOUND`); this is an environment/network limitation, not a
  passed database verification.
- A fresh deployed Vercel route sweep, role handoff, onboarding form run and
  receipt → invoice → payment run remain required after deployment.
