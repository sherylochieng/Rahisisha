-- =============================================================================
-- FILE: sql/migrations/026_ussd_events.sql   (Week 29 Day 4)
-- =============================================================================
--
-- WHY THIS FILE EXISTS
--   The Inbox page must show everything customers sent the shop: WhatsApp
--   messages AND USSD requests (someone dialling the shop's *384*...# code).
--   WhatsApp messages are already saved (table `messages`). USSD requests were
--   NOT saved anywhere. This file creates the notebook where they are written
--   down: a new table called `ussd_events`.
--
-- WHY IMPORTANT
--   No table = nothing to list = the inbox could never show a USSD row.
--   It also holds customers' phone numbers, so it must be locked per shop from
--   its very first day.
--
-- DANGER
--   1. A shop table without row level security (RLS) lets one shop read
--      another shop's customers. The lock lines below must NEVER be removed.
--   2. Run this as the owner user (rahisisha_user). Otherwise the app cannot
--      use the table.
--   3. Never print or log the phone numbers stored here.
--   4. After adding a new RLS rule, the policy count in scripts/reset-db.sh and
--      in .github/workflows/ci.yml goes from 20 to 21 (already updated).
--
-- WHAT IT SOLVES
--   A per-shop, newest-first log of USSD requests that the inbox can read.
--
-- SYSTEM DESIGN PRINCIPLE
--   Isolation in the database, not in our code. We never write
--   "WHERE tenant_id = ..." for this table; Postgres adds it by itself.
--
-- RULES
--   1. ENABLE and FORCE row level security.
--   2. A policy with both USING (reading) and WITH CHECK (writing).
--   3. The table is owned by rahisisha_user.
--   4. sql/SCHEMA.sql gets the same table, so a fresh database matches.
--
-- PRACTICAL EXAMPLE
--   A customer dials Amina's code and presses 2. One row is saved:
--     tenant_id = Amina's shop, phone = the caller, body = '2'.
--   Brian's shop can never see that row.
--
-- WHERE USED
--   Written by: apps/api/src/controllers/ussd.controller.js
--   Read by:    apps/api/src/controllers/inbox.controller.js
--
-- TRADEOFFS
--   + Simple: one row per USSD request.
--   - It grows with every tap (a long menu saves several rows per call).
--     A clean-up job for old rows is future work.
--
-- HOW TO USE
--   psql -U rahisisha_user -d rahisisha -f sql/migrations/026_ussd_events.sql
-- =============================================================================

-- BEGIN / COMMIT: everything between them happens together, or not at all.
-- Real life: either the whole new filing cabinet arrives, or none of it does.
BEGIN;

-- PIECE 1: the table (the notebook). One row = one USSD request.
CREATE TABLE ussd_events (
  -- id: a unique number for each row (like a receipt number)
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- tenant_id: WHICH SHOP this row belongs to. ON DELETE CASCADE means: if a
  -- shop is deleted, its notebook pages are thrown away with it.
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  phone       TEXT NOT NULL,            -- who dialled (Africa's Talking phoneNumber)
  session_id  TEXT,                     -- the call's id from Africa's Talking, for debugging
  body        TEXT NOT NULL,            -- what they typed ('' = they only dialled the code)

  -- created_at: when it happened. Filled in automatically.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PIECE 2: the index (like the index at the back of a book).
-- The inbox always asks "this shop's newest rows first". This lets Postgres
-- jump straight there instead of reading every page of the notebook.
CREATE INDEX ussd_events_tenant_idx ON ussd_events (tenant_id, created_at DESC, id DESC);

-- PIECE 3: turn the lock on. ENABLE = lock exists. FORCE = even the table's
-- owner must obey it. Real life: a door lock that even the caretaker's key
-- must respect.
ALTER TABLE ussd_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ussd_events FORCE  ROW LEVEL SECURITY;

-- PIECE 4: the lock's rule. A row can be seen or written ONLY when its
-- tenant_id equals the shop the current request belongs to.
--   USING      = who may READ / change existing rows
--   WITH CHECK = who may ADD new rows (stops shop B planting a row for shop A)
CREATE POLICY tenant_isolation ON ussd_events
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);

-- PIECE 5: make the app's database user the owner, same as the other tables.
ALTER TABLE ussd_events OWNER TO rahisisha_user;

COMMIT;