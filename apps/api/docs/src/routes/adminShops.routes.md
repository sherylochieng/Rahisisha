# src/routes/adminShops.routes.js

**FILE:** `apps/api/src/routes/adminShops.routes.js` (Week 30 Day 3, Batch 1, step 4)

## WHY THIS FILE EXISTS

The address book for the admin's shop powers. It says which web address goes to which handler and, most important, puts the admin guard in front of **all** of them.

## WHY IMPORTANT

If one route forgot the guard, anyone on the internet could suspend a shop. So the guard is applied **once, to the whole router**, before any route is declared. A route added later is protected automatically.

## DANGER (what breaks without it)

1. `router.use(requirePlatformAdmin)` must stay **above** every route line.
2. No `withTenant` here. The admin works across shops with the admin lock that the service opens, never with one shop's lock.
3. Replies are marked `no-store`, so a browser or proxy never keeps a copy of shop details (owner phone numbers) after the admin signs out.

## WHAT IT SOLVES

"Which address does what, and who may call it."

## SYSTEM DESIGN PRINCIPLE

Secure by default: the guard belongs to the router, not to each route. Separation of concerns: routes only connect addresses to handlers.

## RULES

1. All routes need a valid `admin_token` cookie, or reply `401`.
2. GET reads, POST changes.
3. Every handler is wrapped in `asyncHandler`, so a crash reaches the global error handler instead of hanging the request.

## PRACTICAL EXAMPLE

The admin dashboard (a later batch) calls `GET /v1/admin/shops?status=active&q=wanjiku` and `POST /v1/admin/shops/<id>/suspend` with `{ "reason": "..." }`.

## DECISIONS

- Mounted at `/v1/admin/shops` in `app.js`, next to `/v1/admin/auth`.
- Four small POST routes, not one route with an "action" word in the body, so each power is visible in the address, in logs and in tests.

## WHERE USED

`apps/api/src/app.js`

## TRADEOFFS

+ Easy to read: six lines, six addresses.
- Four routes look alike. The shared handler pattern in the controller keeps them from drifting apart.

## HOW TO USE

`app.use('/v1/admin/shops', adminShopsRouter);` (already added in `app.js`).

---

## LINE BY LINE

**`const router = Router();`**
A fresh address book for this area.

**`router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });`**
Stamps every reply "do not keep a copy" and then lets the request carry on (`next()`).

**`router.use(requirePlatformAdmin);`**
The guard at the door of the whole area. It reads the `admin_token` cookie, checks the admin's signature, loads the active admin and sets `req.admin`. If anything is wrong it replies `401` and the request never reaches a route.

**`router.get('/', ...)` and `router.get('/:id', ...)`**
The register, and one shop's file. `:id` is the shop id from the address.

**`router.post('/:id/suspend' | '/reinstate' | '/verify' | '/unverify', ...)`**
The four powers. Each is wrapped in `asyncHandler`, which sends any error to the global handler.

**`export default router;`**
Hands the finished address book to `app.js`.
