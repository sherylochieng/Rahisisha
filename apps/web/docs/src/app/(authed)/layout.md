# (authed)/layout.js

**FILE:** `apps/web/src/app/(authed)/layout.js` (Week 30 Day 3, Batch 4a-3: sidebar height)

## WHY THIS FILE EXISTS
The frame around every signed-in owner page: the blue sidebar on the left (on laptops), the mobile menu on phones, the welcome header and the page itself. It also checks the login (`requireSession`) before anything is drawn.

## WHY IMPORTANT
Every owner page sits inside it, so a change here shows everywhere: Dashboard, Inbox, Products, Orders, Wallet.

## DANGER
The sidebar must keep its full height on long pages. If the wrapper around it is not a flex box, the blue stops after one screen height and the page looks broken.

## WHAT IT SOLVES (this change)
The blue sidebar used to end after one screen height on a long page (for example a long Products list), as if floating. The wrapper changed from `md:block` to `md:flex`. The wrapper is stretched to the full page height by the row around it, and as a flex box it now passes that height on to the Sidebar. Nothing else in the file changed.

## SYSTEM DESIGN PRINCIPLE
Let the layout do the sizing: one flex row stretches all its children to the same height, so no pixel heights or scripts are needed.

## RULES
1. Keep `hidden md:flex` (phones get `MobileNav` instead of the sidebar).
2. Keep `min-w-0` on the right column so long content shrinks instead of widening the page.

## WHERE USED
Wraps every route under `app/(authed)/`.

## TRADEOFFS
+ One word, no JavaScript. - The menu items scroll away with a very long page (they are at the top of the blue). Making them stick would be a separate, optional change.

## HOW TO USE
Nothing to call. Open a long page on a laptop and scroll: the blue reaches the bottom.
