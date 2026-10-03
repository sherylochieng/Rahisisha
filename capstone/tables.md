# Rahisisha — Table List

Every table in the database with a one-line purpose.
20 tables total. 16 are tenant-owned (RLS on). 4 are system-level (no RLS).

---

## Tenant-owned tables (RLS enabled)

| # | Table | Purpose |
| --- | --- | --- |
| 1 | `memberships` | Links users to tenants with a role (owner or staff) |
| 2 | `brand_profiles` | Logo, colours, tone, delivery rules and hours per tenant |
| 3 | `products` | Every product a business sells, with price and status |
| 4 | `product_variants` | Sizes and colours of each product — stock tracked here per variant |
| 5 | `product_media` | Original and enhanced product photos — nothing public until approved |
| 6 | `customers` | People who buy from a tenant's shop, identified by phone per tenant |
| 7 | `conversations` | Chat threads between a customer and a business per channel |
| 8 | `messages` | Individual messages inside a conversation — every AI reply logged here |
| 9 | `stock_reservations` | Holds stock when a customer taps Buy — released if payment does not confirm |
| 10 | `inventory_movements` | Append-only audit trail of every stock change ever made |
| 11 | `orders` | Confirmed purchases moving through a status state machine |
| 12 | `order_items` | Line items with price and name snapshotted at time of purchase |
| 13 | `wallet_entries` | Append-only payment ledger — balance is always SUM(amount_cents) |
| 14 | `content_posts` | AI-generated social posts waiting for owner approval before publishing |
| 15 | `subscriptions` | Which plan a tenant is on and when their period ends |
| 16 | `usage_counters` | AI message count per tenant per month for enforcing plan caps |

## System-level tables (no RLS — platform-wide access)

| # | Table | Purpose |
| --- | --- | --- |
| 17 | `tenants` | One row per business — the source of tenant identity |
| 18 | `users` | Global user accounts — one person can own multiple businesses |
| 19 | `webhook_events` | Idempotency table — every M-Pesa and WhatsApp callback stored once |
| 20 | `audit_logs` | Every privileged or financial action ever taken, with before/after state |

---

## Why these 20 and not more

Every table here maps directly to a P0 feature from the PRD (Section 3).
Tables for P1 features (ratings, service quotes) are not in the schema yet —
they get added as separate migrations when those features are built.
This keeps the Day 3 schema lean and the migrations clean.