-- =============================================================================
-- FILE: sql/migrations/031_notifications.sql   (Week 30 Day 3, Batch 3b-1: the notifications outbox)
-- =============================================================================
--
-- WHY THIS FILE EXISTS
--   When head office suspends, reinstates or verifies a shop, the owner should be
--   TOLD (a WhatsApp or SMS). Sending a message is slow and can fail (no network,
--   Meta is down, airtime is out). So we never send it inside the admin action.
--   We WRITE A LINE in a table called notifications ("the outbox") and a worker
--   sends it later. This file creates that outbox table.
--
-- WHY IMPORTANT
--   The line is written in the SAME transaction as the shop change and its
--   receipt. Either all three happen or none do. A shop is never suspended
--   without the owner's message being queued, and a message is never queued for
--   a change that was rolled back. Think of the post office tray on the counter:
--   the clerk drops the letter in the tray before you leave; the postman takes it
--   later.
--
-- DANGER
--   1. Additive only (a NEW table). Nothing existing changes. Safe to run twice
--      (IF NOT EXISTS / DROP POLICY IF EXISTS).
--   2. The table has a tenant_id and FORCED row level security, like every other
--      tenant table. Normal shop requests may only READ their own rows
--      (tenant_read). Only head office (app.platform_admin = 'on', switched on
--      by withAdminLock inside a transaction) may write. A shop owner can never
--      queue, edit or delete a message.
--   3. recipient_phone and payload are personal data. Never print them in logs
--      (mask the phone). Payload holds only what the template needs (shop name
--      and, for a suspension, the reason head office typed).
--   4. Run as the owner of the tables (postgres on local, the owner role on
--      Neon) AFTER a pg_dump backup. The last line hands the table to
--      rahisisha_user, like migrations 026 and 028.
--
-- WHAT IT SOLVES
--   "Tell the owner what happened, reliably, without slowing or breaking the
--   admin action", and later: a list of queued, sent and failed messages for
--   head office to look at.
--
-- SYSTEM DESIGN PRINCIPLE
--   Transactional outbox. The message is DATA first (a row), delivery comes
--   later. This also separates WHAT to say (template + payload) from HOW to send
--   it (channel), so WhatsApp and SMS can be added without touching the admin code.
--
-- RULES
--   1. channel is one of: test, whatsapp, sms. Today every row uses 'test' (it
--      sends nothing real). Real channels arrive in later batches.
--   2. status is one of: queued, sent, failed. New rows are 'queued'.
--   3. attempts counts tries. send_after lets the worker retry later.
--   4. recipient_phone may be empty (a shop with no owner row). The row is still
--      written so head office can see "nobody to tell".
--   5. audit_log_id points at the receipt of the admin action that caused the
--      message (ON DELETE SET NULL: removing a receipt never deletes the message).
--
-- PRACTICAL EXAMPLE
--   Head office suspends "Mama Njeri Groceries" for "fake M-Pesa messages".
--   In one transaction: the shop becomes suspended, a receipt is written, and
--   this table gets: template 'shop.suspended', recipient 2547xxxxxxxx, payload
--   {"shopName":"Mama Njeri Groceries","reason":"fake M-Pesa messages"},
--   status 'queued'. A minute later the worker sends it and marks it 'sent'.
--
-- DECISIONS
--   - channel/status are TEXT with CHECK rules (not Postgres ENUMs): adding a
--     new word later is one simple ALTER, not an enum migration.
--   - Shop owners get READ-only access (tenant_read) so a future "messages we
--     sent you" screen is possible. No shop-side writes at all.
--   - ON DELETE CASCADE on tenant_id: if a shop is removed for good, its
--     message history goes with it (same as ussd_events).
--
-- WHERE USED
--   apps/api/src/services/notifications.service.js (queues rows)
--   apps/api/src/services/adminShops.service.js    (calls it after each admin action)
--   apps/api/tests/isolation.test.js               (proves shops cannot touch each other's rows)
--
-- TRADEOFFS
--   + Reliable: the message survives restarts and can be retried.
--   + Auditable: every message ever queued is a row.
--   - A worker is needed to actually send (next batch). Until then rows just wait.
--
-- HOW TO USE
--   Local (as postgres):  psql -d rahisisha -f sql/migrations/031_notifications.sql
--   Neon: backup first, then the same file with the owner connection.
-- =============================================================================

BEGIN;

-- PIECE BY PIECE
--   The table:    one row = one message to send.
--   Two indexes:  one for the worker ("what is waiting?"), one for head office
--                 ("newest messages first, per shop").
--   RLS:          shops read only their own rows; head office does everything.

CREATE TABLE IF NOT EXISTS notifications (
  -- id: a unique number for each message (like a tracking number).
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- tenant_id: WHICH SHOP this message is about. Deleted shop = its messages go too.
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- channel: HOW it will travel. 'test' sends nothing real (used until WhatsApp/SMS exist).
  channel         TEXT NOT NULL DEFAULT 'test'
                  CHECK (channel IN ('test', 'whatsapp', 'sms')),

  -- template: WHAT to say, by name (for example 'shop.suspended'). The words live in code.
  template        TEXT NOT NULL CHECK (char_length(template) BETWEEN 1 AND 80),

  -- recipient_phone: who receives it (stored as 2547xxxxxxxx). NULL = nobody to tell.
  recipient_phone TEXT CHECK (recipient_phone IS NULL OR char_length(recipient_phone) <= 20),

  -- payload: the blanks to fill in the template (shop name, reason...). Small JSON.
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- status: where the message is in its life.
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'sent', 'failed')),

  -- attempts / last_error / send_after: the retry notebook the worker will use.
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error      TEXT CHECK (last_error IS NULL OR char_length(last_error) <= 500),
  send_after      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,

  -- audit_log_id: the receipt of the admin action that caused this message.
  audit_log_id    UUID REFERENCES audit_logs(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Worker's question: "which queued messages are due?" A PARTIAL index: it holds
-- only queued rows, so it stays tiny even after a million messages were sent.
CREATE INDEX IF NOT EXISTS notifications_due_idx
  ON notifications (send_after, id) WHERE status = 'queued';

-- Head office's question: "newest messages first" (and per shop).
CREATE INDEX IF NOT EXISTS notifications_tenant_idx
  ON notifications (tenant_id, created_at DESC, id DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE  ROW LEVEL SECURITY;

-- A shop may READ only its own rows. No INSERT/UPDATE/DELETE policy for shops,
-- so Postgres refuses every shop-side write.
DROP POLICY IF EXISTS tenant_read ON notifications;
CREATE POLICY tenant_read ON notifications
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);

-- Head office may do everything, but only while the admin lock is on.
DROP POLICY IF EXISTS admin_all ON notifications;
CREATE POLICY admin_all ON notifications
  USING      (current_setting('app.platform_admin', TRUE) = 'on')
  WITH CHECK (current_setting('app.platform_admin', TRUE) = 'on');

ALTER TABLE notifications OWNER TO rahisisha_user;

COMMIT;
