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
--  21. ussd_configs (migration 023)
--  22. whatsapp_configs (migration 024)
--  23. whatsapp_dedupe (migration 024)
--  24. daraja_configs (migration 025)
--  25. payment_attempts (migration 025)
--  26. ussd_events (migration 026)
--  27. products.image_url column (migration 027)
--  28. platform_admins table + tenants.suspended_* + audit_logs.actor_admin_id
--      (migration 028, Week 30 platform admin; created at the END of this file
--       because tenants and audit_logs point at platform_admins)
--  29. notifications (migration 031, Week 30 Day 3, Batch 3b-1: the outbox;
--      created at the END of this file because it points at tenants and audit_logs)
--  30. categories + products.category_id (migration 032, Week 30 Day 3, Batch 4a-1;
--      at the END of this file because it changes products)
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
-- (Migration 028 also adds suspended_at, suspended_reason and suspended_by to
--  this table. They are added at the END of this file, after platform_admins
--  exists, because suspended_by points at it.)


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

-- Rule 1: you see rows for the shop stamped on your connection.
-- NULLIF turns an EMPTY setting (left by a reused connection) into NULL,
-- because '' cannot be cast to uuid and would crash the lock (migration 022)
CREATE POLICY tenant_isolation ON memberships
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);

-- Rule 2 (migration 022): LOGIN may read the user's OWN membership rows.
-- Read-only (FOR SELECT). Works only while the login step has set
-- app.login_user, after the password was verified, inside a transaction
CREATE POLICY login_lookup ON memberships
  FOR SELECT
  USING (user_id = NULLIF(current_setting('app.login_user', TRUE), '')::UUID);

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
  -- Week 30 Day 3, Batch 4b (migration 033): the shop's public business card
  town            TEXT,                   -- "Kitengela" (max 60)
  short_description TEXT,                 -- one line under the shop name (max 160)
  list_in_marketplace BOOLEAN NOT NULL DEFAULT FALSE,  -- owner's yes to the marketplace
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brand_profiles_town_len_chk CHECK (town IS NULL OR char_length(town) <= 60),
  CONSTRAINT brand_profiles_desc_len_chk CHECK (short_description IS NULL OR char_length(short_description) <= 160)
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
  image_url   TEXT        CONSTRAINT products_image_url_https_chk
                          CHECK (image_url IS NULL OR image_url LIKE 'https://%'),
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
  amount_cents BIGINT      NOT NULL,      -- positive = credit, negative = debit
  reason       TEXT        NOT NULL CHECK (reason IN ('sale', 'refund', 'commission', 'payout')),
  reference    TEXT,                      -- order id or M-Pesa receipt code
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
-- TABLE 21: ussd_configs (migration 023, Week 29 Day 1)
-- Which shop owns which USSD service code, and its welcome text.
-- One shared phone line (POST /ussd) serves every shop; the code the
-- caller dialled (*384*101#) tells us which shop it is.
-- NO RLS on purpose: the lookup happens BEFORE any shop is known, so an
-- RLS rule on app.current_tenant would hide every row. Service codes are
-- public by nature. Never put secrets in this table.
-- =============================================================
CREATE TABLE IF NOT EXISTS ussd_configs (
  tenant_id    UUID PRIMARY KEY REFERENCES tenants(id),
  service_code TEXT UNIQUE NOT NULL,
  welcome_text TEXT NOT NULL CHECK (char_length(welcome_text) <= 100)
);


-- =============================================================
-- TABLE 22: whatsapp_configs (migration 024, Week 29 Day 2)
-- Which shop owns which WhatsApp number, plus that shop's Meta token.
-- One shared webhook (POST /webhooks/whatsapp) serves every shop; the
-- phone_number_id Meta sends tells us which shop it is.
-- NO RLS on purpose: the webhook looks the shop up BEFORE any shop is
-- known. The token is stored ENCRYPTED (AES-GCM), never plain, and must
-- never be logged.
-- =============================================================
CREATE TABLE IF NOT EXISTS whatsapp_configs (
  tenant_id              UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id        TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  webhook_verify_token   TEXT NOT NULL UNIQUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================
-- TABLE 23: whatsapp_dedupe (migration 024, Week 29 Day 2)
-- Meta retries webhooks, so the same message_id must run only ONCE per
-- shop. The primary key (tenant_id, message_id) enforces it.
-- This one IS a shop table, so it HAS RLS (tenant_isolation).
-- =============================================================
CREATE TABLE IF NOT EXISTS whatsapp_dedupe (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id  TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, message_id)
);
ALTER TABLE whatsapp_dedupe ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_dedupe FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON whatsapp_dedupe
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);


