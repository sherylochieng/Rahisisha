// =============================================================================
// FILE: apps/api/src/controllers/products.controller.js
// (Week 28 products CRUD; Week 30 product photo address added)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   It holds the business logic of the five /v1/products endpoints: list,
//   create, get one, update, delete. Routes only point here; the real work
//   (check the input, talk to the database, answer) happens in this file.
//   Real life: the shopkeeper behind the counter of the "products" stall.
//
// WHY IMPORTANT
//   Products are what a shop sells. Every price, name and photo the customer
//   sees on the shop page started in this file. A bug here means wrong prices
//   or one shop seeing another shop's goods.
//
// DANGER
//   1. Always use req.db, never pool.query. req.db is locked to ONE shop by
//      withTenant + row level security (RLS). pool.query would skip the lock.
//   2. Money is whole cents (KES 350 = 35000). Never floats.
//   3. DELETE is a soft delete (deleted_at). Old orders still point at the row.
//   4. The photo address is only saved after isShopImageUrl() says yes. Never
//      remove that check: it stops a shop saving someone else's photo or a
//      harmful link as its product picture.
//   5. PATCH uses COALESCE ("keep the old value if nothing was sent"), so it
//      cannot clear sku or description. The photo is the exception: it has its
//      own on/off switch (setImage) so it CAN be removed.
//
// WHAT IT SOLVES
//   A safe, validated, tenant-isolated way for the owner to manage products,
//   now including one photo per product.
//
// SYSTEM DESIGN PRINCIPLE
//   Validate at the door (Zod), isolate in the database (RLS), keep the answer
//   shape the same everywhere ({ data, nextCursor, error }).
//
// RULES
//   1. Validate first, then touch the database, then answer.
//   2. 400 validation / 404 not found / 409 duplicate SKU / 201 created /
//      204 deleted.
//   3. List uses cursor paging (WHERE id > cursor), not OFFSET.
//   4. imageUrl: missing = keep, string = set (must be this shop's Cloudinary
//      photo), null = remove.
//
// PRACTICAL EXAMPLE
//   Mama Njeri uploads a photo, then saves the product:
//     POST /v1/products
//     { "name": "Kitenge dress", "priceCents": 250000,
//       "imageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v1/rahisisha/<her shop id>/dress.jpg" }
//     -> 201 { data: { id, name, price_cents, image_url, ... }, error: null }
//   Same request with another shop's photo address -> 400 (imageUrl refused).
//
// WHERE USED
//   Routes:   apps/api/src/routes/products.routes.js
//   Photo check: apps/api/src/services/cloudinary.service.js
//   Web app:  ProductForm (create/edit), products list page
//
// TRADEOFFS
//   + One small file, easy to read, same pattern for every handler.
//   - One photo per product. A gallery would use the product_media table.
//   - We only check the photo ADDRESS, not that the file still exists at
//     Cloudinary.
//   - Deleting a product does not delete its photo at Cloudinary yet.
//
// HOW TO USE
//   Do not import this file anywhere except the routes file. Call the API:
//     GET    /v1/products?limit=10&cursor=<id>
//     POST   /v1/products
//     GET    /v1/products/:id
//     PATCH  /v1/products/:id
//     DELETE /v1/products/:id
//
// PIECE BY PIECE (the photo parts added this week)
//   imageUrl in the Zod shape  = "the form now has a line for the photo
//                                 address; it may be missing, text, or null".
//   refusedImageUrl(...)       = "the guard at the gate: only this shop's own
//                                 photo slips are accepted". If refused it
//                                 already sent the 400 answer, so the handler
//                                 just stops (`return`).
//   image_url in the list      = "the products page can now show each photo".
//   createProduct: imageUrl    = "write the photo address in the new product's
//                                 row; null when no photo".
//   updateProduct: setImage    = "did the caller mention the photo at all?"
//                                 not mentioned -> keep; text -> set; null ->
//                                 remove. Real life: leave the notebook line
//                                 alone / write a new line / rub it out.
//   CASE WHEN $7 THEN $8 ...   = the SQL version of that switch.
//
// -----------------------------------------------------------------------------
// The original Week 28 notes of this file continue below, unchanged.
// -----------------------------------------------------------------------------

// =============================================================
// products.controller.js
// Handles all business logic for the /v1/products endpoints.
//
// PATTERN: This file only does three things per function:
//   1. Validate what came in (req.body / req.params)
//   2. Talk to the database using req.db
//   3. Send a response back
//
// It never touches Express routing — that lives in products.routes.js
// It never uses pool.query — always req.db (tenant isolation)
// =============================================================

