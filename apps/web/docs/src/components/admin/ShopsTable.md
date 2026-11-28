# ShopsTable.js (guide)

**File:** `apps/web/src/components/admin/ShopsTable.js`

## What it is
Draws the register of shops: Shop, Owner, Plan, Status, Verified, Joined.

## Architecture
**Separation of concerns:** `ShopsBrowser` fetches and filters; `ShopsTable` only draws what it is given.

## Data minimisation
The owner's phone number is not shown here. The detail page will show it, where the admin has a reason to look.

## Why rows are not links yet
The detail page does not exist yet. A dead link is worse than no link. We add it in the next step.

## Reuse
Any admin table: change `HEADINGS` and the cells.

## LINE BY LINE
1. `HEADINGS`: one list feeds the table head.
2. Outer `<div className="overflow-x-auto ...">`: on a phone the table scrolls inside its box, never the page.
3. `<caption className="sr-only">`: a hidden title for screen readers.
4. `scope="col"` on headings: tells screen readers these head the columns.
5. First cell: shop name (bold navy) and slug beneath.
6. `shop.owner ? shop.owner.name : '—'`: no owner row shows a dash, never a crash.
7. `capitalize` on plan: "free" shows as "Free".
8. `ShopStatusChip` and `VerifiedMark`: the shared pieces.
9. `formatNairobiDate(shop.createdAt)`: join date in Nairobi time.
