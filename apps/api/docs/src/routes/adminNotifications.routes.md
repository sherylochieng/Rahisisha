# src/routes/adminNotifications.routes.js

**FILE:** `apps/api/src/routes/adminNotifications.routes.js` (Week 30 Day 3, Batch 3b-2b, step 3)

## WHY THIS FILE EXISTS

The addresses for the admin notifications window:
- `GET /v1/admin/notifications` one page of lines
- `GET /v1/admin/notifications/summary` the three counts

## WHY IMPORTANT

The admin guard is applied with `router.use` at the top, so no route below it can forget the lock.

## DANGER

1. Keep `router.use(requirePlatformAdmin)` **above** every route.
2. No `withTenant` here: head office works across shops under the admin lock the service opens.
3. Read-only on purpose. A "retry" button would be a POST with a reason and an audit receipt (a later step).

## WHAT IT SOLVES

"Who may ask, and where."

## SYSTEM DESIGN PRINCIPLE

Secure by default: the guard is the first thing every request meets.

## RULES

1. `Cache-Control: no-store` on every answer.
2. `asyncHandler` on every handler so errors reach the global handler.

## PRACTICAL EXAMPLE

In `app.js`: `app.use('/v1/admin/notifications', adminNotificationsRouter);`

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE

Same shape as `adminShops.routes.js` and `adminStats.routes.js`. Mounted once in `app.js`. + Impossible to forget the guard. - One more file per resource.

---

## LINE BY LINE

**The first `router.use`** Sets `no-store`, so a browser or proxy never keeps these answers.

**`router.use(requirePlatformAdmin)`** The lock. No admin cookie, no entry (401).

**`router.get('/summary', ...)`** The three counts. It is listed before `/` so the word `summary` is never confused with anything else.

**`router.get('/', ...)`** One page of lines.