import { z } from 'zod';
import { isShopImageUrl } from '../services/cloudinary.service.js';
// Week 30 Day 3 (Batch 4a-1): the category a product is filed under.
import {
  findActiveCategory,
  isCategorySlug,
  listShopCategories,
  hasUncategorisedProducts,
  NO_CATEGORY,
} from '../services/categories.service.js';

// ─── VALIDATION SCHEMAS ───────────────────────────────────────
//
// Zod lets us describe the exact shape of data we expect.
// If the incoming request doesn't match this shape,
// Zod tells us exactly which field failed and why —
// before we ever touch the database.
//
// Think of it as a bouncer at the door:
// wrong shape = turned away with a clear reason.
// ─────────────────────────────────────────────────────────────

const ProductCreate = z.object({
  // name is required — every product must have a name
  name: z.string().min(1),

  // priceCents must be a whole number (integer), never negative
  // We store KES 350 as 35000 cents — never use floats for money
  priceCents: z.number().int().nonnegative(),

  // sku, description, status are all optional
  // .optional() means the field can be missing entirely
  sku:         z.string().optional(),
  description: z.string().optional(),

  // status must be one of these three exact strings — nothing else allowed
  status: z.enum(['draft', 'active', 'archived']).optional(),

  // imageUrl = the web address of the product photo (kept at Cloudinary).
  // - missing  : leave the photo as it is (PATCH) / no photo (create)
  // - a string : set this photo (checked below: must be THIS shop's photo)
  // - null     : remove the photo (PATCH only makes sense)
  imageUrl: z.string().max(500).nullable().optional(),

  // categoryId = which aisle the product is in (Week 30 Day 3, Batch 4a-1).
  //   missing = keep (or none on create), an id = set it, null = remove it.
  // It must be a real, active category (checked in refusedCategory below).
  categoryId: z.string().uuid().nullable().optional(),
});

// ─── VALIDATION ERROR HELPER ──────────────────────────────────
//
// When Zod catches bad input, it gives us a list of issues.
// This helper converts that list into the exact error envelope
// the assignment requires (Task 3):
//
// {
//   error: {
//     code: "validation",
//     message: "Request validation failed",
//     details: {
//       name: "Required",
//       priceCents: "Expected number, received string"
//     }
//   }
// }
//
// We define it once here and reuse it in every handler below.
// That's the DRY principle — Don't Repeat Yourself.
// ─────────────────────────────────────────────────────────────

function validationError(res, zodError) {
  const details = {};

  // zodError.issues is an array — one entry per broken field
  // Each issue has:
  //   issue.path[0]  = the field name e.g. "priceCents"
  //   issue.message  = what was wrong e.g. "Expected number"
  for (const issue of zodError.issues) {
   details[issue.path.join('.')] = issue.message;
  }

  return res.status(400).json({
    error: {
      code:    'validation',
      message: 'Request validation failed',
      details,            // the field-by-field breakdown
    },
  });
}

// ─── PHOTO ADDRESS CHECK HELPER ───────────────────────────────
//
// A photo address is only accepted if it is a Cloudinary address from OUR
// cloud, inside THIS shop's own folder (see cloudinary.service.js).
// Real life: mama mboga only accepts a delivery slip that has HER shop's
// name on it, not a slip from another stall.
// Returns true when the address was refused (and the answer was already sent).
// ─────────────────────────────────────────────────────────────

function refusedImageUrl(req, res, imageUrl) {
  if (imageUrl == null) return false;                 // none / removing: fine
  if (isShopImageUrl(imageUrl, req.tenantId)) return false;
  res.status(400).json({
    error: {
      code:    'validation',
      message: 'Request validation failed',
      details: { imageUrl: 'Not a photo uploaded by this shop' },
    },
  });
  return true;
}

// ─── refusedCategory ──────────────────────────────────────────
// (Week 30 Day 3, Batch 4a-1) A product may only be filed under a category
// that really exists and is switched on. null / not sent = fine.
// Real life: the clerk checks the aisle number on the slip is a real aisle.
// Returns true when the category was refused (and the answer was already sent).
// ─────────────────────────────────────────────────────────────
async function refusedCategory(req, res, categoryId) {
  if (categoryId == null) return false;               // none / removing: fine
  if (await findActiveCategory(req.db, categoryId)) return false;
  res.status(400).json({
    error: {
      code:    'validation',
      message: 'Request validation failed',
      details: { categoryId: 'Unknown category' },
    },
  });
  return true;
}

