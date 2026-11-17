# inbox.controller.js: The Unified Inbox

**File:** `apps/api/src/controllers/inbox.controller.js`
**Doc:** `apps/api/docs/src/controllers/inbox.controller.md`
**Added:** Week 29 Day 4
**Route:** `GET /v1/inbox?limit=20&cursor=...` (`apps/api/src/routes/inbox.routes.js`)
**Used by:** `apps/web/src/app/(authed)/inbox/page.js`

---

## WHY THIS FILE EXISTS

One newest-first list of everything customers sent the shop, from WhatsApp and USSD.

## WHY IMPORTANT

It is the data behind the Inbox page (Day 4 Task 1, worth 25 points).

## DANGER

- `UNION ALL` does not sort. `ORDER BY` goes AFTER the union (the assignment's common mistake).
- Cursor = (created_at, id) pair with microseconds (see `keysetCursor.md`).
- Reads through `req.db` only. RLS filters BOTH tables; no `WHERE tenant_id`.
- Only inbound WhatsApp messages (our own replies are not "from" a customer).
- A bad cursor is a 400, not a crash.

## WHAT IT SOLVES

Returns `{ data: [{ id, channel, from, body, createdAt }], nextCursor, error }`. `channel` is `whatsapp` or `ussd`. Limit default 20, max 100, minimum 1.

## SYSTEM DESIGN PRINCIPLE

Query the merge, not the sources: stack both sources into one shape, then sort and cut once.

## RULES

1. ORDER BY after UNION ALL.
2. limit+1 trick to know if more exist.
3. Exactly five fields per row.
4. No phone number or body in any log.

## PRACTICAL EXAMPLE

`GET /v1/inbox?limit=2` returns the two newest rows plus `nextCursor`. Send it back as `&cursor=` to get the next two.

## DECISIONS (and WHY)

- `UNION ALL`, not `UNION`: the sources never overlap, so skip the duplicate check.
- A plain query, NOT a materialised view. The assignment warns that a materialised view needs a refresh plan; a live query needs none and both tables already have a (tenant_id, created_at) index.
- Channel filter `c.channel = 'whatsapp'` so a future `web` chat does not appear as WhatsApp.

## WHERE USED / FUTURE USES

The Inbox page. Future: filter by channel (stretch), unread counts, reply from the inbox.

## TRADEOFFS

+ Always live, simple, correct paging.
- Runs the union per page. At very large volumes a stored summary or materialised view with a refresh plan would be the next step.
- Only "older" paging.

## PIECE BY PIECE (simple words, real-life examples)

### `limit` parsing

`parseInt` then clamp to 1..100. `abc` falls back to 20. Real life: "how many letters per page?" with sensible bounds.

### Cursor check

No cursor = newest. A cursor must decode, else 400. Real life: a bookmark that is not from this book is refused.

### The SQL

Inner part: two SELECTs shaped into the same five columns and stacked with `UNION ALL`. Outer part: the cursor filter, `ORDER BY created_at DESC, id DESC`, `LIMIT`. Real life: two mail trays emptied into one pile, sorted newest on top, handed over a page at a time.

### `hasMore` and `nextCursor`

We asked for one extra row. If it arrived there is a next page, and the bookmark is built from the LAST row we actually return.

### `data.map(...)`

Renames `created_at` to `createdAt` and keeps only the five agreed fields.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
