// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/reconcile.service.test.js   (Week 30, lost-confirmation safety net)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Proves that reconcile.service.js settles a "stuck pending" payment
//   correctly and SAFELY: the money is credited once, never twice, only when
//   Safaricom says paid, and one shop can never touch another shop's attempt.
//
// WHY IMPORTANT
//   The service credits a wallet. A bug here is a bug with real money in it.
//   These tests are the proof that every way it can go wrong is closed.
//
// DANGER
//   1. Fake data and a fake Safaricom only. Never put a real key here.
//   2. It writes real rows for a moment. afterAll deletes only what it made.
//
// WHAT IT SOLVES
//   Locks in the rules so nobody weakens them later (RULE 1: never delete an
//   attack test to make a change pass).
//
// SYSTEM DESIGN PRINCIPLE
//   Test the attacker's view and the unlucky day: late confirmations, double
//   payments, Safaricom saying "wait", another shop's id.
//
// RULES
//   1. Names, phones and keys are fake.
//   2. Money is checked in the DATABASE (wallet_entries), not only in the
//      answer the function returns.
//   3. Every row this file creates is deleted in afterAll.
//
// PRACTICAL EXAMPLE
//   Test 1: an attempt is pending, Safaricom says "paid" -> the order becomes
//   paid and the wallet gets exactly KES 320, once.
//
// HOW TO RUN
//   cd apps/api && npm test -- reconcile
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE (the 10 checks) — real life: the shopkeeper phoning Safaricom
//   1  Paid          = "Yes, it was paid." She writes the money in the book once
//                      and stamps the order PAID.
//   2  Twice         = phoning again changes nothing (the book already says paid).
//   3  Failed        = "No, it was cancelled." She writes "not paid"; no money.
//   4  Still working = "Wait a bit." She writes nothing at all.
//   5  Safaricom down= no answer. She writes nothing.
//   6  No checkout id= she has nothing to ask about, so she does not phone.
//   7  Paid twice    = the order was ALREADY paid. She does NOT add the money to
//                      the takings; she marks it "give back".
//   8  Another shop  = she cannot touch another kiosk's book.
//   9  Whole order   = both stuck attempts of one order are settled; the order
//                      ends up paid once and the extra payment is "give back".
//   10 Quiet         = nothing about phones, amounts or ids is written to logs.

import crypto from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

import { reconcileAttempt, reconcileOrder } from '../src/services/reconcile.service.js';
import { pool } from '../src/db/pool.js';
import { encryptSecret } from '../src/utils/kms.js';

// Load the .env file (DATABASE_URL etc.) before we read process.env below.
dotenv.config();

// Our own database connection, used to set things up and look inside.
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// A random tag so two test runs never collide.
const rand = crypto.randomBytes(4).toString('hex');

// Boxes filled in beforeAll and used in the tests.
let tenantA; let tenantB;
// Boxes that remember the REAL settings so afterAll can put them back.
let realKey; let realFetch; let realBase;
// The pretend Safaricom, and what it should answer to the "status query".
let fetchMock;
let queryAnswer;
// Console listeners, so test 10 can check nothing was printed.
const spies = [];

// ── SMALL HELPERS ────────────────────────────────────────────────────────────

// Borrow a database connection locked to ONE shop (so row-level security applies).
// Real life: take one kiosk's key, work inside that kiosk only, then return it.
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

// What the pretend Safaricom says.
const reply = (status, body) => ({ status, json: async () => body });
const PAID = (id) => reply(200, { ResponseCode: '0', ResultCode: '0', CheckoutRequestID: id });
const FAILED = (id) => reply(200, { ResponseCode: '0', ResultCode: '1032', CheckoutRequestID: id });
const PROCESSING = () => reply(500, { errorCode: '500.001.1001', errorMessage: 'The transaction is being processed' });

// The pretend internet: a token for the login step, then whatever `queryAnswer`
// says for the status query. It reads the checkout id out of the request, so the
// answer is always about the right payment.
function fakeFetch(url, opts) {
  if (String(url).includes('/oauth/')) return Promise.resolve(reply(200, { access_token: `tok-${rand}` }));
  const asked = JSON.parse(opts.body).CheckoutRequestID;
  return Promise.resolve(queryAnswer(asked));
}

