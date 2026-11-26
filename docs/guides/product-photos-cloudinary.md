# Product Photos with Cloudinary

**FILE:** `docs/guides/product-photos-cloudinary.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Shows how a shop owner's product photo travels from their phone to Cloudinary and onto the public shop, which settings it needs, and what must be done before it works on the live site.

## WHY IMPORTANT

A shop without pictures does not sell. Photos are also the easiest way to fill up storage or save a harmful link if the upload is not locked down.

## DANGER (what breaks without it)

1. `CLOUDINARY_API_SECRET` must never reach the browser, the logs or Git.
2. The upload folder is chosen by the server from the logged-in shop (`rahisisha/<tenantId>`), never by the browser.
3. A product may only be saved with a photo address that is `https`, from Cloudinary, and inside **this** shop's folder (`isShopImageUrl`).
4. The live database does not have the `products.image_url` column yet (migration 027). Pushing code that reads it before the migration is applied to Neon breaks the live product list.

## WHAT IT SOLVES

One photo per product, uploaded directly to Cloudinary by the browser, so our server never carries the photo.

## SYSTEM DESIGN PRINCIPLE

Direct upload with a signed permit: the big thing (the photo) goes straight to the store, and our server only hands out a short-lived permit. The secret stays on the server.

## RULES

1. Allowed types: JPEG, PNG, WebP. Largest size in the browser: 5 MB. (Cloudinary's own free-plan limit is 10 MB.)
2. The check happens before any network trip, to save the customer's and owner's data.
3. `POST /v1/uploads/sign` is behind login. No login, no permit.
4. Missing Cloudinary settings give 503 `uploads_not_set_up`, never a crash.
5. On a product: `imageUrl` missing = keep the photo, a string = set it (must pass the address check), `null` = remove it.
6. The database refuses any `image_url` that does not start with `https://` (a CHECK rule).

## PRACTICAL EXAMPLE

Mama Njeri taps **Choose photo** in the product form and picks a 2 MB photo of a kitenge dress.
1. The web app checks size and type.
2. It asks `POST /v1/uploads/sign` and receives `{cloudName, apiKey, timestamp, folder, signature}`.
3. It sends the photo plus those values to Cloudinary, which recomputes the signature with its own copy of the secret.
4. Cloudinary returns the photo's `https` address.
5. She saves the product. The API checks the address belongs to her shop's folder, and stores it.
6. Customers now see the photo on her public shop page.

## DECISIONS

- No Cloudinary SDK on the server: Node's built-in `crypto` is enough (one dependency fewer to patch). Only `folder` and `timestamp` are signed.
- One photo per product. A gallery would use the existing `product_media` table later.
- The public shop returns `image_url` on purpose; it is a public link with no secret in it.

## WHERE USED

API: `services/cloudinary.service.js`, `controllers/uploads.controller.js`, `routes/uploads.routes.js`, `controllers/products.controller.js`, `controllers/storefront.controller.js`.
Web: `lib/uploadPhoto.js`, `components/ProductForm.js`, the products list page and the public shop cards.
Tests: `tests/cloudinary.service.test.js`, `tests/isolation/storefront.cross-tenant.test.js`.

## TRADEOFFS

+ Fast, cheap on a free hosting plan, nothing to patch.
- A photo uploaded but never saved on a product stays at Cloudinary (a clean-up job is future work).
- Deleting a product does not delete its photo at Cloudinary yet.
- No upload progress bar yet.
- The size and type checks in the browser are a kindness, not a lock.

## HOW TO USE

Set these three settings on every server that runs the API: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (locally in `apps/api/.env`, on the live site in Render's environment settings). Never commit them.

---

## PIECE BY PIECE (real life, in simple terms)

**makeUploadSignature(tenantId)**  
The manager stamping a permit that says 'this shop may upload into this folder, right now'. The stamp (the secret) never leaves her desk.

**isShopImageUrl(url, tenantId)**  
The guard who checks that a photo slip really came from THIS shop's drawer before it goes on the shelf.

**uploadPhoto.js**  
The runner: walks to our desk for the permit, then carries the photo to the photo store.

**image_url column**  
The line on the product's card where the photo's address is written.

**setImage switch in PATCH**  
Leave the line alone, write a new line, or rub it out.

---

## Before this works on the live site (do not forget)

1. Take a backup of the live database first (`pg_dump`).
2. Apply migration 027 (`products.image_url`) to the Neon database **by hand**. Code deploys automatically from GitHub, but database migrations do not.
3. Add the three `CLOUDINARY_*` settings in Render.
4. Then push the code and test one upload on the live site.
