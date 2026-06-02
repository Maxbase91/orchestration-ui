# FR-02: Workflow Engine & Orchestration

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `procurement-manager`, `operations-lead`, `admin`

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
| `approval` | All except catalogue (direct-po skips if value < threshold) |
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

FR02-20 · SLA targets are stored in `sla_targets` table (stage, channel, days). Default: 5 days.
FR02-21 · Admin can edit SLA targets via `/admin/sla-targets` without code change.
FR02-22 · `resolveSla(targets, stage)` is used by bottleneck chart, stuck-requests table, timeline view, and active-workflows page to determine overdue threshold.
FR02-23 · Requests where `daysInStage > slaDays(request)` appear in the "Stuck Requests" panel.

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
- `src/lib/workflow/buying-channel-stages.ts` — fallback stage sequences
- `src/lib/db/sla-targets.ts` + `src/lib/db/hooks/use-sla-targets.ts`
- `src/features/workflows/active-workflows-page.tsx` — Kanban/Table/Timeline
- `src/features/workflows/workflow-monitor-page.tsx`
- `src/features/workflows/components/bottleneck-chart.tsx`
