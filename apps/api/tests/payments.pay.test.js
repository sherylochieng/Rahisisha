// =============================================================
// FILE: apps/api/tests/payments.pay.test.js
// =============================================================
//
// WHY THIS FILE EXISTS
//   Proves the pay route, POST /v1/orders/:id/pay, through the REAL app
//   (login cookie, shop lock, controller, database). It checks the route
//   charges the right amount, only for the right shop's open order, leaves
//   a written record, and never says "paid" or touches the wallet.
//
// WHY IMPORTANT
//   This route is where money STARTS. A bug here charges the wrong amount,
//   charges another shop's customer, or sends a customer two prompts.
//
// DANGER (if this file does not exist)
//   - Someone lets the amount come from the request body. A customer then
//     pays KES 1 for a KES 5,000 order. Check 3 catches it.
//   - Someone forgets the status check and a PAID order gets paid again.
//     Check 7 catches it.
//   - A refactor drops the shop lock and Brio can start a payment for
//     Amina's order. Check 5 catches it.
//   - The route starts crediting the wallet "to be quick". Check 2 catches
//     it (the wallet must not change).
//
// WHAT IT SOLVES
//   Day 3, Task 2 proof: "POST /v1/orders/:id/pay ... Insert a
//   payment_attempts row with status pending. Return 202."
//
// SYSTEM DESIGN PRINCIPLE
//   Test the promise through the front door. Requests go through the real
//   Express app with a real login cookie. Only Safaricom is faked (a fake
//   fetch), so no real network call and no real money.
//
// RULES
//   1. NEVER call the real Safaricom. global.fetch is faked in every check.
//   2. Make our own shops, customers and orders with random names, and a
//      throw-away KMS key, so the tests also pass on a fresh CI database.
//   3. Delete everything we made (payment attempts first: an order that has
//      a payment attempt cannot be deleted, by design).
//   4. All keys in here are FAKE words made from a random tag.
//
// PRACTICAL EXAMPLE
//   Check 3: we send { amountCents: 1 } in the body for a KES 1,500 order.
//   Safaricom must still be asked for 1500, because the amount comes from
//   the order, never from the request.
//
// DECISIONS (and WHY)
//   - A fresh order is made for each check, so one check's payment attempt
//     can never block the next one (the 2 minute "prompt already sent" rule).
//   - The login cookie is made the same way the other tests do it: a signed
//     JWT with the shop id, put in the `token` cookie.
//   - Shop B has NO Daraja settings on purpose: it is the "not set up" case.
//
// WHERE USED
//   `npm test` and CI on every push.
//
// TRADEOFFS
//   + Fast, no network, exact checks on what would be sent.
//   - Cannot prove Safaricom accepts our request (only a real sandbox
//     payment proves that), and does not test the callback (Task 3 tests).
//
// HOW TO RUN
//   cd apps/api
//   npm test -- tests/payments.pay.test.js
//
// GUIDE DOC: apps/api/docs/tests/payments.pay.test.md (with the Day 3 docs)
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request. Declared in the Day 3 money audit.

// =============================================================
// THE PIECES OF THIS FILE (read top to bottom)
//   1. Imports
//   2. Test data           two pretend shops, fake keys
//   3. Helpers             withLock, makeCookie, makeOrder, attemptsFor ...
//   4. beforeAll           build the shops and Amina's M-Pesa settings
//   5. beforeEach/After    a fresh fake Safaricom before every check
//   6. afterAll            delete everything we made, put settings back
//   7. The 13 checks
// =============================================================

// -------------------------------------------------------------
// PIECE 1: Imports
// -------------------------------------------------------------
// supertest : sends requests to the app without opening a real port.
// jsonwebtoken : signs the login cookie.
// pg : our own database connection, to set things up and look inside.
// app : the real Express app. pool : its connection pool (closed at the end).
import crypto from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { encryptSecret } from '../src/utils/kms.js';

dotenv.config();

// -------------------------------------------------------------
// PIECE 2: Test data
// -------------------------------------------------------------
// testPool connects as rahisisha_user (not a superuser), so RLS applies to
// our own setup queries exactly as in the real app.
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// A random tag, so names never clash between runs.
const rand = crypto.randomBytes(4).toString('hex');

