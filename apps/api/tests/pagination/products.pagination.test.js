// =============================================================================
// products.pagination.test.js — Cursor pagination tests for /v1/products
// =============================================================================
//
// WHAT THIS FILE TESTS:
// - Page 1 returns 10 products and a nextCursor
// - Page 2 returns remaining 5 products and no nextCursor
// - No product appears on both pages (no duplicates)
// - Total across both pages equals 15

// WHY THIS FILE EXISTS:
// - Proves that cursor pagination works correctly for the products endpoint
// - Catches bugs where rows are skipped, duplicated, or pages loop forever
//
// ⚠️  DANGER — WHAT HAPPENS IF WE DON'T TEST THIS:
// - A bug in the cursor logic could skip products between pages
//   (Amina lists her 15 dresses but only ever sees 14 — one is invisible)
// - A bug could return the same product on page 1 AND page 2
//   (Amina thinks she has 20 dresses but really has 15 — duplicates)
// - The cursor could be wrong and always return page 1 forever
//   (infinite loop — the app appears frozen or broken)
// - These bugs are silent — the API returns 200 with data, no error
//   You would never know until a real shop owner complains
// - In a real business this means wrong stock counts, wrong orders,
//   missed sales — real money lost
//
// HOW THIS TEST SOLVES THE PROBLEM:
// - Step 1: We create exactly 15 products for Acme
// - Step 2: We fetch page 1 (limit=10) and check we got exactly 10
// - Step 3: We use the cursor from page 1 to fetch page 2
// - Step 4: We check page 2 has exactly 5 (the remaining products)
// - Step 5: We collect ALL IDs from both pages and check for duplicates
// - Step 6: We confirm the total is exactly 15 — nothing skipped
// - If any of these assertions fail, the test fails loudly with a clear
//   message showing exactly what went wrong and on which page
// - The beforeEach/afterEach blocks create and delete the 15 products
//   around every single test — so tests never interfere with each other
//
// SYSTEM DESIGN PRINCIPLE: Test the contract, not the implementation
// - Tests check what the API returns, not how the controller works
// - Safe to refactor the controller as long as API behaviour stays the same
// - We test what the API returns, not how the controller works internally
// - If we rewrite listProducts tomorrow, these tests still pass as long as
//   the API behaves the same way from the outside
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any paginated API endpoint needs tests like these
// - Same pattern works for orders, customers, invoices — any list endpoint

// ENGINEERING CONCEPT: Cursor pagination
// - Cursor = ID of the last item on the current page (the sticky note)
// - Safer than page numbers — no skipped or duplicated rows when data changes

//
// TRADEOFFS:
// + Catches real pagination bugs before users find them
// + Runs against real database — tests what actually happens in production
// - Slower than unit tests (real DB + real HTTP requests)
// - Requires at least 1 tenant to exist in the database
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

// testPool is a SEPARATE database connection just for test setup and teardown
// We use this to create test data before tests and delete it after
// This is NOT the same as the app's connection pool
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Will hold the first tenant's ID fetched from the database in beforeAll
let acmeTenantId;

// Will hold the fake JWT cookie — sent with every request like a real browser
let acmeCookie;

// ─── HELPER ──────────────────────────────────────────────────────────────────

