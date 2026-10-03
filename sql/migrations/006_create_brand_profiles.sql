-- Migration 006 — brand_profiles
-- Logo, colours, tone of voice, delivery rules per tenant.
-- Used by the AI assistant to answer questions about policies
-- and by the image API to enhance photos in the right brand style.

CREATE TABLE IF NOT EXISTS brand_profiles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url         TEXT,
  primary_colour   TEXT,
  secondary_colour TEXT,
  tone             TEXT        DEFAULT 'friendly'
                               CHECK (tone IN ('friendly', 'professional', 'playful')),
  delivery_areas   TEXT,
  return_policy    TEXT,
  working_hours    TEXT,
  whatsapp_number  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brand_profiles_tenant_idx ON brand_profiles (tenant_id);

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON brand_profiles
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);