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
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Will hold the first tenant's ID from the database
let acmeTenantId;

// Will hold the fake JWT cookie for Acme
let acmeCookie;

// ─── HELPER ──────────────────────────────────────────────────────────────────

// Builds a fake JWT cookie — same format as a real login
// tenant_id and user_id go inside the token, just like requireAuth expects
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
  // Fetch the first tenant from the database
  // This tenant must already exist — created by migrations or seed script
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

afterAll(async () => {
  // Clean up only the test products we created
  // Real products are safe — we only delete names starting with "Test Product"
  await testPool.query(
    "DELETE FROM products WHERE name LIKE 'Test Product%'"
  );
  await testPool.end();
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('GET /v1/products — cursor pagination', () => {

  // IDs of the 15 products we create for each test
  let createdIds = [];

  // Create 15 products before each test
  beforeEach(async () => {
    createdIds = [];

    for (let i = 1; i <= 15; i++) {
      const res = await request(app)
        .post('/v1/products')
        .set('Cookie', acmeCookie)
        .send({
          name: `Test Product ${i}`,
          priceCents: i * 1000,
        });

      expect(res.status).toBe(201);
      createdIds.push(res.body.id);
    }
  });

  // Delete the 15 products after each test so they don't stack up
  afterEach(async () => {
    await testPool.query(
      'DELETE FROM products WHERE id = ANY($1)',
      [createdIds]
    );
    createdIds = [];
  });

  test('page 1 returns 10 products and a nextCursor', async () => {
    const res = await request(app)
      .get('/v1/products?limit=10')
      .set('Cookie', acmeCookie);

    expect(res.status).toBe(200);

    // Must get exactly 10 products
    expect(res.body.data.length).toBe(10);

    // Must have a cursor — without it there is no way to get page 2
    expect(res.body.nextCursor).not.toBeNull();
  });

  test('page 2 returns remaining 5 products and no nextCursor', async () => {
    // Step 1: get page 1 to obtain the cursor
    const page1 = await request(app)
      .get('/v1/products?limit=10')
      .set('Cookie', acmeCookie);

    expect(page1.status).toBe(200);
    const cursor = page1.body.nextCursor;
    expect(cursor).not.toBeNull();

    // Step 2: use the cursor to get page 2
    const page2 = await request(app)
      .get(`/v1/products?limit=10&cursor=${cursor}`)
      .set('Cookie', acmeCookie);

    expect(page2.status).toBe(200);

    // Remaining 5 products
    expect(page2.body.data.length).toBe(5);

    // No more pages after this
    expect(page2.body.nextCursor).toBeNull();
  });

  test('no product appears on both pages', async () => {
    const page1 = await request(app)
      .get('/v1/products?limit=10')
      .set('Cookie', acmeCookie);

    const page2 = await request(app)
      .get(`/v1/products?limit=10&cursor=${page1.body.nextCursor}`)
      .set('Cookie', acmeCookie);

    const page1Ids = page1.body.data.map(p => p.id);
    const page2Ids = page2.body.data.map(p => p.id);

    // Any ID on both pages = pagination bug
    const duplicates = page1Ids.filter(id => page2Ids.includes(id));
    expect(duplicates).toHaveLength(0);

    // Total across both pages must be 15
    expect(page1Ids.length + page2Ids.length).toBe(15);
  });

});