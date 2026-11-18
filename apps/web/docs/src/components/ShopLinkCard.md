# ShopLinkCard.js: Share Your Shop Link

**File:** `apps/web/src/components/ShopLinkCard.js`
**Doc:** `apps/web/docs/src/components/ShopLinkCard.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

Shows the shop's public link on the dashboard and lets the owner open it, copy it, share it on WhatsApp or use the phone's Share sheet.

## WHY IMPORTANT

The link is how customers find the shop. If the owner cannot easily find and share it, nobody visits.

## DANGER

- It only displays a link it is given. It never builds the link (`lib/shopUrl.js` does) and never reads cookies or calls the API.
- The link is public. Never pass a secret into this component.
- Never use `dangerouslySetInnerHTML`. The link is shown as plain text.
- Copy and Share depend on the browser. The link stays visible so the owner can select it by hand.

## WHAT IT SOLVES

One card with the link, a Copy button, a Share on WhatsApp button, a Share button (only where the browser supports it) and an Open button.

## SYSTEM DESIGN PRINCIPLE

Fail soft: if copying or sharing is not possible, the card still works as plain text.

## RULES

- `'use client'` because it reacts to clicks and uses the clipboard.
- The WhatsApp address is built with `encodeURIComponent`.
- "Copied!" is announced with `role="status"`.
- A note says the public shop page is coming soon, until it is built.

## PRACTICAL EXAMPLE

`<ShopLinkCard url="https://amina.rahisishabiashara.com" shopName="Amina's Boutique" />`.

## TRADEOFFS

+ No libraries. - Older browsers cannot copy with one click.

## PIECE BY PIECE (simple words, real-life examples)

### useState

A small memory for the "Copied!" note.

### canShare

Asks whether this browser has a Share sheet. Phones usually do.

### whatsappHref

A WhatsApp address with the message already written, made safe with `encodeURIComponent`.

### handleCopy

Copies the link. Real life: photocopying your business card. If the copier is broken, the card is still in your hand.

### handleShare

Opens the phone's own share menu. Closing it is not an error.

### target="_blank" and rel="noopener noreferrer"

Opens a new tab that cannot control this one. A standard safety habit.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
