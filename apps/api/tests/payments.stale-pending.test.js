// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/payments.stale-pending.test.js   (Week 30, no second charge)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Proves the rule added to payments.controller.js in Week 30: the till NEVER
//   sends a second M-Pesa request while an older one is unresolved. An old
//   "pending" attempt is first checked with Safaricom. It exists because a real
//   customer was charged twice: the first payment stayed 'pending' (its
//   confirmation was lost) and, after 2 minutes, the till allowed a second one.
//
// WHY IMPORTANT
//   A customer charged twice loses trust in the shop, and the shop owes a
//   refund. This is the lock that stops it.
//
// DANGER
//   1. Fake data and a fake Safaricom only. Never put a real key in this file.
//   2. It writes real rows for a moment. afterAll deletes only what it made.
//   3. To make an attempt "old", the test edits its created_at in the database.
//      That is a test trick. Real attempts get older by themselves.
//
// WHAT IT SOLVES
//   Locks in the five situations of an old pending attempt so nobody can weaken
//   the rule later (RULE 1: never delete a test to make a change pass).
//
// SYSTEM DESIGN PRINCIPLE
//   Never repeat a money action until you KNOW the first one did not happen.
//
// RULES
//   1. Names, phones and keys are fake.
//   2. The money check is in the DATABASE (orders, payment_attempts, wallet).
//   3. We count the calls made to Safaricom, so "no second prompt" is proven,
//      not assumed.
//
// PRACTICAL EXAMPLE
//   Test 1: the first prompt was really paid but never recorded. The customer
//   taps "Try again" 5 minutes later. The till asks Safaricom, learns it was
//   paid, marks the order paid and sends NO new prompt.
//
// HOW TO RUN
//   cd apps/api && npm test -- payments.stale-pending
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE (the 5 checks) — real life: the shopkeeper before ringing again
//   1  Really paid      = before ringing your phone again she checks her book with
//                         Safaricom: "it WAS paid". She stamps the order PAID and
//                         does not ring again.
//   2  Really failed    = "it was cancelled". She is free to ring again.
//   3  Still working    = "Safaricom says wait". She does NOT ring again.
//   4  Just rang (<2min)= she does not even phone Safaricom; she just says "wait,
//                         I rang you a moment ago" (stops a double tap).
//   5  No record of ring= if she cannot tell whether the first ring ever left,
//                         she cannot check it, so she may ring again.

import crypto from 'node:crypto';
import request from 'supertest';
import pg from 'pg';
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { encryptSecret } from '../src/utils/kms.js';

// Load the .env file (DATABASE_URL etc.) before we read process.env below.
dotenv.config();

// Our own database connection, used to set things up and look inside.
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// A random tag so two test runs never collide.
const rand = crypto.randomBytes(4).toString('hex');
const slugA = `sp-a-${rand}`;

// Boxes filled in beforeAll / used in the tests.
let tenantA; let sodaId;
let realKey; let realFetch; let realBase;
let fetchMock;
// What the pretend Safaricom answers to the "status query" in the current test.
let queryAnswer;

// ── SMALL HELPERS ────────────────────────────────────────────────────────────

// Borrow a database connection locked to ONE shop (so row-level security applies).
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

const reply = (status, body) => ({ status, json: async () => body });
const PAID = (id) => reply(200, { ResponseCode: '0', ResultCode: '0', CheckoutRequestID: id });
const FAILED = (id) => reply(200, { ResponseCode: '0', ResultCode: '1032', CheckoutRequestID: id });
const PROCESSING = () => reply(500, { errorCode: '500.001.1001', errorMessage: 'The transaction is being processed' });

// The pretend internet. Three kinds of call:
//   login (oauth)        -> a token
//   status query         -> whatever `queryAnswer` says for that checkout id
//   "send the prompt"    -> accepted, with a fresh checkout id
function fakeFetch(url, opts) {
  const u = String(url);
  if (u.includes('/oauth/')) return Promise.resolve(reply(200, { access_token: `tok-${rand}` }));
  if (u.includes('stkpushquery')) {
    return Promise.resolve(queryAnswer(JSON.parse(opts.body).CheckoutRequestID));
  }
  return Promise.resolve(reply(200, {
    ResponseCode: '0',
    MerchantRequestID: `mr-${rand}`,
    CheckoutRequestID: `ws_CO_${rand}_${crypto.randomBytes(4).toString('hex')}`,
  }));
}