// =============================================================
// HANDLER: listProducts
// Route:   GET /v1/products
//
// Returns a paginated list of this tenant's products.
//
// CURSOR PAGINATION (not offset):
//   Offset pagination:  SELECT ... LIMIT 10 OFFSET 20
//   Cursor pagination:  SELECT ... WHERE id > $lastSeen LIMIT 10
//
// Why cursor?
//   Offset breaks when rows are inserted mid-pagination.
//   Cursor is stable — it always picks up exactly where you left off.
//   Required by Task 4 of this assignment.
//
// Query params:
//   ?limit=10       how many to return (max 100)
//   ?cursor=<uuid>  the last id seen — start AFTER this
//   ?category=<slug> or ?category=none   (Week 30 Day 3, Batch 4a-3)
//                   only products filed under that aisle, or only products
//                   with no aisle yet. A badly shaped word is a 400.
//
// Each product also carries category_name (null when it has no aisle), so the
// owner's Products page can show the aisle without a second request.
// =============================================================

export async function listProducts(req, res) {
  // Cap limit at 100 — never let a caller fetch 10,000 rows at once
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);

  // cursor is the last id the caller already saw
  // null means "start from the beginning"
  const cursor = req.query.cursor || null;

  // Optional aisle filter. null = no filter. 'none' = products with no aisle.
  // Anything else must be a well-shaped slug; an unused one just finds nothing.
  let category = null;
  if (req.query.category !== undefined && req.query.category !== '') {
    const word = String(req.query.category);
    if (word !== NO_CATEGORY && !isCategorySlug(word)) {
      return res.status(400).json({
        error: {
          code:    'validation',
          message: 'Request validation failed',
          details: { category: 'Invalid category' },
        },
      });
    }
    category = word;
  }

  // We fetch limit + 1 rows on purpose.
  // If we get 11 back when limit=10, there IS a next page.
  // We return only 10 to the caller but use the 11th to set nextCursor.
  //
  // req.db.query — ALWAYS use req.db, never pool.query
  // req.db is set by withTenant middleware to this tenant's scoped connection
  // RLS on the database ensures only this tenant's rows come back
  const { rows } = await req.db.query(
    `SELECT p.id, p.sku, p.name, p.description, p.price_cents, p.status, p.image_url,
            p.category_id, c.name AS category_name, p.created_at
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.deleted_at IS NULL
       AND ($1::uuid IS NULL OR p.id > $1)
       AND ($3::text IS NULL
            OR ($3 = '${NO_CATEGORY}' AND p.category_id IS NULL)
            OR ($3 <> '${NO_CATEGORY}' AND c.slug = $3))
     ORDER BY p.id
     LIMIT $2`,
    [cursor, limit + 1, category]
  );

  // Did we get an extra row? If yes, there are more pages.
  const hasMore = rows.length > limit;

  // Only send the rows the caller asked for (not the extra one)
  const data = hasMore ? rows.slice(0, limit) : rows;

  // nextCursor = the id of the LAST row we're returning
  // The caller sends this back as ?cursor= on their next request
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  res.json({ data, nextCursor, error: null });
}

// =============================================================
// HANDLER: listProductCategories   (Week 30 Day 3, Batch 4a-3)
// Route:   GET /v1/products/categories
//
// The aisles THIS shop's own products are filed under, for the filter buttons
// on the owner's Products page, plus whether any product has no aisle yet.
// Real life: the list of aisle signs the owner needs for their own stockroom.
//
// Answer: { data: { categories: [{ slug, name }], uncategorised: true|false }, error: null }
// (the owner sees drafts and archived products too, unlike the public shop window)
// =============================================================

export async function listProductCategories(req, res) {
  const categories    = await listShopCategories(req.db, { onSaleOnly: false });
  const uncategorised = await hasUncategorisedProducts(req.db);
  res.json({ data: { categories, uncategorised }, error: null });
}

// =============================================================
// HANDLER: createProduct
// Route:   POST /v1/products
//
// Creates a new product for this tenant.
// Validates input with Zod before touching the database.
// =============================================================

