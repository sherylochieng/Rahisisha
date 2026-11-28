# 033_brand_profile_marketplace.sql

**FILE:** `sql/migrations/033_brand_profile_marketplace.sql` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

Every shop needs a small public "business card": the town it is in, one line
about it, and whether the owner wants it listed in the marketplace. The table
brand_profiles already holds the shop's other details (logo, WhatsApp number,
delivery areas). This file adds the three missing pieces to it.

## WHY IMPORTANT

The marketplace (Batch 6) will list only shops whose owner said yes, and will
show the town and the one-line description next to each shop. Without these
columns there is nowhere to record that choice.

## DANGER

1. Additive only. Three NEW columns on an existing table. Nothing is removed or
   changed, and every existing row simply gets the safe defaults (no town, no
   description, NOT listed). Safe to run twice (IF NOT EXISTS).
2. list_in_marketplace defaults to FALSE on purpose. No shop is ever shown to
   the public marketplace until its owner switches it on.
3. brand_profiles keeps its existing tenant_isolation policy (forced row level
   security). No new policy is added, so the policy count stays at 27.
4. Run as the owner of the tables (postgres locally, the owner role on Neon)
   after a pg_dump backup.

## WHAT IT SOLVES

"Which town is this shop in?", "what does it sell, in one line?" and "did the
owner agree to be in the marketplace?"

## SYSTEM DESIGN PRINCIPLE

Extend the table that already owns the subject (the shop's public details)
instead of creating a second table for the same shop. The consent flag lives
next to the details it controls, and database CHECKs keep the lengths sane even
if some future code forgets to.

## RULES

1. town: at most 60 characters.
2. short_description: at most 160 characters (about one tweet).
3. list_in_marketplace: true or false, never empty, false by default.

## PRACTICAL EXAMPLE

```
Mama Njeri writes "Kitengela" and "Fresh vegetables and groceries, delivered
the same day." and leaves the marketplace switch off. Her own shop link shows
the town and the line. The marketplace does not list her until she turns it on.
```

## DECISIONS

- Off by default: listing a shop publicly is the owner's choice, never ours.
- No opening hours: an online shop takes orders 24/7. (The older free-text column
  working_hours is left untouched and unused; nothing is removed.)
- Lengths are enforced here AND in the API, so a direct database write cannot
  bypass them.

## WHERE USED

shopProfile.service.js, storefront.controller.js (town and description only)

## TRADEOFFS

+ Simple, fast, no joins. - A shop that has never saved its profile has no
  brand_profiles row yet; the API creates it on the first save.

## HOW TO USE

```
Local (as the table owner):  psql -d rahisisha -f sql/migrations/033_brand_profile_marketplace.sql
Neon: backup first, then the same file with the owner connection.
```
