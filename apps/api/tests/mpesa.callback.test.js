/**
 * ============================================================
 * FILE: apps/api/tests/mpesa.callback.test.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   Proves the M-Pesa callback (POST /callbacks/mpesa/:tenantId) credits a
 *   wallet exactly when it should, exactly once, and never otherwise.
 *
 * WHY IMPORTANT
 *   This route moves money. Each test below is one way money could be lost,
 *   invented or doubled.
 *
 * DANGER
 *   - Uses a FAKE Safaricom (global.fetch is replaced). No real call is made.
 *   - Creates its own two shops and deletes them at the end.
 *   - Uses a throw-away KMS_KEY so your real key is never touched.
 *   - Secrets, receipts and amounts must never reach console.* (test 16).
 *
 * WHAT IT SOLVES
 *   Day 3 Task 3 evidence: verified callback, one transaction, idempotent.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Test the behaviour you must never lose: no double credit, no credit
 *   without confirmation, no credit across shops, nothing half done.
 *
 * RULES
 *   1. Every test makes its own order and attempt (no shared state).
 *   2. Money is checked in the DATABASE (wallet_entries), not only the reply.
 *   3. Safaricom's answer is faked per test with answerQuery().
 *
 * PRACTICAL EXAMPLE
 *   Test 2: a pending attempt for KES 1,500, Safaricom confirms, callback
 *   arrives -> wallet +150000 cents, attempt paid, order paid.
 *   Test 3: the SAME callback again -> wallet still +150000 (not 300000).
 *
 * DECISIONS (and WHY)
 *   - Attempts are inserted directly: the pay route has its own tests.
 *   - The wallet is read with SUM(amount_cents) per shop.
 *
 * WHERE USED
 *   npm test (also in CI).
 *
 * TRADEOFFS
 *   + Fast, no network.
 *   - Safaricom's real behaviour is only as good as the fake; the sandbox
 *     walk-through covers the real thing.
 *
 * HOW TO USE
 *   npm test -- tests/mpesa.callback
 *
 * AI AUDIT NOTE
 *   Written by AI (declared in the Day 3 money audit).
 * ============================================================
 */
import crypto from 'node:crypto';
import request from 'supertest';
import pg from 'pg';
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { encryptSecret } from '../src/utils/kms.js';

dotenv.config();

const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rand = crypto.randomBytes(4).toString('hex');
const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' };

let realKey; let realFetch; let realBase;
let tenantA; let tenantB;
let fetchMock;
let queryAnswer;            // what the fake Safaricom says to a status query
const spies = [];

// -- helpers ----------------------------------------------------------
// withLock: act as a shop (set the same lock the app uses), then let go.
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

// The fake Safaricom: a token for OAuth, and queryAnswer() for status queries.
function fakeSafaricom(url, opts) {
  if (String(url).includes('/oauth/')) return Promise.resolve(reply(200, { access_token: `TOKEN-${rand}` }));
  if (queryAnswer === 'throw') return Promise.reject(new Error('network down'));
  const body = JSON.parse(opts.body);
  return Promise.resolve(reply(200, {
    ResponseCode: '0',
    CheckoutRequestID: body.CheckoutRequestID,
    ResultCode: queryAnswer === 'paid' ? '0' : '1032',
    ResultDesc: 'x',
  }));
}

