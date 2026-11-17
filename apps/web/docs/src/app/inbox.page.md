# inbox/page.js: The Inbox Screen

**File:** `apps/web/src/app/(authed)/inbox/page.js`
**Doc:** `apps/web/docs/src/app/inbox.page.md`
**Added:** Week 29 Day 4
**Next to it:** `inbox/loading.js` (loading state)
**Calls:** `GET /v1/inbox` through `serverGetPage`

---

## WHY THIS FILE EXISTS

One list of WhatsApp and USSD contacts, newest first, with a channel badge.

## WHY IMPORTANT

A customer who gets no reply buys elsewhere.

## DANGER

- Server Component: no `'use client'`.
- Data only through `serverGetPage`; never the database.
- The `cursor` in the URL is untrusted; the API validates it (a made-up one shows the error page, not data).
- API failure throws (error page); never an empty inbox that is really a failure.

## WHAT IT SOLVES

`/inbox` shows the 20 newest; `Older messages` link goes to the next page; empty state when there are none.

## SYSTEM DESIGN PRINCIPLE

Keyset paging with plain links: works without JavaScript and Back behaves normally.

## RULES

1. Empty state text exactly: `No messages yet. Share your USSD code or WhatsApp number.`
2. Badges: WA (green), USSD (amber) with the full word in `title`/`aria-label`.
3. Times in Nairobi time.
4. Long text wraps (`break-words`, `min-w-0`).

## PRACTICAL EXAMPLE

WA 254711000111 "Do you have the red kitenge dress?" 16 Nov, 18:17 / USSD 254722000222 "Chose: 2".

## TRADEOFFS

+ No client JavaScript. - Older-only paging, no live updates, no filters yet (stretch).

## PIECE BY PIECE (simple words, real-life examples)

### `CHANNELS` and `ChannelBadge`

Colour sticker per channel. Unknown channels still show their own name.

### `searchParams`

A Promise in this Next.js version; `await` it to read `?cursor=`.

### `serverGetPage`

Fetches the page as the logged-in visitor and returns the list AND `nextCursor`.

### Empty vs list

`messages.length === 0` shows the shared `EmptyState`; otherwise a list.

### USSD text

`''` becomes "Dialled the USSD code", otherwise "Chose: <digits>".

### Paging links

"Older messages" uses `nextCursor`; "Back to newest" shows only when a cursor is in the URL.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
