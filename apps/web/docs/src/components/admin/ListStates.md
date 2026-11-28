# ListStates.js (guide)

**File:** `apps/web/src/components/admin/ListStates.js`

## What it is
Chooses what an admin list shows: loading text, the empty box, an error with "Try again", or the list with a "Load more" button.

## Why it exists
Loading, empty and error screens are the most forgotten part of any page. Done once here, no list can forget them, and every list looks and behaves the same.

## Architecture
Three small jobs, three files: `useCursorList` fetches, `ListStates` picks the state, `ShopsTable` draws rows. It reuses your existing `EmptyState` and `FormError`.

## Reuse
Pass the hook's whole result: `<ListStates {...list} emptyTitle="..." emptyMessage="...">` and put your table inside.

## Danger
It never fetches. An error with nothing to show gives "Try again", so the admin is never stuck on a blank page.

## LINE BY LINE
1. Props: the hook's values (`items`, `nextCursor`, `loading`, `loadingMore`, `error`, `loadMore`, `retry`), the two empty texts, and `children` (the table).
2. `<FormError message={error} />`: an error is always shown (empty message shows nothing).
3. `loading ?`: first page loading, a "Loading..." status line.
4. `items.length === 0 && !error ?`: loaded and empty, the `EmptyState`.
5. `items.length > 0 ?`: draw `children`, then "Load more" if `nextCursor` exists.
6. Last branch: an error and no items, a "Try again" button calling `retry`.
