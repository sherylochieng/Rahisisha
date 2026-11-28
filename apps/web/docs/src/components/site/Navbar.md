# Navbar.js

**FILE:** `apps/web/src/components/site/Navbar.js` (Week 30 Day 3, Cleanup C3)

> The explanation at the top of the code file and this guide say the same thing.

## WHY THIS FILE EXISTS

The top bar of the public landing page: the logo, the Features / Services / About links, "Log in" and "Get started free". On a phone the links fold into a hamburger menu that slides open.

## WHY IMPORTANT

This is how a new shop owner first meets the product. The "Get started free" button is the front door to sign-up.

## DANGER

- It is a CLIENT file ('use client') because the hamburger needs state (open or closed). Keep it the only interactive part of the landing page.
- If you add a page to this bar, add it to the Footer too (components/site/Footer.js).

## RULES

1. Only for the public landing page. Owners use components/owner/Sidebar, admins use components/admin/AdminShell.
2. Links to sections use `/#features` style so they also work when you are on another page.
3. Tapping any mobile link closes the menu.

## WHERE USED

`app/page.js` (the landing page).

## HOW TO USE

```js
import Navbar from '../components/site/Navbar';
<Navbar />
```

## PIECE BY PIECE

```
menuOpen        = is the folded menu open? false (closed) by default.
sticky top-0    = the bar stays at the top of the screen while you scroll, like a shop sign.
hidden md:flex  = the links show on big screens only; phones get the hamburger.
three spans     = the hamburger icon; when open they turn into an X.
max-h animation = the menu slides open and shut without any height maths in JavaScript.
onClick close   = tapping a link closes the menu so it does not cover the page.
```
