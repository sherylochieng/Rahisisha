// =============================================================================
// products.isolation.test.js — Cross-tenant isolation tests for /v1/products
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Proves that Tenant B can NEVER see Tenant A's products
// - This is the most important test in the whole project
// - Rahisisha is a multi-tenant SaaS — data leaking between tenants
//   is a data breach, not just a bug
//
// SYSTEM DESIGN PRINCIPLE: Trust but verify
// - You wrote the isolation code (withTenant middleware + PostgreSQL RLS)
// - This test verifies it actually works every single time you push code
// - If someone accidentally breaks withTenant, this test catches it
//   before it reaches real users
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every multi-tenant SaaS needs isolation tests like these
// - Same pattern works for orders, customers, invoices
// - Any time two users should NOT see each other's data, write this test
//
// TRADEOFFS:
// + Catches the most dangerous class of bug (data breach)
// + Runs on every push — automated safety net
// - Requires at least 2 tenants in the database
// - Slower than unit tests (real DB + real HTTP)

// WHY THIS FILE EXISTS:
// - Proves that Tenant B can NEVER see Tenant A's products
// - This is the most important test in the whole project
// - Rahisisha is a multi-tenant SaaS — data leaking between tenants
//   is a data breach, not just a bug
//
// ⚠️  DANGER — WHAT HAPPENS IF WE DON'T TEST THIS:
// - You change one line in withTenant.js (maybe fixing something else)
// - RLS accidentally gets disabled in a migration
// - A new developer joins and doesn't understand the isolation pattern
// - Any of these could silently break tenant isolation
// - Without this test, you would never know until a REAL user reports
//   that they can see another shop's products, orders, or customers
// - By then it is a data breach — you could lose users, fail your
//   capstone, or in a real company face legal consequences
// - This test is your automated security guard — it runs on every push
//   and catches the breach BEFORE it reaches real users
//
// HOW THIS TEST SOLVES THE PROBLEM:
// - Step 1: Acme creates a product → we save its ID
// - Step 2: Brio tries to fetch that exact product by ID
// - Step 3: We assert Brio gets 404 — not 200
// - If isolation breaks and Brio gets 200, the test FAILS loudly
//   with a clear message: "Expected 404 but received 200"
// - That failure stops your CI pipeline and blocks the bad code
//   from ever reaching production
// - The third test (Acme can still see their own product) rules out
//   a false pass — maybe we returned 404 because the product was
//   deleted, not because of isolation. This third test proves
//   the product exists — Brio just can't see it.

//
// HOW TO RUN:
//   cd apps/api
//   npm test
// =============================================================================

// =============================================================================
// orders.isolation.test.js — Cross-tenant isolation tests for /v1/orders
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Proves that Tenant B can NEVER see Tenant A's orders
// - Orders contain customer phone numbers, amounts, and purchase history
//   — this data is even more sensitive than products
// - A data leak here means Brian can see Amina's customers and sales
//
// ⚠️  DANGER — WHAT HAPPENS IF WE DON'T TEST THIS:
// - Someone changes one line in withTenant.js
// - RLS gets accidentally disabled in a migration
// - Brian can now see every order Amina has ever received
//   — customer names, phone numbers, amounts paid
// - That is a serious data breach and a violation of user trust
// - This test is your automated guard — it runs on every push
//   and catches the breach BEFORE it reaches real users
//
// HOW THIS TEST SOLVES THE PROBLEM:
// - Step 1: Acme creates an order → we save its ID
// - Step 2: Brio tries to fetch that exact order by ID
// - Step 3: We assert Brio gets 404 — not 200
// - Step 4: We confirm Acme can still see their own order
//   (proves 404 is isolation, not deletion)
//
// SYSTEM DESIGN PRINCIPLE: Trust but verify
// - We wrote the isolation code (withTenant + RLS)
// - This test verifies it works for orders, not just products
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every resource in a multi-tenant SaaS needs an isolation test
// - Products ✅  Orders ✅  Customers → next
//
// TRADEOFFS:
// + Catches the most dangerous class of bug (data breach)
// + Confirms isolation works across ALL resource types, not just products
// - Requires at least 2 tenants in the database
// - Order creation is complex (needs customer + product) — setup is longer
//
// HOW TO RUN:
//   cd apps/api
//   npm test
// =============================================================================

 //request: supertest — sends fake HTTP requests to our app without
// starting a real server on port 3000
import request from 'supertest';

