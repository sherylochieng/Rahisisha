/**
 * ============================================================
 * FILE: apps/api/tests/orders.list.test.js  (Week 29 Day 4 follow-up)
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   Proves GET /v1/orders (the data behind the Orders page): newest first,
 *   each order carries the customer's name and phone, paging never skips or
 *   repeats an order, a bad bookmark is a 400, and no other shop's orders
 *   or customers leak in.
 *
 * WHY IMPORTANT
 *   The Orders page is where the owner decides what to pack and send. A
 *   missing order is a lost sale. Another shop's order (with a customer's
 *   phone number) is a privacy breach.
 *
 * HOW IT WORKS
 *   Three throw-away shops. Shop A gets five orders at FIXED times (two share
 *   one timestamp, one has microseconds). Shop B gets one order with a secret
 *   phone. The empty shop gets nothing. Teardown deletes everything it made.
 *
 * DANGER
 *   1. Never use "now" for order times: the expected order would change from
 *      run to run.
 *   2. Orders must be deleted BEFORE their customers (the database refuses to
 *      delete a customer that still has orders).
 *   3. It writes real rows to the test database for a moment. It only touches
 *      rows it created.
 *
 * WHAT IT SOLVES
 *   Proof for the upgraded listOrders: newest-first keyset paging, customer
 *   fields, and shop isolation.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Test the rule with known data: fixed times in, a known order out.
 *
 * RULES
 *   1. Fixed timestamps only.
 *   2. Every row this file creates is deleted in afterAll.
 *   3. Phone numbers are test values, never real ones.
 *
 * PRACTICAL EXAMPLE
 *   Shop A's newest order is ord-5 (3 Jan). Reading with pages of 1, 2 or 4
 *   must always give ord-5, ord-4, ord-3, ord-2, ord-1 in that order.
 *
 * WHERE USED
 *   npm test (whole suite, CI) and npm test -- tests/orders.list
 *
 * TRADEOFFS
 *   + Self-contained: no seed data needed.
 *   - Reads through the real API, so it also depends on login cookies.
 *
 * HOW TO USE
 *   npm test -- tests/orders.list
 *
 * AI AUDIT NOTE
 *   Written by AI at Sheryl's request.
 * ============================================================
 *
 * ============================================================
 * EXPLAINED PIECE BY PIECE (simple words, real life)
 * ============================================================
 *
 * PIECE 1: ORDERS_A  =  "FIVE ORDER SLIPS WITH KNOWN DATES"
 *   Real life: a practice spike of order slips where you already know which
 *   is newest. Two have the very same time, to test the tie rule.
 *
 * PIECE 2: beforeAll  =  "BUILD THREE SMALL SHOPS"
 *   Shop A gets customers and the five slips, shop B gets one secret slip,
 *   the empty shop gets none.
 *
 * PIECE 3: tests 1 to 3  =  "THE BASICS"
 *   Login needed, newest first, the right customer on the right order.
 *
 * PIECE 4: test 4  =  "TURN EVERY PAGE"
 *   Pages of 1, 2 and 4 give the same orders in the same order, with none
 *   missed or repeated. Real life: reading the slips in smaller handfuls must
 *   not change the pile.
 *
 * PIECE 5: tests 5 to 8  =  "THE SAFETY PROOFS"
 *   Shop B's order never leaks, shop A's bookmark cannot be used to peek at A,
 *   an empty shop is fine, and a bad bookmark is a 400.
 * ============================================================
 */
import crypto from 'node:crypto';
import request from 'supertest';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import app from '../src/app.js';
import { pool } from '../src/db/pool.js';

dotenv.config();

const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rand = crypto.randomBytes(4).toString('hex');

let tenantA; let tenantB; let tenantEmpty;
let cookieA; let cookieB; let cookieEmpty;

// [reference, customer index (0 or 1), total_cents, status, UTC time]
// Oldest first. ord-3 and ord-4 share one time (the tie). ord-5 has microseconds.
const ORDERS_A = [
  ['ord-1', 0, 10000, 'created',   '2026-01-01 06:00:00+00'],
  ['ord-2', 1, 20000, 'paid',      '2026-01-02 08:00:00+00'],
  ['ord-3', 0, 30000, 'packed',    '2026-01-03 09:00:00+00'],
  ['ord-4', 1, 40000, 'cancelled', '2026-01-03 09:00:00+00'],
  ['ord-5', 0, 50000, 'created',   '2026-01-04 12:00:00.123456+00'],
];
const CUSTOMERS_A = [
  { name: 'Amina Test', phone: `+2547000${rand.slice(0, 5)}1` },
  { name: 'Brian Test', phone: `+2547000${rand.slice(0, 5)}2` },
];
const SECRET_PHONE = `+2547999${rand.slice(0, 5)}9`;

const idsByNote = {};   // order id -> its label, so failures read nicely

function makeCookie(tenantId) {
  const token = jwt.sign({ user_id: 1, tenant_id: tenantId, role: 'owner' },
    process.env.JWT_SECRET, { expiresIn: '1h' });
  return `token=${token}`;
}

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

const get = (qs = '', cookie = cookieA) =>
  request(app).get(`/v1/orders${qs}`).set('Cookie', cookie);

// Walk every page with a given page size, returning all orders in order
async function walk(limit, cookie = cookieA) {
  const all = [];
  let cursor = null;
  for (let i = 0; i < 20; i++) {
    const res = await get(`?limit=${limit}` + (cursor ? `&cursor=${cursor}` : ''), cookie);
    expect(res.status).toBe(200);
    all.push(...res.body.data);
    cursor = res.body.nextCursor;
    if (!cursor) return all;
  }
  throw new Error('paging never ended');
}

