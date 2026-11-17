# inbox/loading.js: The Inbox Placeholder

**File:** `apps/web/src/app/(authed)/inbox/loading.js`
**Doc:** `apps/web/docs/src/app/inbox.loading.md`
**Added:** Week 29 Day 4

---

## WHY THIS FILE EXISTS

Shown by Next.js while `inbox/page.js` waits for the API.

## WHY IMPORTANT

A blank screen on a slow connection looks broken.

## DANGER

Keep the shape close to the real page; keep `role="status"` and the screen-reader text.

## WHAT IT SOLVES

The loading state for /inbox.

## SYSTEM DESIGN PRINCIPLE

Skeleton screens.

## RULES

Pure markup, no state.

## PRACTICAL EXAMPLE

A title bar and six pulsing grey rows.

## TRADEOFFS

+ Zero logic. - An approximate height.

## PIECE BY PIECE (simple words, real-life examples)

### `animate-pulse`

Makes the grey boxes fade gently.

### `sr-only` text

Read aloud by screen readers, invisible to the eye.

### `Array.from({ length: 6 })`

Six identical placeholder rows.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
