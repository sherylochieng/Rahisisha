-- =============================================================
-- Migration 003 — Create memberships table
-- Links users to tenants and assigns their role.
-- This is ADR-004: memberships table instead of users.tenant_id
-- because one user might own multiple businesses in the future.
-- =============================================================

CREATE TABLE IF NOT EXISTS memberships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'owner'
                          CHECK (role IN ('owner', 'staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A user can only have ONE role per tenant
-- Prevents Amina from being both owner and staff of the same business
CREATE UNIQUE INDEX memberships_tenant_user_unique
  ON memberships (tenant_id, user_id);

-- Fast lookup: "which tenants does this user belong to?"
CREATE INDEX memberships_user_idx ON memberships (user_id);

-- Fast lookup: "which users belong to this tenant?"
CREATE INDEX memberships_tenant_idx ON memberships (tenant_id);

-- -------------------------------------------------------------
-- Enable RLS — memberships are tenant-scoped data
-- A user should only see their own membership rows
-- -------------------------------------------------------------
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON memberships
  USING (
    tenant_id = current_setting('app.current_tenant', TRUE)::UUID
  );

-- =============================================================
-- MVP rule: every tenant has exactly one owner.
-- The signup flow enforces this in application code.
-- Staff accounts exist in the schema but have no UI in the MVP.
-- =============================================================