-- =============================================================
-- TABLE 24: daraja_configs (migration 025, Week 29 Day 3)
-- Which shop owns which M-Pesa (Daraja) credentials. Every shop is paid
-- into its OWN till, so every shop has its own keys, shortcode and
-- callback address.
-- The consumer key, consumer secret and passkey are stored ENCRYPTED
-- (AES-GCM), never plain, and must never be logged.
-- This one HAS RLS (unlike whatsapp_configs): both the pay route and the
-- callback route know the shop BEFORE they read the config.
-- =============================================================
CREATE TABLE IF NOT EXISTS daraja_configs (
  tenant_id                 UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  env                       TEXT NOT NULL CHECK (env IN ('sandbox','production')),
  consumer_key_encrypted    TEXT NOT NULL,
  consumer_secret_encrypted TEXT NOT NULL,
  shortcode                 TEXT NOT NULL,
  passkey_encrypted         TEXT NOT NULL,
  callback_url              TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE daraja_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daraja_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON daraja_configs
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);


-- =============================================================
-- TABLE 25: payment_attempts (migration 025, Week 29 Day 3)
-- One row per STK push we start: pending, then paid or failed.
-- It is the proof that WE asked for the payment, so a callback is only
-- believed if its checkout_request_id matches a row here.
-- The database refuses duplicates itself: the same M-Pesa receipt can be
-- saved once per shop, and an order can have only ONE paid attempt.
-- Money rule: amount_cents is WHOLE cents, copied from the order.
-- Never log the phone number.
-- =============================================================
CREATE TABLE IF NOT EXISTS payment_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id            UUID NOT NULL REFERENCES orders(id)  ON DELETE RESTRICT,
  amount_cents        BIGINT NOT NULL CHECK (amount_cents > 0),
  phone               TEXT NOT NULL,
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','failed')),
  mpesa_reference     TEXT,
  result_code         INTEGER,
  result_desc         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_receipt_uniq
  ON payment_attempts (tenant_id, mpesa_reference)
  WHERE mpesa_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_paid_per_order
  ON payment_attempts (order_id)
  WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS payment_attempts_tenant_idx
  ON payment_attempts (tenant_id, created_at DESC);
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_attempts
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);


-- =============================================================
-- TABLE 26: ussd_events (migration 026, Week 29 Day 4)
-- One row per USSD request, so the unified inbox can list USSD
-- next to WhatsApp. body is what the caller typed ('' = just dialled).
-- Never log or print the phone number.
-- =============================================================
CREATE TABLE IF NOT EXISTS ussd_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  session_id  TEXT,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ussd_events_tenant_idx
  ON ussd_events (tenant_id, created_at DESC, id DESC);
ALTER TABLE ussd_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ussd_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ussd_events
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);


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
-- TABLE 28: platform_admins (migration 028, Week 30 platform admin)
-- The people allowed into Rahisisha "head office": they can see every shop and
-- suspend one that breaks the rules. A completely separate identity from shop
-- owners (users). Locked with RLS: rows are visible ONLY while the server has
-- set app.platform_admin = 'on', which only the admin code does.
-- This block is at the end because tenants and audit_logs point at it.
-- =============================================================
CREATE TABLE IF NOT EXISTS platform_admins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT        NOT NULL,
  name           TEXT        NOT NULL,
  password_hash  TEXT        NOT NULL,    -- bcrypt, never plain text
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'disabled')),
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_phone_unique ON platform_admins (phone);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admin_only ON platform_admins;
CREATE POLICY platform_admin_only ON platform_admins
  USING      (current_setting('app.platform_admin', TRUE) = 'on')
  WITH CHECK (current_setting('app.platform_admin', TRUE) = 'on');