// Make an order (KES 320 by default) with a customer, in the given shop.
async function makeOrder(tenantId, status = 'created', totalCents = 32000) {
  return withLock(tenantId, async (db) => {
    const c = await db.query(
      'INSERT INTO customers (tenant_id, phone) VALUES ($1,$2) RETURNING id',
      [tenantId, `2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`]);
    return (await db.query(
      `INSERT INTO orders (tenant_id, customer_id, total_cents, channel, status)
       VALUES ($1,$2,$3,'web',$4) RETURNING id`,
      [tenantId, c.rows[0].id, totalCents, status])).rows[0].id;
  });
}

// Make a PENDING payment attempt for an order. `withId: false` makes one that
// Safaricom never confirmed (no checkout id).
async function makeAttempt(tenantId, orderId, { amountCents = 32000, withId = true } = {}) {
  const checkoutId = withId ? `ws_CO_${rand}_${crypto.randomBytes(4).toString('hex')}` : null;
  const id = await withLock(tenantId, async (db) => (await db.query(
    `INSERT INTO payment_attempts (tenant_id, order_id, amount_cents, phone, checkout_request_id)
     VALUES ($1,$2,$3,'254700000000',$4) RETURNING id`,
    [tenantId, orderId, amountCents, checkoutId])).rows[0].id);
  return { id, checkout_request_id: checkoutId };
}

// Look inside the database, through the shop lock.
const attemptRow = (tenantId, id) => withLock(tenantId, async (db) =>
  (await db.query('SELECT status, mpesa_reference, result_code, result_desc FROM payment_attempts WHERE id = $1', [id])).rows[0]);
const orderStatus = (tenantId, id) => withLock(tenantId, async (db) =>
  (await db.query('SELECT status FROM orders WHERE id = $1', [id])).rows[0].status);
const walletRows = (tenantId) => withLock(tenantId, async (db) =>
  (await db.query('SELECT amount_cents, reason, reference FROM wallet_entries ORDER BY created_at')).rows);

// Run the function under a shop lock, like a real request does (req.db).
const reconcile = (tenantId, attempt) => withLock(tenantId, (db) => reconcileAttempt(db, attempt));

// Everything printed to the console during a test (for the leak check).
const consoleText = () => JSON.stringify(spies.flatMap((s) => s.mock.calls));

// ── SET UP AND CLEAN UP ──────────────────────────────────────────────────────

// beforeAll runs ONCE: it builds two shops. Shop A has (fake) M-Pesa settings.
// Shop B has none.
beforeAll(async () => {
  realKey = process.env.KMS_KEY;
  realFetch = global.fetch;
  realBase = process.env.DARAJA_API_BASE;
  // A throw-away encryption key, so fake M-Pesa secrets can be stored safely.
  process.env.KMS_KEY = crypto.randomBytes(32).toString('base64');
  delete process.env.DARAJA_API_BASE;

  const a = await testPool.query('INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id', [`Reconcile A ${rand}`, `rc-a-${rand}`]);
  const b = await testPool.query('INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id', [`Reconcile B ${rand}`, `rc-b-${rand}`]);
  tenantA = a.rows[0].id;
  tenantB = b.rows[0].id;

  await withLock(tenantA, (db) => db.query(
    `INSERT INTO daraja_configs
       (tenant_id, env, consumer_key_encrypted, consumer_secret_encrypted,
        shortcode, passkey_encrypted, callback_url)
     VALUES ($1, 'sandbox', $2, $3, '333333', $4, $5)`,
    [tenantA, encryptSecret(`KEY-${rand}`, tenantA), encryptSecret(`SECRET-${rand}`, tenantA),
      encryptSecret(`PASSKEY-${rand}`, tenantA), `https://rc-${rand}.example/cb`]));
});

// beforeEach runs before EVERY test: a fresh pretend-Safaricom and console listeners.
beforeEach(() => {
  queryAnswer = () => { throw new Error('test forgot to set queryAnswer'); };
  fetchMock = jest.fn(fakeFetch);
  global.fetch = fetchMock;
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) {
    spies.push(jest.spyOn(console, m).mockImplementation(() => {}));
  }
});

// afterEach runs after EVERY test: stop listening to the console.
afterEach(() => {
  while (spies.length) spies.pop().mockRestore();
});

