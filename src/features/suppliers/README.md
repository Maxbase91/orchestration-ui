# Supplier and portal lifecycle

The supplier directory and portal provide the supplier-owned steps of the
internal lifecycle: onboarding responses, sourcing responses, documents,
messages and invoice submission. Internal Operations, Procurement and Admin
continue the matching, approval and simulated payment stages through the
purchasing screens. No external supplier or payment system is written in R1.

The supplier onboarding screen includes a persisted company/contact form and a
compliance confirmation before the submission is marked ready for review. The
supplier profile risk tab now exposes a rationale-gated approve/refer-back form
to Vendor Manager and Admin personas, while the onboarding pipeline exposes a
rationale-gated completion action to Procurement and Admin personas. These
controls persist through the existing own-store adapter and remain simulation
role controls until authentication is implemented.

Supplier profile deep links are also available from requester request details as
read-only views. The supplier directory, onboarding, risk, and administrative
surfaces remain restricted to supplier-management roles.
