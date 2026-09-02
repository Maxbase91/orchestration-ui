-- One-off repair, run 2026-08-28 against the live project. Kept in the repo so
-- the change is auditable, not because it should run again.
--
-- RR-001 "High-value IT software" was active, first in evaluation order, and
-- described as "Routes all software requests above €100K to Procurement-led".
-- Its three conditions were:
--
--     contractId  less_than  false      <- `contractId` was not a field the
--                                          evaluator knew, so this was always
--                                          false
--     supplierId  between    100000     <- `between` needs two bounds; with one
--                                          it can never be satisfied
--     priority    is_empty   (empty)    <- `is_empty` was not an operator the
--                                          evaluator implemented, so this was
--                                          always false
--
-- A rule requires `conditions.every(...)`, so RR-001 had NEVER matched — while
-- carrying `match_count = 42`, implying it had matched 42 times. Software over
-- €100k reached procurement-led only because `fallbackBuyingChannel` happens to
-- agree, and the determination screen therefore told every such requester
-- "No admin routing rule matched — using default fallback."
--
-- Not a coincidence, and not a one-off typo: the admin editor OFFERED
-- `contractId` and `is_empty`, and the built-in Test panel implemented them,
-- so the tester confirmed a rule that production ignored. The code change
-- landing alongside this closes that gap (the evaluator now implements every
-- field and operator the editor offers, and an unrecognised one produces a
-- visible diagnostic instead of a silent `false`).
--
-- The conditions below say what the rule's own description always claimed.
-- `match_count` is reset to 0 rather than preserved: 42 was never true, and
-- carrying it forward would keep asserting a history the rule does not have.

BEGIN;

UPDATE routing_rules
SET conditions = '[
      {"field": "category", "operator": "equals",       "value": "software"},
      {"field": "value",    "operator": "greater_than", "value": "100000"}
    ]'::jsonb,
    match_count   = 0,
    last_modified = now()
WHERE id = 'RR-001';

COMMIT;

-- Verified after the run: 0 active rules contain a field or operator the
-- evaluator cannot act on, and RR-001 now matches the demands its description
-- names (software over €100k) while still not matching software below it.
