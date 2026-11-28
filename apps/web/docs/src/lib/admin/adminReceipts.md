# adminReceipts.js (guide)

**File:** `apps/web/src/lib/adminReceipts.js`

## What it is
Two small functions that turn a raw receipt from the API into words: `receiptTitle(action)` and `receiptReason(receipt)`.

## Why it exists (DRY)
The shop page and the Receipts page (later) both list receipts. One table means `shop.suspended` is always written "Shop suspended".

## Kenyan example
A bank statement says "ATM W/D" in code, and the app shows "Cash withdrawal". This file is that translation.

## Danger
The reason is typed by a person, so it must only ever be shown as plain text. An unknown action still shows (its raw code) so nothing is hidden.

## Reuse
Add one line to `TITLES` whenever the API gets a new receipt action.

## LINE BY LINE
1. `TITLES`: the lookup table from API action code to readable title.
2. `receiptTitle(action)`: returns the title, or the raw code, or "Unknown action". Always a string.
3. `receiptReason(receipt)`: reads `receipt.after.reason` safely (each step checked, so no crash). Returns `''` when there is none.
