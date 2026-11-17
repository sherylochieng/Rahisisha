# inbox.routes.js: The Inbox Door

**File:** `apps/api/src/routes/inbox.routes.js`
**Doc:** `apps/api/docs/src/routes/inbox.routes.md`
**Added:** Week 29 Day 4
**Mounted in:** `apps/api/src/app.js` as `/v1/inbox` behind `requireAuth` and `withTenant`

---

## WHY THIS FILE EXISTS

Wires `GET /v1/inbox` to `listInbox`.

## WHY IMPORTANT

The mount line in `app.js` (login check + shop lock) is the safety story.

## DANGER

- Never mount without `requireAuth` and `withTenant`.
- Wrap the async handler in `asyncHandler`.
- Mount above the 404 catch-all.

## WHAT IT SOLVES

Day 4 Task 1 wiring.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns: routes wire, controllers work.

## RULES

No logic here. GET only.

## PRACTICAL EXAMPLE

A logged-in owner asks `GET /v1/inbox`: login check, shop lock, `listInbox`.

## TRADEOFFS

+ Tiny. - One more file.

## PIECE BY PIECE (simple words, real-life examples)

### `router.get('/', asyncHandler(listInbox))`

The single route. Real life: one door, with a guard and a lock-up clerk standing outside it (set in `app.js`).

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
