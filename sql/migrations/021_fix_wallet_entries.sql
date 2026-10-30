-- Migration 021 — wallet_entries: huge jar, text receipt, reason menu
BEGIN;

ALTER TABLE wallet_entries
  ALTER COLUMN amount_cents TYPE BIGINT;

ALTER TABLE wallet_entries
  ALTER COLUMN reference_id TYPE TEXT USING reference_id::text;

ALTER TABLE wallet_entries
  RENAME COLUMN reference_id TO reference;

ALTER TABLE wallet_entries
  ADD CONSTRAINT wallet_entries_reason_check
  CHECK (reason IN ('sale', 'refund', 'commission', 'payout'));

COMMIT;