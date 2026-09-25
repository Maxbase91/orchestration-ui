# FR-02: Workflow Engine & Orchestration

**Version:** 1.0 · **Date:** 30 August 2026 · **Roles:** `procurement-manager`, `operations-lead`, `admin`

> **Current R1 status:** internal workflow instances, stage history, approvals, and lifecycle writes run against Neon. External integration nodes remain R2; see the [current roadmap](../../roadmap/R1_BACKLOG_FIT_GAP.md).

---

## Purpose

The workflow engine drives every request through its lifecycle. It is template-driven (Workflow Designer defines the graph) and state-machine based (each request has a `workflow_instances` row tracking its current position). The Kanban, Timeline, and Table views surface the resulting state.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR02-01 | proc-manager | When I submit a request, the system automatically places it in the correct first stage | Must |
| FR02-02 | proc-manager | When all approvals are completed, the request automatically advances to the next stage | Must |
| FR02-03 | ops-lead | I can see all active requests in a Kanban view grouped by stage | Must |
| FR02-04 | ops-lead | I can see which requests are overdue (exceeding their stage SLA) | Must |
| FR02-05 | admin | I can change the workflow template used for a request type and it affects newly submitted requests | Should |
| FR02-06 | admin | I can set SLA targets per stage and see the bottleneck view update in real time | Should |

---

## Lifecycle Stages

Stages are defined by `RequestStatus` union type (canonical) + `STAGES_BY_CHANNEL` (sequence per channel):

| Stage | Channels that traverse it |
|-------|--------------------------|
| `intake` | All |
| `validation` | All except catalogue |
| `approval` | All except catalogue under its auto-approval threshold |
| `sourcing` | `procurement-led` only |
| `contracting` | `procurement-led` only |
| `po` | All |
| `receipt` | All |
| `invoice` | All |
| `payment` | All |
| `completed` | Terminal |
| `cancelled` / `referred-back` | Exception states |

---

## Workflow Engine

### Instance lifecycle

```
createRequest()
    │
    ▼ initWorkflow(requestId, templateId, buyingChannel)
       → workflow_instances INSERT { current_node_ids: [start_node_id] }
       → advanceInstance() — traverses start node → first stage node
    │
    ▼ stage node: updateRequest(status = nodeToStatus(node.label))
    │   if status == 'validation' → generateComplianceReport()
    │   if status == 'approval'   → generateApprovalEntries() → status = 'suspended'
    │
    ▼ [suspended] — waiting for external trigger
    │
    ▼ trigger: all approval entries approved
       → advanceWorkflow(requestId, 'approved')
       → engine resumes, executes next node
```

### Decision-node evaluation (G1)

FR02-10 · Decision node edge labels are evaluated as conditions:
- `"value > 100000"` — numeric comparison on request value
- `"category == consulting"` — string equality
- `"approved"` / `"rejected"` — outcome keywords from approval action
- Unlabelled edges always match (fallback).
- First matching edge wins; first edge is the fallback.

### Node types

| Type | Action |
|------|--------|
| `start` | No-op; advance immediately |
| `stage` | Update `requests.status`; if `validation` → generate compliance report; if `approval` → generate entries + suspend |
| `decision` | Evaluate edge conditions; take matching edge |
| `parallel` | Split into multiple concurrent node IDs |
| `integration` | Log stub (future: HTTP webhook) |
| `end` | Set status `completed`, mark instance `completed` |
| `error` | Set status `referred-back`, suspend |

---

## SLA & Bottlenecks

FR02-20 · **A stage's SLA is its workflow-template node's `slaDays`** — one source, edited in
the Workflow Designer (`/admin/workflows`) beside that stage's role and gate. There is no
default: a stage nobody configured has no target, and `stageSlaDays()` returns null rather
than inventing one. `sla_targets` held nine stage rows that disagreed with the templates in
six of nine stages and that nothing read; they were deleted in
`db/backfills/2026-09-17-c10-debris.mjs`, and the table now holds only its `stage='ticket'`
rows.
FR02-21 · Stage SLAs are edited only on the stage, in the Workflow Designer.
`/admin/sla-targets` is now **Support SLAs** — the ticket first-response hours, the rows
`sla_targets` still owns — and links to the designer for stages. It first wrote stage rows
that drove nothing, then showed the template figures read-only while the ticket rows had no
editor (2026-09-25).
FR02-22 · `useStageSlas()` / `stageSlasFromTemplates()` supply the bottleneck chart,
stuck-requests table, timeline view and active-workflows page.
FR02-23 · `requests.sla_deadline` is computed from the stage node's `slaDays` in **working
days** (`slaDeadlineFor` + `addBusinessDays`) whenever a stage opens — at creation
(`api/_domains/intake-submit.ts`, `api/governed-checkout.ts`) and on every stage change
(`api/workflow-action.ts`, `src/lib/workflow/transition.ts`). It is written on every change
**including as NULL**: a stage whose node sets no SLA clears the clock rather than inheriting
the previous stage's. `isOverdue` is derived from it on read, so there is no job and no
staleness window. Requests past their deadline appear in the "Stuck Requests" panel.

---

## Views

FR02-30 · **Kanban**: columns = active stages; cards show request ID, value, owner, days in stage; overdue highlighted.
FR02-31 · **Table**: sortable by stage, value, owner, days in stage; filterable by stage, priority.
FR02-32 · **Timeline**: horizontal bars per request across stage columns; red bar segments exceed SLA.
FR02-33 · **Workflow Monitor**: per-request stage history; integration badges (SAP Ariba, Coupa etc.); bottleneck heatmap.

---

## Key Files

- `src/lib/workflow/engine.ts` — state machine
- `src/lib/db/workflow-instances.ts` — instance DB layer
- `src/lib/workflow/channel-stages.ts` — channel → stages, derived from the templates
  (replaced `buying-channel-stages.ts`, which defined the lifecycle a second time)
- `src/lib/workflow/stage-sla.ts` + `src/lib/db/hooks/use-stage-slas.ts` — stage SLAs from
  the templates (replaced `src/lib/db/sla-targets.ts` and its hook, which had no importers)
- `src/lib/workflow/business-days.ts` — `slaDeadlineFor` / `addBusinessDays`
- `src/features/workflows/active-workflows-page.tsx` — Kanban/Table/Timeline
- `src/features/workflows/workflow-monitor-page.tsx`
- `src/features/workflows/components/bottleneck-chart.tsx`
