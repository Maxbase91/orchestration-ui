# ADR 0001: Dual-mode requester experience

## Context

The procurement front door serves occasional requesters and operational reviewers. A single dense
wizard and request-detail surface exposes governance vocabulary and controls before they are useful
to requesters, while reviewers still need the complete operational view. Release 1 owns the internal
request lifecycle while it still does not execute upstream purchasing actions.

## Decision

Provide two presentation modes behind one permission model:

- `service-owner` requesters default to Simple mode; all other roles default to Expert mode.
- A keyboard-accessible switch is available to every eligible user. The selection is persisted in the
  existing per-user `user_preferences.prefs.requestExperienceMode` JSON key.
- Simple intake is adaptive: it recommends catalogue, contract, P-card, direct-PO, or procurement
  review, then asks only the fields required for the selected route. P-card eligibility is policy-driven
  and the route only deep-links or hands off; it never charges a card or writes to an upstream system.
- Simple request detail is a requester task dashboard with limited requester actions. Expert request
  detail retains the existing seven tabs and deep links.
- Pilot exposure is centrally controlled with Vite feature flags and optional user/role allowlists;
  when preference loading or pilot configuration fails, the role default is used safely.

## Consequences

The mode contract is a UI density decision, not an authorization boundary. Both modes use the same
request records, routing rules, workflow APIs, and internal Neon-backed write lifecycle. Product telemetry can
compare completion, abandonment, correction, and route comprehension before broad rollout. The
Simple journey adds a second composition surface and therefore requires browser coverage in addition
to the existing Expert wizard tests. Role switching remains intentionally available for simulation and
UAT; authentication and production authorization are deferred.
