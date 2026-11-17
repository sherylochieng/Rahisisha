# payments/loading.js: The Payments Placeholder

**File:** `apps/web/src/app/(authed)/payments/loading.js`
**Doc:** `apps/web/docs/src/app/payments.loading.md`
**Added:** Week 29 Day 4

---

## WHY THIS FILE EXISTS

Shown while `payments/page.js` waits for the API.

## WHY IMPORTANT

People refresh money pages nervously; a visible loading shape says it is working.

## DANGER

Keep the shape close to the real page; keep `role="status"` and the screen-reader text.

## WHAT IT SOLVES

The loading state for /payments.

## SYSTEM DESIGN PRINCIPLE

Skeleton screens.

## RULES

Pure markup, no state.

## PRACTICAL EXAMPLE

A title, a grey balance box, a day card with four grey rows.

## TRADEOFFS

+ Zero logic. - Approximate heights.

## PIECE BY PIECE (simple words, real-life examples)

### Title and balance boxes

Grey rectangles where the title and balance will be.

### Day card

A header line plus four rows, like one real day.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
