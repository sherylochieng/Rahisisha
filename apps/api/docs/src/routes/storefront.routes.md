# storefront.routes.js: The Signpost For The Public Shop Door

**File:** `apps/api/src/routes/storefront.routes.js`
**Doc:** `apps/api/docs/src/routes/storefront.routes.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

A route connects a URL to the function that answers it. It does no work itself. This one connects `GET /v1/storefront/:slug` to `getStorefront`.

## WHY IMPORTANT

Without it the public shop page gets a 404 even though the worker function exists.

## DANGER

- The shop link on the dashboard opens a page with no data.
- Someone adds a `POST` here "for orders", and a public door that WRITES exists with no spam protection.

## WHAT IT SOLVES

Wires the public shop door to its controller.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns: routes wire, guards identify, controllers decide. Same as products, orders and tenants.

## RULES

1. No logic here. An `if` belongs in the guard or the controller.
2. Wrap every async handler in `asyncHandler`.
3. Mounted PUBLIC (no `requireAuth`), but AFTER `resolveShopBySlug` and `withTenant`. Public means read-only. Never add a route here that writes data or returns private data.

## THE CODE, PIECE BY PIECE

### Router({ mergeParams: true })

Real life: the sign on the door can still read the shop's name from the street address above it. The `:slug` lives in the mount path in `app.js`, and `mergeParams` lets this router see it.

### router.get('/', asyncHandler(getStorefront))

"A visit to the address itself goes to `getStorefront`." `asyncHandler` makes sure a crash goes to the central error handler instead of leaving the visitor waiting.

## PRACTICAL EXAMPLE

`app.js` mounts it at `/v1/storefront/:slug`, so `router.get('/')` answers `GET /v1/storefront/brio-hardware`.

## DECISIONS (and WHY)

- Only one route. A single product page (`/:slug/products/:id`) comes later if needed.
- Checkout and payment will get their OWN files and their own tests, because they write.

## WHERE USED

`app.js`: `app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant, storefrontRouter)`.

## TRADEOFFS

+ One tiny file per area keeps each area easy to find.

## HOW TO USE

Add read-only routes here only. Anything that changes data gets a new router and a new test.

## COMMON MISTAKES

- Adding `requireAuth` here: customers have no login, so the page would break.
- Removing `mergeParams`: harmless today, but breaks any future route that needs `req.params.slug`.

## AI AUDIT NOTE

Written by AI at Sheryl's request. Declared in `AI_AUDIT_week_29_day4.md` (follow-up section).

## TEST LOG

Proved by `tests/isolation/storefront.cross-tenant.test.js` test 11: POST, PATCH, PUT and DELETE on the address all find nothing (404).