// Amina (shop A) has M-Pesa settings. Brio (shop B) has none.
const A = {
  key: `PAYKEY-A-${rand}`, secret: `PAYSECRET-A-${rand}`, passkey: `PAYPASSKEY-A-${rand}`,
  shortcode: '333333', callback: `https://pay-a-${rand}.example/cb`,
};
const ACCESS_TOKEN = `PAY-ACCESS-TOKEN-${rand}`;
const CUSTOMER_PHONE = '0711111111';     // the customer's phone on the order
const OTHER_PHONE = '0722222222';        // a different phone typed in the body

let realKey;      // your own KMS_KEY, put back at the end
let realFetch;    // the real fetch, put back at the end
let realBase;     // your DARAJA_API_BASE, put back at the end
let tenantA;      // shop A id
let tenantB;      // shop B id
let cookieA;      // Amina's login
let cookieB;      // Brio's login
let fetchMock;    // the fake Safaricom
const spies = []; // hidden microphones on console.*

// -------------------------------------------------------------
// PIECE 3: Helpers
// -------------------------------------------------------------
// makeCookie(tenantId): a signed login, the same way the other tests do it.
function makeCookie(tenantId) {
  const token = jwt.sign(
    { user_id: 1, tenant_id: tenantId, role: 'owner' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  return `token=${token}`;
}

// withLock(tenantId, fn): runs fn with a database connection locked to ONE
// shop (the test version of withTenant), then clears the lock and gives the
// connection back. Real life: a hotel key card that opens only one room.
async function withLock(tenantId, fn) {
  const c = await testPool.connect();
  try {
    await c.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
    return await fn(c);
  } finally {
    await c.query("SELECT set_config('app.current_tenant', '', false)");
    c.release();
  }
}

// makeOrder(tenantId, options): creates a customer and an order for a shop
// and returns the order id. Each check makes its own order, so one check's
// payment attempt can never block another's.
// A customer's phone must be UNIQUE inside a shop (the database insists), so
// unless a check passes its own phone, each customer gets a random valid
// Kenyan number (07 + 8 digits).
async function makeOrder(tenantId, { totalCents = 150000, status = 'created', phone } = {}) {
  const customerPhone = phone
    || `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
  return withLock(tenantId, async (db) => {
    const cust = await db.query(
      'INSERT INTO customers (tenant_id, phone) VALUES ($1, $2) RETURNING id',
      [tenantId, customerPhone]);
    const ord = await db.query(
      `INSERT INTO orders (tenant_id, customer_id, total_cents, status)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, cust.rows[0].id, totalCents, status]);
    return ord.rows[0].id;
  });
}

// attemptsFor(tenantId, orderId): the payment attempts written for an order.
async function attemptsFor(tenantId, orderId) {
  return withLock(tenantId, async (db) => (await db.query(
    `SELECT status, amount_cents, phone, checkout_request_id, merchant_request_id, result_desc
       FROM payment_attempts WHERE order_id = $1 ORDER BY created_at`, [orderId])).rows);
}

// walletTotal(tenantId): the shop's wallet balance, to prove it never moves.
async function walletTotal(tenantId) {
  return withLock(tenantId, async (db) => Number((await db.query(
    'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM wallet_entries')).rows[0].total));
}

// reply(status, body): a fake Safaricom answer shaped like fetch's Response.
const reply = (status, body) => ({ status, json: async () => body });

// happyFetch: the default pretend Safaricom: login works, push accepted.
function happyFetch(url) {
  if (String(url).includes('/oauth/')) return Promise.resolve(reply(200, { access_token: ACCESS_TOKEN }));
  return Promise.resolve(reply(200, {
    ResponseCode: '0', MerchantRequestID: `mr-${rand}`, CheckoutRequestID: `ws_CO_${rand}_${crypto.randomBytes(3).toString('hex')}`,
  }));
}

// consoleText(): everything the code tried to print, as one string.
function consoleText() {
  return JSON.stringify(spies.flatMap((s) => s.mock.calls));
}

