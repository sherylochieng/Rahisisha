# useCursorList.js (guide)

**File:** `apps/web/src/hooks/useCursorList.js`

## What it is
A hook that loads any list a page at a time: first page, "Load more", filters that restart the list, and protection against answers arriving out of order.

## Why it exists (DRY + separation of concerns)
Shops, Receipts and Admins all need this. Written once, tested once, fixed once. The hook decides **how** data is fetched; components decide **what** to draw.

## Kenyan example
A Gikomba stockist asks the supplier: "send me the first 25 items". Then: "send the next 25 after item X". That "after item X" is the cursor. If you change what you are asking for ("only suspended"), you start from the top again.

## Architecture
- **Keyset paging:** `nextCursor` means "continue after this one". Fast on huge lists (page numbers get slower the deeper you go).
- **Latest call wins:** each call gets a number. Only the newest may update the screen. A slow answer for "ma" cannot overwrite the answer for "mama".
- **Stable inputs:** `fetchPage` is held in a ref and filters are compared by their JSON text, so new function or object identities on each render do not reload the list.

## Danger
Remove the `latest` counter and the list will sometimes show wrong shops. Filters must be plain values.

## Reuse
```js
const list = useCursorList({
  fetchPage: (params) => adminApi.listReceipts(params),
  filters: { action, from, to },
});
```

## LINE BY LINE
1. `'use client'`: runs in the browser.
2. `fetchRef`: always holds the newest `fetchPage`, without being a reason to reload.
3. `filterKey = JSON.stringify(filters)`: the filters as text. Same values = no change.
4. `state`: items, nextCursor, loading, loadingMore, error together.
5. `attempt`: a number bumped by `retry` to run the first load again.
6. `latest`: the counter for latest-call-wins.
7. First-page effect: bump `latest`, remember `mine`, set loading, call `fetchRef.current` with the filters and `limit`.
8. `.then`: ignore if `mine !== latest.current`; otherwise store `res.data` and `res.nextCursor`.
9. `.catch`: ignore if stale; 401 goes to sign in; otherwise store the message and an empty list.
10. Effect dependencies `[filterKey, pageSize, attempt, router]`: a real filter change or a retry starts again from page one.
11. `loadMore`: same call plus `cursor`; appends items; drops the answer if filters changed meanwhile.
12. `retry`: bumps `attempt`.
13. `return { ...state, loadMore, retry }`: one object for the screen.
