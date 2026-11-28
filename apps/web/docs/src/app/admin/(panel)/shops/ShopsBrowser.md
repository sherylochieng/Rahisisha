# ShopsBrowser.js (guide)

**File:** `apps/web/src/app/admin/(panel)/shops/ShopsBrowser.js`

## What it is
The shops screen: the search box and two filters, joined to the shared list pieces. It only decides **which** shops to ask for.

## Architecture (each job in its own file)
| Job | File |
|---|---|
| How pages are fetched (race-safe, cursor paging) | `hooks/useCursorList.js` |
| Wait for typing to pause | `hooks/useDebouncedValue.js` |
| Loading, empty, error, Load more | `components/admin/ListStates.js` |
| Draw the rows | `components/admin/ShopsTable.js` |
| Filter buttons | `components/admin/FilterPills.js` |
| Which shops to ask for | this file |

## Kenyan example
You search "njeri" in a register of 800 shops. After a short pause you see Mama Njeri Groceries. Tap "Suspended" and the list narrows. "Load more" adds the next 25.

## Decisions
- No total count: the API does not send one (counting a big table on every search is slow). We show "Showing N shops".
- Deleted shops are not a filter option; the API hides them.
- The filters stay here, not in their own file: they are small and Receipts will have different ones.

## Reuse
Copy this for Receipts and Admins: change the API call, the filters and the table.

## LINE BY LINE
1. `'use client'`: runs in the browser.
2. `STATUS_OPTIONS`, `VERIFIED_OPTIONS`: filter choices. `''` means no filter.
3. `useState` for `status`, `verified`, `search`: what the admin chose.
4. `q = useDebouncedValue(search.trim(), 350)`: search words after typing pauses.
5. `useCursorList({ fetchPage, filters: { status, verified, q } })`: the shared logic. Any filter change restarts from page one.
6. `count`: how many rows are loaded, for "Showing N shops".
7. The heading and subtitle.
8. The controls: `AdminField` for search, two `FilterPills`.
9. `<ListStates {...list} ...>`: handles loading, empty, error and Load more. Inside it: the count line and `ShopsTable`.
