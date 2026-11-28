# sql/migrations/032_categories.sql

**FILE:** `sql/migrations/032_categories.sql` (Week 30 Day 3, Batch 4a-1, step 1)

## WHY THIS FILE EXISTS

Shoppers need to find things by aisle ("Shoes", "Beauty and hair"). This file creates the head-office list of aisles (`categories`) and lets each product point at one of them (`products.category_id`).

Real life: the aisle signs in a supermarket. Head office hangs the signs; each shop only puts its goods under a sign.

## WHY IMPORTANT

The product form, the shop page filter and later the marketplace all read this one list. One list means the same words everywhere, and "Shoes" never turns into "shoes", "Shoe" and "Footwear".

## DANGER (what breaks without it)

1. Safe to run twice (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Seeds are only inserted when the slug is missing, so head-office renames are never overwritten.
2. `categories` has **no `tenant_id`**: it is shared by everyone, so it is read-only for shops. Forced RLS: `categories_read` (SELECT, everyone) and `admin_all` (only `app.platform_admin = 'on'`). A shop can never add or rename an aisle.
3. `products.category_id` uses `ON DELETE SET NULL`: if an aisle is ever deleted, products stay and just lose their aisle.
4. Running it prints one `set_config | on` row. That is the seed step switching on head-office mode for the transaction. It is expected.
5. **The policy count changes**: 25 → 27. `scripts/reset-db.sh` expects 27. Without that, CI says "Expected 25 policies, found 27".
6. Run as the table owner, after a `pg_dump` backup on Neon.

## WHAT IT SOLVES

"Group products into a short fixed list, safely, without a shop being able to change the list."

## SYSTEM DESIGN PRINCIPLE

**Reference data owned by the platform.** A small lookup table read by all, written by head office only. The slug (`womens-fashion`) is the stable code used in URLs; the name is only a label and can change.

## RULES

1. Slugs are lowercase words joined by dashes (CHECK), at most 60 characters.
2. Never delete a category that products use; switch it off (`active = false`) instead.
3. One category per product (decided with you).

## WHAT IS IN IT

- `categories(id, slug unique, name, sort_order, active, created_at)`.
- Ten seeds: Women's fashion 10, Men's fashion 20, Kids and baby 30, Shoes 40, Bags and accessories 50, Beauty and hair 60, Food and groceries 70, Phones and electronics 80, Home and kitchen 90, Other 999 (always last).
- `products.category_id` (nullable) and the partial index `products_category_idx` for active, not-deleted products.

## WHERE USED

Read by `categories.service.js`, `products.controller.js` and `storefront.controller.js`.

## TRADEOFFS

+ Simple and fast. - Head-office editing screen comes later (Batch 8); until then changes are made with SQL.

## HOW TO USE

Local: `psql -U postgres -d rahisisha -f sql/migrations/032_categories.sql`
Neon: backup first, then `psql "$env:NEON_URL" -v ON_ERROR_STOP=1 -f sql/migrations/032_categories.sql`, then check: 10 categories, 27 policies, `products.category_id` exists.

## AI AUDIT NOTE

Written by AI at your request, Week 30 Day 3.
