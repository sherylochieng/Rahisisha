/**
 * ============================================================
 * FILE: apps/api/tests/wallet.entries.test.js  (Week 29 Day 4)
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   Proves GET /v1/wallet/entries (the data behind the Payments page):
 *   newest first, grouped by NAIROBI day, a correct running total that stays
 *   correct across pages, and no other shop's money.
 *
 * WHY IMPORTANT
 *   This is the owner's money. A wrong running total, a day that lands on the
 *   wrong date, or another shop's balance leaking in would each be a serious
 *   trust failure.
 *
 * HOW IT WORKS
 *   Three throw-away shops get ledger rows at FIXED times. One entry is at
 *   21:30 UTC on 1 Jan, which is 00:30 on 2 Jan in Nairobi, to prove days are
 *   Nairobi days. Teardown deletes everything it made.
 *
 * DANGER
 *   1. Totals must be computed BEFORE the page is cut. Tests 5 and 7 fail if
 *      page 2 restarts from zero.
 *   2. Never use "now" for ledger times: the expected days and totals would
 *      change from run to run.
 *   3. It writes real rows to the test database for a moment. It only
 *      touches rows it created and deletes them in afterAll.
 *
 * WHAT IT SOLVES
 *   Day 4 Task 3 proof: day grouping, running total, paging, isolation,
 *   read-only endpoint.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Test the rule with known numbers: fixed times in, known totals out.
 *
 * RULES
 *   1. Fixed timestamps only.
 *   2. Money is whole cents (integers).
 *   3. Every row this file creates is deleted in afterAll.
 *
 * PRACTICAL EXAMPLE
 *   Shop A's ledger nets to 220000 cents (KES 2,200.00). The newest row must
 *   say balanceAfterCents 220000, on page 1 or page 4, with pages of 1, 2 or 4.
 *
 * WHERE USED
 *   npm test (whole suite, CI) and npm test -- tests/wallet.entries.
 *
 * TRADEOFFS
 *   + Self-contained: no seed data needed.
 *   - Test 6 reads the dashboard too, so it also depends on that endpoint.
 *
 * HOW TO USE
 *   npm test -- tests/wallet.entries
 *
 * AI AUDIT NOTE
 *   Written by AI (declared in the Day 4 audit).
 * ============================================================
 *
 * ============================================================
 * EXPLAINED PIECE BY PIECE (simple words, real life)
 * ============================================================
 *
 * PIECE 1: LEDGER_A  =  "A SMALL PASSBOOK WITH KNOWN NUMBERS"
 *   Six entries on three Nairobi days, with one at 00:30 and one tie.
 *   Real life: a practice cash book where you already know the answers.
 *
 * PIECE 2: the setup (beforeAll)  =  "BUILD THREE SMALL SHOPS"
 *   Shop A gets the passbook, shop B gets one big secret amount, the empty
 *   shop gets nothing.
 *
 * PIECE 3: tests 1 and 2  =  "THE BASICS"
 *   Login needed, newest first, exactly the agreed fields, cents are integers.
 *
 * PIECE 4: tests 3 and 4  =  "WHICH DAY, AND THE DAY'S TOTAL"
 *   The 00:30 entry belongs to the next Nairobi day. Each day's total adds up
 *   all that day's entries.
 *
 * PIECE 5: tests 5 and 6  =  "THE RUNNING BALANCE"
 *   Every row shows the balance right after it, and the newest one matches the
 *   dashboard's wallet balance.
 *
 * PIECE 6: test 7  =  "TURN EVERY PAGE"
 *   Pages of 1, 2 and 4 return the same rows with the same totals. Real life:
 *   the balance column must not change just because you read the book in
 *   smaller chunks.
 *
 * PIECE 7: tests 8 to 11  =  "THE SAFETY PROOFS"
 *   Shop B's money never leaks, an empty shop is fine, a bad bookmark is a
 *   400, and the endpoint cannot change money.
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

// ---------------------------------------------------------------
// SHARED STATE
// testPool: our own direct door to the database, used only to build and tidy
//   the test data (the app has its own pool).
// rand: a short random word added to every name so two runs never clash.
// tenantA / tenantB / tenantEmpty: the three pretend shops.
// cookieX: the login cookie for each shop.
// ---------------------------------------------------------------
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rand = crypto.randomBytes(4).toString('hex');

let tenantA; let tenantB; let tenantEmpty;
let cookieA; let cookieB; let cookieEmpty;

// LEDGER_A: shop A's passbook. WHY these numbers: the answers are easy to check
//   by hand. Day 1 = 100000 + 50000 = 150000. Day 2 = -20000 + 30000 - 10000 = 0.
//   Day 3 = 70000. Whole book = 220000.
// [amount_cents, reason, UTC time]. Oldest first.
// Nairobi (UTC+3) days: Jan 1 = first three, Jan 2 = next two, Jan 3 = last.
const LEDGER_A = [
  [100000, 'sale',       '2026-01-01 06:00:00+00'],   // Jan 1 09:00
  [ 50000, 'sale',       '2026-01-01 10:00:00+00'],   // Jan 1 13:00
  [-20000, 'commission', '2026-01-01 21:30:00+00'],   // Jan 2 00:30 Nairobi!
  [ 30000, 'sale',       '2026-01-02 08:00:00+00'],   // Jan 2
  [-10000, 'refund',     '2026-01-02 08:00:00+00'],   // Jan 2, same time as above (tie)
  [ 70000, 'sale',       '2026-01-03 12:00:00.123456+00'], // Jan 3
];
const TOTAL_A = 220000;

// makeCookie: signs a login token for one shop (a staff badge for that shop).
function makeCookie(tenantId) {
  const token = jwt.sign({ user_id: 1, tenant_id: tenantId, role: 'owner' },
    process.env.JWT_SECRET, { expiresIn: '1h' });
  return `token=${token}`;
}

// withLock: act as one shop for a moment (the RLS key), then give the key back.
//   WHY finally: the key is always returned, even if the insert fails.
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

// get: calls the wallet endpoint like the Payments page would (shop A by default).
const get = (qs = '', cookie = cookieA) =>
  request(app).get(`/v1/wallet/entries${qs}`).set('Cookie', cookie);

// walk: turn every page of the passbook and return all rows in order.
//   The 50-turn limit stops a broken pager from running forever.
async function walk(limit, cookie = cookieA) {
  const all = [];
  let cursor = null;
  for (let i = 0; i < 50; i++) {
    const res = await get(`?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`, cookie);
    expect(res.status).toBe(200);
    all.push(...res.body.data);
    cursor = res.body.nextCursor;
    if (!cursor) return all;
  }
  throw new Error('paging never ended');
}

// ---------------------------------------------------------------
// beforeAll: build the pretend market once, before any test runs
// ---------------------------------------------------------------
beforeAll(async () => {
  const ids = [];
  for (const n of ['A', 'B', 'E']) {
    const t = await testPool.query('INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id',
      [`Wallet ${n} ${rand}`, `wallet-${n.toLowerCase()}-${rand}`]);
    ids.push(t.rows[0].id);
  }
  [tenantA, tenantB, tenantEmpty] = ids;
  [cookieA, cookieB, cookieEmpty] = ids.map(makeCookie);

  // Shop A gets the six passbook lines. reference = 'ref-<amount>' so each line
  // is easy to spot.
  await withLock(tenantA, async (db) => {
    for (const [amount, reason, ts] of LEDGER_A) {
      await db.query(
        `INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference, created_at)
         VALUES ($1,$2,$3,$4,$5)`, [tenantA, amount, reason, `ref-${amount}`, ts]);
    }
  });
  // Shop B gets one big amount with a 'B-secret' reference, to catch any leak.
  await withLock(tenantB, (db) => db.query(
    `INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference)
     VALUES ($1, 999999, 'sale', 'B-secret-money')`, [tenantB]));
});

// ---------------------------------------------------------------
// afterAll: delete only what this file created, then close the doors.
// ---------------------------------------------------------------
afterAll(async () => {
  for (const t of [tenantA, tenantB]) {
    await withLock(t, (db) => db.query('DELETE FROM wallet_entries'));
  }
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB, tenantEmpty]]);
  await testPool.end();
  await pool.end();
});

describe('GET /v1/wallet/entries', () => {

  // TEST 1. Real life: no badge, no entry.
  test('1. no login cookie: 401', async () => {
    expect((await request(app).get('/v1/wallet/entries')).status).toBe(401);
  });

  // TEST 2. Newest first, exact field list, money is a whole number.
  //   The two entries at the same time can come in either order, so we compare
  //   them sorted.
  test('2. newest first, every row has the agreed fields', async () => {
    const res = await get('?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(6);
    // the two entries at the same time (30000 and -10000) may come in either order
    expect(res.body.data.slice(1, 3).map((r) => r.amountCents).sort((a, b) => a - b))
      .toEqual([-10000, 30000]);
    expect(res.body.data[0].amountCents).toBe(70000);
    expect(res.body.data.at(-1).amountCents).toBe(100000);
    for (const r of res.body.data) {
      expect(Object.keys(r).sort()).toEqual(
        ['amountCents', 'balanceAfterCents', 'createdAt', 'day', 'dayTotalCents', 'id', 'reason', 'reference']);
      expect(Number.isInteger(r.amountCents)).toBe(true);
    }
  });

  // TEST 3. The 00:30 trap: 21:30 UTC is already the next day in Nairobi.
  test('3. days are NAIROBI days (21:30 UTC counts as the next day)', async () => {
    const res = await get('?limit=100');
    const dayOf = (cents) => res.body.data.find((r) => r.amountCents === cents).day;
    expect(dayOf(100000)).toBe('2026-01-01');
    expect(dayOf(50000)).toBe('2026-01-01');
    expect(dayOf(-20000)).toBe('2026-01-02');
    expect(dayOf(30000)).toBe('2026-01-02');
    expect(dayOf(70000)).toBe('2026-01-03');
  });

  // TEST 4. Day 2 nets to exactly 0 (-20000 + 30000 - 10000), a good trap.
  test('4. day totals add up the whole day', async () => {
    const res = await get('?limit=100');
    const totals = {};
    for (const r of res.body.data) totals[r.day] = r.dayTotalCents;
    expect(totals).toEqual({ '2026-01-01': 150000, '2026-01-02': 0, '2026-01-03': 70000 });
  });

  // TEST 5. Replay the passbook oldest first, adding as we go. Every row must
  //   already say the same number. The newest row must equal the grand total.
  test('5. running total: each row is the balance right after it', async () => {
    const res = await get('?limit=100');
    const oldestFirst = [...res.body.data].reverse();
    let running = 0;
    for (const r of oldestFirst) {
      running += r.amountCents;
      expect(r.balanceAfterCents).toBe(running);
    }
    expect(res.body.data[0].balanceAfterCents).toBe(TOTAL_A);
  });

  // TEST 6. Two different pages must tell the same story: the Payments page
  //   balance and the dashboard balance are the same SUM.
  test('6. the newest running total equals the wallet balance on the dashboard', async () => {
    const dash = await request(app).get('/v1/dashboard').set('Cookie', cookieA);
    const entries = await get('?limit=1');
    expect(entries.body.data[0].balanceAfterCents).toBe(Number(dash.body.data.balanceCents));
  });

  // TEST 7. Read the book in chunks of 1, 2 and 4. Rows, balances and day totals
  //   must match the one-big-page answer exactly (totals worked out BEFORE paging).
  test('7. paging by 2 loses nothing, repeats nothing, and totals stay right on every page', async () => {
    const all = (await get('?limit=100')).body.data;
    for (const size of [1, 2, 4]) {
      const walked = await walk(size);
      expect(walked.map((r) => r.id)).toEqual(all.map((r) => r.id));
      expect(walked.map((r) => r.balanceAfterCents)).toEqual(all.map((r) => r.balanceAfterCents));
      expect(walked.map((r) => r.dayTotalCents)).toEqual(all.map((r) => r.dayTotalCents));
    }
  });

  // TEST 8. The privacy proof for money.
  test('8. shop B sees only its own money; shop A never sees it', async () => {
    const b = await get('?limit=100', cookieB);
    expect(b.body.data.length).toBe(1);
    expect(b.body.data[0].balanceAfterCents).toBe(999999);
    expect(JSON.stringify((await get('?limit=100')).body)).not.toContain('B-secret');
  });

  // TEST 9. A new shop with no payments gets an empty list, not an error. The web
  //   page turns this into "No payments yet."
  test('9. a shop with no money movement gets an empty list', async () => {
    const res = await get('', cookieEmpty);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  // TEST 10. A forged bookmark is refused (400); silly limits are tamed.
  test('10. a made-up cursor is a 400, junk limit is tolerated', async () => {
    expect((await get('?cursor=garbage')).status).toBe(400);
    expect((await get('?limit=abc')).body.data.length).toBe(6);
    expect((await get('?limit=0')).body.data.length).toBe(1);
  });

  // TEST 11. The ledger is append-only: there is no way to write through here.
  //   Unknown methods fall through to the 404 catch-all and the data is unchanged.
  test('11. this endpoint only reads: POST/PUT/DELETE are not routes', async () => {
    for (const method of ['post', 'put', 'delete']) {
      const res = await request(app)[method]('/v1/wallet/entries').set('Cookie', cookieA);
      expect(res.status).toBe(404);
    }
    expect((await get('?limit=100')).body.data.length).toBe(6);
  });
});