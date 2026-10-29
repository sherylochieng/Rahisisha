// =============================================================================
// error-handling.test.js — Proves the API answers errors instead of hanging
// =============================================================================
//
// WHAT THIS FILE TESTS:
// - Malformed IDs (like "not-a-uuid") get a clean 400 answer
// - Unknown order statuses get a 400 answer, not a confusing 409
// - A valid-looking ID that does not exist gets a 404
// - After many failing requests, the API still works (no leaked connections)
//
// WHY THIS FILE EXISTS:
// - Proves the asyncHandler + central error handler (in app.js) work
// - Before them, a database error inside an async controller made the request
//   hang forever and the pooled DB connection was never given back
//
// WHY IT IS IMPORTANT:
// - This is the kind of bug that does not show up in normal use. It shows up
//   when someone sends a bad request, and then it can freeze the API for
//   EVERY shop sharing it
//
// DANGER — WHAT HAPPENS IF WE DON'T HAVE THIS FILE:
// - Example 1: A customer's phone app has a bug and sends /v1/orders/undefined.
//   Each request leaks one connection. After 20 of them the pool is empty and
//   every shop on the platform gets timeouts
// - Example 2: Someone removes asyncHandler from one route while "cleaning up".
//   Nothing looks different until a bad request arrives in production
// - Example 3: The error handler is accidentally moved ABOVE the routes in
//   app.js. Express then never calls it, and nothing tells you
//
// WHAT THIS TEST SOLVES:
// - It sends deliberately bad requests and checks that every one gets a quick,
//   clean answer. The last test sends more bad requests than the pool has
//   connections (20), then checks a normal request still works. That is the
//   proof that connections are being given back
//
// HOW THIS FILE DIFFERS FROM THE OTHER TEST FILES:
// - products.pagination.test.js: does paging work?
// - products.isolation.test.js: can Brio see Acme's orders?
// - products.cross-tenant.test.js: can Brio see Acme's products?
// - THIS file: when things go wrong, does the API stay healthy?
//
// WHERE THIS FILE LIVES:
// - apps/api/tests/errors/ (a new folder: errors are a different concern
//   from isolation and pagination)
//
// SYSTEM DESIGN PRINCIPLE: Fail loudly, recover quietly
// - Bad input is answered with a clear 4xx and the system keeps serving
//   everyone else
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any API with a connection pool: always test that errors release connections
// - Any Express 4 project that uses async/await in its controllers
//
// TRADEOFFS:
// + Catches connection leaks and hangs before real users do
// + Runs against the real database, so it behaves like production
// - Sends many requests, so it is a little slower than other tests
//
// HOW TO RUN:
//   cd apps/api
//   npm test
// =============================================================================

// ─── IMPORTS ─────────────────────────────────────────────────────────────────

// request: supertest. Sends fake HTTP requests straight into our Express app
// without starting a real server on port 3000. Example:
//   await request(app).get('/health')   // behaves like a real browser request
import request from 'supertest';

// jwt: we SIGN our own fake login tokens with this. requireAuth uses the same
// library to VERIFY tokens, so our fake tokens are accepted as real logins
import jwt     from 'jsonwebtoken';

// dotenv: loads the .env file so process.env.DATABASE_URL and
// process.env.JWT_SECRET exist inside the test
import dotenv  from 'dotenv';

// pg: the PostgreSQL client. We use it for one tiny setup query below
import pg      from 'pg';

// app: the Express app WITHOUT app.listen(). Importing it does not start a
// server, so there is no port conflict. This is why app.js and index.js are
// separate files
import app     from '../../src/app.js';

// pool: the APP'S own connection pool. We import it ONLY so we can close it in
// afterAll. An open pool keeps Node alive, which causes Jest to print
// "Jest did not exit one second after the test run has completed"
import { pool } from '../../src/db/pool.js';

// ─── SETUP VALUES ────────────────────────────────────────────────────────────

// Load the .env file into process.env. Must run before reading process.env
dotenv.config();

// Pool is the class that manages a set of reusable database connections
const { Pool } = pg;

// testPool: a SEPARATE pool used only by this test file to look up a tenant ID.
// It is not the app's pool, so it cannot disturb the connections the app uses
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Will hold the fake login cookie. Filled in once, in beforeAll
let acmeCookie;

// MISSING_ID: a correctly FORMATTED UUID that no product or order owns.
// Postgres accepts it as valid and simply finds nothing, which gives a 404.
// Used to prove "bad format" and "does not exist" are different cases
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

// BAD_ID: a MALFORMED id. Postgres cannot read it as a UUID and throws error
// code 22P02. Our error handler in app.js turns that into a 400
const BAD_ID = 'not-a-uuid';

// ─── HELPER: makeCookie ──────────────────────────────────────────────────────
// WHAT: builds a fake but VALID login cookie for a given tenant
// WHY:  every /v1/products and /v1/orders route needs a login, and tests have
//       to pretend to be a logged-in shop owner
// HOW:  sign a token with the same JWT_SECRET that requireAuth checks. The
//       field names (user_id, tenant_id, role) must match what requireAuth
//       reads. The cookie name "token" matches req.cookies.token
function makeCookie(tenantId, userId = 1, role = 'owner') {
  const token = jwt.sign(
    { user_id: userId, tenant_id: tenantId, role },   // the data inside the token
    process.env.JWT_SECRET,                           // the secret that signs it
    { expiresIn: '1h' }                               // long enough for the tests
  );
  return `token=${token}`;      // the format a browser sends in the Cookie header
}

