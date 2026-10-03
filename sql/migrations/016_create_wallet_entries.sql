-- Migration 016 — wallet_entries
-- Append-only ledger. Balance = SUM(amount_cents).
-- Never stored as a separate column — sums never drift.

CREATE TABLE IF NOT EXISTS wallet_entries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount_cents INTEGER     NOT NULL,
  reason       TEXT        NOT NULL CHECK (reason IN ('sale','refund','commission','payout')),
  reference_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX wallet_entries_tenant_idx ON wallet_entries (tenant_id, created_at DESC);

ALTER TABLE wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_entries FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON wallet_entries
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);