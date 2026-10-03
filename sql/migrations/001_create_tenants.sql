-- =============================================================
-- Migration 001 — Create tenants table
-- The foundation of everything. One row = one business.
-- Every other table references this table via tenant_id.
-- =============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL,   -- the subdomain: aminas-boutique
  plan        TEXT        NOT NULL DEFAULT 'starter'
                          CHECK (plan IN ('starter', 'growth', 'pro')),
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Slug must be unique across the whole platform
-- No two businesses can have the same subdomain
CREATE UNIQUE INDEX tenants_slug_unique ON tenants (slug);

-- Fast lookup by slug (happens on every request to identify the tenant)
CREATE INDEX tenants_slug_idx ON tenants (slug);

-- =============================================================
-- NOTE: tenants table does NOT have tenant_id on itself.
-- It IS the source of tenant identity.
-- RLS is NOT applied here — the platform admin needs full access.
-- All other tables reference this table via tenant_id.
-- =============================================================