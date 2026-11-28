# tests/adminNotifications.service.test.js

**FILE:** `apps/api/tests/adminNotifications.service.test.js` (Week 30 Day 3, Batch 3b-2b, step 4)

## WHY THIS FILE EXISTS

Proves head office's window onto the outbox works: the list, the status filter, paging, the counts, and that no phone number or message text ever leaks.

## WHY IMPORTANT

This is how a failing sender becomes visible, and a careless change could leak an owner's phone or a suspension reason.

## DANGER

Makes its own throw-away shop and lines and removes them. Other lines may exist in the database, so every check looks only at **our** lines or compares counts before and after.

## WHAT IT SOLVES

Confidence in `listNotifications` and `getNotificationSummary`.

## SYSTEM DESIGN PRINCIPLE

Test by difference against a shared database, and test the privacy promise.

## RULES

Random names per run. Our lines get `created_at` in the year 2099 so they come first in a newest-first list. Clean up everything.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- adminNotifications.service
```

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE

`created_at` is set directly so ordering and paging are predictable. Normal test run. + Real database. - Needs migration 031.

---

## LINE BY LINE

**Setup.** One shop and four lines: `a` queued (oldest), `b` sent, `c` failed with the note `no_recipient`, `d` queued with no phone (newest).

1. **Order and fields:** the four lines come back newest first (d, c, b, a), with the shop name, template, channel `test`, status, attempts, last error and exactly the expected set of fields.
2. **Privacy:** the phone number, the suspension reason and the word `payload` appear nowhere in the answer. Only `hasPhone` is true or false.
3. **Filter:** `failed` returns only failed lines, `sent` only sent lines, an unknown word is refused with `validation`, and an empty word means all.
4. **Paging:** page one is [d, c], the bookmark gives [b, a], and a nonsense bookmark is refused.
5. **Page size:** 0 becomes 1, 5000 is capped at 100, and a non-number uses the default.
6. **Counts by difference:** after adding 1 queued, 1 failed and 2 sent lines, each count grows by exactly that much.

**How I know the checks have teeth:** returning the phone number instead of yes or no made checks 1 and 2 fail, and ignoring the status filter made check 3 fail. Both were put back.