// A pending order + attempt for a shop. Returns ids we need.
async function makePending(tenantId, { cents = 150000, orderStatus = 'created' } = {}) {
  const phone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
  const checkout = `ws_CO_${rand}_${crypto.randomBytes(4).toString('hex')}`;
  return withLock(tenantId, async (db) => {
    const cust = await db.query(
      'INSERT INTO customers (tenant_id, phone) VALUES ($1, $2) RETURNING id', [tenantId, phone]);
    const ord = await db.query(
      `INSERT INTO orders (tenant_id, customer_id, total_cents, status)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, cust.rows[0].id, cents, orderStatus]);
    const att = await db.query(
      `INSERT INTO payment_attempts
         (tenant_id, order_id, amount_cents, phone, checkout_request_id, merchant_request_id)
       VALUES ($1, $2, $3, '254711111111', $4, $5) RETURNING id`,
      [tenantId, ord.rows[0].id, cents, checkout, `mr-${checkout}`]);
    return { orderId: ord.rows[0].id, attemptId: att.rows[0].id, checkout };
  });
}

// Safaricom's message, in Daraja's exact shape.
function successBody(checkout, { amount = 1500, receipt } = {}) {
  return { Body: { stkCallback: {
    MerchantRequestID: 'mr', CheckoutRequestID: checkout, ResultCode: 0, ResultDesc: 'ok',
    CallbackMetadata: { Item: [
      { Name: 'Amount', Value: amount },
      { Name: 'MpesaReceiptNumber', Value: receipt || `R${crypto.randomBytes(5).toString('hex').toUpperCase()}` },
      { Name: 'TransactionDate', Value: 20261115210000 },
      { Name: 'PhoneNumber', Value: 254711111111 },
    ] },
  } } };
}
function failedBody(checkout) {
  return { Body: { stkCallback: {
    MerchantRequestID: 'mr', CheckoutRequestID: checkout, ResultCode: 1032, ResultDesc: 'Request cancelled by user',
  } } };
}

const post = (tenantId, body) => request(app).post(`/callbacks/mpesa/${tenantId}`).send(body);

async function state(tenantId, orderId) {
  return withLock(tenantId, async (db) => ({
    order: (await db.query('SELECT status FROM orders WHERE id = $1', [orderId])).rows[0].status,
    attempt: (await db.query(
      'SELECT status, mpesa_reference, result_desc FROM payment_attempts WHERE order_id = $1', [orderId])).rows[0],
    wallet: Number((await db.query(
      'SELECT COALESCE(SUM(amount_cents),0) AS t FROM wallet_entries')).rows[0].t),
  }));
}
const walletOf = async (t) => withLock(t, async (db) => Number((await db.query(
  'SELECT COALESCE(SUM(amount_cents),0) AS t FROM wallet_entries')).rows[0].t));

// -- setup / teardown -------------------------------------------------
beforeAll(async () => {
  realKey = process.env.KMS_KEY; realFetch = global.fetch; realBase = process.env.DARAJA_API_BASE;
  process.env.KMS_KEY = crypto.randomBytes(32).toString('base64');
  delete process.env.DARAJA_API_BASE;

  const a = await testPool.query('INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id',
    [`Cb A ${rand}`, `cb-a-${rand}`]);
  const b = await testPool.query('INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id',
    [`Cb B ${rand}`, `cb-b-${rand}`]);
  tenantA = a.rows[0].id; tenantB = b.rows[0].id;

  for (const t of [tenantA, tenantB]) {
    await withLock(t, (db) => db.query(
      `INSERT INTO daraja_configs
         (tenant_id, env, consumer_key_encrypted, consumer_secret_encrypted,
          shortcode, passkey_encrypted, callback_url)
       VALUES ($1,'sandbox',$2,$3,'333333',$4,$5)`,
      [t, encryptSecret(`K-${rand}`, t), encryptSecret(`S-${rand}`, t),
        encryptSecret(`P-${rand}`, t), `https://cb-${rand}.example/callbacks/mpesa/${t}`]));
  }
});

beforeEach(() => {
  queryAnswer = 'paid';
  fetchMock = jest.fn(fakeSafaricom);
  global.fetch = fetchMock;
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) {
    spies.push(jest.spyOn(console, m).mockImplementation(() => {}));
  }
});
afterEach(() => { while (spies.length) spies.pop().mockRestore(); });

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

