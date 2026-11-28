# Sidebar.js

**FILE:** `apps/web/src/components/owner/Sidebar.js` (Week 30 Day 3, Cleanup C1)

## WHY THIS FILE EXISTS
The blue menu down the left side of every signed-in owner page on a laptop: logo, shop name and the links (Dashboard, Inbox, Payments, Products, Orders, Wallet; Settings is marked soon). Real life: the signboard at the shop door listing every department.

## WHY IMPORTANT
It is how an owner moves between the parts of the app. The current page is highlighted in orange.

## DANGER
It must keep its full height (see the `md:flex` wrapper in `(authed)/layout.js`). A link with `ready: false` is drawn greyed out and cannot be clicked, so unfinished pages never lead to an error page.

## WHAT IT SOLVES
One place that lists the owner's menu (`NAV_ITEMS`), so the laptop sidebar and the phone menu (`MobileNav`) show the same items.

## SYSTEM DESIGN PRINCIPLE
Data-driven UI: the menu is a list, not repeated markup. Add an item by adding one row.

## RULES
Hidden on phones (MobileNav is used there). Mark a page `ready: true` only when it exists. Never show a technical error here.

## WHERE USED
`app/(authed)/layout.js` (laptops) and `MobileNav` (reuses `NAV_ITEMS`).

## TRADEOFFS
+ Simple and consistent. - The menu does not stay in view on a very long page.

## HOW TO USE
`<Sidebar shopName={tenant.name} />` inside the signed-in layout.

## UPDATE (Batch 4b)
A new menu row, **Shop profile** (`/shop-profile`), sits between Wallet and Settings. It opens the owner's business card page. Nothing else in this file changed.
