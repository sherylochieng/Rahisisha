# app/admin/(panel)/notifications/NotificationsBrowser.js

**FILE:** `apps/web/src/app/admin/(panel)/notifications/NotificationsBrowser.js` (Week 30 Day 3, Batch 3b-2b, web step 5)

## WHY THIS FILE EXISTS

The notifications screen: the three counts as filter buttons, a Refresh button, and the table of lines with "Load more".

## WHY IMPORTANT

A failing sender is invisible until someone looks. This is the place to look.

## DANGER

1. It shows no phone numbers or message text (the API never sends them).
2. Lines on the `test` channel are practice: marked Sent, but nothing reached a phone. The page says so, so nobody mistakes "Sent" for "delivered".
3. The counts and the list are two separate calls. Refresh reloads both together.

## WHAT IT SOLVES

"Is the sender working? What failed and why?"

## SYSTEM DESIGN PRINCIPLE

Compose shared pieces (DRY): `useCursorList`, `ListStates`, `FilterPills`, `useAdminLoad`. This file only wires them together.

## RULES

1. Choosing a status restarts the list from the top.
2. Refresh changes a counter that is part of the list's filters (so the list restarts) and is the key that reloads the counts.
3. Newest first, 25 at a time.

## PRACTICAL EXAMPLE

Press "Failed (1)" to see only the failed line and read its note.

## DECISIONS

The `refresh` counter travels with the filters but never reaches the server, because `adminApi.listNotifications` picks only `status`, `cursor` and `limit`.

## WHERE USED / TRADEOFFS / HOW TO USE

Rendered by `notifications/page.js`. + Same hooks and components as the Shops page. - The counts can be a few seconds old until you press Refresh.

**Reuse:** this "counts + filters + list + refresh" screen is a pattern for any admin queue: payments, orders, support tickets.

---

## LINE BY LINE

**`status`, `refresh`** What the admin chose, and how many times they pressed Refresh.

**`summary = useAdminLoad(...)`** Loads the three counts. The key includes `refresh`, so pressing Refresh loads them again.

**`list = useCursorList(...)`** Loads the lines 25 at a time. `filters: { status, refresh }` means the list restarts when either changes.

**`hasPractice`** True when any visible line is on the `test` channel. Then the blue note appears.

**The header** The title, a sentence, and the Refresh button (quiet style).

**`FilterPills`** All, Queued (n), Sent (n), Failed (n).

**`ListStates`** Draws loading, the error message with "Try again", the empty message, and "Load more". The table goes inside it as its child.
