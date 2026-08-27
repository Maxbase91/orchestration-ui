-- One-off backfill, run 2026-08-27 against the live project. Kept in the repo
-- so the change is auditable and reproducible, not because it should run again.
--
-- Two data faults left over from before the orchestration realignment (R0–R4):
--
--  1. `buying_channel` held the **display label** on the eight requests the
--     wizard created ("Procurement-Led Sourcing", "Business-Led"). Every
--     consumer keys on the slug, so `getStagesForChannel` always missed and
--     silently fell back to the full lifecycle — no stage was ever marked
--     skipped for a channel that skips it. The write path now stores the slug
--     (step-compliance.tsx `buyingChannelSlug`); these are the rows that
--     predate it.
--
--  2. Thirty-three active requests had **no open `stage_history` row**, because
--     the engine changed status with a bare `updateRequest({status})` and wrote
--     no history at all. Both steppers derive "complete" and the per-stage owner
--     exclusively from `stage_history`, so these requests rendered as never
--     having entered anything.
--
-- Idempotent: both statements are guarded, so a re-run is a no-op.
-- Verified before running against dry-run SELECTs of the same predicates
-- (8 rows and 33 rows respectively).

BEGIN;

-- 1. The label form → the slug. Only these two labels were ever written; an
--    unknown label is left alone rather than guessed at.
UPDATE requests SET buying_channel = 'procurement-led'
WHERE buying_channel = 'Procurement-Led Sourcing';

UPDATE requests SET buying_channel = 'business-led'
WHERE buying_channel = 'Business-Led';

-- 2. Open the current stage for every active request that has none.
--
--    Only the CURRENT stage. Inventing the stages a request passed through on
--    the way here would fabricate a governance record — the steppers would show
--    completed stages with dates that never happened. A request whose earlier
--    history is genuinely unknown should look partly unknown.
--
--    `entered_at` is `updated_at`, not now(): the last time the row changed is
--    the closest evidence of when it arrived in its current stage, and now()
--    would reset the ageing of every request to zero and empty the Stuck and
--    bottleneck views overnight. (`days_in_stage` is 0 on all 33, so it carries
--    no information to use instead.)
--
--    `owner_id` is the request's real owner. Nothing is invented; where the
--    request has no owner the stage is left unassigned, which is visibly wrong
--    rather than quietly wrong.
--
--    Terminal statuses are excluded on purpose. An *open* row on a completed or
--    cancelled request would say it is still waiting on someone, and a closed
--    row would need a completion date nobody recorded.
INSERT INTO stage_history (request_id, stage, entered_at, completed_at, owner_id, action, notes)
SELECT r.id, r.status, COALESCE(r.updated_at, now()), NULL, r.owner_id, 'backfilled',
       'Backfilled: the request was in this stage before the engine wrote stage history. Earlier stages are deliberately not reconstructed.'
FROM requests r
WHERE r.status NOT IN ('completed', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM stage_history sh
    WHERE sh.request_id = r.id AND sh.completed_at IS NULL
  );

-- 3. Two seed requests (REQ-2024-0006 at `sourcing`, REQ-2024-0016 at `po`)
--    carried TWO open rows on the same stage — duplicates from the original
--    seed, not from step 2, which is guarded against exactly that. A stage with
--    two open rows renders twice in the stepper and makes "who owns this now"
--    ambiguous.
--
--    The newer row wins and the older is closed at the newer one's `entered_at`:
--    the request demonstrably re-entered the stage at that moment, so that is
--    the one completion time the data actually supports.
UPDATE stage_history older
SET completed_at = newer.entered_at
FROM stage_history newer
WHERE older.request_id = newer.request_id
  AND older.stage = newer.stage
  AND older.completed_at IS NULL
  AND newer.completed_at IS NULL
  AND older.entered_at < newer.entered_at;

-- 4. Two requests (REQ-2024-0015, REQ-2024-0020) sat at `contracting` with their
--    open row still on `sourcing`. Both were moved on by the award write-back
--    before `transitionStage` existed, so the status changed and the history did
--    not — the stepper showed them still out to market.
--
--    Closed at the request's `updated_at` (when the award actually moved it) and
--    the current stage opened from the same instant, so the two records agree.
UPDATE stage_history
SET completed_at = (SELECT r.updated_at FROM requests r WHERE r.id = stage_history.request_id)
WHERE completed_at IS NULL
  AND stage = 'sourcing'
  AND request_id IN (
    SELECT r.id FROM requests r
    WHERE r.status <> 'sourcing'
      AND EXISTS (SELECT 1 FROM stage_history s WHERE s.request_id = r.id
                    AND s.stage = 'sourcing' AND s.completed_at IS NULL)
  );

INSERT INTO stage_history (request_id, stage, entered_at, completed_at, owner_id, action, notes)
SELECT r.id, r.status, r.updated_at, NULL, r.owner_id, 'backfilled',
       'Backfilled: the award moved the request on before transitions closed and opened stage history.'
FROM requests r
WHERE r.id IN ('REQ-2024-0015', 'REQ-2024-0020')
  AND NOT EXISTS (
    SELECT 1 FROM stage_history sh
    WHERE sh.request_id = r.id AND sh.stage = r.status AND sh.completed_at IS NULL
  );

COMMIT;

-- Verified after the run: 0 requests with more than one open row, 0 active
-- requests with no open row, 0 open rows whose stage disagrees with the request
-- status, 0 label-form buying channels. Three open rows remain on terminal
-- requests (stage 'completed'/'cancelled', action 'closed'/'cancelled') — those
-- are correct: the terminal stage is where the request stops, so there is no
-- completion to record.

-- Not done, deliberately:
--
--  * The eight `WF-001` instances parked at n3 are NOT re-pointed. Their pointer
--    is the *next* node to execute, and n3 (Validation) is genuinely the next
--    node for a request sitting at intake — the old engine simply never ran it.
--    The realigned engine does, so they resolve on the next advance. Marking
--    them `suspended` to match the new gate model would be actively wrong: the
--    resume path skips execution of the node it is suspended on, so they would
--    jump straight past Validation.
--
--  * No `approval_chain` is written. The column is new and null on all 101; the
--    engine falls back to the value band, which is the chain the intake preview
--    already showed the requester. Backfilling a chain would freeze a guess in
--    place of that live resolution.
