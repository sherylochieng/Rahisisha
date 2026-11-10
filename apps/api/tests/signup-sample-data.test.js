// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/signup-sample-data.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Proves that every NEW shop gets exactly 3 sample products
//   and 2 sample customers at signup, and that each shop gets
//   its OWN copies.
//
// WHAT IT TESTS
//   1. A new shop sees exactly 3 sample products (via the API)
//   2. A new shop has exactly 2 sample customers (via the
//      database, because there is no customers endpoint yet)
//   3. A second shop gets its own 3 products, with no clash on
//      the repeated SKUs and no leak between the two shops
//
// WHY IMPORTANT
//   Seeding runs inside signup. If it breaks, signup breaks for
//   EVERY new customer. This test is the alarm for that.
//
// DANGER (what breaks without it)
//   - Someone edits the seed lists or the SQL and new shops
//     silently get 2 products, or none.
//   - A change to the SKU rule makes the second shop's signup
//     fail with a duplicate error.
//   - A bug writes the samples to the wrong shop (a leak).
//
// WHAT IT SOLVES
//   The happy-path tests prove signup works. This one proves
//   what signup LEAVES BEHIND in the new shop.
//
// SYSTEM DESIGN PRINCIPLE
//   "Test the side effects, not just the reply." Signup says
//   201 either way. The real question is: what is in the shop
//   afterwards? Also: tenant isolation applies to seed data too.
//
// RULES (never do this)
//   1. NEVER read tenant tables without stamping the tenant
//      first (set_config). Row-level security would return 0
//      rows and the test would pass or fail for the wrong reason.
//   2. NEVER leave a transaction open. Our helper always ends
//      with ROLLBACK (we only read).
//   3. NEVER hard-code a phone number. Use a unique one per run.
//   4. NEVER skip pool.end() in afterAll, or the test hangs.
//   5. NEVER edit a test just to make it pass. Ask first: is the
//      test wrong, or is the code wrong?
//
// PRACTICAL EXAMPLE
//   Amina signs up. GET /v1/products returns her 3 samples.
//   Wanjiru signs up a minute later. She also gets 3 samples
//   with the SAME SKUs (SAMPLE-1, 2, 3), because SKUs only have
//   to be unique inside one shop.
//
// DECISIONS
//   - Products: checked through the real API, end to end.
//   - Customers: checked in the database with the tenant stamp,
//     the same pattern the isolation tests use.
//   - Two shops are created once in beforeAll and shared by the
//     three tests, so the file stays fast.
//   - The expected values are written out in full in this file
//     (not imported from the service). Otherwise a mistake in
//     the service would also change the test, and nothing would
//     fail.
//
// WHERE YOU WILL USE THIS
//   - By hand:  npm test -- signup-sample-data
//   - CI (Task 7) runs it on every push.
//
// TRADEOFFS
//   + Real database, real transaction, real confidence.
//   - Leaves two test shops behind each run. The reset script
//     (Task 5) clears them.
//   - If we change the sample list on purpose, we update this
//     file on purpose.
//
// HOW TO USE
//   cd apps/api
//   npm test -- signup-sample-data
//   Expect: 3 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. signupShop()  =  OPENING A NEW SHOP, TWICE
//    A helper that signs up one shop and hands back its badge
//    (cookie) and ID. We call it for shop A and shop B.
//
// 2. inTenant()  =  PUTTING ON THE SHOP'S STAFF BADGE FOR A MOMENT
//    Database rows are locked per shop. To read shop A's rows we
//    first say "I am shop A" (set_config), read, then take the
//    badge off (ROLLBACK).
//
// 3. BEGIN ... ROLLBACK  =  LOOK BUT DON'T TOUCH
//    We only read. ROLLBACK undoes the transaction and ends the
//    "I am shop A" stamp, so nothing leaks to the next query.
//
// 4. sort() before comparing  =  SORTING THE SHELF FIRST
//    The database may return rows in any order. We sort so the
//    comparison does not depend on luck.
//
// 5. toEqual([...])  =  "THE LISTS MATCH EXACTLY"
//    Compares what is INSIDE the lists, item by item.
//
// 6. Sets and "no overlap"  =  NO ITEM ON TWO SHELVES
//    Shop A's product ids must not appear in shop B's list.
//
// 7. pool.end() in afterAll  =  CLOSING OUR OWN DOOR
//    We opened a database pool in this file, so we close it.
// ═══════════════════════════════════════════════════════════

