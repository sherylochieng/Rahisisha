-- Migration 015 — webhook_events
-- Idempotency table — every incoming webhook stored here first.
-- ADR-009: same provider + event_id = duplicate, silent no-op.
-- Covers M-Pesa, WhatsApp, and any future provider.
-- NO RLS — system table, no tenant context at ingest time.

CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT        NOT NULL,
  event_id     TEXT        NOT NULL,
  raw_payload  JSONB       NOT NULL,
  processed    BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX webhook_events_provider_event_unique
  ON webhook_events (provider, event_id);
CREATE INDEX webhook_events_unprocessed_idx
  ON webhook_events (processed, created_at) WHERE processed = FALSE;