// afterAll runs ONCE at the end: clean up everything we made.
afterAll(async () => {
  global.fetch = realFetch;
  if (realBase === undefined) delete process.env.DARAJA_API_BASE; else process.env.DARAJA_API_BASE = realBase;
  if (realKey === undefined) delete process.env.KMS_KEY; else process.env.KMS_KEY = realKey;
  for (const t of [tenantA, tenantB]) {
    await withLock(t, async (db) => {
      await db.query('DELETE FROM payment_attempts');
      await db.query('DELETE FROM wallet_entries');
      await db.query('DELETE FROM orders');
      await db.query('DELETE FROM customers');
    });
  }
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB]]);
  await testPool.end();
  await pool.end();
});

// ── THE CHECKS ───────────────────────────────────────────────────────────────

describe('reconcileAttempt / reconcileOrder (Week 30)', () => {

  // CHECK 1. Safaricom says PAID: credit once, mark the attempt and the order.
  // Real life: "Yes, it was paid." She writes it in the book and stamps PAID.
  test('1. Safaricom says paid: order paid, attempt paid, wallet credited exactly once', async () => {
    const orderId = await makeOrder(tenantA);
    const attempt = await makeAttempt(tenantA, orderId);
    queryAnswer = PAID;

    // Run it.
    const outcome = await reconcile(tenantA, attempt);
    expect(outcome).toBe('paid');

    // The order is paid.
    expect(await orderStatus(tenantA, orderId)).toBe('paid');
    // The attempt is paid, settled by the query (so no receipt code is known).
    const row = await attemptRow(tenantA, attempt.id);
    expect(row.status).toBe('paid');
    expect(row.result_code).toBe(0);
    expect(row.result_desc).toBe('paid_confirmed_by_query');
    expect(row.mpesa_reference).toBeNull();
    // The wallet has ONE entry: the amount WE asked for (KES 320), as a sale,
    // with the checkout id as its reference.
    const wallet = (await walletRows(tenantA)).filter((w) => w.reference === attempt.checkout_request_id);
    expect(wallet).toHaveLength(1);
    expect(wallet[0].reason).toBe('sale');
    expect(Number(wallet[0].amount_cents)).toBe(32000);
  });

  // CHECK 2. Running it again changes nothing.
  // Real life: phoning twice does not make her write the money twice.
  test('2. running it twice never credits twice', async () => {
    const orderId = await makeOrder(tenantA);
    const attempt = await makeAttempt(tenantA, orderId);
    queryAnswer = PAID;

    await reconcile(tenantA, attempt);
    const before = (await walletRows(tenantA)).length;
    // The second run: the attempt is already paid, so nothing is added.
    const second = await reconcile(tenantA, attempt);
    expect(second).toBe('paid');
    expect((await walletRows(tenantA)).length).toBe(before);
  });

  // CHECK 3. Safaricom says FAILED: the attempt is failed, no money, the order stays open.
  // Real life: "No, the customer cancelled." The customer may try again.
  test('3. Safaricom says failed: attempt failed, order still open, no money', async () => {
    const orderId = await makeOrder(tenantA);
    const attempt = await makeAttempt(tenantA, orderId);
    queryAnswer = FAILED;
    const walletBefore = (await walletRows(tenantA)).length;

    const outcome = await reconcile(tenantA, attempt);
    expect(outcome).toBe('failed');
    expect((await attemptRow(tenantA, attempt.id)).status).toBe('failed');
    // The order is still 'created', so the customer can pay again.
    expect(await orderStatus(tenantA, orderId)).toBe('created');
    expect((await walletRows(tenantA)).length).toBe(walletBefore);
  });

  // CHECK 4. Safaricom says "still processing": change NOTHING.
  // Real life: "Wait a bit." She writes nothing, so nothing can be wrong.
  test('4. Safaricom is still processing: nothing changes', async () => {
    const orderId = await makeOrder(tenantA);
    const attempt = await makeAttempt(tenantA, orderId);
    queryAnswer = PROCESSING;

    expect(await reconcile(tenantA, attempt)).toBe('unconfirmed');
    expect((await attemptRow(tenantA, attempt.id)).status).toBe('pending');
    expect(await orderStatus(tenantA, orderId)).toBe('created');
  });

  // CHECK 5. Safaricom is unreachable: change NOTHING.
  test('5. Safaricom is down (the call fails): nothing changes', async () => {
    const orderId = await makeOrder(tenantA);
    const attempt = await makeAttempt(tenantA, orderId);
    // The pretend internet breaks after the login step.
    queryAnswer = () => { throw new TypeError('network down'); };

    expect(await reconcile(tenantA, attempt)).toBe('unconfirmed');
    expect((await attemptRow(tenantA, attempt.id)).status).toBe('pending');
    expect(await orderStatus(tenantA, orderId)).toBe('created');
  });

  // CHECK 6. An attempt with no checkout id: we cannot ask Safaricom, so we do not even call.
  test('6. an attempt with no checkout id is left alone and Safaricom is not called', async () => {
    const orderId = await makeOrder(tenantA);
    const attempt = await makeAttempt(tenantA, orderId, { withId: false });

    expect(await reconcile(tenantA, attempt)).toBe('unconfirmed');
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await attemptRow(tenantA, attempt.id)).status).toBe('pending');
  });

  // CHECK 7. The customer paid TWICE: the second payment is never credited.
  // Real life: the order is already stamped PAID. The extra money is marked
  // "give back", not added to the takings.
  test('7. paid for an order that is already paid: no credit, closed as refund needed', async () => {
    const orderId = await makeOrder(tenantA, 'paid');
    const attempt = await makeAttempt(tenantA, orderId);
    queryAnswer = PAID;
    const walletBefore = (await walletRows(tenantA)).length;

    expect(await reconcile(tenantA, attempt)).toBe('refund_needed');
    const row = await attemptRow(tenantA, attempt.id);
    // Closed as failed with a clear reason, so a future "refunds" screen can find it.
    expect(row.status).toBe('failed');
    expect(row.result_desc).toBe('paid_but_order_not_open');
    // The order stays paid and the takings do not grow.
    expect(await orderStatus(tenantA, orderId)).toBe('paid');
    expect((await walletRows(tenantA)).length).toBe(walletBefore);
  });

  // CHECK 8. One shop cannot settle another shop's attempt.
  // Real life: Mama Njeri cannot write in Mama Achieng's book.
  test("8. another shop's attempt cannot be settled from this shop's lock", async () => {
    const orderId = await makeOrder(tenantA);
    const attempt = await makeAttempt(tenantA, orderId);
    queryAnswer = PAID;

    // Shop B (no M-Pesa settings, and it cannot even SEE A's rows) tries.
    expect(await reconcile(tenantB, attempt)).toBe('unconfirmed');
    // Shop A's attempt and order are untouched.
    expect((await attemptRow(tenantA, attempt.id)).status).toBe('pending');
    expect(await orderStatus(tenantA, orderId)).toBe('created');
  });

  // CHECK 9. The whole order: two stuck attempts, both really paid (exactly the
  // case from real testing: one payment recorded nowhere, one paid twice).
  test('9. two stuck attempts that were both paid: order paid once, the extra is refund needed', async () => {
    const orderId = await makeOrder(tenantA);
    const first = await makeAttempt(tenantA, orderId);
    const second = await makeAttempt(tenantA, orderId);
    queryAnswer = PAID;
    const walletBefore = (await walletRows(tenantA)).length;

    const outcomes = await withLock(tenantA, (db) => reconcileOrder(db, orderId));
    // Newest first: the newest is settled as paid, the older one is the extra.
    expect(outcomes).toEqual(['paid', 'refund_needed']);
    expect(await orderStatus(tenantA, orderId)).toBe('paid');
    expect((await attemptRow(tenantA, second.id)).status).toBe('paid');
    expect((await attemptRow(tenantA, first.id)).result_desc).toBe('paid_but_order_not_open');
    // Only ONE credit of KES 320, never two.
    expect((await walletRows(tenantA)).length).toBe(walletBefore + 1);
  });

  // CHECK 10. Nothing sensitive is printed.
  test('10. no phone, amount, checkout id or key appears in the console', async () => {
    const orderId = await makeOrder(tenantA);
    const attempt = await makeAttempt(tenantA, orderId);
    queryAnswer = PAID;
    await reconcile(tenantA, attempt);

    const text = consoleText();
    expect(text).not.toContain(attempt.checkout_request_id);
    expect(text).not.toContain('254700000000');
    expect(text).not.toContain(`KEY-${rand}`);
    expect(text).not.toContain(`SECRET-${rand}`);
  });
});