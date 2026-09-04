# ADR 0008: One standardised requester UI

**Status:** Accepted. Supersedes [ADR 0001](0001-dual-mode-requester-experience.md).

## Context

ADR-0001 introduced a Simple/Expert experience switch: a requester defaulted to
a stripped-down view, everyone else to the operational one, with the choice
persisted per user and gated behind pilot flags.

Driving the result showed what the switch actually bought. It was three files
and about 170 lines of machinery, read in five places, and only two things
genuinely forked:

- the home page — `SimpleHomePage` (a demand box and the requester's own
  requests) versus `DashboardPage` (widgets, KPIs, quick actions);
- the request detail page — a single-column read versus the seven-tab view.

Everything else it changed was copy ("Start a request" / "New Request" /
"Create a new procurement request in N steps") or whether the workings were on
the page **at all**: the routing rule behind a recommendation, the inherent-risk
tier, the operational-risk dimensions, the determination export. Simple did not
present that evidence differently. It withheld it.

Two costs followed. The requester had to make a decision about *how to see the
product* before they could use it, which is not a decision they are equipped to
make or should be asked to make. And every screen that forked was a place two
implementations could drift — which the intake pages had already done twice,
into different governance outcomes for the same demand.

## Decision

There is one UI. The switch, both forked pages and the pilot flags are deleted.

- `/` renders the dashboard for everyone. Simplification comes from **role**:
  a requester's default widget layout is their own requests and the requests-by-
  stage view, not KPIs. That is a property of the role's registry defaults, not
  a mode.
- `/requests/:id` renders the tabbed detail for everyone. The contract and
  purchase-order deep links that existed only on the removed Simple page moved
  to the Related tab, purchase-order role entitlement included.
- Every disclosure that was Expert-only is now shown to everyone, **collapsed by
  default**: "Why this?" on the buy-route screen, the classification workings,
  inherent and operational risk, the governance details on both checkouts, and
  the determination export. Progressive disclosure is the mechanism; a mode
  toggle was never needed to achieve it.
- `user_preferences` keeps its generic `prefs` JSONB; the
  `requestExperienceMode` key is no longer read or written.

## Consequences

- One page per surface. The class of defect where two implementations of the
  same journey drift apart cannot recur here, because there is one.
- Nobody has to choose a view before starting. The copy that survived is the
  plainer half of each pair.
- Evidence is available to every user rather than to whichever density they were
  in — which matters because a requester who cannot see why their demand was
  routed a particular way cannot challenge it.
- Role-based defaults now carry the whole weight of "show me only what I need".
  If a role's dashboard is wrong for it, that is a registry fix
  (`widget-registry.tsx`), not a new mode.
- `test:mode-equivalence` survives the switch it was written for. What it
  asserts — that the decision layer takes no density argument and that
  presentation cannot reach into the step order, the gates or the record — is a
  layering rule that outlives the feature.
