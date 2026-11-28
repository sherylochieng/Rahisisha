# categories.service.js

**FILE:** `apps/api/src/services/categories.service.js` (Week 30 Day 3, Batch 4a-1)

## WHY THIS FILE EXISTS
All category questions in one place: "which aisles are open?" and "is this id a real, open aisle?". Real life: the person at the information desk with the aisle map.

## WHY IMPORTANT
Two controllers need this (public list, product validation). One file means one definition of "active category" (DRY).

## DANGER
Must only return `active` rows. If it returned switched-off aisles, owners could file products under hidden aisles.

## WHAT IT SOLVES
`listCategories(db)` returns `[{id, slug, name}]` ordered by `sort_order, name`. `findActiveCategory(db, id)` returns the row or `null`; it checks the UUID shape first, so a garbage id never crashes Postgres.

## ADDED IN THE DRY PASS (Week 30 Day 3)
- `isCategorySlug(word)`: the one rule for how a slug is written (lowercase words joined by dashes, up to 60), the same as the CHECK in migration 032. The storefront controller used to carry its own copy.
- `listShopCategories(db)`: the aisles ONE shop uses (active categories holding at least one active, not-deleted product). Run it on `req.db` so RLS keeps it to that shop. The storefront controller used to carry this SQL inline.
- Nothing removed.

## SYSTEM DESIGN PRINCIPLE
Service takes the connection (`db`) as a parameter: the caller decides whether it is a shop connection or the plain pool. Testable, no hidden globals.

## RULES
No `tenant_id` here: categories are shared. Never write to categories from this file (only head office writes).

## WHERE USED
`categories.controller.js` (list), `products.controller.js` (`refusedCategory`).

## TRADEOFFS
+ Tiny and clear. - No caching in the service (the HTTP cache header covers browsers).

## HOW TO USE
`const rows = await listCategories(pool);` / `const cat = await findActiveCategory(req.db, id);`

## ADDED IN BATCH 4a-3 (Week 30 Day 3): THE OWNER'S VIEW

- `listShopCategories(db, { onSaleOnly })`: the default (`true`) is unchanged and still feeds the public shop window (only active products in active aisles). With `onSaleOnly: false` it lists every aisle any live product of the shop is filed under, drafts and archived included, for the owner's own Products page.
- `hasUncategorisedProducts(db)`: true when the shop has at least one live product with no aisle, so the owner page shows a "No category" button only when it would find something.
- `NO_CATEGORY = 'none'`: the reserved word for "products with no aisle". Head office must never create a category with the slug `none`.
- Nothing removed.
