# sql/migrations/030_tenants_verified.sql

**FILE:** `sql/migrations/030_tenants_verified.sql` (Week 30 Day 3, Batch 1, step 1)

## WHY THIS FILE EXISTS

The platform admin must be able to mark a shop as verified after checking it is a real business, like a blue tick on a trusted seller. Migration 028 added the "suspended" columns to `tenants`. Nothing remembered "verified". This file adds two columns for that and one index for a fast admin list.

## WHY IMPORTANT

The marketplace will show a "Verified" badge later. The badge is only honest if the database remembers **when** and **by which admin**. Without "by whom" you can never trace a wrong verification.

## DANGER (what breaks without it)

1. It is additive. Nothing is renamed or dropped, so existing shops are safe.
2. `verified_by` uses `ON DELETE SET NULL`: if an admin row is ever deleted, the shop keeps its date and is not un-verified by accident.
3. Shop owners must never write these columns. Only the admin service sets them, inside the admin lock, with an audit row.
4. Run it as the owner of `tenants`. On Neon, take a backup first and use a connection that owns the tables.

## WHAT IT SOLVES

"Is this shop verified, when, and by whom?" and an admin list that stays fast with thousands of shops.

## SYSTEM DESIGN PRINCIPLE

Audit by design: a privileged flag carries "when" and "who" beside it. Additive migrations with `IF NOT EXISTS` can run twice and let old code keep working during a rollout.

## RULES

1. Safe to run twice.
2. Both columns are nullable. `NULL` means not verified.
3. `sql/SCHEMA.sql` gets the same lines in the next step.

## PRACTICAL EXAMPLE

Amina's Boutique in Nairobi sends a photo of her business permit. The admin checks it and presses Verify. The row then holds `verified_at = 2026-11-27 18:40` and `verified_by = <admin id>`. A shop nobody checked keeps both empty.

## DECISIONS

- A date (`TIMESTAMPTZ`), not a yes/no flag, because the date is needed for the audit story.
- No CHECK tying the two columns together, because `ON DELETE SET NULL` can legitimately empty only `verified_by`.
- Index on `(status, created_at DESC)` because the admin list is almost always "active, newest first" or "suspended".

## WHERE USED

The admin shops service (next files of this batch) and, in Batch 4, the marketplace read function that shows the badge.

## TRADEOFFS

+ Cheap and reversible: drop the two columns and the index.
- One more index slightly slows writes to `tenants`. Shops are created rarely and listed often, so it is a good trade.

## HOW TO USE

```
psql -U postgres -d rahisisha -f sql/migrations/030_tenants_verified.sql
```

Local first. On Neon only after a `pg_dump` backup. Not yet on Neon.

---

## LINE BY LINE

**`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;`**
Adds a "verified on" date field to every shop's file, unless it is already there. `NULL` means never verified. Real life: the date stamp the county licensing office writes on a trader's permit.

**`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES platform_admins(id) ON DELETE SET NULL;`**
Adds "which officer stamped it". `REFERENCES platform_admins(id)` makes the database check that the officer really exists. `ON DELETE SET NULL` means: if that officer's record is removed, leave the name blank but keep the shop and the date.

**`CREATE INDEX IF NOT EXISTS tenants_status_created_idx ON tenants (status, created_at DESC);`**
A sorted contents page at the front of a book. The admin can jump to "suspended shops, newest first" without reading every page. `IF NOT EXISTS` lets you run the file twice.