import request from 'supertest';
import dotenv  from 'dotenv';
import pg      from 'pg';
import app     from '../src/app.js';

dotenv.config();

// Our own database connection pool, for reading customers directly
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Unique ticket number for THIS run
const stamp    = String(Date.now()).slice(-8);
const password = 'Test1234!';

// What EVERY new shop must get. Written out in full on purpose,
// not imported from the service (see DECISIONS above).
const EXPECTED_PRODUCT_NAMES = [
  'Sample: Cooking Oil 1L',
  'Sample: Maize Flour 2kg',
  'Sample: Sugar 1kg',
];
const EXPECTED_PRICES_CENTS = [16000, 18000, 32000]; // sorted
const EXPECTED_CUSTOMER_PHONES = ['0700000001', '0700000002'];

// The two shops we create
let shopA;
let shopB;

// signupShop: signs up one new shop, returns { cookie, tenantId }
async function signupShop(phone, shopName) {
  const res = await request(app)
    .post('/v1/signup')
    .send({
      phone,
      name: 'Seed Tester',
      password,
      tenant_name: shopName,
    });

  // If signup fails, every test below is meaningless: fail loudly here
  expect(res.status).toBe(201);

  return {
    cookie:   res.headers['set-cookie'],
    tenantId: res.body.tenant_id,
  };
}

// inTenant: run ONE read-only query as a given shop, then roll back
async function inTenant(tenantId, sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // true = the stamp lasts only until this transaction ends
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const { rows } = await client.query(sql, params);
    await client.query('ROLLBACK');
    return rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Setup: open two brand new shops
beforeAll(async () => {
  shopA = await signupShop(`07${stamp}`, `Seed A ${stamp}`);
  shopB = await signupShop(`01${stamp}`, `Seed B ${stamp}`);
});

afterAll(async () => {
  await pool.end();
});

describe('Signup sample data', () => {

  // ── TEST 1: PRODUCTS (through the real API) ───────────
  test('a new shop sees exactly 3 sample products', async () => {
    const res = await request(app)
      .get('/v1/products')
      .set('Cookie', shopA.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);

    // Right names
    const names = res.body.data.map((p) => p.name).sort();
    expect(names).toEqual(EXPECTED_PRODUCT_NAMES);

    // Right prices (in cents; Number() because Postgres may send text)
    const prices = res.body.data.map((p) => Number(p.price_cents)).sort((a, b) => a - b);
    expect(prices).toEqual(EXPECTED_PRICES_CENTS);

    // All sellable
    expect(res.body.data.every((p) => p.status === 'active')).toBe(true);
  });

  // ── TEST 2: CUSTOMERS (straight from the database) ────
  test('a new shop has exactly 2 sample customers', async () => {
    const rows = await inTenant(
      shopA.tenantId,
      'SELECT phone, channel FROM customers ORDER BY phone'
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.phone)).toEqual(EXPECTED_CUSTOMER_PHONES);

    // Both channels are allowed values (whatsapp, web, ussd)
    expect(rows.map((r) => r.channel)).toEqual(['whatsapp', 'web']);
  });

  // ── TEST 3: EACH SHOP GETS ITS OWN COPIES ─────────────
  test('a second shop gets its own samples, with no clash and no leak', async () => {
    const a = await request(app).get('/v1/products').set('Cookie', shopA.cookie);
    const b = await request(app).get('/v1/products').set('Cookie', shopB.cookie);

    // Shop B signed up fine (same SKUs as shop A, no duplicate error)
    // and has exactly its own 3 products, not 6
    expect(b.status).toBe(200);
    expect(b.body.data).toHaveLength(3);

    // No product id appears in BOTH shops
    const idsA = new Set(a.body.data.map((p) => p.id));
    const overlap = b.body.data.filter((p) => idsA.has(p.id));
    expect(overlap).toHaveLength(0);

    // Shop B has its own 2 customers too, not shared with A
    const customersB = await inTenant(
      shopB.tenantId,
      'SELECT phone FROM customers ORDER BY phone'
    );
    expect(customersB.map((r) => r.phone)).toEqual(EXPECTED_CUSTOMER_PHONES);
  });
});