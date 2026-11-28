# DeleteProductButton.js

**FILE:** `apps/web/src/components/owner/DeleteProductButton.js` (Week 30 Day 3, Cleanup C1)

## WHY THIS FILE EXISTS
The Delete link on each row of the owner's Products page. One click does not delete: it first asks "Delete this product?" with Yes, delete or Cancel. Real life: the shopkeeper asking "are you sure?" before crossing a product off the stock book.

## WHY IMPORTANT
Deleting by accident is easy on a phone. The two-step confirmation prevents it.

## DANGER
The delete is a soft delete in the API (the product is hidden, past orders keep their records). The button must never show a raw technical error.

## WHAT IT SOLVES
Confirm, then call `api.deleteProduct(id)`, then refresh the page so the row disappears. A failed call shows a friendly message and the button comes back.

## SYSTEM DESIGN PRINCIPLE
A small state machine: idle, confirming, deleting. All API calls go through `lib/api.js`, never `fetch()` in the component.

## RULES
Always confirm first. Disable the buttons while deleting so it cannot be sent twice. Show the message from `lib/api.js`.

## WHERE USED
`app/(authed)/products/page.js`, one per row.

## TRADEOFFS
+ Safe and tiny. - No undo after the delete (soft delete means head office could still restore it).

## HOW TO USE
`<DeleteProductButton productId={product.id} productName={product.name} />`
