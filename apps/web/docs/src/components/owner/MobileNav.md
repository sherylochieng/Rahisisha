# MobileNav.js: The Phone Menu

**File:** `apps/web/src/components/owner/MobileNav.js`
**Doc:** `apps/web/docs/src/components/owner/MobileNav.md`
**Added:** Week 29 Day 4
**Also changed:** `Sidebar.js` (Inbox and Payments added, `NAV_ITEMS` exported) and `(authed)/layout.js` (renders MobileNav, smaller padding on phones)

---

## WHY THIS FILE EXISTS

The Sidebar is hidden below the `md` breakpoint, so on a phone nobody could move between pages.

## WHY IMPORTANT

Most owners use phones. Without it, Inbox and Payments are unreachable there and "mobile layout works" would be false.

## DANGER

- `md:hidden` here and `hidden md:block` on the Sidebar: both visible = a double menu, neither = no menu.
- It reuses `NAV_ITEMS`; never copy the list.
- It only displays; the login check is the layout's.

## WHAT IT SOLVES

A sideways-scrolling bar of links under the header on phones, with unbuilt pages greyed out.

## SYSTEM DESIGN PRINCIPLE

One data list, two presentations.

## RULES

1. Touch targets at least 40px tall.
2. No link to unbuilt pages.
3. `aria-label="Main menu"`.

## PRACTICAL EXAMPLE

On a 390px screen: [Dashboard] [Inbox] [Payments] [Products soon] ... swipe sideways.

## TRADEOFFS

+ No open/close state. - Less polished than a slide-out drawer.

## PIECE BY PIECE (simple words, real-life examples)

### `'use client'`

Needed for `usePathname`, which asks the browser which page we are on.

### `NAV_ITEMS.map`

One list item per menu entry; `ready: false` items are plain grey text.

### `isActive`

True on the page itself and its sub-pages; highlights the link in orange.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
