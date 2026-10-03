-- =============================================================
-- Migration 002 — Create users table
-- Global user accounts — not per tenant.
-- One person can belong to multiple tenants via memberships.
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT        NOT NULL,
  name           TEXT        NOT NULL,
  password_hash  TEXT        NOT NULL,   -- bcrypt hash, never plain text
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phone number must be unique across the whole platform
-- One phone = one account (even if they own multiple businesses)
CREATE UNIQUE INDEX users_phone_unique ON users (phone);

-- =============================================================
-- NOTE: users table does NOT have tenant_id.
-- It is global — a user's identity exists outside any one tenant.
-- Which tenant they belong to is stored in the memberships table.
-- RLS is NOT applied here.
-- =============================================================