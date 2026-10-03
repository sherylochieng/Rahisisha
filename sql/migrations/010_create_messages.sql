-- Migration 010 — messages
-- Individual messages inside a conversation.
-- Every AI reply is logged here. direction = inbound (customer)
-- or outbound (us). Dedup on channel_message_id prevents
-- the same WhatsApp message being processed twice.

CREATE TABLE IF NOT EXISTS messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id)       ON DELETE CASCADE,
  conversation_id    UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction          TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body               TEXT        NOT NULL,
  sender             TEXT        NOT NULL CHECK (sender IN ('customer', 'ai', 'owner')),
  channel_message_id TEXT,
  raw_payload        JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at DESC);
CREATE INDEX messages_tenant_idx       ON messages (tenant_id, created_at DESC);
CREATE UNIQUE INDEX messages_channel_dedup
  ON messages (tenant_id, channel_message_id) WHERE channel_message_id IS NOT NULL;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);