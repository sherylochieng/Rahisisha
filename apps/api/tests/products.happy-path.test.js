// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/products.happy-path.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   A shop owner's whole job is managing products: add one,
//   look at it, change the price, remove it. This file checks
//   that the full life of ONE product works when used correctly.
//
// WHAT IT TESTS (happy path = everything done correctly)
//   1. POST   /v1/products      -> 201, product created
//   2. GET    /v1/products/:id  -> 200, same product comes back
//   3. PATCH  /v1/products/:id  -> 200, price changed, name kept
//   4. DELETE /v1/products/:id  -> 204, then GET gives 404
//   (GET /v1/products, the list, is already tested in the
//   pagination test, so we do not repeat it here.)
//
// WHY IMPORTANT
//   Products feed orders, the dashboard and the money. If
//   create or update breaks, shops cannot sell anything.
//
// DANGER (what breaks without it)
//   A change in products.controller.js (a typo in the SQL, a
//   renamed column) silently breaks one action. You find out
//   when a real owner cannot change a price. This test finds
//   it in 5 seconds.
//
// WHAT IT SOLVES
//   Isolation tests prove Shop A cannot touch Shop B's products
//   (locks). They do NOT prove create, read, update and delete
//   work for the owner (doors). This file proves the doors open.
//
// SYSTEM DESIGN PRINCIPLE
//   "Each test file builds its own world."
//   We sign up a brand new shop in beforeAll. We do NOT depend
//   on shops already in the database, or on products another
//   test made. So this file passes on a clean database, on
//   CI (Task 7), and after the reset script (Task 5).
//   Also: CRUD lifecycle. Create -> Read -> Update -> Delete is
//   the natural story of any record.
//
// RULES (never do this)
//   1. NEVER hard-code a phone number. Use a unique one each run.
//   2. NEVER assume a shop already has zero products. Task 4
//      will give new shops 3 sample products, so we never count
//      the list here.
//   3. NEVER log cookies or passwords.
//   4. NEVER point tests at the production database.
//   5. NEVER edit a test just to make it pass. Ask first: is the
//      test wrong, or is the code wrong?
//   6. NEVER guess a response shape. Products reply with
//      { data, error }. The product is inside res.body.data.
//
// PRACTICAL EXAMPLE
//   Mama Njeri adds "Sugar 2kg" for 25000 cents (KES 250).
//   She opens it and sees the same name. She raises the price
//   to 27000. Later she removes it, and it is gone from her shop.
//   That is exactly the 4 tests below.
//
// DECISIONS
//   - Money is in CENTS (integers): 25000 = KES 250.00. Floats
//     like 250.10 cause rounding bugs in money.
//   - Delete is a SOFT delete (deleted_at is set). The row stays
//     for history, but the API acts as if it is gone: 404.
//   - The tests share productId, so they run in order on purpose.
//   - Postgres can send numbers as text, so we wrap them in
//     Number(...) before comparing.
//
// WHERE YOU WILL USE THIS
//   - By hand:  npm test -- products.happy-path
//   - CI (Task 7) runs it on every push.
//   - The "Core Polish" grader looks for one test per endpoint.
//
// TRADEOFFS
//   + Real database, real SQL, real confidence.
//   - Leaves one test shop behind each run. The reset script
//     (Task 5) clears them.
//   - Soft-deleted product rows also stay. Same cleanup.
//
// HOW TO USE
//   cd apps/api
//   npm test -- products.happy-path
//   Expect: 4 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. beforeAll  =  OPENING THE SHOP in the morning
//    Runs ONCE before all tests. We sign up a shop and keep
//    the cookie, like unlocking the door and getting the key.
//    WHERE: setup that every test needs.
//    WHEN:  setup is slow or must happen once.
//    HOW:   beforeAll(async () => { ... })
//
// 2. cookie  =  THE STAFF BADGE
//    Every products route needs login. The badge proves we
//    are staff of THIS shop. .set('Cookie', cookie)
//
// 3. productId  =  THE PRODUCT'S BARCODE
//    Test 1 makes a product and saves its id. Tests 2, 3, 4
//    use that id to find the same product. Like scanning the
//    same barcode again.
//
// 4. priceCents: 25000  =  PRICE TAG IN WHOLE SHILLING CENTS
//    Think of M-Pesa: you never send 250.123 shillings.
//    Whole numbers only, so money never gets rounded wrong.
//
// 5. res.body.data  =  THE BAG, res.body  =  THE SHOPPING TRIP
//    The API replies { data: ..., error: null }. The product
//    is in the bag (data). error is null when all is well.
//
// 6. toBe vs toBeDefined  =  "EXACTLY THIS" vs "SOMETHING IS THERE"
//    toBe('Sugar 2kg') must match exactly. toBeDefined() is
//    for ids that change every run.
//
// 7. PATCH  =  CHANGE ONE THING ON THE LABEL
//    PATCH sends only the fields to change (price). The name
//    must stay the same. PUT would replace everything.
//
// 8. 204  =  "DONE, NOTHING TO SHOW YOU"
//    Delete returns 204 No Content. There is no body to read.
//
// 9. GET after DELETE gives 404  =  THE SHELF IS EMPTY
//    Proves the delete really worked, not just that the API
//    said "OK". Always check the result, not the promise.
//
// 10. Number(...)  =  READING THE PRICE TAG AS A NUMBER
//    Postgres may give "27000" (text) instead of 27000.
//    Number() makes both look the same.
// ═══════════════════════════════════════════════════════════

