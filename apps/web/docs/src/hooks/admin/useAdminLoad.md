# useAdminLoad.js (guide)

**File:** `apps/web/src/hooks/admin/useAdminLoad.js`

## What it is
A hook that loads ONE thing (one shop, later one admin) and reports `data`, `loading`, `error`, `notFound`, plus `reload` and `retry`.

## Why it exists
`useCursorList` is for lists. Detail screens need the same safety for one item: no stale answers, 401 goes to sign in, and a reload after an action.

## Kenyan example
You open file A at the registry, then quickly ask for file B. If A's file arrives late, it must not be placed under B's name. The counter makes sure only the newest request is used.

## Reuse
`useAdminLoad(() => adminApi.getAdmin(id), id)`.

## Danger
Without the counter, quickly opening two shops can show the wrong data. 404 is shown calmly as "not found".

## LINE BY LINE
1. `loadRef`: always the newest loader, without making it a reason to reload.
2. `state`: `data`, `loading`, `error`, `notFound` together.
3. `latest`: the counter, so only the newest call may update the screen.
4. `run(quiet)`: bumps the counter; unless quiet, blanks the screen and shows loading. Then calls the loader.
5. `.then`: ignore if stale; otherwise store `res.data`.
6. `.catch`: ignore if stale; 401 goes to sign in; 404 sets `notFound`; anything else keeps old data and stores the message.
7. The effect: loads on arrival and whenever `key` changes; its cleanup bumps the counter so leaving the page makes old answers stale.
8. `reload`: `run(true)`, fetches again without blanking the screen (used after suspend or verify in part 3b).
9. `retry`: `run(false)`, the "Try again" button.