// How many times did the code ask Safaricom to SEND a prompt (not login, not query)?
const promptsSent = () => fetchMock.mock.calls.filter(([u]) => {
  const s = String(u);
  return !s.includes('/oauth/') && !s.includes('stkpushquery');
}).length;
// How many times did it ask the status query?
const queriesSent = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('stkpushquery')).length;

// A fresh fake Kenyan phone per test, so the "3 prompts per phone" limit never
// leaks from one test into another.
const newPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;

// The customer's requests: NO login cookie, only the shop's address word.
const checkout = (body) => request(app).post(`/v1/storefront/${slugA}/checkout`).send(body);
const pay = (orderId) => request(app).post(`/v1/storefront/${slugA}/orders/${orderId}/pay`).send({});

// Make an order for one soda and start the FIRST payment. Returns the order id
// and the attempt's checkout id.
async function orderWithFirstPrompt() {
  const res = await checkout({ name: 'Amina', phone: newPhone(), items: [{ productId: sodaId, quantity: 1 }] });
  expect(res.status).toBe(201);
  const orderId = res.body.data.orderId;
  expect((await pay(orderId)).status).toBe(202);
  const attempt = (await attemptsFor(orderId))[0];
  return { orderId, checkoutId: attempt.checkout_request_id };
}

// Make the first attempt OLD (5 minutes) the way real time would, so the
// 2-minute "just sent" rule no longer applies.
const ageAttempts = (orderId) => withLock(tenantA, (db) => db.query(
  `UPDATE payment_attempts SET created_at = NOW() - interval '5 minutes' WHERE order_id = $1`, [orderId]));

// Look inside the database.
const attemptsFor = (orderId) => withLock(tenantA, async (db) => (await db.query(
  'SELECT status, checkout_request_id, result_desc FROM payment_attempts WHERE order_id = $1 ORDER BY created_at', [orderId])).rows);
const orderStatus = (orderId) => withLock(tenantA, async (db) =>
  (await db.query('SELECT status FROM orders WHERE id = $1', [orderId])).rows[0].status);
const walletCount = () => withLock(tenantA, async (db) =>
  Number((await db.query('SELECT count(*) AS n FROM wallet_entries')).rows[0].n));

// ── SET UP AND CLEAN UP ──────────────────────────────────────────────────────

// beforeAll runs ONCE: one shop with one product and (fake) M-Pesa settings.
beforeAll(async () => {
  realKey = process.env.KMS_KEY;
  realFetch = global.fetch;
  realBase = process.env.DARAJA_API_BASE;
  process.env.KMS_KEY = crypto.randomBytes(32).toString('base64');
  delete process.env.DARAJA_API_BASE;

  const a = await testPool.query('INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id', [`StalePending A ${rand}`, slugA]);
  tenantA = a.rows[0].id;

  await withLock(tenantA, async (db) => {
    sodaId = (await db.query(
      `INSERT INTO products (tenant_id, name, price_cents, status) VALUES ($1,'Soda',8000,'active') RETURNING id`,
      [tenantA])).rows[0].id;
    await db.query(
      `INSERT INTO daraja_configs
         (tenant_id, env, consumer_key_encrypted, consumer_secret_encrypted,
          shortcode, passkey_encrypted, callback_url)
       VALUES ($1, 'sandbox', $2, $3, '333333', $4, $5)`,
      [tenantA, encryptSecret(`KEY-${rand}`, tenantA), encryptSecret(`SECRET-${rand}`, tenantA),
        encryptSecret(`PASSKEY-${rand}`, tenantA), `https://sp-${rand}.example/cb`]);
  });
});

// beforeEach runs before EVERY test: a fresh pretend-Safaricom.
beforeEach(() => {
  queryAnswer = () => { throw new Error('test forgot to set queryAnswer'); };
  fetchMock = jest.fn(fakeFetch);
  global.fetch = fetchMock;
});

// afterAll runs ONCE: clean up everything we made.
afterAll(async () => {
  global.fetch = realFetch;
  if (realBase === undefined) delete process.env.DARAJA_API_BASE; else process.env.DARAJA_API_BASE = realBase;
  if (realKey === undefined) delete process.env.KMS_KEY; else process.env.KMS_KEY = realKey;
  await withLock(tenantA, async (db) => {
    await db.query('DELETE FROM payment_attempts');
    await db.query('DELETE FROM wallet_entries');
    await db.query('DELETE FROM orders');
    await db.query('DELETE FROM customers');
    await db.query('DELETE FROM products');
  });
  await testPool.query('DELETE FROM tenants WHERE id = $1', [tenantA]);
  await testPool.end();
  await pool.end();
});

