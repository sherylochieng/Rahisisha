# shopActions.js (guide)

**File:** `apps/web/src/lib/shopActions.js`

## What it is
One printed list of the four things an admin can do to a shop (Suspend, Reinstate, Verify, Remove verification), plus `availableActions(shop)` which says which ones fit a shop right now.

## Why it exists (DRY, data-driven UI)
The buttons, the confirmation box and the "done" message all read from this one table. Change a word once and it changes everywhere. A fifth action is one new entry.

## Kenyan example
A county office has a menu of services on the wall: "Renew licence", "Cancel licence". The clerk only offers "Cancel" to someone who has a licence, and "Renew" to someone whose licence has lapsed. `availableActions` is the clerk deciding what to offer.

## Danger
- `suspend` is the only action whose reason the **owner sees**. `warnsOwner: true` makes the form warn the admin. Never remove it.
- The buttons are only an offer. The API is the real lock and refuses a wrong action anyway.

## Reuse
Any app with a few admin actions that each need a reason: orders (refund, cancel), users (ban, restore).

## LINE BY LINE
1. `SHOP_ACTIONS`: one entry per action. `apiMethod` is the function name on `adminApi`; `buttonLabel`, `title`, `explain`, `confirmLabel` are the words; `warnsOwner` shows the orange notice; `danger` makes the confirm button red; `doneMessage` is shown afterwards.
2. `availableActions(shop)`: returns a list of keys.
3. `if (!shop || shop.status === 'deleted') return []`: a deleted shop cannot be changed.
4. First choice: a suspended shop offers `reinstate`, any other offers `suspend`.
5. Second choice: a verified shop offers `unverify`, otherwise `verify`.
