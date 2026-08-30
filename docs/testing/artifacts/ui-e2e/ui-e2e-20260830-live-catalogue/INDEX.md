# UI-E2E live catalogue lifecycle — 2026-08-30

This run used only the visible in-app role switcher and browser UI against the deployed Vercel application. Records were intentionally retained with the `UI-E2E-20260830-` prefix; no direct API, database, localStorage, or impersonation shortcuts were used.

## Completed journey

| Scenario | Persona/mode | Observed result | Evidence |
| --- | --- | --- | --- |
| Catalogue order, first attempt | Requestor / Simple | Submission succeeded, but the request stayed in Intake. This exposed the lifecycle-stage defect fixed in `2a58500`. | `001`–`004` |
| Catalogue order, corrected low value | Requestor / Simple | A4 Paper order submitted and advanced to PO; `REQ-2025-8216`, `PO-REQ-2025-8216`. | `005`–`006`, `010`–`012` |
| Catalogue order, high value | Requestor / Expert | Laptop order submitted and correctly entered Approval; `REQ-2025-8847`. | `007`–`009` |
| Receipt | Procurement Operations Lead | Partial receipt and full receipt actions completed through the visible receipt form. | `013`–`016` |
| Supplier invoice | Supplier (External) | Invoice `UI-E2E-20260830-INV-LOW-4` submitted after date-input handling was fixed in `051869f`. | `017`–`021` |
| Invoice review and matching | Procurement Operations Lead | Invoice opened for review and matched to the PO. | `022`–`023` |
| Invoice approval | Strategic Procurement Manager | Matched invoice approved. | `024` |
| Payment simulation | Admin / Platform Owner | Payment scheduled and released; tracker shows Matched → Approved → Paid. | `025`–`028` |
| Contract call-off, successful submit | Requestor / Simple | AWS Cloud Infrastructure matched at 97%, checkout submitted as `REQ-2025-8479`; initial post-submit status exposed the fallback reset and was retained as evidence. | `029`–`032` |
| Contract call-off, staged handoff | Requestor → Vendor Manager → Strategic Procurement Manager | `REQ-2025-4818` advanced through Risk → Onboarding → Approval using visible role switches. Approval persistence exposed the no-workflow fallback gap fixed in `0429a8d`. | live UI, no extra screenshot |

## Retained records

- Request: `REQ-2025-6335` (initial Simple attempt; retained as a regression record)
- Request: `REQ-2025-8216` (low-value catalogue order; PO created)
- Request: `REQ-2025-8847` (Expert high-value catalogue order; approval required)
- PO: `PO-REQ-2025-8216`
- Invoice: `UI-E2E-20260830-INV-LOW-4`
- Contract call-off request: `REQ-2025-8479` (successful submission before stage-reset fix)
- Contract call-off request: `REQ-2025-4818` (risk/onboarding/approval handoff)

## Findings during the run

1. The first low-value request was created before the lifecycle-stage fix and remained in Intake. New submissions after `2a58500` advanced to PO or Approval as expected.
2. The receipt form recorded partial and complete receipt actions, but the queue row continued to display `Submitted` after completion; the PO detail should be rechecked and the queue status synchronized.
3. The Supplier Portal currently presents a fixed supplier identity (Accenture), so the test invoice references a Staples PO while displaying Accenture. Supplier/PO consistency should be enforced before production use.
4. PDF/DOCX extraction was not included in this run because the deployed intake-upload handler is intentionally excluded from the shared function bundle after a serverless cold-start failure. This remains an unavailable UI path and should be delivered through the existing dispatcher/function-budget boundary.
5. Contract call-off and full new-demand submissions were not completed in this run; their visible route screens were available, but the first demand form did not reliably submit from the wrapped input until the explicit **Find route** control was added. Resume those journeys after the next deployment.
6. Contract call-off submission initially reached the success screen, but the workflow fallback reset the request to Intake. The fix in `b5c9316` preserves the governed Risk/Approval stage; a subsequent approval fallback fix is in `0429a8d`.

## Runtime evidence

- Payment tracker row observed: `UI-E2E-20260830-INV-LOW-4  Accenture  €5  Matched  Approved  Paid`.
- No uncaught browser errors or horizontal-overflow failures were observed on the completed catalogue journey.
- Screenshots immediately before and after each retained submission are included in this directory.

See `manifest.json` for machine-readable checkpoints.
