// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/dashboard.happy-path.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The dashboard is the first screen a shop owner sees. This
//   file checks that it shows the right "morning report":
//   orders today, wallet balance, and latest products.
//
// WHAT IT TESTS (happy path = everything done correctly)
//   1. GET /v1/dashboard -> 200, the 3 values are present
//   2. GET /v1/dashboard -> counts today's order, lists product
//
// WHY IMPORTANT
//   The dashboard answers "how is my shop doing today?". If it
//   shows wrong or empty numbers, owners stop trusting the app.
//
// DANGER (what breaks without it)
//   A SQL typo in dashboard.controller.js shows wrong numbers,
//   or crashes the page every owner lands on after login.
//
// WHAT IT SOLVES
//   Isolation tests prove Shop A cannot see Shop B (locks).
//   They do NOT prove the dashboard works (doors). This file
//   proves the door opens.
//
// SYSTEM DESIGN PRINCIPLE
//   "Each test file builds its own world." We sign up a new
//   shop, add a product and place an order in beforeAll, so we
//   know there is something to count. We never depend on data
//   other tests made.
//
// RULES (never do this)
//   1. NEVER assume the dashboard is empty. Compare with >= and
//      "is in the list", because Task 4 will add sample products.
//   2. NEVER hard-code a phone or shop name. Use a unique one.
//   3. NEVER log cookies or passwords.
//   4. NEVER point tests at the production database.
//   5. NEVER edit a test just to make it pass. Ask first: is the
//      test wrong, or is the code wrong?
//
// PRACTICAL EXAMPLE
//   Mama Njeri opens the app. The dashboard says: 1 order today,
//   balance 0, latest product "Dash Sugar". That is what the 2
//   tests below check.
//
// DECISIONS
//   - Postgres sends COUNT as TEXT, so we wrap numbers in
//     Number(...) before comparing.
//   - The reply is { data: { ordersToday, balanceCents,
//     latestProducts } }. There is no "error" field here yet
//     (a known inconsistency in our notes), so we do not
//     check for one.
//
// WHERE YOU WILL USE THIS
//   - By hand:  npm test -- dashboard.happy-path
//   - CI (Task 7) runs it on every push.
//   - The "Core Polish" grader looks for one test per endpoint.
//
// TRADEOFFS
//   + Real database, real confidence.
//   - Leaves one test shop, product, customer and order behind
//     each run. The reset script (Task 5) clears them.
//
// HOW TO USE
//   cd apps/api
//   npm test -- dashboard.happy-path
//   Expect: 2 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. stamp  =  A TICKET NUMBER from the queue
//    Different every run, so phones never clash with old runs.
//
// 2. beforeAll  =  OPENING THE SHOP and SELLING ONE ITEM
//    We sign up, add a product, and take one order, so the
//    morning report has something real to show.
//
// 3. dashboard  =  THE SHOP'S MORNING REPORT
//    ordersToday (how many orders), balanceCents (wallet money),
//    latestProducts (what was added recently).
//
// 4. Number(...)  =  READING TEXT AS A REAL NUMBER
//    Postgres COUNT arrives as "1" (text). Number("1") is 1.
//
// 5. Number.isFinite(...)  =  "IS THIS A REAL NUMBER?"
//    Fails for NaN or undefined. Like checking the price tag
//    is not blank.
//
// 6. toBeGreaterThanOrEqual(1)  =  "AT LEAST ONE"
//    We do not say "exactly 1", other data may exist.
//
// 7. some((p) => p.name === ...)  =  "IS MY ITEM ON THE LIST?"
//    Like finding your name on a notice board.
// ═══════════════════════════════════════════════════════════

// supertest: calls our Express app like a browser, no server needed.
import request from 'supertest';

// dotenv: loads DATABASE_URL, JWT_SECRET etc. from .env
import dotenv from 'dotenv';

// app: our real Express app.
import app from '../src/app.js';

dotenv.config();

// Unique ticket number for THIS run.
const stamp    = String(Date.now()).slice(-8);
const phone    = `07${stamp}`;
const password = 'Test1234!';

let cookie;

// ── SETUP: open a fresh shop, add a product, take an order ──
beforeAll(async () => {
  // 1) sign up a brand new shop
  const signup = await request(app)
    .post('/v1/signup')
    .send({
      phone,
      name: 'Dash Tester',
      password,
      tenant_name: `Dashboard Shop ${stamp}`,
    });

  expect(signup.status).toBe(201);
  cookie = signup.headers['set-cookie'];
  expect(cookie).toBeDefined();

  // 2) add a product
  const product = await request(app)
    .post('/v1/products')
    .set('Cookie', cookie)
    .send({ name: 'Dash Sugar', priceCents: 25000, status: 'active' });

  expect(product.status).toBe(201);
  const productId = product.body.data.id;

  // 3) place one order, so the dashboard has something to count
  const order = await request(app)
    .post('/v1/orders')
    .set('Cookie', cookie)
    .send({
      customerPhone: `01${stamp}`,
      channel: 'web',
      items: [{ productId, quantity: 1 }],
    });

  expect(order.status).toBe(201);
});

describe('Dashboard happy path', () => {

  // ── TEST 1: SHAPE ─────────────────────────────────────
  test('GET /v1/dashboard returns the three dashboard values', async () => {
    const res = await request(app)
      .get('/v1/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const { ordersToday, balanceCents, latestProducts } = res.body.data;

    // Each value must exist and be the right kind of thing.
    expect(Number.isFinite(Number(ordersToday))).toBe(true);
    expect(Number.isFinite(Number(balanceCents))).toBe(true);
    expect(Array.isArray(latestProducts)).toBe(true);
  });

  // ── TEST 2: REAL DATA ─────────────────────────────────
  test('GET /v1/dashboard counts today\'s order and lists the product', async () => {
    const res = await request(app)
      .get('/v1/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const { ordersToday, latestProducts } = res.body.data;

    // We placed 1 order in beforeAll, so at least 1 today.
    expect(Number(ordersToday)).toBeGreaterThanOrEqual(1);

    // Our product is on the "latest products" list.
    const found = latestProducts.some((p) => p.name === 'Dash Sugar');
    expect(found).toBe(true);
  });
});