// jwt: we use this to SIGN our own fake tokens for tests
// Same library that requireAuth uses to VERIFY tokens
// We sign with the same secret, so requireAuth accepts our fake tokens
import jwt from 'jsonwebtoken';

// dotenv: loads .env file so process.env.DATABASE_URL and JWT_SECRET
// are available in the test environment
import dotenv from 'dotenv';

// pg: PostgreSQL client — we use this to connect directly to the database
// for test setup (creating data) and teardown (deleting data)
// This is SEPARATE from the app's connection pool
import pg from 'pg';

// app: the Express app WITHOUT the server start
// This is why we created app.js — we can import it here without
// triggering app.listen() and causing a port conflict
import app from '../../src/app.js';

// Load environment variables from .env into process.env
dotenv.config();

// Destructure Pool from the pg library
// Pool manages a set of database connections we can reuse
const { Pool } = pg;

// testPool: our own direct database connection for setup and teardown ONLY
// WHY separate from the app's pool?
// The app's pool uses RLS (Row Level Security) scoped to a tenant
// We need an UNSCOPED connection to create and delete test data freely
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// These variables are declared here (outside tests) so ALL tests can use them
// They are filled in beforeAll() once the database is queried
let acmeTenantId; // The real UUID of Acme tenant from the database
let brioTenantId; // The real UUID of Brio tenant from the database

// These are the fake login cookies
// Format: "token=<jwt>" — exactly what a browser sends automatically
let acmeCookie; // Amina's login — scoped to Acme
let brioCookie;  // Brian's login — scoped to Brio

// acmeProductId: every order needs a product to reference
// We create one product in beforeAll and reuse it for every order test
let acmeProductId;

// ─── HELPER ──────────────────────────────────────────────────────────────────

// makeCookie: creates a fake but VALID JWT cookie
// WHY: tests need to pretend to be logged in as a specific tenant
// HOW:
//   1. We sign a JWT with user_id, tenant_id, role inside
//   2. We use the same JWT_SECRET that requireAuth uses to verify
//   3. requireAuth reads this cookie, verifies it, and sets req.tenantId
//   4. withTenant then scopes the DB connection to that tenant
// RESULT: the entire auth + isolation pipeline runs exactly as in production
function makeCookie(tenantId, userId = 1, role = 'owner') {
  const token = jwt.sign(
    // PAYLOAD: what goes inside the token
    // These exact field names match what requireAuth reads:
    // decoded.user_id → req.userId
    // decoded.tenant_id → req.tenantId
    // decoded.role → req.role
    { user_id: userId, tenant_id: tenantId, role },

    // SECRET: must match process.env.JWT_SECRET in requireAuth
    // If they don't match, requireAuth rejects with 401
    process.env.JWT_SECRET,

    // OPTIONS: token expires in 1 hour — long enough for tests to finish
    { expiresIn: '1h' }
  );

  // Return the cookie string in the format the browser sends
  // "token=eyJhbGci..." — the name "token" matches req.cookies.token in requireAuth
  return `token=${token}`;
}

// ─── SETUP ───────────────────────────────────────────────────────────────────

// beforeAll: runs ONCE before ANY test in this file starts
// WHY: we need real tenant IDs and a real product before tests can run
// Think of this as "opening the restaurant before customers arrive"
beforeAll(async () => {

  // Query the database for the first 2 tenants
  // ORDER BY created_at ensures we always get the same 2 tenants
  // These tenants must already exist — created by your migrations/seed script
  const result = await testPool.query(
    'SELECT id FROM tenants ORDER BY created_at LIMIT 2'
  );

  // Safety check: if fewer than 2 tenants exist, the isolation test
  // cannot run — we need 2 separate tenants to prove isolation
  if (result.rows.length < 2) {
    throw new Error(
      'Need at least 2 tenants in the database. Run your seed script first.'
    );
  }

  // Store the real UUIDs — these are used in makeCookie and in assertions
  acmeTenantId = result.rows[0].id; // First tenant = Acme (Amina)
  brioTenantId = result.rows[1].id; // Second tenant = Brio (Brian)

  // Create fake login cookies for each tenant
  acmeCookie = makeCookie(acmeTenantId);
  brioCookie  = makeCookie(brioTenantId);

  // Create one product for Acme — every order needs a product_id
  // We create it once here and reuse it in every test via acmeProductId
  const productRes = await request(app)
    .post('/v1/products')
    .set('Cookie', acmeCookie) // logged in as Acme
    .send({ name: 'Test Product For Orders', priceCents: 50000 });

  // If product creation fails, all order tests will fail too
  // Better to know here immediately than to get confusing errors later
  expect(productRes.status).toBe(201);
  acmeProductId = productRes.body.id;
});