// pay(orderId, cookie, body): the request under test.
const pay = (orderId, cookie = cookieA, body = {}) =>
  request(app).post(`/v1/orders/${orderId}/pay`).set('Cookie', cookie).send(body);

// -------------------------------------------------------------
// PIECE 4: beforeAll (once)
// -------------------------------------------------------------
// Swap in a throw-away KMS key, create two shops and the two logins, and give
// ONLY shop A its encrypted M-Pesa settings (written under A's lock, because
// daraja_configs has RLS).
beforeAll(async () => {
  realKey = process.env.KMS_KEY;
  realFetch = global.fetch;
  realBase = process.env.DARAJA_API_BASE;
  process.env.KMS_KEY = crypto.randomBytes(32).toString('base64');
  delete process.env.DARAJA_API_BASE;

  const a = await testPool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [`Pay A ${rand}`, `pay-a-${rand}`]);
  const b = await testPool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [`Pay B ${rand}`, `pay-b-${rand}`]);
  tenantA = a.rows[0].id;
  tenantB = b.rows[0].id;
  cookieA = makeCookie(tenantA);
  cookieB = makeCookie(tenantB);

  await withLock(tenantA, (db) => db.query(
    `INSERT INTO daraja_configs
       (tenant_id, env, consumer_key_encrypted, consumer_secret_encrypted,
        shortcode, passkey_encrypted, callback_url)
     VALUES ($1, 'sandbox', $2, $3, $4, $5, $6)`,
    [tenantA, encryptSecret(A.key, tenantA), encryptSecret(A.secret, tenantA),
      A.shortcode, encryptSecret(A.passkey, tenantA), A.callback]));
});

// -------------------------------------------------------------
// PIECE 5: beforeEach / afterEach (every check)
// -------------------------------------------------------------
// A brand-new fake Safaricom, and microphones on the console. Note the fake
// fetch only replaces fetch INSIDE our code; supertest talks to the app
// directly and is not affected.
beforeEach(() => {
  fetchMock = jest.fn(happyFetch);
  global.fetch = fetchMock;
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) {
    spies.push(jest.spyOn(console, m).mockImplementation(() => {}));
  }
});

afterEach(() => {
  while (spies.length) spies.pop().mockRestore();
});

// -------------------------------------------------------------
// PIECE 6: afterAll (once)
// -------------------------------------------------------------
// Put everything back and delete what we made. ORDER MATTERS: payment
// attempts first (an order with a payment attempt cannot be deleted), then
// orders, then customers, then the shops (their config goes with them).
afterAll(async () => {
  global.fetch = realFetch;
  if (realBase === undefined) delete process.env.DARAJA_API_BASE;
  else process.env.DARAJA_API_BASE = realBase;
  if (realKey === undefined) delete process.env.KMS_KEY;
  else process.env.KMS_KEY = realKey;

  for (const t of [tenantA, tenantB]) {
    await withLock(t, async (db) => {
      await db.query('DELETE FROM payment_attempts');
      await db.query('DELETE FROM orders');
      await db.query('DELETE FROM customers');
    });
  }
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB]]);
  await testPool.end();
  await pool.end();
});

