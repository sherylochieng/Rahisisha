# components/admin/NotificationsTable.js

**FILE:** `apps/web/src/components/admin/NotificationsTable.js` (Week 30 Day 3, Batch 3b-2b, web step 3)

## WHY THIS FILE EXISTS

Draws the table of outbox lines: which message, for which shop, its status, how many tries, and a one-line note.

## WHY IMPORTANT

This is how head office sees whether owners are really being told.

## DANGER

1. It receives lines **without** phone numbers or message text (the API never sends them). Do not add them here.
2. `lastError` is rendered as plain text. React escapes it, so markup in a value cannot run. The test render also confirmed a shop name like `Mama <b>Njeri</b>` shows as text.

## WHAT IT SOLVES

"Show me the messages, readable on a phone or a desk."

## SYSTEM DESIGN PRINCIPLE

A presentational component: data in, markup out, no state. Same shape as `ShopsTable`.

## RULES

1. A caption for screen readers and real `<th scope="col">` headings.
2. The shop name links to that shop's page.
3. A wide table scrolls sideways instead of breaking the layout.

## PRACTICAL EXAMPLE

`<NotificationsTable items={list.items} />`

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE

All wording comes from `lib/admin/adminNotifications.js`. Used by `NotificationsBrowser.js`. + Simple and accessible. - No sorting; always newest first.

---

## LINE BY LINE

**`HEADINGS`** Message, Shop, Status, Channel, Tries, Note, Created.

**The wrapper `div`** A rounded box with `overflow-x-auto` so the table scrolls on small screens.

**The row** For each line: the message's friendly name; the shop as a link to `/admin/shops/<id>`; the status pill; the channel; the number of tries; the note from `describeNote`; and the creation time in Nairobi time.
