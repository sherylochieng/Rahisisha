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
  await testPool.query(
    "DELETE FROM products WHERE name LIKE 'Test Product%'"
  );
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
      createdIds.push(res.body.id);
    }
  });

  // afterEach: runs after EVERY test inside this describe block
  // WHY: delete exactly the 30 products we created — no more, no less
  // Without this, products stack up between tests and pagination counts break
  afterEach(async () => {
    await testPool.query(
      'DELETE FROM products WHERE id = ANY($1)',
      [createdIds]
    );
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

  // TEST 3: Page 3 gives us the final 10 and NO cursor (we are done)
  test('page 3 returns final 10 products and no nextCursor', async () => {
    // Get page 1
    const page1 = await request(app)
      .get('/v1/products?limit=10')
      .set('Cookie', acmeCookie);

    // Get page 2 using cursor from page 1
    const page2 = await request(app)
      .get(`/v1/products?limit=10&cursor=${page1.body.nextCursor}`)
      .set('Cookie', acmeCookie);

    // Get page 3 using cursor from page 2
    const page3 = await request(app)
      .get(`/v1/products?limit=10&cursor=${page2.body.nextCursor}`)
      .set('Cookie', acmeCookie);

    expect(page3.status).toBe(200);

    // Final 10 products
    expect(page3.body.data.length).toBe(10);

    // No more pages — nextCursor must be null
    // If it is not null here, the pagination never ends — infinite loop bug
    expect(page3.body.nextCursor).toBeNull();
  });

  // TEST 4: No product appears on more than one page — no duplicates
  test('no product appears on multiple pages — no duplicates, total is 30', async () => {
    // Fetch all 3 pages
    const page1 = await request(app)
      .get('/v1/products?limit=10')
      .set('Cookie', acmeCookie);

    const page2 = await request(app)
      .get(`/v1/products?limit=10&cursor=${page1.body.nextCursor}`)
      .set('Cookie', acmeCookie);

    const page3 = await request(app)
      .get(`/v1/products?limit=10&cursor=${page2.body.nextCursor}`)
      .set('Cookie', acmeCookie);

    // Collect IDs from all 3 pages
    const page1Ids = page1.body.data.map(p => p.id);
    const page2Ids = page2.body.data.map(p => p.id);
    const page3Ids = page3.body.data.map(p => p.id);

    // Check every possible overlap — any duplicate = pagination bug
    const duplicates = [
      ...page1Ids.filter(id => page2Ids.includes(id)),
      ...page1Ids.filter(id => page3Ids.includes(id)),
      ...page2Ids.filter(id => page3Ids.includes(id)),
    ];
    expect(duplicates).toHaveLength(0);

    // Total across all 3 pages must be exactly 30 — nothing skipped
    expect(page1Ids.length + page2Ids.length + page3Ids.length).toBe(30);
  });

});