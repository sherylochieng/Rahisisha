// =============================================================================
// dashboard.controller.js — the numbers shown on the dashboard home page
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - When a shop owner logs in, the first screen should answer three questions:
//     1. How many orders did I get today?
//     2. How much money is in my wallet?
//     3. What are my newest products?
// - The web page cannot touch the database (that is the API's job), so it asks
//   one endpoint: GET /v1/dashboard. This file is that endpoint
//
// WHY IMPORTANT:
// - It is the first thing every owner sees. If the numbers are wrong, or worse,
//   belong to another shop, the owner stops trusting the product
// - One request gives the page everything, instead of three separate requests
//
// DANGER (if this file does not exist):
// - The page would need its own database access, or three separate calls,
//   and it would be easy to forget the tenant lock on one of them
// - Or the page would show empty boxes and fake numbers
//
// WHAT IT SOLVES:
// - Real numbers on the dashboard, always for the logged-in shop only
// - A single, fast summary that the web page can show in one go
//
// SYSTEM DESIGN PRINCIPLE: One request per screen, and the database keeps the lock
// - A screen should ask once, not three times (fewer round trips, faster page)
// - Every query goes through req.db, the tenant-scoped connection. We never
//   write "WHERE tenant_id = ..." by hand: Row Level Security does it, so we
//   cannot forget it
//
// RULES (never break these):
// - Never use pool.query here. Always req.db
// - Never read a shop id from the URL, the body or a header the user can set.
//   The shop comes from the signed login token, through withTenant
// - Money stays in whole cents here. The web page turns cents into KES
// - This file never decides who may log in. requireAuth does that, before us
//
// -----------------------------------------------------------------------------
// DECISIONS WE MADE (and why)
// -----------------------------------------------------------------------------
// 1. ONE endpoint, not three
//    - Fewer requests, one place for the lock. The cost: if one number is slow,
//      the whole page waits. For three small queries this is fine
//
// 2. "Today" means Nairobi time, not the server's clock
//    - A server abroad could think it is still yesterday while it is already
//      morning in Nairobi. We say 'Africa/Nairobi' in the query so an order at
//      12:30 AM counts as today
//
// 3. "Today's orders" counts every order created today
//    - That includes cancelled ones. It is the simplest honest definition:
//      "orders that came in today". If the owner would rather hide cancelled
//      orders, it is a one-line change: add  AND status <> 'cancelled'
//
// 4. No "WHERE tenant_id = ..." in the queries
//    - RLS already hides other shops' rows. Adding it by hand would be a
//      second, forgettable copy of the same rule
//
// 5. COUNT comes back from Postgres as TEXT, so we wrap it in Number()
//    - Otherwise "7" + 1 becomes "71". The same trap as the wallet balance
//
// 6. The answer is wrapped as { data: ... }
//    - The same envelope the other endpoints use, so the web page handles all
//      responses in one way
//
// 7. The balance comes from balance() in wallet.service.js, not a new query
//    - One rule for "how a balance is counted", in one place. The dashboard
//      and the wallet page can never disagree
//
// 8. "Latest 5 products" means the 5 newest that are not deleted
//    - We hide soft-deleted products (deleted_at IS NOT NULL), exactly like
//      the products list does. Drafts and archived ones are included, and
//      each row carries its status so the page can label it
//    - Rows keep the database's names (price_cents, created_at), the same
//      shape GET /v1/products already returns
//
// -----------------------------------------------------------------------------
// PRACTICAL EXAMPLES — where to use this file and how
// -----------------------------------------------------------------------------
// EXAMPLE 1: the dashboard home page asks for it
//   const res  = await fetch(`${API_URL}/v1/dashboard`, { credentials: 'include' });
//   const json = await res.json();
//   // json.data.ordersToday  → 7
//   credentials: 'include' sends the login cookie. Without it requireAuth
//   answers 401 "Not logged in"
//
// EXAMPLE 2: trying it by hand (after logging in, in the same browser)
//   Open  http://localhost:3000/v1/dashboard  → you see the JSON answer
//
// EXAMPLE 3: what the answer looks like
//   { "data": { "ordersToday": 7,
//               "balanceCents": 350000,
//               "latestProducts": [
//                 { "id": "...", "name": "Dress", "price_cents": 250000,
//                   "status": "active", "created_at": "2026-11-05T09:12:00Z" }
//               ] } }
//   A brand-new shop gets:
//   { "data": { "ordersToday": 0, "balanceCents": 0, "latestProducts": [] } }
//
// EXAMPLE 4: a test for it (later)
//   Log in as Acme, create 2 orders, call GET /v1/dashboard, expect
//   ordersToday to be 2. Log in as Brio: expect 0, not 2. That second check is
//   the isolation proof for this endpoint
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any SaaS "home screen": an invoicing app (unpaid invoices today), a school
//   system (students present today), a clinic (appointments today), a shop
// - The pattern is always: one summary endpoint, a few counts and totals,
//   every query through the tenant-scoped connection
//
// TRADEOFFS:
// + One request, one lock, easy to test
// - The page gets all three numbers or none (one error hides everything)
// - Queries run one after the other, because one database connection handles
//   one query at a time. Fine now; very large tables might need indexes or
//   caching later (created_at is already indexed on orders and products)
//
// HOW TO USE:
// - Mounted in app.js:  app.use('/v1/dashboard', requireAuth, withTenant, ...)
// - Called by the dashboard page with the login cookie
// =============================================================================

