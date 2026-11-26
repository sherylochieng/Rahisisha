# Products: list, create, edit and delete (owner dashboard)

**FILE:** `docs/guides/product-edit-delete.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains how a shop owner manages products, what "delete" really does, and the rules that stop one shop touching another shop's goods.

## WHY IMPORTANT

Every price, name and photo a customer sees began here. A bug means wrong prices or one shop seeing another's products.

## DANGER (what breaks without it)

1. Always use `req.db` (locked to one shop by row level security), never a direct pool query.
2. Money is whole cents (KES 350 = 35000). Never decimals.
3. Delete is a **soft delete** (`deleted_at`). Old orders still point at the product.
4. `PATCH` keeps the old value when a field is not sent (`COALESCE`), so it cannot accidentally blank a SKU or description.

## WHAT IT SOLVES

A validated, isolated way for the owner to create, change and remove products, including one photo each.

## SYSTEM DESIGN PRINCIPLE

Validate at the door (Zod), isolate in the database (RLS), keep the answer shape the same everywhere (`{data, nextCursor, error}`).

## RULES

1. Validate first, then touch the database, then answer.
2. Status codes: 201 created, 204 deleted, 400 validation, 404 not found, 409 duplicate SKU.
3. Lists use cursor paging (`WHERE id > cursor`), not OFFSET, so a long list never skips or repeats.
4. Only `active` products appear on the public shop. `draft` and `archived` stay hidden.

## PRACTICAL EXAMPLE

Mama Njeri edits the price of a dress: `PATCH /v1/products/:id` with `{ "priceCents": 240000 }`. Only the price changes; name, SKU and photo stay as they were. Later she deletes an old product: `DELETE /v1/products/:id` returns 204, the product disappears from her shop, and her past orders still show it.

## DECISIONS

- Soft delete over hard delete, to protect order history.
- One photo per product for now (a gallery later).
- Edit and delete are done in the web dashboard through `ProductForm` and the products list page.

## WHERE USED

API: `routes/products.routes.js`, `controllers/products.controller.js`. Web: `ProductForm.js`, the products pages. Tests: the products isolation tests.

## TRADEOFFS

+ Simple, safe, same pattern for every handler.
- No bulk edit and no stock count yet (stock is the next planned feature).
- A deleted product's photo remains at Cloudinary.

## HOW TO USE

`GET /v1/products?limit=10&cursor=<id>`, `POST /v1/products`, `GET /v1/products/:id`, `PATCH /v1/products/:id`, `DELETE /v1/products/:id`, all with the owner's login cookie.

---

## PIECE BY PIECE (real life, in simple terms)

**Zod shape**  
The form at the door: 'name needed, price a whole number'. A wrong form is turned away before any work begins.

**RLS lock**  
The kiosk's key. Mama Njeri's key opens only Mama Njeri's drawer.

**COALESCE in PATCH**  
'If she did not mention it, leave the old line in the notebook.'

**Soft delete**  
Draw a line through the product in the book instead of tearing out the page, because old receipts refer to it.

---


