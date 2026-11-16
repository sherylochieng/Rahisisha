# mpesa.routes.js — The Door Safaricom Knocks On

**File:** `apps/api/src/routes/mpesa.routes.js`
**Doc:** `apps/api/docs/src/routes/mpesa.routes.md`
**Added:** Week 29 Day 3
**Mounted in:** `apps/api/src/app.js` as `/callbacks/mpesa`

---

## WHY THIS FILE EXISTS

Wires `POST /callbacks/mpesa/:tenantId` to the guard, the shop lock and the handler.

## WHY IMPORTANT

The order of the three steps is the whole safety story: guard, lock, handler.

## DANGER

- The route is public on purpose. Never add `requireAuth` and never add private routes to this file.
- Wrap the async handler in `asyncHandler`.
- Mount it above the 404 catch-all in `app.js`.

## WHAT IT SOLVES

Day 3 Task 3 wiring.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns: this file only wires; the checks are in the guard and the logic is in the controller.

## RULES

1. No logic here.
2. Guard first, lock second, handler last.
3. Nothing private on a public route.

## PRACTICAL EXAMPLE

Safaricom posts the result of Amina's customer's payment to `/callbacks/mpesa/<Amina's id>`: guard, lock, handler.

## DECISIONS (and WHY)

A separate router (not `orders.routes.js`) because the orders routes need a login and this one must not have one. POST only; a GET gets the normal 404.

## WHERE USED / FUTURE USES

`app.js`: `app.use('/callbacks/mpesa', mpesaRouter)`.

## TRADEOFFS

+ Obvious and tiny.
- One more file to know about.

## HOW TO USE

The `callback_url` saved in `daraja_configs` must end in `/callbacks/mpesa/<that shop's id>`; the seed script builds it.

## PIECE BY PIECE (simple words, real-life examples)

### Imports

`Router`, the guard, `withTenant`, `asyncHandler` and the handler.

### `router.post('/:tenantId', ...)`

The single route. Real life: one letterbox with a doorman, a lock-up clerk and a cashier in a fixed order.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*
