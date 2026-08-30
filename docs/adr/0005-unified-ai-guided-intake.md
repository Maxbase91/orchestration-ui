# ADR-0005 — Unified, AI-guided procurement intake

**Status:** Accepted (R1 internal platform)

## Decision

Use one requester-facing journey for goods, services, software, consulting, and other demand
types: describe or upload, clarify only missing information, review the recommended route, complete
the required details, and submit. Goods/Services remains an internal classification value for
policy compatibility and is not a user choice. Catalogue is the only visible shortcut; contract and
P-card paths are discovered by the governance engine.

The first input may be a sentence, a long pasted brief, or a PDF/DOCX. Extraction and classification
are server boundaries, while the browser presents candidates and asks for explicit confirmation.
Candidates are specific commodity/service families (up to three only at ≥90% confidence, otherwise
the highest candidate), with a visible reason and “None of these”.

The description model keeps Included (`scope`), Excluded (`exclusions`), Deliverables, and
Acceptance Criteria distinct. The right-hand description remains editable and each section records
whether it was requester-provided, document-extracted, AI-drafted, or reviewer-edited. The legacy
`businessJustification` field is preserved for old records but is not populated from the narrative
for new requests.

Contextual guidance is optional and privacy-preserving: it may use generalized signals from approved
completed requests, curated templates, catalogue metadata, contracts, and policy configuration, but
never sends raw historical examples, names, or identifiers to the requester. Applying a suggestion
requires an explicit click. Deterministic prompts and matching remain the fallback when AI is
unavailable.

## Lifecycle rule

The server remains authoritative for required fields, route, governance, and workflow stage. Once
required intake information is complete, submission creates stage history and enters the first
actionable stage (for example validation, risk review, approval, sourcing, or contracting). A record
may remain in `intake` only when required information is genuinely missing.

## Consequences

- Simple and Expert views share the same domain semantics while retaining different presentation
  density.
- Existing broad category values and compatibility columns remain backward compatible.
- Uploads are currently persisted in the request attachment JSON boundary; a future blob store can
  replace that implementation without changing the intake contract.
- Role switching remains simulation-only; this ADR does not add authentication or authorization.
