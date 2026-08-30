# ADR-0004: Contract-scope matching and adaptive clarification

**Status:** Accepted · **Date:** 30 August 2026

## Decision

Contract call-off recommendations use normalized, effective-dated scope versions rather than
category alone. Deliverables, aliases, exclusions, service family, geography, business unit,
supplier, requested dates and remaining capacity are evaluated by deterministic rules. A request is
only sufficient for matching when it contains a service family, an outcome/deliverable and one
contextual discriminator. The intake asks up to three targeted questions, then routes to the full
service-description journey when evidence remains insufficient.

`POST /api/contract-match` returns explainable candidates. The existing Groq → Gemini chain may
rerank only candidates already admitted by the rules; outages use the deterministic order. The final
`/api/governed-checkout` transaction repeats the match against Neon, rejects stale or conflicting
client selections, and stores scope version, score, reasons, algorithm version and input fingerprint
on the requisition. This keeps the browser useful for preview without allowing a client score to
authorize a call-off.

## Consequences

- Incomplete or expired scope metadata remains visible but routes to full intake.
- Scope changes are auditable because versions are effective-dated rather than overwritten.
- Existing role switching and the R1 no-upstream-write boundary are unchanged.
- Curated backfill provides baseline coverage; procurement owners must maintain it for high-confidence
  matching.