// balance: your Day 4 function. It adds up every line in the wallet ledger and
// returns a number in cents. We pass it req.db, so it only sees this shop's lines
import { balance } from '../services/wallet.service.js';

// -----------------------------------------------------------------------------
// getDashboard — handles GET /v1/dashboard
// req = the incoming request. req.db is the tenant-scoped database connection
// res = the response we send back
// -----------------------------------------------------------------------------
export async function getDashboard(req, res) {

  // ---------------------------------------------------------------------------
  // QUESTION 1: how many orders were made TODAY (Nairobi time)?
  //
  // Reading the WHERE line from the inside out:
  //   now() AT TIME ZONE 'Africa/Nairobi'   = the clock time in Nairobi right now
  //   date_trunc('day', ...)                = cut it back to midnight today
  //   AT TIME ZONE 'Africa/Nairobi'         = turn that midnight back into a real
  //                                           moment, so it can be compared with
  //                                           created_at
  // So the whole line means: "created at or after midnight in Nairobi".
  //
  // There is no tenant filter on purpose: RLS only lets this shop's orders
  // through (Decision 4)
  // ---------------------------------------------------------------------------
  const ordersResult = await req.db.query(
    `SELECT COUNT(*) AS count
     FROM orders
     WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi')
                         AT TIME ZONE 'Africa/Nairobi'`
  );

  // COUNT comes back from Postgres as text, so turn it into a real number
  // (Decision 5). rows[0] is the single result row; .count is the column name
  // we chose with "AS count"
  const ordersToday = Number(ordersResult.rows[0].count);

  // ---------------------------------------------------------------------------
  // QUESTION 2: how much money is in this shop's wallet?
  //
  // We do NOT write a new SUM here. balance() already knows the rule (the
  // ledger total, in cents), so the dashboard can never disagree with the
  // wallet (Decision 7). It returns a plain number, so no conversion is needed
  // ---------------------------------------------------------------------------
  const balanceCents = await balance(req.db);

  // ---------------------------------------------------------------------------
  // QUESTION 3: what are the 5 newest products?
  //
  // Reading the query:
  //   SELECT id, name, ...        = only the columns the dashboard card needs
  //   WHERE deleted_at IS NULL    = skip soft-deleted products (Decision 8)
  //   ORDER BY created_at DESC    = newest first
  //   LIMIT 5                     = never more than five rows
  // Again no tenant filter: RLS does it (Decision 4)
  // ---------------------------------------------------------------------------
  const productsResult = await req.db.query(
    `SELECT id, name, price_cents, status, created_at
     FROM products
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 5`
  );

  // .rows is already a list of plain objects. An empty list means "no products
  // yet", which the page can show as a friendly "Add your first product" message
  const latestProducts = productsResult.rows;

  // ---------------------------------------------------------------------------
  // THE ANSWER: all three questions in one packet, wrapped in { data: ... }
  // (Decision 6). Money is still in whole cents (Rules)
  // ---------------------------------------------------------------------------
  res.json({ data: { ordersToday, balanceCents, latestProducts } });
}