// -------------------------------------------------------------
// PIECE 7: The checks
// -------------------------------------------------------------
describe('POST /v1/orders/:id/pay', () => {

  // CHECK 1: not logged in. No cookie = 401, nothing sent to Safaricom.
  // Real life: the till will not start a payment for a stranger.
  test('1. no login: 401 and Safaricom is never called', async () => {
    const orderId = await makeOrder(tenantA);
    const res = await request(app).post(`/v1/orders/${orderId}/pay`).send({});
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 2: the happy path. Amina pays her KES 1,500 order:
  //   - the answer is 202 (started, not finished) and status 'pending'
  //   - Safaricom was asked for exactly 1500 on Amina's till
  //   - a payment_attempts row exists: pending, 150000 cents, the customer's
  //     phone in Daraja's form, with Safaricom's two ids saved
  //   - the order is STILL 'created' and the wallet has NOT moved: only the
  //     callback may say "paid" and credit money
  // Real life: the till shows "waiting for customer", not "paid".
  test('2. good order: 202, a pending attempt is saved, nothing is marked paid', async () => {
    const orderId = await makeOrder(tenantA, { totalCents: 150000, phone: CUSTOMER_PHONE });
    const walletBefore = await walletTotal(tenantA);

    const res = await pay(orderId);
    expect(res.status).toBe(202);
    expect(res.body.error).toBeNull();
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.paymentAttemptId).toBeTruthy();

    // Safaricom: login first, then the push for KES 1500 on A's till.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const pushBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(pushBody.Amount).toBe(1500);
    expect(pushBody.BusinessShortCode).toBe(A.shortcode);
    expect(pushBody.PhoneNumber).toBe('254711111111');
    expect(pushBody.AccountReference).toBe(`ORD-${orderId.replace(/-/g, '').slice(0, 8)}`);
    expect(pushBody.AccountReference.length).toBeLessThanOrEqual(12);

    // The written record.
    const rows = await attemptsFor(tenantA, orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(Number(rows[0].amount_cents)).toBe(150000);
    expect(rows[0].phone).toBe('254711111111');
    expect(rows[0].checkout_request_id).toMatch(/^ws_CO_/);
    expect(rows[0].merchant_request_id).toBe(`mr-${rand}`);

    // Starting a payment never marks paid and never touches the wallet.
    const order = await withLock(tenantA, (db) =>
      db.query('SELECT status FROM orders WHERE id = $1', [orderId]));
    expect(order.rows[0].status).toBe('created');
    expect(await walletTotal(tenantA)).toBe(walletBefore);
  });

  // CHECK 3: THE MONEY RULE. The body tries to cheat: amount 1, total 1,
  // and a different phone. The amount must still be the ORDER'S 1500. The
  // phone override is allowed (a customer paying from another number).
  // Real life: a customer cannot tell the cashier "just charge me 1 shilling".
  test('3. the amount comes from the order, never from the request body', async () => {
    const orderId = await makeOrder(tenantA, { totalCents: 150000 });
    const res = await pay(orderId, cookieA, {
      amountCents: 1, amount: 1, total_cents: 1, totalCents: 1, phone: OTHER_PHONE,
    });
    expect(res.status).toBe(202);
    const pushBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(pushBody.Amount).toBe(1500);
    expect(pushBody.PhoneNumber).toBe('254722222222');
    const rows = await attemptsFor(tenantA, orderId);
    expect(Number(rows[0].amount_cents)).toBe(150000);
  });

  // CHECK 4: no phone in the body = the order's customer phone is used
  // (already proven in check 2). Here we prove the opposite edge: a bad
  // phone in the body is refused, nothing is written and nothing is sent.
  // Real life: the till refuses to dial something that is not a phone number.
  test('4. a bad phone is refused: 400, no attempt written, Safaricom never called', async () => {
    const orderId = await makeOrder(tenantA);
    const res = await pay(orderId, cookieA, { phone: 'not-a-phone' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await attemptsFor(tenantA, orderId)).toHaveLength(0);
  });

  // CHECK 5: THE SHOP LOCK. Brio is logged in and tries to pay AMINA'S order.
  // The database hides Amina's order from Brio, so it is a plain 404. Nothing
  // is sent, nothing is written for that order.
  // Real life: Brian cannot start a payment on Amina's till.
  test("5. another shop cannot pay my order: 404, nothing sent, nothing written", async () => {
    const orderId = await makeOrder(tenantA);
    const res = await pay(orderId, cookieB);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await attemptsFor(tenantA, orderId)).toHaveLength(0);
  });

  // CHECK 6: an order id that does not exist is 404; one that is not even
  // an id (a typo or an attack string) is 400, never a crash or a 500.
  test('6. unknown order is 404, a malformed id is 400', async () => {
    const missing = await pay(crypto.randomUUID());
    expect(missing.status).toBe(404);
    const malformed = await pay('not-a-uuid');
    expect(malformed.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 7: only an OPEN order ('created') can be paid. An order that is
  // already paid, cancelled or delivered is refused with 409, so nobody is
  // charged twice for the same order.
  // Real life: you cannot pay a bill that is already stamped PAID.
  test("7. an order that is not 'created' cannot be paid: 409, nothing sent", async () => {
    for (const status of ['paid', 'cancelled', 'delivered']) {
      const orderId = await makeOrder(tenantA, { status });
      const res = await pay(orderId);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('order_not_payable');
      expect(await attemptsFor(tenantA, orderId)).toHaveLength(0);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 8: an order total that is not whole shillings (KES 1500.50) is
  // refused with 400, nothing written and nothing sent. It is never rounded.
  test('8. a total that is not whole shillings is refused, never rounded', async () => {
    const orderId = await makeOrder(tenantA, { totalCents: 150050 });
    const res = await pay(orderId);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await attemptsFor(tenantA, orderId)).toHaveLength(0);
  });

  // CHECK 9: DOUBLE TAP. The second request right after the first must NOT
  // send a second prompt: 409 payment_in_progress. Exactly one attempt exists
  // and Safaricom was asked once (login + push = 2 calls, not 4).
  // Real life: tapping Pay twice must not send the customer two PIN prompts.
  test('9. a second tap is refused while a prompt is pending', async () => {
    const orderId = await makeOrder(tenantA);
    const first = await pay(orderId);
    expect(first.status).toBe(202);
    const second = await pay(orderId);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('payment_in_progress');
    expect(await attemptsFor(tenantA, orderId)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // CHECK 10: a shop that never set up M-Pesa (Brio, no daraja_configs row)
  // paying its OWN order: 409 payments_not_set_up, Safaricom is never
  // called, and the attempt is kept as 'failed' with the short reason code.
  test('10. a shop with no M-Pesa settings: 409, attempt kept as failed', async () => {
    const orderId = await makeOrder(tenantB);
    const res = await pay(orderId, cookieB);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('payments_not_set_up');
    expect(fetchMock).not.toHaveBeenCalled();
    const rows = await attemptsFor(tenantB, orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].result_desc).toBe('daraja_not_configured');
  });

  // CHECK 11: Safaricom refuses the push. The route answers 502, the attempt
  // is kept as 'failed' with only our short code, and Safaricom's own words
  // are never copied into the database or the reply.
  test('11. Safaricom refuses: 502, attempt failed with a short code only', async () => {
    fetchMock.mockImplementation((url) => String(url).includes('/oauth/')
      ? Promise.resolve(reply(200, { access_token: ACCESS_TOKEN }))
      : Promise.resolve(reply(200, { ResponseCode: '1', errorMessage: 'SECRET-WORDS-FROM-SAFARICOM' })));
    const orderId = await makeOrder(tenantA);
    const res = await pay(orderId);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('payment_provider_error');
    expect(JSON.stringify(res.body)).not.toContain('SECRET-WORDS-FROM-SAFARICOM');
    const rows = await attemptsFor(tenantA, orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].result_desc).toBe('daraja_rejected');
    expect(rows[0].checkout_request_id).toBeNull();
  });

  // CHECK 12: after a FAILED attempt the owner can try again straight away
  // (only a PENDING attempt blocks a second tap).
  test('12. after a failed attempt, trying again works', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(reply(500, {})));   // login fails
    const orderId = await makeOrder(tenantA);
    const first = await pay(orderId);
    expect(first.status).toBe(502);
    const second = await pay(orderId);
    expect(second.status).toBe(202);
    const rows = await attemptsFor(tenantA, orderId);
    expect(rows.map((r) => r.status)).toEqual(['failed', 'pending']);
  });

  // CHECK 13: nothing secret in the console or in any reply. Run a good
  // payment and a failing one, then search everything printed and every
  // response body for the keys, the passkey, the token and the phone digits.
  test('13. no key, token or phone number leaks into the console or a reply', async () => {
    const good = await pay(await makeOrder(tenantA));
    fetchMock.mockImplementationOnce(() => Promise.resolve(reply(401, {})));
    const bad = await pay(await makeOrder(tenantA));
    const everything = consoleText() + JSON.stringify(good.body) + JSON.stringify(bad.body);
    for (const secret of [A.key, A.secret, A.passkey, ACCESS_TOKEN, '711111111', 'Basic', 'Bearer']) {
      expect(everything).not.toContain(secret);
    }
  });
});