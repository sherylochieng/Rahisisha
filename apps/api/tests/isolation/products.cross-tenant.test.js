// =============================================================================
// products.cross-tenant.test.js — Cross-tenant isolation tests for /v1/products
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Proves that Tenant B can NEVER read, edit or delete Tenant A's products
// - Task 5 of the Day 3 assignment asks for this test on products AND orders.
//   The orders half already exists; this file is the products half
// - Rahisisha is multi-tenant: many shops share ONE database. Isolation is
//   the promise that makes it safe to put your shop on the platform
//
// WHY IT IS IMPORTANT:
// - A product holds a shop's prices, stock and descriptions. That is the
//   shop's business secret (a competitor would love to read it)
// - If isolation breaks, this is a data breach, not just a bug
//
// DANGER — WHAT HAPPENS IF WE DON'T HAVE THIS FILE:
// - Example 1: Someone edits withTenant.js to fix a small bug and accidentally
//   removes the tenant setting. Brian (Brio shop) now sees Amina's products
//   and prices. Nothing crashes. Nothing looks wrong. You never find out
// - Example 2: A migration accidentally turns off RLS on the products table.
//   Every shop can read every other shop's catalogue
// - Example 3: A new developer writes a new products query using pool.query
//   instead of req.db. It skips the tenant check. Data leaks silently
// - Example 4: Brian could change or delete Amina's prices (a WRITE leak).
//   Amina's shop shows wrong prices to customers and she loses money
// - These bugs are SILENT: the API still answers 200 with data. Without this
//   test, the first person to notice is a real shop owner, and by then it is
//   a breach and a loss of trust
//
// WHAT THIS TEST SOLVES:
// - It plays both shop owners on purpose. Amina creates a product, then Brian
//   tries to get it, list it, edit it and delete it. If any answer is ever
//   anything but "not found", this test fails loudly and blocks the bad code
//   before it reaches real users
//
// HOW THIS FILE DIFFERS FROM YOUR OTHER TEST FILES:
// - products.pagination.test.js: ONE tenant, checks that paging works
//   (nothing skipped, nothing repeated). It does not look at other tenants
// - products.isolation.test.js: despite its name, it tests /v1/orders across
//   two tenants (Brio must not see Acme's orders)
// - THIS file: two tenants, but for /v1/products. Same idea as the orders
//   test, for the other resource
// - Rule of thumb: every resource that holds tenant data needs its own
//   isolation test. Products now, orders done, customers next
//
// WHERE THIS FILE LIVES:
// - apps/api/tests/isolation/ (next to the orders isolation test)
// - Jest finds it because its name ends in .test.js inside tests/
//
// SYSTEM DESIGN PRINCIPLE: Trust but verify
// - You wrote the isolation code (withTenant + RLS policies)
// - This test checks, on every run, that it still works
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any multi-tenant SaaS (invoicing, booking, school software, a CRM)
// - Any time two users must never see each other's data, write this test
//
// TRADEOFFS:
// + Catches the most dangerous class of bug (a data breach)
// + Runs against the real database, so it tests what production does
// - Slower than unit tests (real DB and real HTTP requests)
// - Needs at least 2 tenants to exist in the database
//
// HOW TO RUN:
//   cd apps/api
//   npm test
// =============================================================================

// request: supertest. Sends fake HTTP requests to our app without starting a
// real server on port 3000
import request from 'supertest';

// jwt: we SIGN our own fake login tokens with this. requireAuth uses the same
// library to VERIFY them, so our fake tokens are accepted
import jwt     from 'jsonwebtoken';

// dotenv: loads .env so process.env.DATABASE_URL and JWT_SECRET exist here
import dotenv  from 'dotenv';

// pg: PostgreSQL client. We use it for test setup and cleanup
import pg      from 'pg';

// app: the Express app WITHOUT app.listen(), so importing it does not start
// a server or cause a port conflict
import app     from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

// Load the .env file into process.env (must run before we read process.env)
dotenv.config();

// Pool manages a set of reusable database connections
const { Pool } = pg;

// testPool: a SEPARATE pool just for test setup and cleanup.
// It is not the app's pool. It connects as rahisisha_user, so RLS applies to
// it too (that is why cleanup needs deleteAsTenant below)
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// These are filled in once, in beforeAll, then shared by all tests
let acmeTenantId;   // real UUID of the first tenant (Amina's shop)
let brioTenantId;   // real UUID of the second tenant (Brian's shop)
let acmeCookie;     // fake login for Acme
let brioCookie;     // fake login for Brio
let acmeProductId;  // the product Acme creates, which Brio will try to attack

// ─── HELPER 1: makeCookie ────────────────────────────────────────────────────
// WHAT: builds a fake but VALID login cookie for a given tenant
// WHY:  tests must pretend to be a logged-in shop owner
// HOW:  sign a token with the same JWT_SECRET that requireAuth checks.
//       The field names (user_id, tenant_id, role) must match what
//       requireAuth reads. The cookie name "token" matches req.cookies.token
function makeCookie(tenantId, userId = 1, role = 'owner') {
  const token = jwt.sign(
    { user_id: userId, tenant_id: tenantId, role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }          // long enough for the tests to finish
  );
  return `token=${token}`;       // the format a browser sends automatically
}