// afterAll: runs ONCE after ALL tests in this file finish
// WHY: clean up everything we created so the database stays tidy
// "closing the restaurant after all customers leave"
afterAll(async () => {
  // Delete the product we created in beforeAll
  await testPool.query(
    "DELETE FROM products WHERE name = 'Test Product For Orders'"
  );

  // Delete any test orders — orders created during tests
  await testPool.query(
    "DELETE FROM orders WHERE id IN (SELECT id FROM orders LIMIT 100)"
  );

  // ALWAYS close the database connection when done
  // Leaving connections open causes the test process to hang and never exit
  await testPool.end();
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('Cross-tenant isolation — /v1/orders', () => {

  // acmeOrderId: stores the ID of the order Acme creates before each test
  // Brio will try to fetch this exact order — they must always get 404
  let acmeOrderId;

  // beforeEach: runs before EVERY test inside this describe block
  // WHY: each test needs a fresh order to attempt to steal
  // We create a new order before each test so they don't interfere
  beforeEach(async () => {
    const res = await request(app)
      .post('/v1/orders')
      .set('Cookie', acmeCookie) // Amina creates the order
      .send({
        // customer: the person who placed the order
        // phone is required and must be unique per tenant
        customer: { phone: '+254700000001', name: 'Test Customer' },

        // items: list of products in the order
        // product_id references the product we created in beforeAll
        items: [{ product_id: acmeProductId, quantity: 1 }],

        // channel: how the order came in (whatsapp/web/ussd)
        channel: 'web',
      });

    // If order creation fails, stop and show the error immediately
    expect(res.status).toBe(201);

    // Save the order ID so tests can reference it
    acmeOrderId = res.body.id;
  });

  // afterEach: runs after EVERY test inside this describe block
  // WHY: delete Acme's order so the next test starts with a clean slate
  // Without this, orders stack up and the customer phone UNIQUE constraint
  // would fail on the second test (same phone number already exists)
  afterEach(async () => {
    await testPool.query(
      'DELETE FROM orders WHERE id = $1',
      [acmeOrderId]
    );
  });

  // TEST 1: The most important test — Brian tries to steal Amina's order
  test('Brio cannot fetch Acme order by ID — gets 404', async () => {
    // Brian uses Amina's order ID — maybe he guessed it, maybe he found it
    // It does not matter HOW he got it — he must NEVER get the data
    const res = await request(app)
      .get(`/v1/orders/${acmeOrderId}`)
      .set('Cookie', brioCookie); // logged in as Brio (Brian)

    // WHAT SHOULD HAPPEN:
    // withTenant sets Brio's tenant_id on the DB connection
    // RLS policy: "only show rows where tenant_id = app.tenant_id"
    // Acme's order has Acme's tenant_id — invisible to Brio's connection
    // Controller does SELECT ... WHERE id = $1 — finds nothing — returns 404

    // WHAT MUST NOT HAPPEN:
    // 200 = Brio can see Amina's order = DATA BREACH

    expect(res.status).toBe(404);
  });

  // TEST 2: Brian lists ALL his orders — Amina's must never appear
  test('Brio order list never contains Acme orders', async () => {
    const res = await request(app)
      .get('/v1/orders')
      .set('Cookie', brioCookie); // logged in as Brio

    expect(res.status).toBe(200);

    // Extract just the IDs from Brio's order list
    const ids = res.body.data.map(o => o.id);

    // Acme's order ID must not be anywhere in this list
    // toContain checks the whole array — fails if it finds the ID anywhere
    expect(ids).not.toContain(acmeOrderId);
  });

  // TEST 3: Amina can still see her own order — proves isolation not deletion
  // WHY THIS TEST EXISTS:
  // Without it, we could pass test 1 by DELETING the order instead of hiding it
  // This test confirms the order DOES exist — Brio just cannot see it
  test('Acme can still fetch their own order', async () => {
    const res = await request(app)
      .get(`/v1/orders/${acmeOrderId}`)
      .set('Cookie', acmeCookie); // logged in as Acme (Amina)

    // Amina must always be able to see her own orders
    expect(res.status).toBe(200);

    // And it must be the exact same order we created
    expect(res.body.id).toBe(acmeOrderId);
  });

});