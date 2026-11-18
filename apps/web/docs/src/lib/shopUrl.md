# shopUrl.js: A Shop's Public Link

**File:** `apps/web/src/lib/shopUrl.js`
**Doc:** `apps/web/docs/src/lib/shopUrl.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

Every shop has an address word (its slug), for example `amina`. Customers reach the shop at `amina.rahisishabiashara.com`. This file builds that full address in one place.

## WHY IMPORTANT

A wrong link is a shop owner sharing a dead address with real customers.

## DANGER

- The slug is checked again here (lowercase letters, digits and single dashes). Anything else returns `null`, so a strange value never becomes a link.
- The slug must come from the logged-in session, never from something a visitor types.
- The link is public. Never put anything secret in it.

## WHAT IT SOLVES

Laptop: `amina` + `localhost:3001` gives `http://amina.localhost:3001`. Online: `amina` + `rahisishabiashara.com` gives `https://amina.rahisishabiashara.com`.

## SYSTEM DESIGN PRINCIPLE

One pure function: plain text in, plain text out. It reads no cookies and calls no API, so it is easy to test.

## RULES

- Returns a string or `null`.
- The port is copied from the address the owner is using now.
- `https` everywhere except `localhost`.

## PRACTICAL EXAMPLE

`buildShopUrl({ slug: 'amina', host: 'localhost:3001', rootDomain: 'localhost' })` gives `http://amina.localhost:3001`.

## TRADEOFFS

+ Tiny and predictable. - A shop on its own custom domain is not supported yet.

## PIECE BY PIECE (simple words, real-life examples)

### SLUG_PATTERN

The allowed shape of a shop word. Real life: a shop sign may only use letters, numbers and dashes.

### The slug check

Returns `null` for anything else, so the page can hide the card instead of showing a broken link.

### root and port

The main domain (`localhost` on a laptop) and the `:3001` copied from the owner's current address.

### scheme

`http` for a laptop, `https` online, so the padlock appears for real customers.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
