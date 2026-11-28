# components/admin/NotificationStatusChip.js

**FILE:** `apps/web/src/components/admin/NotificationStatusChip.js` (Week 30 Day 3, Batch 3b-2b, web step 2)

## WHY THIS FILE EXISTS

The small coloured pill that says Queued, Sent or Failed, drawn in one place.

## WHY IMPORTANT

One colour rule everywhere: queued is orange (waiting), sent is blue (done), failed is red (needs a look).

## DANGER

Never rely on colour alone. The word is always shown too, so it works for colour-blind people and in black-and-white print.

## WHAT IT SOLVES

Repeated pill markup and inconsistent colours (DRY).

## SYSTEM DESIGN PRINCIPLE

DRY and accessibility: colour **and** text.

## RULES

Unknown statuses still show, in grey, with their own word.

## PRACTICAL EXAMPLE

`<NotificationStatusChip status="failed" />` draws a red "Failed" pill.

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE

A separate component (not a branch in `ShopStatusChip`) so a shop's status and a message's status can change independently. Used by `NotificationsTable.js`. The markup matches `ShopStatusChip`; it is three lines, so a shared base was not worth it yet.

---

## LINE BY LINE

**`LOOKS`** The colours per status (dark text on a light background so it is readable).

**`const look = LOOKS[status] || ...`** Unknown status gets grey.

**`const label = ...`** Capitalises the word: `queued` becomes `Queued`; a missing status shows `Unknown`.

**The `<span>`** A rounded pill with the look and the word.
