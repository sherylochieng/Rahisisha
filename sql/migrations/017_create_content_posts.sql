-- Migration 017 — content_posts
-- AI-generated posts waiting for owner approval.
-- draft → approved → published (or rejected).
-- Nothing moves past draft without explicit owner approval.

CREATE TABLE IF NOT EXISTS content_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id   UUID        REFERENCES products(id)         ON DELETE SET NULL,
  media_url    TEXT,
  caption      TEXT,
  channel      TEXT        NOT NULL DEFAULT 'whatsapp'
                           CHECK (channel IN ('whatsapp','instagram','telegram')),
  status       TEXT        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','approved','published','rejected')),
  approved_at  TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX content_posts_tenant_status_idx
  ON content_posts (tenant_id, status, created_at DESC);

ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_posts FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON content_posts
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);