// -- the checks -------------------------------------------------------
describe('POST /callbacks/mpesa/:tenantId', () => {

  test('1. unknown shop or junk id: 200 Accepted, nothing happens', async () => {
    for (const id of [crypto.randomUUID(), 'not-a-uuid', '123']) {
      const res = await post(id, successBody('x'));
      expect(res.status).toBe(200);
      expect(res.body).toEqual(ACCEPTED);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('2. a real payment: wallet credited, attempt paid, order paid (one transaction)', async () => {
    const p = await makePending(tenantA);
    const before = await walletOf(tenantA);
    const res = await post(tenantA, successBody(p.checkout, { receipt: 'QGH7XYZ123' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(ACCEPTED);
    const s = await state(tenantA, p.orderId);
    expect(s.order).toBe('paid');
    expect(s.attempt.status).toBe('paid');
    expect(s.attempt.mpesa_reference).toBe('QGH7XYZ123');
    expect(s.wallet - before).toBe(150000);
    const entry = await withLock(tenantA, (db) => db.query(
      "SELECT reason, amount_cents FROM wallet_entries WHERE reference = 'QGH7XYZ123'"));
    expect(entry.rows).toHaveLength(1);
    expect(entry.rows[0].reason).toBe('sale');
  });

  test('3. the SAME callback twice: credited once', async () => {
    const p = await makePending(tenantA);
    const body = successBody(p.checkout, { receipt: 'DUP0000001' });
    const before = await walletOf(tenantA);
    await post(tenantA, body);
    const second = await post(tenantA, body);
    expect(second.status).toBe(200);
    expect(await walletOf(tenantA) - before).toBe(150000);
  });

  test('4. two callbacks at the SAME moment: credited once', async () => {
    const p = await makePending(tenantA);
    const body = successBody(p.checkout, { receipt: 'RACE000001' });
    const before = await walletOf(tenantA);
    const [r1, r2] = await Promise.all([post(tenantA, body), post(tenantA, body)]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await walletOf(tenantA) - before).toBe(150000);
  });

  test('5. Safaricom says NOT paid (callback lies): nothing credited, attempt failed', async () => {
    queryAnswer = 'failed';
    const p = await makePending(tenantA);
    const before = await walletOf(tenantA);
    const res = await post(tenantA, successBody(p.checkout));
    expect(res.status).toBe(200);
    const s = await state(tenantA, p.orderId);
    expect(s.attempt.status).toBe('failed');
    expect(s.order).toBe('created');
    expect(s.wallet).toBe(before);
  });

  test('6. Safaricom cannot be reached: nothing changes, attempt stays pending', async () => {
    queryAnswer = 'throw';
    const p = await makePending(tenantA);
    const before = await walletOf(tenantA);
    const res = await post(tenantA, successBody(p.checkout));
    expect(res.status).toBe(200);
    const s = await state(tenantA, p.orderId);
    expect(s.attempt.status).toBe('pending');
    expect(s.order).toBe('created');
    expect(s.wallet).toBe(before);
  });

  test('7. a made-up CheckoutRequestID: ignored, Safaricom never asked', async () => {
    const res = await post(tenantA, successBody(`ws_CO_${rand}_nonexistent`));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("8. shop B's callback cannot pay shop A's attempt", async () => {
    const p = await makePending(tenantA);
    const beforeA = await walletOf(tenantA);
    const beforeB = await walletOf(tenantB);
    const res = await post(tenantB, successBody(p.checkout));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    const s = await state(tenantA, p.orderId);
    expect(s.attempt.status).toBe('pending');
    expect(s.wallet).toBe(beforeA);
    expect(await walletOf(tenantB)).toBe(beforeB);
  });

  test('9. wrong amount (paid less): not credited, failed as amount_mismatch, receipt kept', async () => {
    const p = await makePending(tenantA, { cents: 150000 });
    const before = await walletOf(tenantA);
    await post(tenantA, successBody(p.checkout, { amount: 1, receipt: 'SHORT00001' }));
    const s = await state(tenantA, p.orderId);
    expect(s.attempt.status).toBe('failed');
    expect(s.attempt.result_desc).toBe('amount_mismatch');
    expect(s.attempt.mpesa_reference).toBe('SHORT00001');
    expect(s.order).toBe('created');
    expect(s.wallet).toBe(before);
  });

  test('10. order no longer open (cancelled): not credited, failed as order_not_open', async () => {
    const p = await makePending(tenantA, { orderStatus: 'cancelled' });
    const before = await walletOf(tenantA);
    await post(tenantA, successBody(p.checkout, { receipt: 'LATE000001' }));
    const s = await state(tenantA, p.orderId);
    expect(s.attempt.status).toBe('failed');
    expect(s.attempt.result_desc).toBe('order_not_open');
    expect(s.attempt.mpesa_reference).toBe('LATE000001');
    expect(s.order).toBe('cancelled');
    expect(s.wallet).toBe(before);
  });

  test('11. customer cancelled (ResultCode 1032): attempt failed, Safaricom confirms, no credit', async () => {
    queryAnswer = 'failed';
    const p = await makePending(tenantA);
    const before = await walletOf(tenantA);
    await post(tenantA, failedBody(p.checkout));
    const s = await state(tenantA, p.orderId);
    expect(s.attempt.status).toBe('failed');
    expect(s.order).toBe('created');
    expect(s.wallet).toBe(before);
  });

  test('12. callback says failed but Safaricom says paid: nothing changes (needs a human)', async () => {
    queryAnswer = 'paid';
    const p = await makePending(tenantA);
    const before = await walletOf(tenantA);
    await post(tenantA, failedBody(p.checkout));
    const s = await state(tenantA, p.orderId);
    expect(s.attempt.status).toBe('pending');
    expect(s.wallet).toBe(before);
  });

  test('13. malformed bodies are ignored with 200 Accepted', async () => {
    const p = await makePending(tenantA);
    const bad = [
      {}, { Body: {} }, { Body: { stkCallback: null } },
      { Body: { stkCallback: { CheckoutRequestID: "x'; DROP TABLE orders;--", ResultCode: 0 } } },
      { Body: { stkCallback: { CheckoutRequestID: p.checkout, ResultCode: 0 } } },               // no metadata
      successBody(p.checkout, { amount: -5 }),
      successBody(p.checkout, { amount: 1500.005 }),
      { Body: { stkCallback: { CheckoutRequestID: p.checkout, ResultCode: 'abc' } } },
    ];
    for (const b of bad) {
      const res = await post(tenantA, b);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(ACCEPTED);
    }
    const s = await state(tenantA, p.orderId);
    expect(s.attempt.status).toBe('pending');
  });

  test('14. the amount in the callback is shillings: 1500.00 equals 150000 cents', async () => {
    const p = await makePending(tenantA, { cents: 150000 });
    const before = await walletOf(tenantA);
    await post(tenantA, successBody(p.checkout, { amount: 1500.0, receipt: 'DEC0000001' }));
    expect(await walletOf(tenantA) - before).toBe(150000);
  });

  test('15. the SAME receipt on a different order is refused by the database: one credit only', async () => {
    const p1 = await makePending(tenantA);
    const p2 = await makePending(tenantA);
    const before = await walletOf(tenantA);
    await post(tenantA, successBody(p1.checkout, { receipt: 'SAMERCPT01' }));
    const res = await post(tenantA, successBody(p2.checkout, { receipt: 'SAMERCPT01' }));
    expect(res.status).toBe(200);
    expect(await walletOf(tenantA) - before).toBe(150000);
    const s2 = await state(tenantA, p2.orderId);
    expect(s2.order).toBe('created');
    expect(s2.attempt.status).toBe('pending');
  });

  test('16. nothing sensitive reaches console.*', async () => {
    const p = await makePending(tenantA);
    await post(tenantA, successBody(p.checkout, { receipt: 'LOGCHECK01' }));
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const secret of ['LOGCHECK01', '150000', '254711111111', `K-${rand}`, `S-${rand}`, `P-${rand}`, `TOKEN-${rand}`]) {
      expect(logged).not.toContain(secret);
    }
  });

  test('17. a deleted shop is ignored', async () => {
    const t = await testPool.query(
      "INSERT INTO tenants (name, slug, status) VALUES ($1,$2,'deleted') RETURNING id",
      [`Cb D ${rand}`, `cb-d-${rand}`]);
    const res = await post(t.rows[0].id, successBody('x'));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    await testPool.query('DELETE FROM tenants WHERE id = $1', [t.rows[0].id]);
  });

  test('18. GET on the callback address is a normal 404', async () => {
    const res = await request(app).get(`/callbacks/mpesa/${tenantA}`);
    expect(res.status).toBe(404);
  });
});