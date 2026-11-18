# ProductForm.js: Add A Product

**File:** `apps/web/src/components/ProductForm.js`
**Doc:** `apps/web/docs/src/components/ProductForm.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

A form with name, price in KES, optional SKU, optional description and status. It sends the new product to the API.

## WHY IMPORTANT

Without it the only way to add a product is by hand in the database. A shop cannot run on that.

## DANGER

- Money is sent as whole cents made by `kesToCents`. Never multiply a decimal by 100 here.
- All API calls go through `lib/api.js` (`api.createProduct`), never `fetch()`.
- Empty optional boxes are left out of the request. An empty SKU sent as `""` would clash with the one-SKU-per-shop rule.
- The price must fit the database column (32-bit, so under about KES 21,474,836).
- The form never decides which shop the product belongs to. The API reads that from the login cookie.

## WHAT IT SOLVES

Friendly checks first, then the API's answer decides: the form checks only to be fast and kind, and the API is the one that says yes or no.

## SYSTEM DESIGN PRINCIPLE

Check twice, trust once.

## RULES

- `noValidate` so our messages replace the browser's pop-ups.
- A duplicate SKU (409) shows under the SKU box.
- A 400 with `details` points at the wrong box.
- After success it goes to `/products` and refreshes the list.
- Status starts as "active".

## PRACTICAL EXAMPLE

Amina types `Red dress` and `1,500`. The API gets `{ name: 'Red dress', priceCents: 150000, status: 'active' }` and she lands on the list with the dress in it.

## TRADEOFFS

+ No libraries, reuses `FormError`, `SubmitButton` and `useFormState`. - No images, edit or delete yet.

## PIECE BY PIECE (simple words, real-life examples)

### MAX_PRICE_CENTS

The biggest number the database column can hold. Real life: a till that shows 8 digits cannot ring a 9-digit sale.

### FieldError and inputClass

The red note under a box and the shared look of every box.

### handleSubmit

Reads the boxes by name, checks them, builds the request and sends it.

### The body

`sku` and `description` are added only when typed.

### The 409 and 400 branches

A duplicate SKU or a field the API disliked is shown next to the right box.

### router.push and refresh

Go back to the list and re-read it so the new product appears.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
