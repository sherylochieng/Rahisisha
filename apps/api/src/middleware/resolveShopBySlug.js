// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/middleware/resolveShopBySlug.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The public shop page has no login. A customer just opens
//   brio-hardware.rahisishabiashara.com. So the API needs another way to
//   know WHICH shop is meant. This guard reads the shop word (the slug)
//   from the URL, finds that shop, and stamps its id on the request
//   (req.tenantId). The next guard, withTenant, then locks the database
//   to that one shop.
//
// WHY IMPORTANT
//   Everything after this guard trusts req.tenantId. If it picked the
//   wrong shop, the public page would show the wrong shop's goods.
//
// DANGER (what breaks without it)
//   - Without it the public page would have to skip the database lock
//     (pool.query on products). One missing WHERE and every shop's
//     products leak to every visitor.
//
// WHAT IT SOLVES
//   "Public page, many shops": the shop is found from the address word,
//   and the database lock (RLS) still protects everything after it.
//
// SYSTEM DESIGN PRINCIPLE
//   "Stamp, then lock." Same pattern as login (requireAuth, withTenant)
//   and USSD (resolveUssdTenant, withTenant). Identity is resolved once,
//   early, in one place. The database lock is the second wall.
//   Also: "Public endpoints expose the minimum." This guard only ever
//   puts the shop's name and slug on the request.
//
// RULES (never break these)
//   1. Only ACTIVE shops are found. A suspended shop looks like it does
//      not exist.
//   2. A badly shaped word and a missing shop give the SAME 404 and the
//      same message, so nobody can learn which shop names exist beyond
//      what the address already shows.
//   3. Validate the word BEFORE touching the database.
//   4. This file may use pool.query ONLY because the tenants table has
//      no tenant_id and no RLS: it IS the list of shops. Never copy
//      this to a tenant table.
//   5. Set req.tenantId from the tenants table only, never from the
//      query string or the body.
//
// PRACTICAL EXAMPLES
//   GET /v1/storefront/brio-hardware         -> req.tenantId = Brio's id
//   GET /v1/storefront/nobody                -> 404 Shop not found
//   GET /v1/storefront/BAD_WORD!             -> 404 Shop not found
//   (suspended shop) /v1/storefront/old-shop -> 404 Shop not found
//
// DECISIONS
//   - The slug rule is the same one tenants.controller.js uses
//     (lowercase letters, numbers, hyphens, up to 63 characters, no
//     hyphen at either end).
//   - Errors go to next(err), because Express 4 does not catch errors
//     from async functions on its own.
//   - The 404 body is { data: null, error: { message: 'Shop not found' } },
//     the same as /v1/tenants/by-slug, so the website handles one shape.
//
// WHERE YOU WILL USE THIS
//   app.js: app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant,
//   storefrontRouter). Later: any other public page that belongs to one
//   shop (a "contact us" form, an order tracking page).
//
// TRADEOFFS
//   + One small guard; the lock after it does the heavy protecting.
//   - One extra database query per visit (the shop lookup). Fine now;
//     later cache slug -> id in memory.
//   - Anyone can test whether a shop word exists. The address already
//     shows that, so nothing new leaks.
//
// HOW TO USE
//   router: app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant, router)
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request (follow-up to Week 29 Day 4).
//   Declared in docs/AI_AUDIT_week_29_day4.md.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. SLUG_PATTERN = "IS THIS EVEN SHAPED LIKE A SHOP WORD?"
//    Real life: a bouncer glances at a ticket. Torn, wrong colour, or
//    written in crayon? Turned away without anyone checking the guest list.
//    Where: first line of the guard. When: every request.
//
// 2. notFound(res) = "ONE POLITE NO"
//    Real life: the receptionist always says "no such shop" in the same
//    words, whether the word was nonsense or the shop was closed.
//
// 3. The SELECT = "LOOK IN THE SHOP LIST"
//    Real life: checking the street directory. We ask only for id, name
//    and slug (the least that does the job), and only for status 'active'.
//    $1 is a safe slot, so a sneaky word can never change the query.
//
// 4. req.tenantId and req.shop = "STICK THE SHOP'S NAME TAG ON THE REQUEST"
//    req.tenantId is for withTenant (the lock). req.shop is for the
//    controller (to show the shop's name).
//
// 5. next() / next(err) = "PASS IT ON"
//    Success goes to withTenant. A crash goes to the central error handler.
// ═══════════════════════════════════════════════════════════

import { pool } from '../db/pool.js';

// What a valid shop word looks like. ^ and $ mean the WHOLE word must match.
// Starts and ends with a lowercase letter or number; hyphens allowed inside.
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// One answer for every kind of "no": bad word, no such shop, closed shop
function notFound(res) {
  return res.status(404).json({ data: null, error: { message: 'Shop not found' } });
}

export async function resolveShopBySlug(req, res, next) {
  try {
    // The :slug part of the URL
    const slug = req.params.slug;

    // Wrong shape: say no without asking the database
    if (!SLUG_PATTERN.test(slug)) return notFound(res);

    // Find the active shop with this word
    const { rows } = await pool.query(
      `SELECT id, name, slug
         FROM tenants
        WHERE slug = $1 AND status = 'active'`,
      [slug]
    );
    if (!rows[0]) return notFound(res);

    // Stamp the shop on the request, then pass it to withTenant
    req.tenantId = rows[0].id;
    req.shop = { name: rows[0].name, slug: rows[0].slug };
    return next();
  } catch (err) {
    return next(err);
  }
}