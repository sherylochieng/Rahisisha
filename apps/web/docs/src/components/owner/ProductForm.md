# ProductForm.js: Add A Product

**File:** `apps/web/src/components/owner/ProductForm.js`
**Doc:** `apps/web/docs/src/components/owner/ProductForm.md`
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

## ADDED IN BATCH 4a-2 (Week 30 Day 3): CATEGORY DROPDOWN

- A "Category (optional)" dropdown sits between Status and Photo. It is its own file, `CategorySelect.js`, which gets the aisles from `useCategories()`; ProductForm only holds the chosen value and sends it.
- `inputClass` and `FieldError` moved, unchanged, to `components/shared/formParts.js` so ProductForm and CategorySelect share one copy (the only lines removed from ProductForm).
- `categoryId` is kept in state (not read from the form), so the right aisle stays selected when the list arrives after the page opens.
- Sent only when it changed: an id sets it, `null` removes it. A price-only edit never touches the aisle (matches the API's keep / set / clear rule).
- A 400 with `details.categoryId` shows "Choose a category from the list." under the box.
- If the list cannot load, the dropdown offers only "No category" and saving still works.
- Nothing removed from the earlier guide text.

## ADDED IN BATCH 4a-3 (Week 30 Day 3): FIELD ORDER

The form now starts with **Photo**, then **Category**, then Name, Price, SKU, Description and Status. Reason: a photo takes a few seconds to upload, and the form lets you keep typing meanwhile, so the upload runs while you fill in the rest. Only the order of the blocks changed. Nothing removed.
