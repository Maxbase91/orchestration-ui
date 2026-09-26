# ADR-0010: Submit decides the demand again, and refuses a different answer

Extends [ADR-0007](0007-atomic-intake-and-lifecycle-stabilisation.md). Decided 2026-09-26.

## Context

The intake determination (the buying channel, the approval chain, the risk and
materiality tiers, whether a risk assessment is needed, screening, the
disposition and the policy checks) was computed in the browser. `/api/intake-submit`
checked that the channel existed and that the required details were present,
then stored the determination and the compliance record the browser sent.
A Channel page left open while a supplier's screening or an admin's thresholds
changed, or a payload edited on the way, therefore became the record. That broke
the rule that anything creating a record recomputes its decision from stored
data ([AGENTS.md](../../AGENTS.md) rule 3).

Two things stood in the way of deciding again on the server:

- five of the determination's helpers defaulted their thresholds to a
  module-level copy that the browser fills at boot and nothing fills on a
  server, so the same demand could be decided two ways;
- the supplier, its contracts and its reusable risk assessments are upstream
  objects read through the source-connector ports, which existed only in the
  browser. Rule 2 forbids a server handler from adding direct SQL reads of them.

## Decision

1. **The determination takes its thresholds as a required input.** No default:
   the browser passes the admin's saved values, the server passes the stored
   row (`api/_policy.ts`). Every helper receives them.
2. **The ports have a server side for the objects submit reads.**
   `createSharedConnectors(client)` builds the supplier, contract and
   risk-assessment connectors for whichever client it is given. The browser
   registers them with its `/api/db` client and the server builds them with its
   in-process one, so both read with the same queries (`*-core.ts`) and mapping.
   A live connector for one of them is swapped there, once, for both. Reuse
   matching reads through the risk port, now able to ask for a validity window,
   rather than through a query beside it.
3. **The server's client answers as the endpoint does.** The in-process
   executor JSON-encodes its result like `/api/db`'s response, so a date is the
   same ISO string on both sides.
4. **Submit decides again and compares.** `api/_determination.ts` makes the
   determination from stored data with the inputs the browser's hook reads.
   `determination-changes.ts` compares what the Channel page showed and the
   request records: the channel, approval chain, sourcing type, the tiers, the
   risk assessment, screening, disposition, the SRA outcome, each policy
   check's result, the reusable assessments, vendor onboarding and the risk
   questions asked. The time each was decided and the wording are not compared.
5. **A different answer is refused, not corrected.** The server answers
   409 `determination_changed` with each change in a sentence and writes
   nothing. The page fetches the inputs again, redraws the Channel page and says
   what changed; the requester reviews and submits again. When the two agree,
   the server records its own determination and compliance record.

Refusing was chosen over storing the server's answer silently: the requester
reviewed one set of conclusions, and a request must not go forward on
conclusions nobody reviewed.

## Consequences

- A request's determination and compliance record are the server's, from
  stored data, and match what the requester reviewed.
- A browser that reads its inputs differently from the server would have every
  submit refused. `test:submit-decides-again` holds both to one read path:
  the shared connectors, one construction point, one set of read cores. It also
  checks the refusal and the record against the live store.
- The submit request carries the answers to the two risk questions
  (`riskAnswers`). The server needs them as inputs; they are not in the request
  record.
- `api/governed-checkout.ts` and the other domain handlers still read with SQL
  (ARCHITECTURE §4.4). The shared connectors are where they would move to.
- Stage exits are still written from the browser (ARCHITECTURE §10). This
  decision covers the moment of creation only.