-- The suspension notice on each shop: when, why (max 500 characters) and by whom.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_by     UUID
  REFERENCES platform_admins(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_suspended_reason_len_chk'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_suspended_reason_len_chk
      CHECK (suspended_reason IS NULL OR char_length(suspended_reason) <= 500);
  END IF;
END $$;

-- Who did it, in the audit diary (admins are not shop-owner users).
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_admin_id UUID
  REFERENCES platform_admins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audit_logs_actor_admin_idx
  ON audit_logs (actor_admin_id, created_at DESC);


-- =============================================================
-- Migration 029 (Week 30 Day 3): the platform admin may READ memberships
-- =============================================================
-- Why: the admin shop list shows who owns each shop. memberships has forced
-- row level security (tenant_isolation, login_lookup), so an admin session
-- saw zero rows. This adds one SELECT-only policy that is true only while
-- app.platform_admin = 'on', which withAdminLock switches on inside a
-- transaction. Normal shop requests are unchanged. No write access.
DROP POLICY IF EXISTS admin_read_memberships ON memberships;
CREATE POLICY admin_read_memberships ON memberships
  FOR SELECT
  USING (current_setting('app.platform_admin', TRUE) = 'on');


-- =============================================================
-- Migration 030 (Week 30 Day 3, Batch 1): shops can be VERIFIED
-- =============================================================
-- Why: the platform admin marks a shop as verified after checking it is a
-- real business. The marketplace badge needs to know WHEN and BY WHOM.
-- verified_at is empty until verified. verified_by points at platform_admins
-- and becomes empty (not the shop deleted) if that admin row is ever removed.
-- The index keeps the admin shop list fast: filter by status, newest first.
-- Additive only. Only the admin service writes these columns.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS verified_by UUID
  REFERENCES platform_admins(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tenants_status_created_idx
  ON tenants (status, created_at DESC);


-- =============================================================
-- Migration 031 (Week 30 Day 3, Batch 3b-1): the notifications OUTBOX
-- =============================================================
-- Why: when head office suspends, reinstates or verifies a shop, the owner is
-- told. Sending is slow and can fail, so the admin action only WRITES A ROW
-- here (in the same transaction as the change and its receipt). A worker sends
-- it later. Shops may only READ their own rows (tenant_read); only head office
-- (app.platform_admin = 'on') may write (admin_all).
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL DEFAULT 'test'
                  CHECK (channel IN ('test', 'whatsapp', 'sms')),
  template        TEXT NOT NULL CHECK (char_length(template) BETWEEN 1 AND 80),
  recipient_phone TEXT CHECK (recipient_phone IS NULL OR char_length(recipient_phone) <= 20),
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'sent', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error      TEXT CHECK (last_error IS NULL OR char_length(last_error) <= 500),
  send_after      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  audit_log_id    UUID REFERENCES audit_logs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_due_idx
  ON notifications (send_after, id) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS notifications_tenant_idx
  ON notifications (tenant_id, created_at DESC, id DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_read ON notifications;
CREATE POLICY tenant_read ON notifications
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);
DROP POLICY IF EXISTS admin_all ON notifications;
CREATE POLICY admin_all ON notifications
  USING      (current_setting('app.platform_admin', TRUE) = 'on')
  WITH CHECK (current_setting('app.platform_admin', TRUE) = 'on');
ALTER TABLE notifications OWNER TO rahisisha_user;


-- =============================================================
-- Migration 032 (Week 30 Day 3, Batch 4a-1): CATEGORIES
-- =============================================================
-- Why: a marketplace needs aisles. A short list of categories controlled by head
-- office, and an optional category on each product. No tenant_id: shared reference
-- data. Everyone may read it (categories_read); only head office (admin lock) may
-- write it (admin_all). One category per product. ON DELETE SET NULL.
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE
              CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  sort_order  INTEGER NOT NULL DEFAULT 100,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The starter list is written with the admin lock on for this transaction only.
SELECT set_config('app.platform_admin', 'on', true);
INSERT INTO categories (slug, name, sort_order) VALUES
  ('womens-fashion',   'Women''s fashion',       10),
  ('mens-fashion',     'Men''s fashion',         20),
  ('kids-baby',        'Kids and baby',          30),
  ('shoes',            'Shoes',                  40),
  ('bags-accessories', 'Bags and accessories',   50),
  ('beauty-hair',      'Beauty and hair',        60),
  ('food-groceries',   'Food and groceries',     70),
  ('electronics',      'Phones and electronics', 80),
  ('home-kitchen',     'Home and kitchen',       90),
  ('other',            'Other',                 999)
ON CONFLICT (slug) DO NOTHING;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categories_read ON categories;
CREATE POLICY categories_read ON categories
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS admin_all ON categories;
CREATE POLICY admin_all ON categories
  USING      (current_setting('app.platform_admin', TRUE) = 'on')
  WITH CHECK (current_setting('app.platform_admin', TRUE) = 'on');
ALTER TABLE categories OWNER TO rahisisha_user;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_category_idx
  ON products (category_id)
  WHERE status = 'active' AND deleted_at IS NULL;


-- =============================================================
-- 26 tables total (ussd_events added in migration 026, Week 29 Day 4)
-- 20 tables with RLS enabled (all tenant-owned tables)
--  platform_admins (table 28, migration 028) has RLS of its own kind: visible
--    only while app.platform_admin = 'on' (counted separately from the below)
--  6 tables without RLS (tenants, users, webhook_events, audit_logs,
--    ussd_configs and whatsapp_configs: both are looked up before any
--    shop is known)
--
-- Every tenant-owned table has:
--   - tenant_id UUID NOT NULL REFERENCES tenants(id)
--   - ENABLE ROW LEVEL SECURITY
--   - FORCE ROW LEVEL SECURITY
--   - A tenant_isolation policy using current_setting('app.current_tenant')
--   - A (tenant_id, ...) composite index for fast filtered queries
-- =============================================================