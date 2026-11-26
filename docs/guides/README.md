# Guides Index

**FILE:** `docs/guides/README.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

A map of the feature guides, so you can find the right explanation when you return to the project.

## WHY IMPORTANT

The code files carry their own explanations, but a guide shows how the pieces fit together across files and between the API and the web app.

## DANGER (what breaks without it)

Without an index, guides get forgotten and the same questions get asked again.

## WHAT IT SOLVES

Quick navigation by topic.

## SYSTEM DESIGN PRINCIPLE

One guide per feature, each explaining why, what, danger and how, in simple terms.

## RULES

1. Add a line here when you add a guide. 2. Keep each guide about one feature.

## PRACTICAL EXAMPLE

Wondering why there is no 'send again' button while waiting for M-Pesa? Open the payment safety guide.

## DECISIONS

Guides live in `docs/guides/`, incidents in `docs/incidents/`, API shapes in `docs/api/`, the to-do list in `docs/PENDING_TASKS.md`.

## WHERE USED

Linked from the README when it is next updated.

## TRADEOFFS

More files to keep, but each is short and focused.

## HOW TO USE

Pick the topic below.

---

## PIECE BY PIECE (real life, in simple terms)

**Index**  
Like the contents page of a notebook: which page to open for which topic.

---

| Topic | Guide |
|---|---|
| Customer shop to receipt, step by step | `checkout-flow.md` |
| Lost confirmations, double charges, the check button | `payment-safety-and-reconcile.md` |
| What happened on 26 Nov 2026 | `../incidents/2026-11-26-double-charge.md` |
| The basket and checkout screens in the browser | `web-cart-and-basket.md` |
| Product photos and Cloudinary | `product-photos-cloudinary.md` |
| Product edit and delete | `product-edit-delete.md` |
| Public shop page, addresses, local setup | `public-storefront-and-local-domains.md` |
| Exact customer endpoint shapes | `../api/customer-checkout-endpoints.md` |
| Everything still to do | `../PENDING_TASKS.md` |
