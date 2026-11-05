-- =============================================================================
-- Migration 022 — let LOGIN read the user's own memberships
-- =============================================================================
--
-- WHY THIS MIGRATION EXISTS:
-- - memberships is locked: you only see rows for the shop stamped on your
--   connection (app.current_tenant)
-- - At login nobody has a shop stamp yet. Login must read memberships to FIND
--   OUT which shop the person belongs to, so the lock hid everything and
--   login answered 403
--
-- WHAT IT DOES:
-- 1. Adds a second, read-only rule (login_lookup): a user may see THEIR OWN
--    membership rows, but only when the login step has set app.login_user
--    (after the password was verified, inside a transaction)
-- 2. Makes the existing rule safe against an EMPTY setting. A reused database
--    connection leaves '' behind, and '' cannot be read as a uuid, so the lock
--    would crash instead of hiding rows. NULLIF turns '' into NULL = no match
--
-- WHAT IT DOES NOT DO:
-- - It does not let login write anything (FOR SELECT only)
-- - It does not weaken the shop lock for any other table
-- - A normal request (no app.login_user) sees exactly what it saw before
--
-- TESTED ON A SCRATCH DATABASE (5 checks): login sees only its own rows;
-- nothing is visible after the login transaction; other shops are unaffected;
-- login cannot update or insert; the version without NULLIF crashes.
-- =============================================================================

BEGIN;

-- 1. Make the existing shop rule safe against an empty setting
ALTER POLICY tenant_isolation ON memberships
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);

-- 2. The new read-only login rule
CREATE POLICY login_lookup ON memberships
  FOR SELECT
  USING (user_id = NULLIF(current_setting('app.login_user', TRUE), '')::UUID);

COMMIT;