export async function createProduct(req, res) {
  // safeParse does NOT throw — it returns { success, data } or { success, error }
  // This is safer than .parse() which throws and crashes if input is wrong
  const result = ProductCreate.safeParse(req.body);

  // If validation failed, send the error envelope and stop here
  // The 'return' is important — without it, the code below would still run
  if (!result.success) return validationError(res, result.error);

  // result.data is the clean, validated input — safe to use
  // Default values: sku=null, description=null, status='draft'
  const {
    name,
    priceCents,
    sku         = null,
    description = null,
    status      = 'draft',
    imageUrl    = null,
    categoryId  = null,
  } = result.data;

  // Refuse a photo address that is not this shop's own photo
  if (refusedImageUrl(req, res, imageUrl)) return;
  // Refuse a category that does not exist or is switched off
  if (await refusedCategory(req, res, categoryId)) return;

  try {
    // RETURNING * tells Postgres to give us back the full created row
    // This saves us doing a second SELECT after the INSERT
    const { rows } = await req.db.query(
      `INSERT INTO products (tenant_id, name, price_cents, sku, description, status, image_url, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.tenantId, name, priceCents, sku, description, status, imageUrl, categoryId]
    );

    // 201 Created — not 200. 201 means "a new thing was created"
    res.status(201).json({ data: rows[0], error: null });

  } catch (err) {
    // Postgres error code 23505 = unique constraint violation
    // Our schema has: UNIQUE (tenant_id, sku) — so duplicate SKU within
    // the same tenant triggers this. Different tenants can share SKUs.
    if (err.code === '23505') {
      return res.status(409).json({
        data: null,
        error: { message: 'Duplicate SKU for this tenant' },
      });
    }

    // For any other unexpected error, rethrow it
    // Express will catch it and return a 500
    throw err;
  }
}

// =============================================================
// HANDLER: getProduct
// Route:   GET /v1/products/:id
//
// Fetches a single product by id.
// Returns 404 if not found OR if soft-deleted.
// =============================================================

export async function getProduct(req, res) {
  // req.params.id = the :id part of the URL
  // AND deleted_at IS NULL — soft-deleted products are invisible
  const { rows } = await req.db.query(
    `SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL`,
    [req.params.id]
  );

  // rows[0] is undefined if nothing matched
  if (!rows[0]) {
    return res.status(404).json({ data: null, error: { message: 'Not found' } });
  }

  res.json({ data: rows[0], error: null });
}

// =============================================================
// HANDLER: updateProduct
// Route:   PATCH /v1/products/:id
//
// Partially updates a product — only the fields sent are changed.
// This is a PATCH (partial update), not a PUT (full replace).
//
// COALESCE($1, name) means:
//   "use $1 if it's not null, otherwise keep the existing value"
// So if the caller only sends { name: "New Name" },
// price_cents and status are untouched.
// =============================================================

export async function updateProduct(req, res) {
  // .partial() makes every field in ProductCreate optional
  // So PATCH can receive any subset of fields
  const result = ProductCreate.partial().safeParse(req.body);
  if (!result.success) return validationError(res, result.error);

  const { name, priceCents, sku, description, status, imageUrl, categoryId } = result.data;

  // Refuse a photo address that is not this shop's own photo
  if (refusedImageUrl(req, res, imageUrl)) return;
  // Refuse a category that does not exist or is switched off
  if (await refusedCategory(req, res, categoryId)) return;

  // The photo is special: COALESCE cannot REMOVE it (null would mean "keep").
  // So we say clearly whether the caller sent imageUrl at all:
  //   not sent       -> keep the current photo
  //   sent a string  -> set it
  //   sent null      -> remove it
  const setImage = imageUrl !== undefined;

  // The category works the same way as the photo (Batch 4a-1):
  //   not sent -> keep, an id -> set it, null -> remove it.
  const setCategory = categoryId !== undefined;

  const { rows } = await req.db.query(
    `UPDATE products
     SET name        = COALESCE($1, name),
         price_cents = COALESCE($2, price_cents),
         sku         = COALESCE($3, sku),
         description = COALESCE($4, description),
         status      = COALESCE($5, status),
         image_url   = CASE WHEN $7::boolean THEN $8::text ELSE image_url END,
         category_id = CASE WHEN $9::boolean THEN $10::uuid ELSE category_id END,
         updated_at  = NOW()
     WHERE id = $6
       AND deleted_at IS NULL
     RETURNING *`,
    // ?? null converts undefined to null so COALESCE works correctly
    // undefined would break the query — null is what Postgres expects
    [name ?? null, priceCents ?? null, sku ?? null, description ?? null, status ?? null, req.params.id, setImage, imageUrl ?? null, setCategory, categoryId ?? null]
  );

  if (!rows[0]) {
    return res.status(404).json({ data: null, error: { message: 'Not found' } });
  }

  res.json({ data: rows[0], error: null });
}

// =============================================================
// HANDLER: deleteProduct
// Route:   DELETE /v1/products/:id
//
// SOFT DELETE — does NOT remove the row from the database.
// Sets deleted_at = NOW() instead.
//
// Why soft delete?
//   Orders reference products. If we hard-deleted a product,
//   every historical order that referenced it would break.
//   Soft delete keeps the row alive for history but hides it
//   from all normal queries (which filter WHERE deleted_at IS NULL)....
// =============================================================

export async function deleteProduct(req, res) {
  const { rows } = await req.db.query(
    // We UPDATE instead of DELETE — this is the soft delete pattern
    `UPDATE products
     SET deleted_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id`,
    [req.params.id]
  );

  // If nothing was returned, the product didn't exist (or was already deleted)
  if (rows.length === 0) {
    return res.status(404).json({ data: null, error: { message: 'Not found' } });
  }

  // 204 No Content — success, but nothing to return
  res.status(204).end();
}