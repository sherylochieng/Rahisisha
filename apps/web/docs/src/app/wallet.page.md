# wallet/page.js: The Wallet Redirect

**File:** `apps/web/src/app/(authed)/wallet/page.js`
**Doc:** `apps/web/docs/src/app/wallet.page.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

The sidebar has a Wallet link. The money view already exists as the Payments page, so `/wallet` sends the visitor to `/payments`.

## WHY IMPORTANT

Without it the Wallet link would be a dead end.

## DANGER

- It shows and fetches nothing; it only redirects.
- It sits inside `(authed)`, so the login check runs first.

## WHAT IT SOLVES

One money page with two working names.

## SYSTEM DESIGN PRINCIPLE

Do not build the same thing twice: one page is the single source of truth.

## RULES

- Uses `redirect('/payments')` from `next/navigation`.

## PRACTICAL EXAMPLE

Amina clicks Wallet and the address bar changes to `/payments`.

## TRADEOFFS

+ Nothing to keep in sync. - The menu has two items (Payments and Wallet) that open the same page. A later clean-up can merge them.

## PIECE BY PIECE (simple words, real-life examples)

### redirect

A sign saying "Wallet: go to the Payments counter".

### Where it is used

Sidebar and MobileNav link to `/wallet`.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
