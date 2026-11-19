# resolveShopBySlug.js: The Door Guard For The Public Shop Page

**File:** `apps/api/src/middleware/resolveShopBySlug.js`
**Doc:** `apps/api/docs/src/middleware/resolveShopBySlug.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

The public shop page has no login. A customer just opens `brio-hardware.rahisishabiashara.com`. The API still has to know WHICH shop is meant. This guard reads the shop word (the slug) from the URL, finds that shop, and stamps its id on the request (`req.tenantId`). The next guard, `withTenant`, then locks the database to that one shop.

## WHY IMPORTANT

Everything after this guard trusts `req.tenantId`. If it picked the wrong shop, the public page would show the wrong shop's goods.

## DANGER

- Without it the public page would have to skip the database lock (`pool.query` on `products`). One missing `WHERE` and every shop's products leak to every visitor.
- Setting `req.tenantId` from anything the visitor controls (the query string or the body) would let them pick any shop.

## WHAT IT SOLVES

"Public page, many shops". The shop is found from the address word, and the database lock (RLS) still protects everything after it.

## SYSTEM DESIGN PRINCIPLE

"Stamp, then lock." The same pattern as login (`requireAuth`, then `withTenant`) and USSD (`resolveUssdTenant`, then `withTenant`). Identity is worked out once, early, in one place, and the database lock is the second wall. Also: "Public endpoints expose the minimum". The guard only puts the shop's name and slug on the request.

## RULES

1. Only ACTIVE shops are found. A suspended shop looks like it does not exist.
2. A badly shaped word and a missing shop give the SAME 404 with the same message.
3. Validate the word BEFORE touching the database.
4. `pool.query` is allowed here ONLY because the `tenants` table has no `tenant_id` and no RLS: it IS the list of shops. Never copy this to a tenant table.
5. `req.tenantId` comes only from the `tenants` table.

## THE CODE, PIECE BY PIECE

### SLUG_PATTERN: "is this even shaped like a shop word?"

`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`: lowercase letters and numbers, hyphens inside, up to 63 characters, no hyphen at either end. Real life: a bouncer glances at a ticket. Torn, wrong colour or written in crayon? Turned away without anyone checking the guest list.

### notFound(res): one polite "no"

Always `404 { data: null, error: { message: 'Shop not found' } }`. Real life: the receptionist says "no such shop" in the same words whether the word was nonsense or the shop was closed.

### The SELECT: look in the shop list

`SELECT id, name, slug FROM tenants WHERE slug = $1 AND status = 'active'`. We ask only for what we need. `$1` is a safe slot, so a sneaky word can never change the query.

### req.tenantId and req.shop: the name tag

`req.tenantId` is for `withTenant` (the lock). `req.shop` is for the controller (so it can show the shop's name without a second lookup).

### next() and next(err): pass it on

Success goes to `withTenant`. A crash goes to the central error handler (Express 4 does not catch errors from async functions by itself).

## PRACTICAL EXAMPLES

| Request | Result |
|---|---|
| `GET /v1/storefront/brio-hardware` | `req.tenantId` = Brio's id, on to `withTenant` |
| `GET /v1/storefront/nobody` | 404 Shop not found |
| `GET /v1/storefront/BAD_WORD!` | 404 Shop not found (database never asked) |
| `GET /v1/storefront/old-shop` (suspended) | 404 Shop not found |

## DECISIONS (and WHY)

- The slug rule is the same one `tenants.controller.js` uses, so both agree on what a shop word is.
- Errors go to `next(err)`, never thrown, because Express 4 would otherwise hang the request.
- The 404 body matches `/v1/tenants/by-slug`, so the website handles one shape.

## WHERE USED

`app.js`: `app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant, storefrontRouter)`. Later: any other public page that belongs to one shop (an order tracking page, a contact form).

## TRADEOFFS

+ One small guard. The lock after it does the heavy protecting.
- One extra database query per visit. Later, cache `slug -> id` in memory.
- Anyone can test whether a shop word exists. The address already shows that, so nothing new leaks.

## HOW TO USE

`app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant, router)`. The order matters: `withTenant` reads the id this guard stamps.

## COMMON MISTAKES

- Putting `withTenant` BEFORE this guard: it would lock to `undefined` and fail.
- Reading the shop from the body or query string.
- Skipping the `status = 'active'` check (test 7 in `storefront.cross-tenant.test.js` catches this).

## AI AUDIT NOTE

Written by AI at Sheryl's request. Declared in `AI_AUDIT_week_29_day4.md` (follow-up section).

## TEST LOG

Proved by `tests/isolation/storefront.cross-tenant.test.js`: tests 7 (same 404 for unknown, badly shaped and suspended shops) and 6 (a login cookie does not change which shop is shown). On 18 November 2026 the test failed on purpose when this guard stopped checking `status = 'active'`, then passed again when it was put back.
