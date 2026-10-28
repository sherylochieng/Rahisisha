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

import request from 'supertest';
import jwt     from 'jsonwebtoken';
import dotenv  from 'dotenv';
import pg      from 'pg';
import app     from '../../src/app.js';

dotenv.config();

const { Pool } = pg;
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Two tenants — Acme (Amina's dress shop) and Brio (Brian's electronics shop)
let acmeTenantId;
let brioTenantId;

// A fake login cookie for each tenant
let acmeCookie;
let brioCookie;

// ─── HELPER ──────────────────────────────────────────────────────────────────

// Builds a fake JWT cookie — same format as a real login
// This is exactly what requireAuth reads and verifies
function makeCookie(tenantId, userId = 1, role = 'owner') {
  const token = jwt.sign(
    { user_id: userId, tenant_id: tenantId, role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `token=${token}`;
}

// ─── SETUP ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Fetch TWO tenants from the database
  // Both must already exist — created by migrations or seed script
  const result = await testPool.query(
    'SELECT id FROM tenants ORDER BY created_at LIMIT 2'
  );

  if (result.rows.length < 2) {
    throw new Error(
      'Need at least 2 tenants in the database to run isolation tests. ' +
      'Run your seed script first.'
    );
  }

  acmeTenantId = result.rows[0].id;
  brioTenantId = result.rows[1].id;

  // Make a fake login cookie for each tenant
  acmeCookie = makeCookie(acmeTenantId);
  brioCookie  = makeCookie(brioTenantId);
});

afterAll(async () => {
  // Clean up only test products we created
  await testPool.query(
    "DELETE FROM products WHERE name LIKE 'Test Product%'"
  );
  await testPool.end();
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('Cross-tenant isolation — /v1/products', () => {

  // Acme's product ID — Brio will try to steal this
  let acmeProductId;

  // Acme creates one product before each test
  beforeEach(async () => {
    const res = await request(app)
      .post('/v1/products')
      .set('Cookie', acmeCookie)
      .send({
        name: 'Test Product Isolation',
        priceCents: 99900,
      });

    expect(res.status).toBe(201);
    acmeProductId = res.body.id;
  });

  // Clean up Acme's product after each test
  afterEach(async () => {
    await testPool.query(
      'DELETE FROM products WHERE id = $1',
      [acmeProductId]
    );
  });

  test('Brio cannot fetch Acme product by ID — gets 404', async () => {
    // Brian knows the product ID — maybe he guessed it, maybe he saw it
    // It does not matter — he must NEVER get Amina's data
    const res = await request(app)
      .get(`/v1/products/${acmeProductId}`)
      .set('Cookie', brioCookie);

    // 404 = product does not exist IN BRIO'S SCOPE
    // RLS hides Acme's rows completely from Brio's connection
    // If this returns 200 — data breach. Isolation is broken.
    expect(res.status).toBe(404);
  });

  test('Brio product list never contains Acme products', async () => {
    // Even listing ALL products must never leak Acme's data
    const res = await request(app)
      .get('/v1/products')
      .set('Cookie', brioCookie);

    expect(res.status).toBe(200);

    const ids = res.body.data.map(p => p.id);

    // Acme's product ID must not appear anywhere in Brio's list
    expect(ids).not.toContain(acmeProductId);
  });

  test('Acme can still fetch their own product — isolation not deletion', async () => {
    // This confirms the product exists — we are returning 404 to Brio
    // because of isolation, not because we deleted the product
    const res = await request(app)
      .get(`/v1/products/${acmeProductId}`)
      .set('Cookie', acmeCookie);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(acmeProductId);
  });

});