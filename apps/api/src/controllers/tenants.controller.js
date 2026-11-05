// =============================================================================
// tenants.controller.js — "which shop has this address word?"
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Every shop has an address word (the slug): skirt-shirt.localhost:3001
// - The website's gate guard (proxy.js) reads that word and needs to know
//   which shop it belongs to. The website has no database, so it asks this
//   endpoint: GET /v1/tenants/by-slug/:slug
//
// WHY IMPORTANT:
// - It is how an address turns into a shop. Without it the website cannot
//   tell Amina's visit from Brian's
//
// DANGER (if this file does not exist):
// - The gate guard cannot look anything up. Either every address is "not
//   found", or someone is tempted to give the website database access
//
// WHAT IT SOLVES:
// - Returns the shop's id, name and slug for an address word
// - Returns 404 for a word that is not a shop, or a shop that is not active
//
// SYSTEM DESIGN PRINCIPLE: Give out the least information that does the job
// - We return only id, name and slug. Never plan, status, dates or anything
//   else. The gate guard only needs to know "which shop"
//
// RULES (never break these):
// - This is the ONE endpoint that is public on purpose. Never add anything
//   private to its answer
// - Validate the word BEFORE touching the database
// - Only active shops are found. Suspended and deleted shops look like they
//   do not exist
// - This file uses pool.query, which is normally forbidden. It is allowed here
//   ONLY because the tenants table has no tenant_id and no RLS: it IS the list
//   of shops, and nobody is logged in yet. Never copy this to a tenant table
//
// -----------------------------------------------------------------------------
// DECISIONS WE MADE (and why)
// -----------------------------------------------------------------------------
// 1. A bad word and a missing shop both give the SAME 404
//    - We do not say "invalid format" versus "no such shop". One answer means
//      we leak nothing, and the gate guard handles only one case
//
// 2. Only status = 'active' shops are returned
//    - A suspended or deleted shop must not get a working address
//
// 3. The answer uses the same envelope as the other endpoints
//    - { data, error }, so the website reads every response the same way
//
// 4. The id is returned although it is an internal id
//    - A shop id is not a secret. The real protection is the login token and
//      the database lock: knowing a shop's id lets nobody read its data
//
// -----------------------------------------------------------------------------
// PRACTICAL EXAMPLES — where to use this file and how
// -----------------------------------------------------------------------------
// EXAMPLE 1: the gate guard (proxy.js) calls it
//   const res = await fetch(`${API_URL}/tenants/by-slug/${slug}`);
//   if (!res.ok) → send the visitor to /not-found
//
// EXAMPLE 2: trying it by hand in the browser
//   http://localhost:3000/v1/tenants/by-slug/skirt-shirt
//   → {"data":{"id":"...","name":"skirt Shirt","slug":"skirt-shirt"},"error":null}
//
// EXAMPLE 3: a word that is not a shop
//   http://localhost:3000/v1/tenants/by-slug/nonsense
//   → 404 {"data":null,"error":{"message":"Shop not found"}}
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any app where each customer gets an address: yourshop.shopify.com,
//   yourcompany.slack.com. This is the lookup behind that address
//
// TRADEOFFS:
// + Simple, fast (slug has an index), no login needed
// - Anyone can test whether a shop name exists. That is already visible to
//   anyone who types the address, so it leaks nothing new. Rate limiting is a
//   good later addition
//
// HOW TO USE:
// - Mounted PUBLIC in app.js (no requireAuth, no withTenant):
//     app.use('/v1/tenants', tenantsRouter)
// =============================================================================

// pool: the shared database connection pool. See the RULES note above for why
// pool is allowed in this one file
import { pool } from '../db/pool.js';

// SLUG_PATTERN: what a valid address word looks like.
//   ^ and $                  = the whole word must match, not just part of it
//   [a-z0-9]                 = starts with a lowercase letter or a number
//   ([a-z0-9-]{0,61}[a-z0-9])? = then letters, numbers or hyphens, and it must
//                              END with a letter or number (no trailing hyphen)
// 63 letters is the longest a web address word may be
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// -----------------------------------------------------------------------------
// getTenantBySlug — handles GET /v1/tenants/by-slug/:slug
// -----------------------------------------------------------------------------
export async function getTenantBySlug(req, res) {

  // The address word from the URL (the :slug part)
  const slug = req.params.slug;

  // Step 1: is it even shaped like an address word?
  // If not, answer 404 without asking the database (Decision 1)
  if (!SLUG_PATTERN.test(slug)) {
    return res.status(404).json({ data: null, error: { message: 'Shop not found' } });
  }

  // Step 2: look the shop up. $1 is filled safely with the slug, so a
  // sneaky word can never change the query. We select only what the gate guard
  // needs (the "least information" principle) and only active shops (Decision 2)
  const { rows } = await pool.query(
    `SELECT id, name, slug
     FROM tenants
     WHERE slug = $1 AND status = 'active'`,
    [slug]
  );

  // Step 3: nothing found? Same 404 as a bad word (Decision 1)
  if (!rows[0]) {
    return res.status(404).json({ data: null, error: { message: 'Shop not found' } });
  }

  // Step 4: found it. Send back the shop (Decision 3)
  res.json({ data: rows[0], error: null });
}