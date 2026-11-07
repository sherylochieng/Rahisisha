// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/orders.happy-path.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Orders are how a shop makes money. This file checks that
//   the normal life of ONE order works: a customer orders,
//   the owner sees it in the list, opens it, and marks it paid.
//
// WHAT IT TESTS (happy path = everything done correctly)
//   1. POST  /v1/orders      -> 201, order created, total correct
//   2. GET   /v1/orders      -> 200, the order is in the list
//   3. GET   /v1/orders/:id  -> 200, same order comes back
//   4. PATCH /v1/orders/:id  -> 200, status moves created -> paid
//
// WHY IMPORTANT
//   Orders carry the customer, the items and the TOTAL. A wrong
//   total means a shop loses money or overcharges a customer.
//
// DANGER (what breaks without it)
//   Someone edits orders.controller.js and the total is wrong,
//   or the status stops changing. Nobody notices until a real
//   customer is charged the wrong amount. This test catches it.
//
// WHAT IT SOLVES
//   Isolation tests prove Shop A cannot see Shop B's orders
//   (locks). They do NOT prove the owner can create and manage
//   orders (doors). This file proves the doors open.
//
// SYSTEM DESIGN PRINCIPLE
//   "Each test file builds its own world."
//   We sign up a new shop and create a product in beforeAll.
//   We never depend on data other tests made. Also: "the server
//   calculates money, never the client". The test sends only
//   product ids and quantities, and checks the server worked out
//   the total itself (price x quantity).
//
// RULES (never do this)
//   1. NEVER send a total from the client. The server computes it.
//   2. NEVER hard-code a phone number. Use a unique one each run.
//   3. NEVER assume the list is empty. Check the order is IN it.
//   4. NEVER log cookies or passwords.
//   5. NEVER point tests at the production database.
//   6. NEVER edit a test just to make it pass. Ask first: is the
//      test wrong, or is the code wrong?
//
// PRACTICAL EXAMPLE
//   A customer on WhatsApp orders 2 x "Sugar 2kg" at 25000 cents
//   each. The shop sees total 50000 cents (KES 500), status
//   "created". The owner gets the M-Pesa payment and moves the
//   order to "paid". That is the 4 tests below.
//
// DECISIONS
//   - Money in cents (integers). 2 x 25000 = 50000.
//   - Status follows a fixed path: created -> paid -> packed
//     -> sent -> delivered. Happy path tests only the first step.
//   - Illegal jumps (created -> delivered, giving 409) are an
//     edge case, not happy path, so they are not tested here.
//   - Tests share orderId, so they run in order on purpose.
//   - Number(...) because Postgres may send numbers as text.
//
// WHERE YOU WILL USE THIS
//   - By hand:  npm test -- orders.happy-path
//   - CI (Task 7) runs it on every push.
//   - The "Core Polish" grader looks for one test per endpoint.
//
// TRADEOFFS
//   + Real database, real transaction, real confidence.
//   - Leaves one test shop, product, customer and order behind
//     each run. The reset script (Task 5) clears them.
//
// HOW TO USE
//   cd apps/api
//   npm test -- orders.happy-path
//   Expect: 4 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. beforeAll  =  OPENING THE SHOP and STOCKING THE SHELF
//    Runs once before all tests. We sign up a shop and add one
//    product, because an order needs something to buy.
//
// 2. cookie  =  THE STAFF BADGE
//    Every orders route needs login. .set('Cookie', cookie)
//
// 3. productId  =  THE BARCODE of what the customer buys
//    The order says "2 of THIS barcode".
//
// 4. items: [{ productId, quantity: 2 }]  =  THE SHOPPING LIST
//    We send ids and counts only. The server looks up the
//    real prices itself, so nobody can cheat the price.
//
// 5. channel: 'web'  =  WHERE THE ORDER CAME FROM
//    whatsapp, web or ussd. Like writing "phone order" or
//    "walk-in" on a paper slip.
//
// 6. customerPhone  =  THE CUSTOMER'S NAME TAG
//    The server finds or creates the customer from the phone.
//
// 7. total_cents = 50000  =  THE RECEIPT TOTAL
//    2 x 25000. We check it because a wrong total is the most
//    expensive bug in a shop.
//
// 8. status 'created' -> 'paid'  =  THE ORDER'S JOURNEY
//    Like a parcel: ordered, paid, packed, sent, delivered.
//    The server only allows the next sensible step.
//
// 9. toContain / some(...)  =  "IS MY ORDER ON THE LIST?"
//    Like finding your name on a notice board. We do not care
//    how many other names there are.
//
// 10. orderId  =  THE RECEIPT NUMBER
//    Test 1 saves it. Tests 2, 3, 4 use it to find the same
//    order again.
// ═══════════════════════════════════════════════════════════

