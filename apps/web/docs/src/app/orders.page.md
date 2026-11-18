# orders/page.js: The Orders List

**File:** `apps/web/src/app/(authed)/orders/page.js`
**Doc:** `apps/web/docs/src/app/orders.page.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

The page behind the sidebar's Orders link: a paged list of the shop's orders, newest first, with the customer's name and phone, the total, the channel, the Nairobi time and a coloured stage tag.

## WHY IMPORTANT

Orders are the money coming in. The owner decides what to pack and send from this list. A missing order is a lost sale.

## DANGER

- Server Component: no `'use client'`, no database, no pool.
- Money arrives as cents and is shown with `formatKes`; times with `formatNairobiTime`.
- The cursor from the address bar is accepted only if it has the plain characters of our bookmarks, otherwise the newest page is shown.
- Customer phone numbers are private: drawn on screen only, never logged, never put in a link.
- If the API fails, `serverGetPage` throws.

## WHAT IT SOLVES

A paged, read-only list drawn on the server, with the shared empty state "No orders yet".

## SYSTEM DESIGN PRINCIPLE

The page never touches the database. It calls `GET /v1/orders`; RLS keeps other shops' orders and customers out.

## RULES

- 20 orders per page.
- Older orders and Back to newest orders links.
- No name shows the phone as the main line.
- An unknown status gets a neutral grey tag.

## PRACTICAL EXAMPLE

Brio Hardware sees `Amina Test, +2547..., KES 500.00, Website, 4 Jan 15:00, created` at the top.

## TRADEOFFS

+ Simple and fast. - Read-only: no detail page, filter or status change yet.

## PIECE BY PIECE (simple words, real-life examples)

### CURSOR_PATTERN

Letters, digits, underscore and dash only, the alphabet of our bookmarks.

### STATUS_STYLES

Blue new, green paid, amber packed, purple sent, dark green delivered, grey cancelled.

### CHANNEL_LABELS

Turns `web` into Website for people.

### The row

Who ordered, how much, where from and when on the left; the stage tag on the right.

### The paging links

Older orders goes back in time; Back to newest returns to the top.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
