# page.js

**FILE:** `apps/web/src/app/(authed)/shop-profile/page.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

The owner's "Shop profile" page at /shop-profile. It loads the saved business card
and shows the form to change it.

## WHY IMPORTANT

It is where an owner writes the town and one-line description that strangers see,
and where they choose whether to appear in the marketplace.

## DANGER

1. A SERVER page: it reads the card with the owner's login cookie (serverGet), so
   the form opens already filled in. No flash of an empty form.
2. It sits inside the (authed) group, so the layout already checks the login and
   draws the sidebar. Do not repeat that here.

## WHAT IT SOLVES

Load, then hand to the form. The form does the typing and saving.

## SYSTEM DESIGN PRINCIPLE

Server page fetches, client form interacts (same as Edit product).

## RULES

1. No form logic here.
2. Keep the title and the helper line short and plain.

## PRACTICAL EXAMPLE

```
Mama Njeri taps "Shop profile" in the menu and sees her saved town, line and number.
```

## WHERE USED

The sidebar link "Shop profile" (components/owner/Sidebar.js).

## HOW TO USE

```
Visit /shop-profile while logged in.
```

## PIECE BY PIECE

```
metadata       = THE BROWSER TAB TITLE.
serverGet(...) = ASK THE API FOR MY CARD, using my login cookie.
<ShopProfileForm profile={...} /> = THE FORM, already filled with the saved words.
```
