# Supplier and portal lifecycle

The supplier directory and portal provide the supplier-owned steps of the
internal lifecycle: onboarding responses, sourcing responses, documents,
messages and invoice submission. Internal Operations, Procurement and Admin
continue the matching, approval and simulated payment stages through the
purchasing screens. No external supplier or payment system is written in R1.

The supplier onboarding screen includes a persisted company/contact form and a
compliance confirmation before the submission is marked ready for review; saving
starts onboarding and never takes back a completed one.

**Evidence, not verdicts** (2026-09-26, `lib/procurement/supplier-evidence.ts`).
The profile's Risk & Compliance tab lets a Vendor Manager or Admin **record a
screening result** — clear or flagged, with the reference of the screening that
was performed and its date — and **link a risk assessment**: a completed,
in-date assessment of this supplier from the register, which sets the SRA and its
expiry. Neither touches onboarding, and each is audited. They replaced
"Approve risk" and "Refer back", which wrote the SRA valid and screening clear or
flagged with nothing screened or assessed. The onboarding pipeline's **Complete**
(Procurement Manager, Admin) needs a clear screening on record and keeps its
note in the audit log. These controls remain simulation role controls until
authentication is implemented.

Supplier profile deep links are also available from requester request details as
read-only views. The supplier directory, onboarding, risk, and administrative
surfaces remain restricted to supplier-management roles.
