# orders/loading.js: The Orders Placeholder

**File:** `apps/web/src/app/(authed)/orders/loading.js`
**Doc:** `apps/web/docs/src/app/orders.loading.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

Shown while `orders/page.js` waits for the API.

## WHY IMPORTANT

A blank screen looks broken; a skeleton says "your orders are on the way".

## DANGER

- Keep `role="status"` and the screen-reader text.
- Keep the shape close to the real page.

## WHAT IT SOLVES

The loading state for `/orders`.

## SYSTEM DESIGN PRINCIPLE

Skeleton screens: same shape, no data.

## RULES

- Pure markup: no state, no fetching.

## PRACTICAL EXAMPLE

A grey title and six grey rows, each with a name line, a details line and a stage tag.

## TRADEOFFS

+ Zero logic. - Approximate heights.

## PIECE BY PIECE (simple words, real-life examples)

### Title placeholder

A grey bar where the title will be.

### Six rows

Six placeholder rows, like six empty clipboard slots waiting for order slips.

### role and sr-only

Screen readers hear "Loading your orders...".

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
