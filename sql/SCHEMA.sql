-- =============================================================
-- Rahisisha — Full Database Schema (SCHEMA.sql)
-- Week 27 Day 3 · Sheryl Ochieng · Mctaba Labs Capstone
--
-- Run this on a fresh Postgres database to get the complete
-- Rahisisha database ready to go.
--
-- Order matters — tables must be created before they are
-- referenced by foreign keys.
--
-- Run order:
--   1. tenants
--   2. users
--   3. memberships
--   4. brand_profiles
--   5. products
--   6. product_variants
--   7. product_media
--   8. customers
--   9. conversations
--  10. messages
--  11. stock_reservations
--  12. inventory_movements
--  13. orders
--  14. order_items
--  15. webhook_events
--  16. wallet_entries
--  17. content_posts
--  18. subscriptions
--  19. usage_counters
--  20. audit_logs
-- =============================================================


-- Enable the UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================
-- TABLE 1: tenants
-- One row per business on the platform.
-- Every other tenant-owned table references this via tenant_id.
-- =============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL,        -- subdomain: aminas-boutique
  plan        TEXT        NOT NULL DEFAULT 'starter'
                          CHECK (plan IN ('starter', 'growth', 'pro')),
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX tenants_slug_unique ON tenants (slug);
CREATE INDEX        tenants_slug_idx    ON tenants (slug);
-- No RLS on tenants — it IS the source of identity


-- =============================================================
-- TABLE 2: users
-- Global user accounts — not per tenant.
-- One person can own multiple businesses via memberships.
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT        NOT NULL,
  name           TEXT        NOT NULL,
  password_hash  TEXT        NOT NULL,    -- bcrypt, never plain text
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_phone_unique ON users (phone);
-- No RLS on users — global identity table


