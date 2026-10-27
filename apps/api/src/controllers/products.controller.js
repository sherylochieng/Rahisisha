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
    details[issue.path[0]] = issue.message;
  }

  return res.status(400).json({
    error: {
      code:    'validation',
      message: 'Request validation failed',
      details,            // the field-by-field breakdown
    },
  });
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
// =============================================================

export async function listProducts(req, res) {
  // Cap limit at 100 — never let a caller fetch 10,000 rows at once
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);

  // cursor is the last id the caller already saw
  // null means "start from the beginning"
  const cursor = req.query.cursor || null;

  // We fetch limit + 1 rows on purpose.
  // If we get 11 back when limit=10, there IS a next page.
  // We return only 10 to the caller but use the 11th to set nextCursor.
  //
  // req.db.query — ALWAYS use req.db, never pool.query
  // req.db is set by withTenant middleware to this tenant's scoped connection
  // RLS on the database ensures only this tenant's rows come back
  const { rows } = await req.db.query(
    `SELECT id, sku, name, description, price_cents, status, created_at
     FROM products
     WHERE deleted_at IS NULL
       AND ($1::uuid IS NULL OR id > $1)
     ORDER BY id
     LIMIT $2`,
    [cursor, limit + 1]
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
// HANDLER: createProduct
// Route:   POST /v1/products
//
// Creates a new product for this tenant.
// Validates input with Zod before touching the database.
// =============================================================

export async function createProduct(req, res) {
  // safeParse