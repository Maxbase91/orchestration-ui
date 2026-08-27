-- One-off backfill, run 2026-08-27 against the live project. Kept in the repo
-- so the change is auditable and reproducible, not because it should run again.
--
-- Why it was needed: requests reached the sourcing stage long before an event
-- could be raised from a request, so six sat in `status='sourcing'` against one
-- unrelated event. Sourcing now gates the workflow, and a stage with no event
-- behind it is a dead end.
--
-- Idempotent: the NOT EXISTS / ON CONFLICT / status guards make a re-run a no-op.
-- Verified before running against a dry-run SELECT of the same predicate.

BEGIN;

-- 1. A draft event per stranded request, seeded from the request.
--    Criteria and requirements are left EMPTY on purpose: inventing evaluation
--    criteria would fabricate the basis of a future award. The evaluation page
--    already states that an event with no criteria cannot be scored.
INSERT INTO sourcing_events
  (id, title, category, type, status, budget, currency, owner_id, description, request_id)
SELECT
  next_sourcing_event_id(),
  r.title,
  COALESCE(r.category, ''),
  -- Matches the wizard's own convention: higher-value demand goes out as an RFP.
  CASE WHEN r.value >= 250000 THEN 'RFP' ELSE 'RFQ' END,
  'draft',
  r.value,
  COALESCE(r.currency, 'EUR'),
  r.owner_id,
  'Backfilled for a request that entered the sourcing stage before events could be raised from a request.',
  r.id
FROM requests r
WHERE r.status = 'sourcing'
  AND NOT EXISTS (SELECT 1 FROM sourcing_events e WHERE e.request_id = r.id);

-- 2. Seed the incumbent as the first invitation, mirroring the
--    "Create sourcing event" action. Joins suppliers because supplier_id is a
--    real FK — a request naming a deleted supplier must not break the insert.
INSERT INTO sourcing_responses (id, event_id, supplier_id, supplier_name, status)
SELECT 'SRS-' || e.id || '-' || s.id, e.id, s.id, s.name, 'not-viewed'
FROM sourcing_events e
JOIN requests r  ON r.id = e.request_id
JOIN suppliers s ON s.id = r.supplier_id
WHERE e.status = 'draft'
  AND e.description LIKE 'Backfilled for a request%'
ON CONFLICT (event_id, supplier_id) DO NOTHING;

-- 3. The orphan: cancelled, NOT deleted. It predates request linking and had no
--    criteria, requirements, budget, deadline or invitations, so it would sit in
--    the Evaluation Centre as "open for evaluation" with nothing to evaluate.
--    Deleting it would cascade and erase history; cancelling states what it is.
UPDATE sourcing_events
SET status = 'cancelled',
    description = 'Pre-launch test event. Cancelled during the sourcing backfill: not linked to any request and never had criteria or invitations.',
    updated_at = now()
WHERE request_id IS NULL
  AND id = '2ed9e6f4-71e1-4c9d-b5c7-13df98c40216'
  AND status <> 'cancelled';

COMMIT;

-- Result: 6 events (SRC-0003..SRC-0008) linked to the 6 requests, 3 incumbent
-- invitations seeded (SUP-012 x2, SUP-007), 1 orphan cancelled.
