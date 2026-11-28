# Footer.js

**FILE:** `apps/web/src/components/site/Footer.js` (Week 30 Day 3, Cleanup C3)

> The explanation at the top of the code file and this guide say the same thing.

## WHY THIS FILE EXISTS

The bottom of the public landing page: the brand blurb, Product links, Account links and the small print.

## WHY IMPORTANT

It gives visitors a second way to reach sign-up and log-in after they have read the whole page.

## DANGER

- If you rename or add a section on the landing page, update the links here and in Navbar, or one of them goes to nothing.

## RULES

1. A server component: no state and no clicks. Do not add 'use client' just for styling.
2. Public landing page only.

## WHERE USED

`app/page.js` (the landing page).

## HOW TO USE

```js
import Footer from '../components/site/Footer';
<Footer />
```

## PIECE BY PIECE

```
Column 1 = the brand and one sentence about what we do.
Column 2 = Product links (Features, Services, About) that jump to sections of the landing page.
Column 3 = Account links (Create account, Log in).
Bottom bar = the small print, built in Kenya.
```