// ─── SETUP AND TEARDOWN ──────────────────────────────────────────────────────

// beforeAll: Jest runs this ONCE before any test in this file.
// WHAT: finds the first tenant and builds a login cookie for it
// WHY:  all tests below need a logged-in user. These tests create no data, so
//       there is nothing to clean up afterwards
beforeAll(async () => {
  // The tenants table has no RLS, so testPool can read it directly
  const result = await testPool.query(
    'SELECT id FROM tenants ORDER BY created_at LIMIT 1'
  );

  // Safety check: with no tenants, the fake login would be meaningless
  if (result.rows.length === 0) {
    throw new Error('No tenants found. Run your seed script first.');
  }

  // Make the login cookie from the real tenant UUID
  acmeCookie = makeCookie(result.rows[0].id);
});

// afterAll: Jest runs this ONCE after every test in this file finishes.
// WHAT: closes both database pools
// WHY:  open pools keep the Node process alive, so Jest would not exit cleanly
afterAll(async () => {
  await testPool.end();   // our setup pool
  await pool.end();       // the app's pool
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

// describe: groups related tests under one name in the Jest output
describe('Error handling — the API answers instead of hanging', () => {

  // TEST 1: malformed product ID on a READ
  // SCENARIO: someone asks for /v1/products/not-a-uuid
  // BEFORE THE FIX: Postgres threw, nothing answered, the request hung
  // NOW: the error goes to the central handler, which answers 400
  test('GET /v1/products/:id with a malformed ID returns 400', async () => {
    const res = await request(app)
      .get(`/v1/products/${BAD_ID}`)
      .set('Cookie', acmeCookie);

    // The HTTP status code must be 400 (bad request)
    expect(res.status).toBe(400);

    // The body must use our standard error shape: { error: { code, ... } }
    expect(res.body.error.code).toBe('validation');
  });

  // TEST 2: malformed order ID on a READ
  // Same idea as test 1, for the orders resource. Orders and products have
  // separate controllers, so each needs its own proof
  test('GET /v1/orders/:id with a malformed ID returns 400', async () => {
    const res = await request(app)
      .get(`/v1/orders/${BAD_ID}`)
      .set('Cookie', acmeCookie);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation');
  });

  // TEST 3: malformed ID on a WRITE (status update)
  // Writes go through a different controller function (updateOrderStatus), so
  // a read test does not prove writes are safe. The status "paid" is valid, so
  // the failure here comes from the bad ID reaching the database query
  test('PATCH /v1/orders/:id with a malformed ID returns 400', async () => {
    const res = await request(app)
      .patch(`/v1/orders/${BAD_ID}`)
      .set('Cookie', acmeCookie)
      .send({ status: 'paid' });          // .send() puts this in req.body

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation');
  });

  // TEST 4: malformed ID on a DELETE
  // Another controller function (deleteProduct), so another test
  test('DELETE /v1/products/:id with a malformed ID returns 400', async () => {
    const res = await request(app)
      .delete(`/v1/products/${BAD_ID}`)
      .set('Cookie', acmeCookie);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation');
  });

  // TEST 5: an unknown status is a validation error (400), NOT a state-machine
  // conflict (409). This checks the Object.hasOwn fix in updateOrderStatus.
  // MISSING_ID is well-formed, and the status is checked BEFORE any database
  // query runs, so the response does not depend on an order existing
  test('PATCH /v1/orders/:id with an unknown status returns 400', async () => {
    const res = await request(app)
      .patch(`/v1/orders/${MISSING_ID}`)
      .set('Cookie', acmeCookie)
      .send({ status: 'bananas' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation');
  });

  // TEST 6: the CONTROL. A well-formed ID that does not exist is a normal 404.
  // WHY THIS TEST EXISTS: without it, a lazy handler that answered 400 for
  // EVERYTHING would pass tests 1 to 5. This proves the 400 is specifically
  // about a malformed ID, not about every missing record
  test('GET /v1/products/:id with a missing (but valid) ID returns 404', async () => {
    const res = await request(app)
      .get(`/v1/products/${MISSING_ID}`)
      .set('Cookie', acmeCookie);

    expect(res.status).toBe(404);
  });

  // TEST 7: THE PROOF that connections are released.
  // THE IDEA: the app pool holds at most 20 connections (max: 20 in pool.js).
  //   If a failed request kept its connection (the old bug), 20 failures would
  //   empty the pool, and request number 21 would wait forever.
  // THE TEST: send 25 failing requests in a row (more than the pool size),
  //   then make one normal request. If it still succeeds, every failed request
  //   gave its connection back. This is the real proof
  test('25 failing requests do not exhaust the pool; a normal request still works', async () => {
    // We loop one request at a time (await inside the loop) so each request
    // finishes before the next starts. Any leak would add up predictably
    for (let i = 0; i < 25; i++) {
      const bad = await request(app)
        .get(`/v1/orders/${BAD_ID}`)
        .set('Cookie', acmeCookie);

      // Each one must answer quickly with 400, never hang
      expect(bad.status).toBe(400);
    }

    // One healthy request AFTER all the failures
    const ok = await request(app)
      .get('/v1/products?limit=1')
      .set('Cookie', acmeCookie);

    // If this is 200, the pool still had a connection to give. Nothing leaked
    expect(ok.status).toBe(200);
  });
});