-- =============================================================
-- TABLE 3: memberships
-- Links users to tenants with a role.
-- ADR-004: memberships table instead of users.tenant_id
-- Schema-ready for staff accounts — MVP only has 'owner'.
-- =============================================================
CREATE TABLE IF NOT EXISTS memberships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'owner'
                          CHECK (role IN ('owner', 'staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX memberships_tenant_user_unique ON memberships (tenant_id, user_id);
CREATE INDEX        memberships_user_idx            ON memberships (user_id);
CREATE INDEX        memberships_tenant_idx          ON memberships (tenant_id);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 4: brand_profiles
-- Logo, colours, tone of voice, delivery rules per tenant.
-- Set once during onboarding. Used to personalise AI replies
-- and photo enhancements.
-- =============================================================
CREATE TABLE IF NOT EXISTS brand_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url        TEXT,
  primary_colour  TEXT,                   -- hex: #1e3a5f
  secondary_colour TEXT,
  tone            TEXT        DEFAULT 'friendly',
                              CHECK (tone IN ('friendly', 'professional', 'playful')),
  delivery_areas  TEXT,                   -- "Nairobi CBD, Westlands, Kilimani"
  return_policy   TEXT,                   -- "Returns within 7 days, unworn"
  working_hours   TEXT,                   -- "Mon–Sat 8am–6pm"
  whatsapp_number TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brand_profiles_tenant_idx ON brand_profiles (tenant_id);

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON brand_profiles
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 5: products
-- Every product a business sells.
-- Prices always in KES cents (KES 350 = 35000).
-- =============================================================
CREATE TABLE IF NOT EXISTS products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku         TEXT,
  name        TEXT        NOT NULL,
  description TEXT,
  price_cents INTEGER     NOT NULL CHECK (price_cents >= 0),
  status      TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ          -- soft delete
);

CREATE UNIQUE INDEX products_tenant_sku_unique
  ON products (tenant_id, sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX products_tenant_status_idx
  ON products (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX products_tenant_created_idx
  ON products (tenant_id, created_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 6: product_variants
-- Sizes and colours of each product — stock tracked HERE.
-- ADR-006: stock per variant, not per product.
-- "5 in stock" is meaningless without knowing which size.
-- =============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  product_id    UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size          TEXT,
  colour        TEXT,
  measurements  TEXT,                     -- "Bust 36, Waist 28"
  price_cents   INTEGER,                  -- NULL = use product base price
  stock         INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX variants_product_size_colour_unique
  ON product_variants (product_id, size, colour) WHERE deleted_at IS NULL;
CREATE INDEX variants_product_idx
  ON product_variants (product_id) WHERE deleted_at IS NULL;
CREATE INDEX variants_tenant_idx
  ON product_variants (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX variants_tenant_stock_idx
  ON product_variants (tenant_id, stock) WHERE deleted_at IS NULL;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON product_variants
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 7: product_media
-- Original + enhanced photos per product variant.
-- ADR-015: enhance the real photo, never generate a fake one.
-- Nothing goes public until the owner explicitly approves it.
-- =============================================================
CREATE TABLE IF NOT EXISTS product_media (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id)          ON DELETE CASCADE,
  product_id    UUID        NOT NULL REFERENCES products(id)          ON DELETE CASCADE,
  variant_id    UUID        REFERENCES product_variants(id)          ON DELETE SET NULL,
  original_url  TEXT        NOT NULL,     -- always kept, never deleted
  enhanced_url  TEXT,                     -- NULL until enhancement runs
  approved      BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_at   TIMESTAMPTZ,
  position      INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX product_media_product_idx
  ON product_media (product_id, position);
CREATE INDEX product_media_tenant_idx
  ON product_media (tenant_id);

ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON product_media
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 8: customers
-- People who buy from a tenant's shop.
-- Tenant-scoped — Amina's customers are invisible to Brian.
-- Identified by phone number within a tenant.
-- =============================================================
CREATE TABLE IF NOT EXISTS customers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  name        TEXT,
  channel     TEXT        NOT NULL DEFAULT 'whatsapp'
                          CHECK (channel IN ('whatsapp', 'web', 'ussd')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Same phone can be a customer of multiple tenants
-- but only once per tenant
CREATE UNIQUE INDEX customers_tenant_phone_unique
  ON customers (tenant_id, phone);
CREATE INDEX customers_tenant_idx
  ON customers (tenant_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 9: conversations
-- One conversation per customer per channel per tenant.
-- Holds the thread of messages between a customer and a business.
-- =============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  customer_id  UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel      TEXT        NOT NULL DEFAULT 'whatsapp'
                           CHECK (channel IN ('whatsapp', 'web', 'ussd')),
  status       TEXT        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'resolved', 'handed_off')),
  last_message_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conversations_tenant_idx
  ON conversations (tenant_id, last_message_at DESC);
CREATE INDEX conversations_customer_idx
  ON conversations (customer_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversations
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 10: messages
-- Individual messages inside a conversation.
-- Every AI reply is logged here — tenant_id on every row.
-- direction: 'inbound' = customer sent it, 'outbound' = we sent it
-- =============================================================
CREATE TABLE IF NOT EXISTS messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id)       ON DELETE CASCADE,
  conversation_id  UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction        TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body             TEXT        NOT NULL,
  sender           TEXT        NOT NULL CHECK (sender IN ('customer', 'ai', 'owner')),
  channel_message_id TEXT,               -- WhatsApp message ID for dedup
  raw_payload      JSONB,                -- original webhook payload, kept for audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conversation_idx
  ON messages (conversation_id, created_at DESC);
CREATE INDEX messages_tenant_idx
  ON messages (tenant_id, created_at DESC);
-- Dedup index — same channel message ID per tenant processed only once
CREATE UNIQUE INDEX messages_channel_dedup
  ON messages (tenant_id, channel_message_id)
  WHERE channel_message_id IS NOT NULL;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 11: stock_reservations
-- Holds stock when a customer taps Buy — before payment confirms.
-- ADR-007: reserve-then-confirm. Stock never drops until payment
-- is confirmed by Safaricom's server-side callback.
-- BullMQ releases expired reservations automatically.
-- =============================================================
CREATE TABLE IF NOT EXISTS stock_reservations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id)          ON DELETE CASCADE,
  variant_id  UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER     NOT NULL CHECK (quantity > 0),
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'released', 'expired')),
  expires_at  TIMESTAMPTZ NOT NULL,       -- BullMQ releases if still pending after this
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stock_reservations_variant_idx
  ON stock_reservations (variant_id, status);
CREATE INDEX stock_reservations_expires_idx
  ON stock_reservations (expires_at) WHERE status = 'pending';
CREATE INDEX stock_reservations_tenant_idx
  ON stock_reservations (tenant_id);

ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_reservations
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 12: inventory_movements
-- Audit trail — every single stock change ever recorded.
-- ADR-008: never just update a number, always write a row.
-- "Why is stock at 3?" has a real answer, not a guess.
-- type: sale | release | adjustment | return | import
-- =============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)          ON DELETE CASCADE,
  variant_id   UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL
                           CHECK (type IN ('sale','release','adjustment','return','import')),
  quantity     INTEGER     NOT NULL,      -- positive = stock added, negative = stock removed
  reference_id UUID,                      -- order_id, reservation_id, etc.
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_movements_variant_idx
  ON inventory_movements (variant_id, created_at DESC);
CREATE INDEX inventory_movements_tenant_idx
  ON inventory_movements (tenant_id, created_at DESC);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_movements
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 13: orders
-- Confirmed purchases — one row per order.
-- Status state machine: created → paid → packed → sent → delivered
-- Also cancellable from any state.
-- =============================================================
CREATE TABLE IF NOT EXISTS orders (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  customer_id   UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status        TEXT        NOT NULL DEFAULT 'created'
                            CHECK (status IN (
                              'created','paid','packed','sent','delivered','cancelled'
                            )),
  channel       TEXT        NOT NULL DEFAULT 'whatsapp'
                            CHECK (channel IN ('whatsapp', 'web', 'ussd')),
  total_cents   INTEGER     NOT NULL CHECK (total_cents >= 0),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_tenant_status_idx
  ON orders (tenant_id, status, created_at DESC);
CREATE INDEX orders_customer_idx
  ON orders (customer_id);
CREATE INDEX orders_tenant_created_idx
  ON orders (tenant_id, created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 14: order_items
-- Line items inside an order.
-- ADR-010: price and name are COPIED at purchase time.
-- If Amina changes a price later, old order totals never change.
-- =============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id)          ON DELETE CASCADE,
  order_id        UUID        NOT NULL REFERENCES orders(id)           ON DELETE CASCADE,
  variant_id      UUID        REFERENCES product_variants(id)          ON DELETE SET NULL,
  product_name    TEXT        NOT NULL,   -- snapshot at purchase time
  variant_label   TEXT,                   -- "Blue / Size M" — snapshot
  unit_price_cents INTEGER    NOT NULL CHECK (unit_price_cents >= 0),
  quantity        INTEGER     NOT NULL CHECK (quantity > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_items_order_idx  ON order_items (order_id);
CREATE INDEX order_items_tenant_idx ON order_items (tenant_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_items
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 15: webhook_events
-- Idempotency table — every incoming webhook stored here first.
-- ADR-009: a duplicate callback is a silent no-op, not an error.
-- Covers M-Pesa, WhatsApp, and any future provider.
-- =============================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT        NOT NULL,      -- 'mpesa' | 'whatsapp' | 'meta'
  event_id     TEXT        NOT NULL,      -- provider's own unique ID
  raw_payload  JSONB       NOT NULL,
  processed    BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- This is the idempotency key — same provider + event_id = duplicate
CREATE UNIQUE INDEX webhook_events_provider_event_unique
  ON webhook_events (provider, event_id);
CREATE INDEX webhook_events_unprocessed_idx
  ON webhook_events (processed, created_at) WHERE processed = FALSE;
-- No RLS on webhook_events — system-level table, no tenant context at ingest


-- =============================================================
-- TABLE 16: wallet_entries
-- Append-only ledger — every payment in and out.
-- Balance = SUM(amount_cents) — never stored separately.
-- ADR: no balance column because balances can drift; sums cannot.
-- =============================================================
CREATE TABLE IF NOT EXISTS wallet_entries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount_cents INTEGER     NOT NULL,      -- positive = credit, negative = debit
  reason       TEXT        NOT NULL,      -- 'sale' | 'refund' | 'commission' | 'payout'
  reference_id UUID,                      -- order_id or payment_id
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX wallet_entries_tenant_idx
  ON wallet_entries (tenant_id, created_at DESC);

ALTER TABLE wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_entries FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON wallet_entries
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 17: content_posts
-- AI-generated product posts waiting for owner approval.
-- Status: draft → approved → published
-- Nothing moves past 'draft' without the owner's explicit tap.
-- =============================================================
CREATE TABLE IF NOT EXISTS content_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  product_id   UUID        REFERENCES products(id)          ON DELETE SET NULL,
  media_url    TEXT,                      -- enhanced image URL
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


-- =============================================================
-- TABLE 18: subscriptions
-- Tracks which plan each tenant is on and when it renews.
-- =============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan            TEXT        NOT NULL DEFAULT 'starter'
                              CHECK (plan IN ('starter','growth','pro')),
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','past_due','cancelled')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX subscriptions_tenant_idx ON subscriptions (tenant_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON subscriptions
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 19: usage_counters
-- Tracks AI message usage per tenant per month.
-- Used to enforce plan caps (Starter = 1,000 msgs/month).
-- =============================================================
CREATE TABLE IF NOT EXISTS usage_counters (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month         DATE        NOT NULL,     -- first day of the month: 2026-10-01
  ai_messages   INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX usage_counters_tenant_month_unique
  ON usage_counters (tenant_id, month);

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_counters
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);


-- =============================================================
-- TABLE 20: audit_logs
-- Records every privileged or financial action.
-- Who did what, to what, and what it looked like before and after.
-- Used for the platform admin and for debugging incidents.
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id     UUID        REFERENCES users(id)   ON DELETE SET NULL,
  action       TEXT        NOT NULL,      -- 'order.status_changed', 'product.deleted'
  resource     TEXT        NOT NULL,      -- 'orders', 'products'
  resource_id  UUID,
  before       JSONB,                     -- state before the change
  after        JSONB,                     -- state after the change
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_tenant_idx
  ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX audit_logs_resource_idx
  ON audit_logs (resource, resource_id);
-- No RLS on audit_logs — platform admin needs full access


-- =============================================================
-- RLS CONTEXT FUNCTION
-- Called at the start of every request by tenantContext.js:
--   SELECT set_tenant_context('<tenantId>');
-- Sets the transaction-local variable that all RLS policies read.
-- =============================================================
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant', tenant_uuid, TRUE);
END;
$$ LANGUAGE plpgsql;


-- =============================================================
-- SUMMARY
-- 20 tables total
-- 16 tables with RLS enabled (all tenant-owned tables)
--  4 tables without RLS (tenants, users, webhook_events, audit_logs)
--
-- Every tenant-owned table has:
--   - tenant_id UUID NOT NULL REFERENCES tenants(id)
--   - ENABLE ROW LEVEL SECURITY
--   - FORCE ROW LEVEL SECURITY
--   - A tenant_isolation policy using current_setting('app.current_tenant')
--   - A (tenant_id, ...) composite index for fast filtered queries
-- =============================================================