# Card.js

**FILE:** `apps/web/src/components/site/Card.js` (Week 30 Day 3, Cleanup C3)

> The explanation at the top of the code file and this guide say the same thing.

## WHY THIS FILE EXISTS

One reusable feature card for the landing page: an icon, a title and a short description, in a light or dark style.

## WHY IMPORTANT

The landing page shows nine of these. Because they all come from one component, a design change is made once.

## DANGER

- Do not copy this card's markup into the page. A copy will stop matching the others the first time the design changes.

## RULES

1. Content comes in through props; the shape stays the same.
2. Do not fetch data in here.
3. `variant` is only 'light' or 'dark'.

## WHERE USED

`app/page.js` (the landing page).

## HOW TO USE

```js
import Card from '../components/site/Card';
<Card icon={<svg />} title="Track sales" description="See what sold today." variant="dark" />
```

## PIECE BY PIECE

```
icon        = the small picture in the rounded square at the top.
title       = the heading.
description = the short grey sentence under it.
variant     = 'light' (white card) or 'dark' (navy card).
className   = extra spacing from the page, if needed.
hover lift  = the card rises slightly when you point at it.
```