// supertest: calls our Express app like a browser, no server needed.
import request from 'supertest';

// dotenv: loads DATABASE_URL, JWT_SECRET etc. from .env
import dotenv from 'dotenv';

// app: our real Express app.
import app from '../src/app.js';

dotenv.config();

// Unique phones for THIS run (owner and customer are different).
const stamp         = String(Date.now()).slice(-8);
const ownerPhone    = `07${stamp}`;
const customerPhone = `01${stamp}`;
const password      = 'Test1234!';

// The staff badge, the product barcode and the receipt number.
let cookie;
let productId;
let orderId;

// ── SETUP: open a fresh shop and add one product ────────
beforeAll(async () => {
  // 1) sign up a brand new shop
  const signup = await request(app)
    .post('/v1/signup')
    .send({
      phone: ownerPhone,
      name: 'Orders Tester',
      password,
      tenant_name: 'Orders Happy Shop',
    });

  expect(signup.status).toBe(201);
  cookie = signup.headers['set-cookie'];
  expect(cookie).toBeDefined();

  // 2) add the product the customer will buy
  const product = await request(app)
    .post('/v1/products')
    .set('Cookie', cookie)
    .send({
      name: 'Sugar 2kg',
      priceCents: 25000,
      status: 'active',
    });

  expect(product.status).toBe(201);
  productId = product.body.data.id;
});

describe('Orders happy path', () => {

  // ── TEST 1: CREATE ────────────────────────────────────
  test('POST /v1/orders creates an order with the right total', async () => {
    const res = await request(app)
      .post('/v1/orders')
      .set('Cookie', cookie)
      .send({
        customerPhone,
        channel: 'web',
        items: [{ productId, quantity: 2 }],
      });

    // 201 = Created
    expect(res.status).toBe(201);
    expect(res.body.error).toBeNull();

    // A new order always starts as "created".
    expect(res.body.data.status).toBe('created');

    // The SERVER worked out the total: 2 x 25000 = 50000.
    expect(Number(res.body.data.total_cents)).toBe(50000);

    // Save the receipt number for the next tests.
    orderId = res.body.data.id;
    expect(orderId).toBeDefined();
  });

  // ── TEST 2: LIST ──────────────────────────────────────
  test('GET /v1/orders includes the new order', async () => {
    const res = await request(app)
      .get('/v1/orders')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Is MY order on the notice board?
    const found = res.body.data.some((o) => o.id === orderId);
    expect(found).toBe(true);
  });

  // ── TEST 3: READ ONE ──────────────────────────────────
  test('GET /v1/orders/:id returns the same order', async () => {
    const res = await request(app)
      .get(`/v1/orders/${orderId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderId);
    expect(Number(res.body.data.total_cents)).toBe(50000);
  });

  // ── TEST 4: MOVE STATUS ───────────────────────────────
  test('PATCH /v1/orders/:id moves created to paid', async () => {
    const res = await request(app)
      .patch(`/v1/orders/${orderId}`)
      .set('Cookie', cookie)
      .send({ status: 'paid' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paid');
  });
});