// ─── HELPER 2: deleteAsTenant ────────────────────────────────────────────────
// WHAT: runs a cleanup query WITH the tenant context set
// WHY:  testPool connects as rahisisha_user, so RLS applies. With no tenant
//       set it sees ZERO rows, so a plain DELETE silently deletes nothing
//       and test data piles up between runs
// HOW:  BEGIN opens a transaction, set_config(..., true) sets the tenant for
//       that transaction only, we run the query, then COMMIT saves it.
//       On any error we ROLLBACK, and finally we always give the connection
//       back to the pool (otherwise the pool slowly runs out of connections)
async function deleteAsTenant(tenantId, sql, params = []) {
  const client = await testPool.connect();      // borrow one connection
  try {
    await client.query('BEGIN');                // start the transaction
    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]                                // `true` is correct here
    );                                          // because a transaction is open
    await client.query(sql, params);            // the actual cleanup query
    await client.query('COMMIT');               // save it
  } catch (err) {
    await client.query('ROLLBACK');             // undo everything on failure
    throw err;                                  // still report the error
  } finally {
    client.release();                           // ALWAYS return the connection
  }
}

// ─── SETUP ───────────────────────────────────────────────────────────────────

// beforeAll: runs ONCE before any test in this file
// WHAT: finds two real tenants, makes a login for each, and has Acme create
//       one product for Brio to try to attack
// WHY:  every test needs the same starting situation, so we build it once
beforeAll(async () => {
  // Get the first 2 tenants. ORDER BY created_at gives the same two each time.
  // The tenants table has no RLS, so testPool can read it directly
  const result = await testPool.query(
    'SELECT id FROM tenants ORDER BY created_at LIMIT 2'
  );

  // Safety check: isolation cannot be proved with fewer than 2 tenants
  if (result.rows.length < 2) {
    throw new Error('Need at least 2 tenants in the database.');
  }

  // Keep the real UUIDs for the cookies and for cleanup
  acmeTenantId = result.rows[0].id;   // first tenant  = Acme (Amina)
  brioTenantId = result.rows[1].id;   // second tenant = Brio (Brian)

  // One fake login per tenant
  acmeCookie = makeCookie(acmeTenantId);
  brioCookie = makeCookie(brioTenantId);

  // Acme creates ONE product through the real API.
  // We use the API (not a direct INSERT) so this also exercises auth + tenant
  // handling the way production does
  const res = await request(app)
    .post('/v1/products')
    .set('Cookie', acmeCookie)        // logged in as Acme
    .send({ name: 'Test Product Cross Tenant', priceCents: 12000 });

  // If creation fails, stop right away with a clear reason, instead of
  // confusing failures in every test below
  expect(res.status).toBe(201);

  // Save its ID. Every test below needs it
  acmeProductId = res.body.data.id;
});

// afterAll: runs ONCE after all tests in this file finish
// WHAT: deletes the product we created, then closes the test pool
// WHY:  leftover test data breaks other tests (like the pagination counts),
//       and an open pool stops Jest from exiting cleanly
afterAll(async () => {
  await deleteAsTenant(
    acmeTenantId,
    "DELETE FROM products WHERE name = 'Test Product Cross Tenant'"
  );
  await testPool.end();
  await pool.end();
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('Cross-tenant isolation — /v1/products', () => {

  // TEST 1: the main one (Task 5). Brian guesses or finds Amina's product ID.
  // It does not matter HOW he got it. He must never get the data
  test('Brio cannot fetch an Acme product by ID — gets 404', async () => {
    const res = await request(app)
      .get(`/v1/products/${acmeProductId}`)
      .set('Cookie', brioCookie);               // logged in as Brio

    // WHAT SHOULD HAPPEN: withTenant scopes the connection to Brio, RLS hides
    // Acme's row, the SELECT finds nothing, the controller returns 404
    // WHAT MUST NOT HAPPEN: 200 here would be a data breach
    expect(res.status).toBe(404);
  });

  // TEST 2: Brian lists ALL his products. Amina's must not be among them
  test('Brio product list never contains the Acme product', async () => {
    const res = await request(app)
      .get('/v1/products?limit=100')
      .set('Cookie', brioCookie);

    expect(res.status).toBe(200);

    // Collect just the IDs Brio can see
    const ids = res.body.data.map((p) => p.id);

    // Acme's ID must not appear anywhere in the list
    expect(ids).not.toContain(acmeProductId);
  });

  // TEST 3: a WRITE attack. Brian tries to change Amina's product.
  // Without isolation he could change her prices
  test('Brio cannot update an Acme product — gets 404', async () => {
    const res = await request(app)
      .patch(`/v1/products/${acmeProductId}`)
      .set('Cookie', brioCookie)
      .send({ name: 'Hacked by Brio' });

    // RLS hides the row, so the UPDATE matches nothing and the API says 404
    expect(res.status).toBe(404);
  });

  // TEST 4: another WRITE attack. Brian tries to delete Amina's product
  test('Brio cannot delete an Acme product — gets 404', async () => {
    const res = await request(app)
      .delete(`/v1/products/${acmeProductId}`)
      .set('Cookie', brioCookie);

    expect(res.status).toBe(404);
  });

  // TEST 5: Amina can still see her own product, and it is untouched.
  // WHY THIS TEST EXISTS: tests 1-4 return 404, which could also mean "the
  // product is gone". This proves the product exists and the attacks changed
  // nothing. Brian just cannot see it.
  // It runs last on purpose, after all the attacks above
  test('Acme can still fetch her own product, unchanged', async () => {
    const res = await request(app)
      .get(`/v1/products/${acmeProductId}`)
      .set('Cookie', acmeCookie);               // logged in as Acme

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(acmeProductId);

    // The name is still the original, so the "Hacked by Brio" edit failed
    expect(res.body.data.name).toBe('Test Product Cross Tenant');
  });
});