# UX simplification and view modes — draft

Status: proposal only. No product-code changes should start until the decisions at the end of this document are confirmed.

## Objective

Make procurement requests understandable to occasional requesters without removing the governance, audit, and operational detail needed by procurement experts.

## Product model

Create two presentation modes over the same request data and decision engine:

- **Simple requester view** — one task at a time, plain-language labels, current status, next action, and only the inputs needed from the requester.
- **Expert view** — complete workflow, compliance evidence, approvals, audit history, integrations, configuration context, and operational actions.

The modes must not create separate business logic or separate records. They are presentation and permission boundaries over the same source of truth.

## Request creation

### Simple mode

Replace the seven visible process steps with three user phases:

1. **Describe the need** — free text, optional catalogue shortcut, and lightweight requester context.
2. **Confirm the route** — present catalogue, contract, or full-request outcome as one recommendation with a clear explanation.
3. **Review and submit** — show the captured summary, missing information, expected next action, and submit.

Risk, sourcing, routing, approvals, and supplier checks should appear as concise “how we decided” summaries or only when an answer is required.

### Expert mode

Retain access to the detailed stages, but make each stage task-oriented and collapsible. Internal terms such as IRQ, SRA, materiality, determination, and buying channel need definitions or expert-only labels.

## Request detail

### Simple mode

Default to a focused summary containing:

- current status and plain-language explanation;
- the next action, owner, and due date;
- request value, category, supplier, and delivery target;
- concise business justification and service description;
- one primary action where the user has authority.

Move workflow, compliance, approvals, documents, activity, and related records behind progressive disclosure.

### Expert mode

Expose the complete operational surface, but group it into a smaller information architecture:

- **Overview**
- **Progress** — lifecycle, current owner, SLAs, integrations;
- **Risk and approvals** — compliance, assessments, approval chain;
- **Records** — documents, activity, related requests/contracts.

Keep the full template/configuration table behind an explicit “Show technical workflow” control, preferably restricted to operational roles.

## Shared quality requirements

- Replace the fixed mobile sidebar with a responsive drawer/collapsed navigation.
- Make lifecycle stages keyboard-accessible buttons with names and focus states.
- Give icon-only controls accessible labels.
- Keep one visible owner for each concept; do not reintroduce duplicate cards.
- Calculate date-sensitive states such as SRA expiry at render time.
- Preserve deep links and existing request IDs during migration.
- Add usability acceptance tests for comprehension, task completion, and responsive behavior in addition to rendering tests.

## Delivery sequence

1. Confirm personas, mode policy, permissions, and terminology.
2. Produce low-fidelity IA/wireframes for both modes.
3. Extract shared summary/status/action components.
4. Implement the simple request-creation flow behind a feature flag.
5. Implement the simple request-detail view and expert grouping.
6. Fix responsive/accessibility foundations.
7. Run browser, keyboard, mobile, and role-based regression suites.
8. Pilot with occasional requesters and procurement experts; compare task completion and support questions.
9. Roll out gradually and retire duplicate presentation paths only after usage confirms the new IA.

## Decisions required before implementation

1. Who should receive Simple mode by default, and which roles should default to Expert mode?
2. Should users be able to switch modes themselves, and should that choice persist across sessions?
3. Should mode be a user preference, a role/permission, a request-specific setting, or a combination?
4. Which expert-only actions or fields must never be exposed to ordinary requesters?
5. Should the simple creation journey use the proposed three phases, or should it have a different number of phases?
6. Which inputs are mandatory in Simple mode: supplier, value, delivery date, cost centre, beneficiary, and justification?
7. Should experts use the same three-phase journey with expandable detail, or retain the seven-stage operational journey?
8. On request detail, which actions should be available in Simple mode, and who is allowed to perform them?
9. Are the proposed four Expert-mode groups acceptable, and which existing tabs must remain separately addressable for deep links?
10. Should technical workflow templates be restricted to admins/operations, or visible to all users in Expert mode?
11. What plain-language vocabulary should replace or explain IRQ, SRA, materiality, determination, sourcing type, and buying channel?
12. Should the simple view show AI/risk explanations inline, behind “Why?”, or only in Expert mode?
13. Should the mobile navigation open as a drawer, start collapsed, or use a different pattern?
14. Which success measures define “simpler”: completion time, abandonment, support questions, comprehension score, or another metric?
15. Which audience and sample size should participate in the pilot before broad rollout?
16. Should this work be delivered as one release or as independently deployable creation, detail, and responsive/accessibility increments?
