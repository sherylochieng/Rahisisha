# ShopDetail.js (guide)

**File:** `apps/web/src/app/admin/(panel)/shops/[id]/ShopDetail.js`

## What it is
One shop's page: the summary at the top and its receipts below. Part 3b adds the suspend, reinstate, verify and unverify buttons.

## Architecture
`useAdminLoad` fetches, `ShopSummary` and `ReceiptsList` draw, this file picks what to show for each state.

## States
Loading, not found (calm), error with Try again, ready. A back link to the list shows in every state.

## Decisions
The receipts come in the same answer as the shop, so you always see one consistent picture.

## Danger
Read only for now. Nothing here changes data yet.

## LINE BY LINE
1. `BackLink`: written once, used in every state.
2. `useAdminLoad(() => adminApi.getShop(id), id)`: loads the shop; a new id loads again.
3. `loading ?`: loading text.
4. `notFound ?`: the "Shop not found" box.
5. `shop ?`: summary, then a "Receipts" heading and the list.
6. Last branch: the error message and Try again.
