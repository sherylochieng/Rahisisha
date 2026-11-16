# orders.routes.js — The Orders Doors (and the New Pay Door)

**File:** `apps/api/src/routes/orders.routes.js`
**Doc:** `apps/api/docs/src/routes/orders.routes.md`
**Added:** Week 29 Day 3
**Mounted in:** `apps/api/src/app.js` under `/v1/orders`  
**Tests:** `apps/api/tests/payments.pay.test.js`

---

## WHY THIS FILE EXISTS

Lists the URLs for orders and says which handler answers each. In Week 29 Day 3 it got one new line: `POST /:id/pay`.

## WHY IMPORTANT

These routes sit behind the login and the shop lock, so every order query is automatically for the logged-in shop only.

## DANGER

Do not move the pay route to a public router. It must stay behind `requireAuth` and `withTenant`.

## WHAT IT SOLVES

Show where each order URL goes, with the reasons written next to it.

## SYSTEM DESIGN PRINCIPLE

Thin routes, logic in controllers.

## RULES

1. Routes only wire.
2. Wrap async handlers in `asyncHandler`.
3. Keep the reasons as comments in the file.

## PRACTICAL EXAMPLE

POST `/v1/orders/<id>/pay` goes to `payOrder` in `payments.controller.js`.

## DECISIONS (and WHY)

The pay action lives under orders (`/orders/:id/pay`) because it is an action on one order. The callback is separate because it is public.

## WHERE USED / FUTURE USES

`app.js` mounts it under `/v1/orders`.

## TRADEOFFS

+ Familiar URL shape.
- Payment code is in its own controller, so one more file to open.

## HOW TO USE

Call the routes with the shop's login cookie.

## PIECE BY PIECE (simple words, real-life examples)

### Existing routes

`GET /`, `POST /`, `GET /:id` and `PATCH /:id` are unchanged. All original comments were kept.

### `router.post('/:id/pay', asyncHandler(payOrder))`

The new line. Real life: a new button on the order slip that says Pay.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*