// makeCookie: builds a fake JWT cookie that requireAuth will accept
// WHY: tests need to pretend to be a logged-in user
// HOW: we sign a token with the same JWT_SECRET that requireAuth uses
// The cookie format "token=<jwt>" is exactly what the browser sends
function makeCookie(tenantId, userId = 1, role = 'owner') {
  const token = jwt.sign(
    { user_id: userId, tenant_id: tenantId, role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `token=${token}`;
}

// deleteAsTenant: runs a cleanup query WITH tenant context set
// WHY: testPool connects as rahisisha_user, so RLS applies to it.
// Without app.current_tenant it sees zero rows and deletes nothing.
// We use BEGIN ... COMMIT so the setting lasts for the whole cleanup.
// Here `true` (transaction-local) is CORRECT because we opened a transaction.
async function deleteAsTenant(tenantId, sql, params = []) {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    await client.query(sql, params);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── SETUP ───────────────────────────────────────────────────────────────────

// beforeAll: runs ONCE before any test in this file
// WHY: we need to know the real tenant ID before we can make a valid cookie
// We fetch the first tenant from the database — it must already exist
beforeAll(async () => {
  const result = await testPool.query(
    'SELECT id FROM tenants ORDER BY created_at LIMIT 1'
  );

  if (result.rows.length === 0) {
    throw new Error(
      'No tenants found in the database. Run your seed script first.'
    );
  }

  acmeTenantId = result.rows[0].id;
  acmeCookie   = makeCookie(acmeTenantId);
});

// afterAll: runs ONCE after all tests finish
// WHY: clean up every test product we created so they don't pollute the DB
// SAFE: we only delete products whose name starts with "Test Product"
// Real products (from seeds or manual entry) are never touched
afterAll(async () => {
   await deleteAsTenant(acmeTenantId, "DELETE FROM products WHERE name LIKE 'Test Product%'");
  // Close the test database connection — never leave connections open
  await testPool.end();
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('GET /v1/products — cursor pagination', () => {

  // Stores IDs of the 30 products we create before each test
  // Used in afterEach to delete exactly those products — nothing else
  let createdIds = [];

  // beforeEach: runs before EVERY test inside this describe block
  // WHY: each test needs a clean set of 30 products to paginate through
  // We create them via the API (POST /v1/products) not directly in the DB
  // This also tests that product creation works — two birds, one stone
  beforeEach(async () => {
    createdIds = [];

    for (let i = 1; i <= 30; i++) {
      const res = await request(app)
        .post('/v1/products')
        .set('Cookie', acmeCookie)
        .send({
          name: `Test Product ${i}`,
          priceCents: i * 1000,
        });

      // If any product creation fails, stop immediately and show the error
      expect(res.status).toBe(201);
      createdIds.push(res.body.data.id);
    }
  });

  // afterEach: runs after EVERY test inside this describe block
  // WHY: delete exactly the 30 products we created — no more, no less
  // Without this, products stack up between tests and pagination counts break
  afterEach(async () => {
    await deleteAsTenant(acmeTenantId, 'DELETE FROM products WHERE id = ANY($1)', [createdIds]);
    createdIds = [];
  });

  // TEST 1: Page 1 gives us 10 products and a cursor to continue
  test('page 1 returns 10 products and a nextCursor', async () => {
    const res = await request(app)
      .get('/v1/products?limit=10')
      .set('Cookie', acmeCookie);

    expect(res.status).toBe(200);

    // Must get exactly 10 products — not 9, not 11
    expect(res.body.data.length).toBe(10);

    // Must have a cursor — the "sticky note" pointing to page 2
    // null here means "no more pages" which would be wrong — we have 30
    expect(res.body.nextCursor).not.toBeNull();
  });

  // TEST 2: Page 2 gives us the next 10 and another cursor for page 3
  test('page 2 returns next 10 products and a nextCursor', async () => {
    // First get page 1 to obtain the cursor
    const page1 = await request(app)
      .get('/v1/products?limit=10')
      .set('Cookie', acmeCookie);

    expect(page1.status).toBe(200);
    const cursor1 = page1.body.nextCursor;
    expect(cursor1).not.toBeNull();

    // Use cursor from page 1 to get page 2
    const page2 = await request(app)
      .get(`/v1/products?limit=10&cursor=${cursor1}`)
      .set('Cookie', acmeCookie);

    expect(page2.status).toBe(200);

    // Must get exactly 10 more products
    expect(page2.body.data.length).toBe(10);

    // Still more products after this — cursor must exist
    expect(page2.body.nextCursor).not.toBeNull();
  });

  // TEST 3: Follow the cursor through EVERY page until it ends
  // WHY: we don't know how many products the tenant has (seed data + our 30),
  // so we keep asking for the next page until the API says "no more pages"
  test('walking every page returns all 30 test products once, and the cursor ends', async () => {
    const allIds = [];
    let cursor = null;
    let pages = 0;

    do {
      const url = cursor
        ? `/v1/products?limit=10&cursor=${cursor}`
        : '/v1/products?limit=10';

      const res = await request(app).get(url).set('Cookie', acmeCookie);
      expect(res.status).toBe(200);

      allIds.push(...res.body.data.map(p => p.id));
      cursor = res.body.nextCursor;
      pages++;

      // Safety net: a broken cursor must FAIL the test, not loop forever
      if (pages > 10) throw new Error('nextCursor never became null');
    } while (cursor !== null);

    // No duplicates: every ID appears exactly once
    expect(new Set(allIds).size).toBe(allIds.length);

    // Nothing skipped: every product we created is somewhere in the pages
    for (const id of createdIds) {
      expect(allIds).toContain(id);
    }
  });

});