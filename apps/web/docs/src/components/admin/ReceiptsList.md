# ReceiptsList.js (guide)

**File:** `apps/web/src/components/admin/ReceiptsList.js`

## What it is
Draws receipts (the audit trail): what was done, by which admin, when, from which address, and the written reason.

## Why it exists
Receipts are the proof of every admin action. This is what you open when an owner asks "why was I suspended?". One component serves the shop page now and the Receipts page later.

## Danger
The reason is shown as plain text (React escapes it). Never use `dangerouslySetInnerHTML`.

## Reuse
`<ReceiptsList receipts={receipts} />` anywhere you have receipts from the API.

## LINE BY LINE
1. Empty or missing list: a calm "No receipts yet" line.
2. `<ol>`: an ordered list, newest first as the API sends it.
3. Title: `receiptTitle(r.action)`, time: `formatNairobiTime`.
4. `By {r.adminName || 'Unknown admin'}`: a removed admin still shows something.
5. `reason &&`: the reason line only when there is one.
6. `ipAddress &&`: the address the action came from, small and grey.