// ── THE CHECKS ───────────────────────────────────────────────────────────────

describe('no second prompt while an older one is unresolved (Week 30)', () => {

  // CHECK 1. The first prompt was REALLY paid (just never recorded).
  // Real life: you paid, the shop never heard. When you ask to pay again, she
  // checks with Safaricom first, finds it was paid, and does not ring again.
  test('1. old attempt was really paid: order marked paid, NO new prompt, credited once', async () => {
    const { orderId, checkoutId } = await orderWithFirstPrompt();
    await ageAttempts(orderId);
    queryAnswer = PAID;
    // Forget the calls made while starting the first payment.
    fetchMock.mockClear();
    const walletBefore = await walletCount();

    // The customer taps "try again".
    const res = await pay(orderId);

    // Refused: there is nothing left to pay.
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('order_not_payable');
    // The order is now PAID (settled from Safaricom's answer).
    expect(await orderStatus(orderId)).toBe('paid');
    // Money was credited exactly once, with the checkout id as its reference.
    expect(await walletCount()).toBe(walletBefore + 1);
    // Safaricom was asked "what happened?" and was NOT asked to send a new prompt.
    expect(queriesSent()).toBe(1);
    expect(promptsSent()).toBe(0);
    // Still only the one attempt, now paid.
    const rows = await attemptsFor(orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'paid', checkout_request_id: checkoutId });
  });

  // CHECK 2. The first prompt really FAILED: a new prompt is allowed.
  // Real life: "it was cancelled" so she rings again.
  test('2. old attempt really failed: it is closed and a new prompt is sent', async () => {
    const { orderId } = await orderWithFirstPrompt();
    await ageAttempts(orderId);
    queryAnswer = FAILED;
    fetchMock.mockClear();

    const res = await pay(orderId);

    expect(res.status).toBe(202);
    expect(promptsSent()).toBe(1);
    // Two attempts now: the old one failed, the new one pending.
    const rows = await attemptsFor(orderId);
    expect(rows.map((r) => r.status)).toEqual(['failed', 'pending']);
    // The order is still open (nothing was paid).
    expect(await orderStatus(orderId)).toBe('created');
  });

  // CHECK 3. Safaricom says "still processing": refuse. Never risk a double charge.
  // Real life: "Safaricom says wait" so she does not ring again.
  test('3. Safaricom is still processing the old attempt: refused, no new prompt', async () => {
    const { orderId } = await orderWithFirstPrompt();
    await ageAttempts(orderId);
    queryAnswer = PROCESSING;
    fetchMock.mockClear();

    const res = await pay(orderId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('payment_in_progress');
    expect(promptsSent()).toBe(0);
    // Nothing changed: one attempt, still pending; order still open.
    const rows = await attemptsFor(orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(await orderStatus(orderId)).toBe('created');
  });

  // CHECK 4. A prompt sent under 2 minutes ago: refused WITHOUT bothering Safaricom.
  // Real life: a double tap. "I rang you a moment ago, wait."
  test('4. a prompt sent a moment ago is refused without calling Safaricom at all', async () => {
    const { orderId } = await orderWithFirstPrompt();
    fetchMock.mockClear();

    const res = await pay(orderId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('payment_in_progress');
    // Not even a login: this is the cheap local check.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 5. An old attempt Safaricom never confirmed as sent (no checkout id).
  // We cannot check it, so it must not block a new prompt for ever.
  test('5. an old attempt with no checkout id cannot be checked and does not block', async () => {
    const { orderId } = await orderWithFirstPrompt();
    await ageAttempts(orderId);
    // Pretend Safaricom's ids were never saved for that attempt.
    await withLock(tenantA, (db) => db.query(
      'UPDATE payment_attempts SET checkout_request_id = NULL WHERE order_id = $1', [orderId]));
    fetchMock.mockClear();

    const res = await pay(orderId);

    expect(res.status).toBe(202);
    // There was nothing to ask Safaricom about.
    expect(queriesSent()).toBe(0);
    expect(promptsSent()).toBe(1);
  });
});