# FR-03: Approvals & Delegation

**Version:** 1.0 · **Date:** June 2026 · **Roles:** All internal roles

---

## Purpose

The approvals subsystem implements multi-step, parallel approval chains with delegation, OOO substitution, and AI-assisted risk summaries.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR03-01 | any internal | I can see all requests waiting for my approval in a single queue | Must |
| FR03-02 | any internal | I can approve or reject a request in one click with an optional comment | Must |
| FR03-03 | ops-lead | I can set a delegate so approvals go to them when I'm OOO | Must |
| FR03-04 | proc-manager | When all parallel approvers have approved, the request advances automatically | Must |
| FR03-05 | proc-manager | I can substitute an approver mid-chain if they are unavailable | Should |
| FR03-06 | admin | Editing an approval chain in Admin changes who gets approval requests for matching new requests | Must |

---

## Approval Chain Execution

FR03-10 · When the engine enters the `approval` stage, `generateApprovalEntries(requestId, chainName)` is called.
FR03-11 · The chain name is resolved from `requests.approval_chain` (set by routing rule), then matched to `approval_chains` table by `id` (exact) then by `name ilike` (fuzzy fallback).
FR03-12 · For each step in the chain: find all `users` with `role = CHAIN_ROLE_TO_SYSTEM_ROLE[step.role]`.
FR03-13 · **OOO substitution**: if `user.is_ooo = true` and `user.delegate_id` is set, insert the entry with `approverId = delegateId`.
FR03-14 · All entries are created with `status = 'pending'`. Multiple users for the same role = parallel approvals.
FR03-15 · **All must approve**: the engine only advances when `areAllApprovalsComplete(requestId)` returns true (no pending entries remain).
FR03-16 · On reject/cancel: `advanceWorkflow(requestId, outcome)` is called immediately (does not wait for other approvers).

### Role mapping (`CHAIN_ROLE_TO_SYSTEM_ROLE`)

| Chain step role | System role |
|-----------------|-------------|
| Budget Owner | `service-owner` |
| Category Manager, Finance, VP Procurement | `procurement-manager` |
| CFO, Board | `admin` |
| Supplier Manager | `vendor-manager` |
| Operations Lead | `operations-lead` |

---

## Delegation & OOO

FR03-20 · User can set `is_ooo = true` and `delegate_id` via AI assistant action `set_ooo` / `set_delegate` or via the Delegation page.
FR03-21 · Delegation page (`/approvals/delegation`) shows the current OOO status and delegate.
FR03-22 · The AI assistant surfaces the option to set a delegate when a user mentions going out of office.

---

## Approval Entry Model

```
approval_entries
  id             uuid PK
  request_id     → requests.id
  approver_id    → users.id
  stage          text (chain step label, e.g. "Category Manager")
  status         pending | approved | rejected | delegated | info-requested
  requested_at   timestamptz
  responded_at   timestamptz (null until actioned)
  comments       text
  delegated_to   text (user id, if delegated)
  chain_id       text (→ approval_chains.id)
  step_order     int
```

---

## Approvals Page

FR03-30 · `/approvals` shows all `pending` approval entries where `approver_id = currentUser.id`.
FR03-31 · Cards show request ID, title, value, requestor, days waiting, AI risk summary.
FR03-32 · One-click Approve/Reject buttons; optional comment field.
FR03-33 · Bulk approve available for multiple low-risk requests.
FR03-34 · After actioning, the UI re-fetches both `approval_entries` and `requests` to reflect the updated state.

---

## Key Files

- `src/lib/workflow/engine.ts` — `generateApprovalEntries`, `areAllApprovalsComplete`
- `src/lib/db/approvals.ts` — `createApproval`, `updateApproval`
- `src/lib/db/approval-chains.ts` — chain CRUD
- `src/features/approvals/approvals-page.tsx`
- `src/features/approvals/delegation-page.tsx`
- `src/features/requests/request-detail/components/action-buttons.tsx` — approve/reject wired to engine
