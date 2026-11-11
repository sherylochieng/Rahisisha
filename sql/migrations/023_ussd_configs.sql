-- =====================================================================
-- 023_ussd_configs.sql : which shop owns which USSD service code
-- =====================================================================
-- WHY THIS FILE EXISTS
--   One USSD endpoint serves every shop. When a phone dials a code like
--   *384*101#, we need to know WHICH shop that code belongs to. This
--   table is the phone book: service code -> shop.
--
-- WHY IMPORTANT
--   It is the only thing that decides whose data a USSD caller sees.
--
-- DANGER
--   If two shops share a code, customers of one shop see the other's
--   menu. The UNIQUE rule on service_code makes that impossible.
--   NEVER trust the caller's phone number to pick the shop: the same
--   phone can be a customer of many shops.
--
-- WHAT IT SOLVES
--   One shared endpoint, per-shop settings, no copy-pasted code per shop.
--
-- SYSTEM DESIGN PRINCIPLE
--   Shared code, per-tenant configuration.
--
-- RULES
--   1. service_code is UNIQUE across all shops.
--   2. welcome_text is short (see DECISIONS) so the whole reply stays
--      under the 182-character USSD limit.
--   3. The endpoint looks the shop up BEFORE any tenant is stamped on
--      the connection, so this table is read without a tenant.
--
-- PRACTICAL EXAMPLE
--   service_code '*384*101#' -> Mama Mboga, welcome 'Karibu Mama Mboga'
--   service_code '*384*102#' -> Brio Hardware, welcome 'Welcome to Brio'
--
-- DECISIONS
--   * NO row level security on this table (same as tenants and users).
--     Reason: at lookup time no shop is known yet, so an RLS rule that
--     reads app.current_tenant would hide every row (the same trap that
--     broke login before migration 022).
--     A service code is public by nature: customers dial it.
--   * welcome_text capped at 100 characters. The menu lines add about
--     50 more, so the reply stays well under 182.
--
-- WHERE USED
--   POST /ussd (tenant resolution), the demo data, the USSD tests.
--
-- TRADEOFFS
--   + Simple, fast lookup, no special login-style policy needed.
--   - The app user can read every shop's code and welcome text.
--     Acceptable here: it is public information. Do not add secrets
--     to this table.
--
-- HOW TO USE
--   psql -d <database> -f sql/migrations/023_ussd_configs.sql
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ussd_configs (
  -- One config per shop. Deleting a shop is blocked while it has one.
  tenant_id    UUID PRIMARY KEY REFERENCES tenants(id),

  -- What the customer dials. UNIQUE: one code, one shop.
  service_code TEXT UNIQUE NOT NULL,

  -- First line of the menu. Short, because USSD replies are capped.
  welcome_text TEXT NOT NULL CHECK (char_length(welcome_text) <= 100)
);

COMMIT;