# ShopActions.js (guide)

**File:** `apps/web/src/components/admin/ShopActions.js`

## What it is
The "Actions" card on a shop's page: the buttons that fit this shop, the confirmation box, and the "done" message.

## Why it exists
This is the moment an admin changes something real. It offers only sensible actions, always asks for a reason, and always refreshes the screen afterwards.

## Architecture
- Buttons come from `lib/shopActions.js`.
- `ReasonDialog` asks the question.
- `adminApi` talks to the server.
- `onDone` (the page's `reload`) refreshes the shop and its receipts without blanking the page.

## Out-of-date pages
If another admin changed the shop first, the API answers 409 ("already suspended"). The page refreshes behind the box and the message is shown. We never pretend it worked.

## Kenyan example
Two clerks have the same file open. One closes the account. The other tries to close it too and is told "already closed", and their screen updates.

## Danger
The buttons are only an offer. The API is the real lock.

## Reuse
Copy the pattern for any record with state-dependent actions.

## LINE BY LINE
1. `openKey`: which action's box is open (or none). `notice`: the done message.
2. `availableActions(shop)`: what to offer. No actions (deleted shop) returns nothing.
3. `confirm(reason)`: runs the chosen API method with the shop id and the reason.
4. `catch`: 401 goes to sign in; 409 or 404 refreshes the page; then it re-throws so the box shows the message.
5. On success: close the box, set the done message, refresh.
6. The card: a heading, one quiet button per action, the status message, and the box (`key={openKey}` gives a fresh empty box each time).