beforeAll(async () => {
  const ids = [];
  for (const n of ['A', 'B', 'E']) {
    const t = await testPool.query('INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id',
      [`Orders ${n} ${rand}`, `orders-${n.toLowerCase()}-${rand}`]);
    ids.push(t.rows[0].id);
  }
  [tenantA, tenantB, tenantEmpty] = ids;
  [cookieA, cookieB, cookieEmpty] = ids.map(makeCookie);

  // Shop A: two customers, five orders
  await withLock(tenantA, async (db) => {
    const custIds = [];
    for (const c of CUSTOMERS_A) {
      const r = await db.query(
        'INSERT INTO customers (tenant_id, phone, name) VALUES ($1,$2,$3) RETURNING id',
        [tenantA, c.phone, c.name]);
      custIds.push(r.rows[0].id);
    }
    for (const [ref, ci, total, status, ts] of ORDERS_A) {
      const r = await db.query(
        `INSERT INTO orders (tenant_id, customer_id, status, channel, total_cents, note, created_at)
         VALUES ($1,$2,$3,'web',$4,$5,$6) RETURNING id`,
        [tenantA, custIds[ci], status, total, ref, ts]);
      idsByNote[r.rows[0].id] = ref;
    }
  });

  // Shop B: one customer with a secret phone, one order
  await withLock(tenantB, async (db) => {
    const c = await db.query(
      'INSERT INTO customers (tenant_id, phone, name) VALUES ($1,$2,$3) RETURNING id',
      [tenantB, SECRET_PHONE, 'B Secret']);
    await db.query(
      `INSERT INTO orders (tenant_id, customer_id, status, channel, total_cents, note)
       VALUES ($1,$2,'created','web',99999,'B-secret-order')`, [tenantB, c.rows[0].id]);
  });
});

afterAll(async () => {
  // Orders first, then customers (customers cannot be deleted while orders use them)
  for (const t of [tenantA, tenantB]) {
    await withLock(t, async (db) => {
      await db.query('DELETE FROM orders');
      await db.query('DELETE FROM customers');
    });
  }
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB, tenantEmpty]]);
  await testPool.end();
  await pool.end();
});

const refs = (orders) => orders.map((o) => idsByNote[o.id]);

describe('GET /v1/orders (Week 29 Day 4 follow-up)', () => {

  // TEST 1. Real life: no badge, no entry.
  test('1. no login cookie: 401', async () => {
    expect((await request(app).get('/v1/orders')).status).toBe(401);
  });

  // TEST 2. Newest first, and the agreed fields (the old ones are all still there)
  test('2. newest first, with the agreed fields and no internal cursor field', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.nextCursor).toBeNull();            // 5 orders fit in the default 10
    const r = refs(res.body.data);
    // ord-3 and ord-4 share a time, so they may come in either order
    expect(r[0]).toBe('ord-5');
    expect(r.slice(1, 3).sort()).toEqual(['ord-3', 'ord-4']);
    expect(r.slice(3)).toEqual(['ord-2', 'ord-1']);
    expect(Object.keys(res.body.data[0]).sort()).toEqual([
      'channel', 'created_at', 'customer_id', 'customer_name', 'customer_phone',
      'id', 'status', 'total_cents',
    ]);
    expect(Number.isInteger(res.body.data[0].total_cents)).toBe(true);
  });

  // TEST 3. The right customer on the right order
  test('3. each order shows its own customer name and phone', async () => {
    const res = await get();
    const byRef = Object.fromEntries(res.body.data.map((o) => [idsByNote[o.id], o]));
    expect(byRef['ord-5'].customer_name).toBe('Amina Test');
    expect(byRef['ord-5'].customer_phone).toBe(CUSTOMERS_A[0].phone);
    expect(byRef['ord-2'].customer_name).toBe('Brian Test');
    expect(byRef['ord-2'].customer_phone).toBe(CUSTOMERS_A[1].phone);
  });

  // TEST 4. Pages of 1, 2 and 4: same orders, same order, none missed or repeated
  test('4. paging by 1, 2 and 4 returns the same five orders once each', async () => {
    const whole = refs((await get()).body.data);
    for (const size of [1, 2, 4]) {
      const paged = refs(await walk(size));
      expect(paged).toHaveLength(5);
      expect(new Set(paged).size).toBe(5);
      expect(paged).toEqual(whole);
    }
  });

  // TEST 5. Shop B's order and its secret phone never appear for shop A
  test("5. shop A never sees shop B's order or customer phone", async () => {
    const text = JSON.stringify((await walk(2)));
    expect(text).not.toContain('B-secret');
    expect(text).not.toContain(SECRET_PHONE);
    const b = await get('', cookieB);
    expect(b.body.data).toHaveLength(1);
    expect(b.body.data[0].customer_phone).toBe(SECRET_PHONE);
  });

  // TEST 6. A bookmark made for shop A cannot show shop A's orders to shop B
  test("6. shop A's bookmark used by shop B still returns only shop B's rows", async () => {
    const page1 = await get('?limit=1');
    const cursorA = page1.body.nextCursor;
    expect(cursorA).toBeTruthy();
    const asB = await get(`?limit=10&cursor=${cursorA}`, cookieB);
    expect(asB.status).toBe(200);
    expect(JSON.stringify(asB.body.data)).not.toContain('Test');   // none of shop A's names
  });

  // TEST 7. A shop with no orders
  test('7. a shop with no orders gets an empty list and no bookmark', async () => {
    const res = await get('', cookieEmpty);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  // TEST 8. A bad bookmark is a clean 400 (the old uuid-style bookmark too)
  test('8. a bad cursor is a 400 with a clear message', async () => {
    for (const bad of ['garbage', '00000000-0000-0000-0000-000000000000']) {
      const res = await get(`?cursor=${bad}`);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid cursor');
    }
  });
});