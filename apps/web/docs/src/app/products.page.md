# products/page.js: The Products List

**File:** `apps/web/src/app/(authed)/products/page.js`
**Doc:** `apps/web/docs/src/app/products.page.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

The page behind the sidebar's Products link: a paged list of the shop's products with name, price, SKU and status, and an Add product button.

## WHY IMPORTANT

Products are what customers buy. The owner needs to see all of them, not only the five newest on the dashboard.

## DANGER

- Server Component: no `'use client'`, no database, no pool.
- Money arrives as cents and is shown with `formatKes`.
- The cursor from the address bar is accepted only if it looks like a UUID, otherwise page one is shown.
- If the API fails, `serverGetPage` throws, so an empty list that looks real is never shown.

## WHAT IT SOLVES

A paged, read-only list drawn on the server, with the shared empty state for a new shop.

## SYSTEM DESIGN PRINCIPLE

The page never touches the database. It calls `GET /v1/products`, and the tenant-scoped connection keeps other shops out.

## RULES

- 20 products per page.
- Only Next page and Back to first page (the products API pages forward by id).
- No SKU shows a dash, not `null`.

## PRACTICAL EXAMPLE

Brio Hardware sees `Cement 50kg  KES 750.00  active` and `Hammer  KES 450.00  active`.

## TRADEOFFS

+ Simple and fast. - No search, filter, edit or delete yet.

## PIECE BY PIECE (simple words, real-life examples)

### PAGE_SIZE and UUID_PATTERN

Rows per page, and the shape a real bookmark must have.

### STATUS_STYLES

Colour stickers: green for active, grey for draft, amber for archived.

### The header

The title on the left and the Add product button on the right; the button drops under the title on a small screen.

### The list

Name, price and SKU on the left, status tag on the right.

### The paging links

Back to first page and Next page, shown only when they make sense.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
