# storefront.controller.js: What Goes In The Shop Window

**File:** `apps/api/src/controllers/storefront.controller.js`
**Doc:** `apps/api/docs/src/controllers/storefront.controller.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

It answers `GET /v1/storefront/:slug`: the data behind the PUBLIC shop page. The shop's name and the products it is selling right now.

## WHY IMPORTANT

This is the first endpoint where a stranger, not a logged-in owner, reads tenant data. What it returns is exactly what the whole internet can see.

## DANGER

- Returning draft or archived products shows items the owner is not ready to sell.
- Returning the SKU, status, created time or any internal field tells strangers how the shop runs its stock.
- Using `pool.query` instead of `req.db` skips the database lock, and one missing `WHERE` shows every shop's goods to everyone.

## WHAT IT SOLVES

Gives the public page what it needs and nothing more: `{ data: { shop: { name, slug }, products: [...] }, nextCursor, error }`.

## SYSTEM DESIGN PRINCIPLE

"Public endpoints expose the minimum" and "defence in depth". The query filters (status active, not deleted) are the first wall; the database lock (RLS, set by `withTenant`) is the second wall. Newest first with keyset paging, the same rule as Inbox, Payments and Orders (`utils/keysetCursor.js`).

## RULES

1. ALWAYS use `req.db` (locked to one shop). NEVER import `pool` here.
2. ONLY `status = 'active' AND deleted_at IS NULL`.
3. Product fields shown: `id`, `name`, `description`, `price_cents`. Nothing else. Add a field only after asking "is it fine for any stranger to see this?".
4. Never read or return anything about wallet, orders, customers, phone numbers or the owner.
5. Money stays whole cents (an integer). The page formats it.
6. A bad cursor is a clear 400, never a crash.

## THE CODE, PIECE BY PIECE

### limit: how many shelves to show at once

`parseInt`, then clamped between 1 and 48 (default 24). Real life: a window display that holds 24 items. `?limit=100000` cannot make it hold the warehouse. `?limit=abc` falls back to 24.

### decodeCursor: the bookmark

The bookmark from the last page says "carry on after this product". A made-up bookmark gets `400 Invalid cursor` before any database work.

### The SELECT: what goes in the window

`status = 'active'` and `deleted_at IS NULL`: only what the owner is selling now. `ORDER BY created_at DESC, id DESC` is newest first, and the id breaks ties so two products saved in the same moment never swap places between pages. `LIMIT $3` is `limit + 1`: one spare row tells us whether another page exists.

### hasMore and nextCursor: is there another page?

If we got the spare row, make a bookmark from the last product we are actually showing.

### products.map: wrap only what the customer may see

Each product is rebuilt with exactly four fields. Even if someone later adds a column to the SELECT, it does not reach the public by accident.

## PRACTICAL EXAMPLES

```
GET /v1/storefront/brio-hardware
-> { data: { shop: { name: 'Brio Hardware', slug: 'brio-hardware' },
             products: [ { id, name: 'Cement 50kg', description: null, price_cents: 75000 } ] },
     nextCursor: null, error: null }
GET /v1/storefront/brio-hardware?limit=2       -> 2 products + nextCursor
GET /v1/storefront/brio-hardware?cursor=hello  -> 400 Invalid cursor
GET /v1/storefront/nobody                      -> 404 (stopped earlier by resolveShopBySlug)
```

## DECISIONS (and WHY)

- limit 1 to 48, default 24: 24 divides nicely into 2, 3 and 4 columns.
- The shop's name comes from `req.shop` (stamped by the guard), so no second lookup.
- A shop with no active products is a normal 200 with an empty list, not a 404: the shop exists, it just has nothing for sale yet.

## WHERE USED

`routes/storefront.routes.js`. The website calls it through `apps/web/src/lib/publicApi.js`.

## TRADEOFFS

+ Tiny, and protected twice. - No search, categories or caching yet.

## HOW TO USE

`router.get('/', asyncHandler(getStorefront))`, mounted behind `resolveShopBySlug` and `withTenant`.

## COMMON MISTAKES

- Adding `sku` or `status` "because the page might want it".
- Adding a write route to the same router (the door must stay read-only).
- Forgetting `deleted_at IS NULL`: removed products would come back to life on the public page.

## AI AUDIT NOTE

Written by AI at Sheryl's request. Declared in `AI_AUDIT_week_29_day4.md` (follow-up section).

## TEST LOG

Proved by `tests/isolation/storefront.cross-tenant.test.js` (tests 1 to 5, 8 to 10). On 18 November 2026 the test failed on purpose when drafts were shown and when the SKU was leaked, then passed again when the code was put back. In the browser, Brio Hardware showed its two active products and hid the drafts.

## ADDED IN BATCH 4a-1 (Week 30 Day 3): CATEGORY FILTER

- Optional `?category=<slug>`. A badly shaped word is a 400 (`validation`). A well-shaped word nobody uses returns an empty list (an old link shows an empty shelf, not an error).
- The answer's `data` now also has `categories: [{slug, name}]`: only aisles that hold at least one active product of THIS shop, in head-office order. The page uses it to show filter buttons.
- Still public fields only. Proved by `tests/storefront.category.test.js`; the shape test in `storefront.cross-tenant.test.js` now lists `categories`.

- DRY pass: the slug rule (`isCategorySlug`) and the aisle query (`listShopCategories`) now live in `services/categories.service.js`; this controller only calls them. Nothing removed.
