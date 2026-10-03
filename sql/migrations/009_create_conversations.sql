-- Migration 009 — conversations
-- One thread per customer per channel per tenant.
-- Holds the context the AI assistant uses to reply.

CREATE TABLE IF NOT EXISTS conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  customer_id     UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL DEFAULT 'whatsapp'
                              CHECK (channel IN ('whatsapp', 'web', 'ussd')),
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'resolved', 'handed_off')),
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conversations_tenant_idx   ON conversations (tenant_id, last_message_at DESC);
CREATE INDEX conversations_customer_idx ON conversations (customer_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversations
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);