// supertest: calls our Express app like a browser, no server needed.
import request from 'supertest';

// dotenv: loads DATABASE_URL, JWT_SECRET etc. from .env
import dotenv from 'dotenv';

// app: our real Express app.
import app from '../src/app.js';

dotenv.config();

// Unique phone for THIS run, so signup never gets 409.
const phone    = `07${String(Date.now()).slice(-8)}`;
const password = 'Test1234!';

// The staff badge for our brand new test shop.
let cookie;

// The barcode of the product we create in test 1.
let productId;

// ── SETUP: open a fresh shop ────────────────────────────
beforeAll(async () => {
  const res = await request(app)
    .post('/v1/signup')
    .send({
      phone,
      name: 'Products Tester',
      password,
      tenant_name: 'Products Happy Shop',
    });

  // If signup fails, every test below is meaningless.
  // Fail loudly here with a clear reason.
  expect(res.status).toBe(201);

  // Signup logs us in, so the cookie comes back here.
  cookie = res.headers['set-cookie'];
  expect(cookie).toBeDefined();
});

describe('Products happy path', () => {

  // ── TEST 1: CREATE ────────────────────────────────────
  test('POST /v1/products creates a product', async () => {
    const res = await request(app)
      .post('/v1/products')
      .set('Cookie', cookie)
      .send({
        name: 'Sugar 2kg',
        priceCents: 25000,
        sku: `SUGAR-${Date.now()}`,
        description: 'White sugar, 2kg pack',
        status: 'active',
      });

    // 201 = Created
    expect(res.status).toBe(201);
    expect(res.body.error).toBeNull();

    // The product is inside data.
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('Sugar 2kg');
    expect(Number(res.body.data.price_cents)).toBe(25000);
    expect(res.body.data.status).toBe('active');

    // Save the barcode for the next tests.
    productId = res.body.data.id;
  });

  // ── TEST 2: READ ONE ──────────────────────────────────
  test('GET /v1/products/:id returns the same product', async () => {
    const res = await request(app)
      .get(`/v1/products/${productId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(productId);
    expect(res.body.data.name).toBe('Sugar 2kg');
  });

  // ── TEST 3: UPDATE ────────────────────────────────────
  test('PATCH /v1/products/:id changes the price only', async () => {
    const res = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('Cookie', cookie)
      .send({ priceCents: 27000 });

    expect(res.status).toBe(200);

    // The price changed...
    expect(Number(res.body.data.price_cents)).toBe(27000);

    // ...and the name stayed the same.
    expect(res.body.data.name).toBe('Sugar 2kg');
  });

  // ── TEST 4: DELETE ────────────────────────────────────
  test('DELETE /v1/products/:id removes the product', async () => {
    const del = await request(app)
      .delete(`/v1/products/${productId}`)
      .set('Cookie', cookie);

    // 204 = done, no body.
    expect(del.status).toBe(204);

    // Prove it is really gone: asking for it now gives 404.
    const after = await request(app)
      .get(`/v1/products/${productId}`)
      .set('Cookie', cookie);

    expect(after.status).toBe(404);
  });
});