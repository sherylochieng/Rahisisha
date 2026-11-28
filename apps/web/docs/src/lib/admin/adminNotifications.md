# src/lib/admin/adminNotifications.js

**FILE:** `apps/web/src/lib/admin/adminNotifications.js` (Week 30 Day 3, Batch 3b-2b, web step 1)

## WHY THIS FILE EXISTS

The **plain-words dictionary** for the notifications screen: what to call each message, how to describe each line's situation, and the filter choices. No screen code, no network.

## WHY IMPORTANT

The API speaks in codes (`shop.suspended`, `no_recipient`). A tired admin should read "Shop suspended" and "No phone number on file". One place for the words means one place to change them (DRY).

## DANGER

1. An unknown template or error code must still show something (its own code). Nothing may disappear.
2. `lastError` is shown as plain text only.
3. A line on the `test` channel was **not** sent to a phone. The note says so.

## WHAT IT SOLVES

"What does this row mean, in one friendly line?"

## SYSTEM DESIGN PRINCIPLE

Data-driven UI and separation of concerns: words in a table, screen code stays short.

## RULES

Pure functions. Unknown values fall back to the raw code.

## PRACTICAL EXAMPLE

```js
templateLabel('shop.suspended');   // 'Shop suspended'
describeNote({ status: 'failed', lastError: 'no_recipient' });  // 'No phone number on file'
```

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE

The filter options are built here so any future widget reuses them. Used by `NotificationsTable.js` and `NotificationsBrowser.js`. + One dictionary. - A new template on the API needs a label here (until then it shows its code).

**Reuse:** any admin screen over coded data (order states, payment results) benefits from one dictionary file.

---

## LINE BY LINE

**`TEMPLATE_LABELS`, `ERROR_LABELS`** Code to words.

**`templateLabel(template)`** The label, or the code itself when unknown.

**`describeNote(n)`** One line per row:
- **sent:** "Sent 28 Nov, 12:31", plus "(practice channel, nothing reached a phone)" when the channel is `test`.
- **failed:** the friendly error, or the raw error, or "Failed".
- **queued, tried before:** "Next try ..." with the time, and "Last problem: ..." when there is one.
- **queued, never tried:** "Waiting to be sent".

**`statusOptions(counts)`** The four filter buttons (All, Queued, Sent, Failed). When the counts have loaded, each shows its number, like "Queued (2)". Before that, the plain words.
