-- =============================================================================
-- FILE: sql/migrations/028_platform_admins.sql   (Week 30, platform admin: step 1)
-- =============================================================================
--
-- WHY THIS FILE EXISTS
--   Until now Rahisisha only knows SHOP OWNERS. Nobody can see all the shops
--   together, and nobody can suspend a shop that breaks the rules. This file
--   prepares the database for the PLATFORM ADMIN (you, the owner of Rahisisha):
--     1. a new table `platform_admins` for the admin accounts,
--     2. three new columns on `tenants` to record a suspension (when, why, by whom),
--     3. one new column on `audit_logs` so admin actions show WHO did them.
--
-- WHY IMPORTANT
--   The admin can see and stop every shop, so the admin account must be a
--   completely separate thing from a shop owner. If an admin were just a shop
--   owner with a flag, one stolen shop login could become the key to every shop.
--
-- DANGER
--   1. `platform_admins` is locked with row level security (RLS): rows are
--      visible ONLY while the server sets app.platform_admin = 'on'. Only the
--      admin code ever sets it. A shop owner's request never does, so even a
--      bug in a shop route cannot read the admin accounts or their password
--      hashes.
--   2. The password is stored as a bcrypt hash (password_hash), never as text.
--   3. Run as the owner of `tenants` and `audit_logs`. If you get "must be
--      owner of table", run it as postgres (the same as migrations 023-027).
--   4. Do NOT touch the RLS lines of any shop table. This migration does not.
--   5. Creating the FIRST admin must go through the admin script (next step),
--      which sets app.platform_admin = 'on' for itself. A plain INSERT is
--      refused by RLS on purpose.
--
-- WHAT IT SOLVES
--   A place to store admin accounts, and the facts needed to suspend a shop
--   with a reason that can be shown and audited.
--
-- SYSTEM DESIGN PRINCIPLE
--   Separation of identities: customers, shop owners and platform admins are
--   three different kinds of person with three different doors.
--   Also: additive change. Only ADD. Nothing is renamed or removed, so the
--   code that runs today keeps working while the admin code is built.
--
-- RULES
--   1. Every statement is safe to run twice (IF NOT EXISTS).
--   2. phone is unique across admins.
--   3. status is 'active' or 'disabled' (a disabled admin cannot log in).
--   4. suspended_reason is optional here and limited to 500 characters. The API
--      will REQUIRE a reason when suspending (the existing tenants may already
--      have status = 'suspended' without one, so the database does not force it).
--   5. If an admin account is ever deleted, shops they suspended and audit
--      lines keep existing (ON DELETE SET NULL): history is never lost.
--   6. sql/SCHEMA.sql gets the same changes, so a fresh database matches.
--
-- PRACTICAL EXAMPLE
--   You create admin "Sheryl". Later she suspends "Brio Hardware" because it
--   sold fake goods. The database then holds:
--     tenants.status           = 'suspended'
--     tenants.suspended_at     = 2026-12-01 09:14
--     tenants.suspended_reason = 'Selling counterfeit goods (report #12)'
--     tenants.suspended_by     = <Sheryl's admin id>
--     audit_logs.actor_admin_id = <Sheryl's admin id>, action 'tenant.suspended'
--
-- DECISIONS
--   - A separate table, not a flag on `users`: a shop owner login can never
--     become an admin by accident.
--   - RLS on the admin table as a second wall: even if code is wrong, the
--     database refuses.
--   - `audit_logs` has no RLS (platform admin needs to read it), so we only add
--     a column; we do not change who can see it.
--
-- WHERE USED
--   Next steps: the admin script, the admin login, the admin shop list, and
--   suspend / reinstate (API), plus the /admin screens (web).
--
-- TRADEOFFS
--   + Admin accounts are separated at the database level, not only in code.
--   - The admin code must always set app.platform_admin = 'on' inside a
--     transaction before reading this table. That is one more rule to follow,
--     and it is exactly the point.
--
-- HOW TO USE
--   psql -U <owner> -d <database> -f sql/migrations/028_platform_admins.sql
--   (run it on LOCAL first; on Neon only after a pg_dump backup).
-- =============================================================================

-- PIECE BY PIECE
--   platform_admins        = the book that lists the people allowed into the
--                            "head office". Real life: a very short staff list
--                            at the Rahisisha head office, kept in a locked drawer.
--   phone / password_hash  = how an admin proves who they are. The password is
--                            scrambled (hashed), so even we cannot read it.
--   status                 = 'active' may enter; 'disabled' is locked out.
--   last_login_at          = when they last came in (useful if someone logs in
--                            at 3 a.m. and it was not you).
--   RLS policy             = the lock on the drawer: it opens only when the
--                            server says "I am head office right now".
--   tenants.suspended_*    = the notice pinned on a closed kiosk: when it was
--                            closed, why, and by whom.
--   audit_logs.actor_admin_id = the signature line in the head-office diary.


-- =============================================================================
-- 1. THE ADMIN ACCOUNTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS platform_admins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT        NOT NULL,                 -- login name, like 0712345678 stored as 254712345678
  name           TEXT        NOT NULL,
  password_hash  TEXT        NOT NULL,                 -- bcrypt, never plain text
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'disabled')),
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One admin per phone number.
CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_phone_unique ON platform_admins (phone);

-- The lock on the drawer. FORCE makes it apply even to the table's owner.
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE  ROW LEVEL SECURITY;

-- Rows are visible (and writable) ONLY while the server has said
-- SET app.platform_admin = 'on'. A shop owner's request never says that.
DROP POLICY IF EXISTS platform_admin_only ON platform_admins;
CREATE POLICY platform_admin_only ON platform_admins
  USING      (current_setting('app.platform_admin', TRUE) = 'on')
  WITH CHECK (current_setting('app.platform_admin', TRUE) = 'on');


-- =============================================================================
-- 2. THE SUSPENSION NOTICE ON EACH SHOP
-- =============================================================================
-- status already allows 'suspended'. These columns say when, why and by whom.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_by     UUID
  REFERENCES platform_admins(id) ON DELETE SET NULL;

-- The reason is limited to 500 characters (a short, clear sentence).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_suspended_reason_len_chk'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_suspended_reason_len_chk
      CHECK (suspended_reason IS NULL OR char_length(suspended_reason) <= 500);
  END IF;
END $$;


-- =============================================================================
-- 3. WHO DID IT, IN THE AUDIT DIARY
-- =============================================================================
-- audit_logs.actor_id points at shop-owner accounts (users). Admins are a
-- different kind of person, so they get their own column.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_admin_id UUID
  REFERENCES platform_admins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audit_logs_actor_admin_idx
  ON audit_logs (actor_admin_id, created_at DESC);


-- =============================================================================
-- 4. SAME OWNER AS THE OTHER TABLES (the app's database user)
-- =============================================================================
ALTER TABLE platform_admins OWNER TO rahisisha_user;