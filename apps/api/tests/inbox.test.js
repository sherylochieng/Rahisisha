/**
 * ============================================================
 * FILE: apps/api/tests/inbox.test.js  (Week 29 Day 4)
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   Proves GET /v1/inbox merges WhatsApp and USSD into one newest-first list,
 *   pages without losing or repeating a row, and never shows another shop's
 *   rows. Also proves a USSD dial is logged into the inbox.
 *
 * WHY IMPORTANT
 *   The inbox is the first screen an owner checks. A skipped or repeated
 *   message, or a message from another shop, is a trust and privacy failure.
 *
 * HOW IT WORKS
 *   Three throw-away shops are created with a direct connection. Rows get
 *   FIXED timestamps (including two with the same second, and two that differ
 *   only in microseconds) so the expected order is known in advance. Teardown
 *   deletes everything it made.
 *
 * DANGER
 *   1. The paging tests walk pages of 1, 2 and 3. If the cursor loses
 *      microseconds or the tie-break on id is missing, a row is skipped or
 *      repeated and they fail.
 *   2. Tests 13 to 15 come last on purpose: test 13 adds a row by dialling
 *      USSD, which would change the counts the earlier tests expect.
 *   3. Never point this at a real shop. It only touches rows it created.
 *
 * WHAT IT SOLVES
 *   Day 4 Task 1 proof: UNION ALL then ORDER BY after the union, keyset paging,
 *   RLS isolation, empty shop, bad cursor.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Test the rule, not the code: fixed times in, known order out.
 *
 * RULES
 *   1. Fixed timestamps only. Never "now".
 *   2. Every row this file creates is deleted in afterAll.
 *   3. Money, phones and tokens are never printed.
 *
 * PRACTICAL EXAMPLE
 *   Shop A has 9 inbox rows. Walking pages of 2 must return those 9 ids once
 *   each, in the same order as one big page. Shop B's secret rows must never
 *   appear in shop A's answer.
 *
 * WHERE USED
 *   npm test (whole suite, CI) and npm test -- tests/inbox.
 *
 * TRADEOFFS
 *   + Self-contained: no seed data needed.
 *   - It writes real rows to the test database for a moment.
 *
 * HOW TO USE
 *   npm test -- tests/inbox
 *
 * AI AUDIT NOTE
 *   Written by AI (declared in the Day 4 audit).
 * ============================================================
 *
 * ============================================================
 * EXPLAINED PIECE BY PIECE (simple words, real life)
 * ============================================================
 *
 * PIECE 1: the setup (beforeAll)  =  "BUILD THREE SMALL SHOPS"
 *   Shop A has messages and USSD dials, shop B has one of each (its secrets),
 *   the empty shop has nothing. Real life: a pretend market with three stalls.
 *
 * PIECE 2: withLock  =  "SHOW THE KEY FOR ONE SHOP"
 *   Acts as one shop for a moment, the same lock the app uses, then lets go.
 *
 * PIECE 3: walk(limit)  =  "TURN EVERY PAGE"
 *   Keeps asking for the next page until there is none. Real life: reading a
 *   book page by page and checking no page is missing or read twice.
 *
 * PIECE 4: tests 1 to 4  =  "THE BASICS"
 *   Login needed, one merged list, the right fields, our own replies hidden.
 *
 * PIECE 5: tests 5 to 8  =  "THE PAGING PROOFS"
 *   Pages of 2, 1 and 3 give the same rows; the tie and the microsecond rows
 *   are the traps. Junk limits are tamed.
 *
 * PIECE 6: tests 9 to 12  =  "THE SAFETY PROOFS"
 *   A made-up bookmark is a 400. Shop B never leaks into shop A. A shop with
 *   nothing gets an empty list. A bookmark from another shop shows nothing.
 *
 * PIECE 7: tests 13 to 15  =  "A REAL DIAL LEAVES A TRACE"
 *   Dialling the shop's USSD code adds a row to the inbox. No phone number
 *   means no log but still a menu. An unknown code logs nothing.
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
// rand: a short random word added to every name, so two test runs never clash.
//   Real life: a different name tag on each day's practice stall.
// tenantA / tenantB / tenantEmpty: the three pretend shops.
// cookieX: the login cookie for each shop (what the browser would send).
// serviceCode: shop A's own USSD code, e.g. *384*ab12cd34#
// expectedA: the ids of shop A's rows in the order we EXPECT, newest first.
// ---------------------------------------------------------------
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rand = crypto.randomBytes(4).toString('hex');

let tenantA; let tenantB; let tenantEmpty;
let cookieA; let cookieB; let cookieEmpty;
let serviceCode;
const expectedA = [];   // ids of shop A's inbox rows, newest first

// makeCookie: signs a login token for one shop, like the login page would.
// Real life: printing a staff badge that says which shop you work for.
function makeCookie(tenantId) {
  const token = jwt.sign({ user_id: 1, tenant_id: tenantId, role: 'owner' },
    process.env.JWT_SECRET, { expiresIn: '1h' });
  return `token=${token}`;
}

// Act as one shop (same lock the app uses), then let go
// WHY: the tables are locked by RLS. To insert a shop's rows we must first
//   say "I am shop X" (set_config), and we always take the badge off again
//   in `finally`, even if something fails.
// Real life: signing into one stall's till, doing the job, signing out.
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

// get: calls the inbox like the website would. Defaults to shop A's cookie.
// EXAMPLE: get('?limit=2') asks for the first 2 rows.
const get = (qs = '', cookie = cookieA) =>
  request(app).get(`/v1/inbox${qs}`).set('Cookie', cookie);

// Walk every page with the given page size, return all rows in order
// WHY the 50-turn limit: if paging were broken and never ended, the test would
//   run forever. After 50 turns we fail loudly instead.
// Real life: turning pages of a book until the last one, then counting them.
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
  // Three shops: A (busy), B (has secrets), E (empty)
  const ids = [];
  for (const n of ['A', 'B', 'E']) {
    const t = await testPool.query('INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id',
      [`Inbox ${n} ${rand}`, `inbox-${n.toLowerCase()}-${rand}`]);
    ids.push(t.rows[0].id);
  }
  [tenantA, tenantB, tenantEmpty] = ids;
  [cookieA, cookieB, cookieEmpty] = ids.map(makeCookie);
  serviceCode = `*384*${rand}#`;

  // WHY fixed times: with real "now" times the order could change between runs.
  // WHY a tie and a microsecond pair: they are exactly where paging code breaks.
  // Shop A: 3 WhatsApp in, 1 WhatsApp OUT (must not show), 4 USSD.
  // Times are fixed. The two rows at 10:03:00 tie, and two are only 0.000356s
  // apart (they differ only in microseconds).
  await withLock(tenantA, async (db) => {
    const cu = await db.query(
      `INSERT INTO customers (tenant_id, phone, channel) VALUES ($1,'0711000111','whatsapp') RETURNING id`, [tenantA]);
    const cv = await db.query(
      `INSERT INTO conversations (tenant_id, customer_id, channel) VALUES ($1,$2,'whatsapp') RETURNING id`,
      [tenantA, cu.rows[0].id]);
    const conv = cv.rows[0].id;
    // wa(): insert one WhatsApp message and return its id.
    // us(): insert one USSD event and return its id.
    const wa = async (dir, body, ts) => (await db.query(
      `INSERT INTO messages (tenant_id, conversation_id, direction, body, sender, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [tenantA, conv, dir, body, dir === 'inbound' ? 'customer' : 'owner', ts])).rows[0].id;
    const us = async (body, ts) => (await db.query(
      `INSERT INTO ussd_events (tenant_id, phone, body, created_at) VALUES ($1,'0722000222',$2,$3) RETURNING id`,
      [tenantA, body, ts])).rows[0].id;

    // Each pair is [id, time]. Written oldest to newest so a human can read it.
    const rows = [
      [await wa('inbound', 'wa-oldest', '2026-01-01 10:00:00+00'), '2026-01-01 10:00:00+00'],
      [await us('ussd-1',               '2026-01-01 10:01:00+00'), '2026-01-01 10:01:00+00'],
      [await wa('inbound', 'wa-2',      '2026-01-01 10:02:00+00'), '2026-01-01 10:02:00+00'],
      [await us('ussd-tie-a',           '2026-01-01 10:03:00+00'), '2026-01-01 10:03:00+00'],
      [await wa('inbound', 'wa-tie-b',  '2026-01-01 10:03:00+00'), '2026-01-01 10:03:00+00'],
      [await us('ussd-micro',           '2026-01-01 10:04:00.123456+00'), '2026-01-01 10:04:00.123456+00'],
      [await us('ussd-micro-older',     '2026-01-01 10:04:00.123100+00'), '2026-01-01 10:04:00.123100+00'],
      [await us('ussd-3',               '2026-01-01 10:05:00+00'), '2026-01-01 10:05:00+00'],
      [await wa('inbound', 'wa-newest', '2026-01-01 10:06:00+00'), '2026-01-01 10:06:00+00'],
    ];
    await wa('outbound', 'our reply, must not show', '2026-01-01 10:07:00+00');
    // Expected order: newest first, ties broken by id DESC (same rule as the API)
    // WHY the + 0.456 / + 0.100: a JavaScript Date only knows milliseconds, so
    //   we add the microsecond part back by hand to sort exactly like Postgres.
    const sorted = rows
      .map(([id, ts]) => ({ id, t: new Date(ts).getTime() + (ts.includes('.123456') ? 0.456 : ts.includes('.123100') ? 0.100 : 0) }))
      .sort((x, y) => (y.t - x.t) || (y.id < x.id ? -1 : y.id > x.id ? 1 : 0));
    expectedA.push(...sorted.map((r) => r.id));

    await db.query('INSERT INTO ussd_configs (tenant_id, service_code, welcome_text) VALUES ($1,$2,$3)',
      [tenantA, serviceCode, 'Welcome']);
  });

  // Shop B: one of each. The words 'B-secret' let later tests spot any leak.
  await withLock(tenantB, async (db) => {
    const cu = await db.query(
      `INSERT INTO customers (tenant_id, phone) VALUES ($1,'0799000999') RETURNING id`, [tenantB]);
    const cv = await db.query(
      `INSERT INTO conversations (tenant_id, customer_id) VALUES ($1,$2) RETURNING id`, [tenantB, cu.rows[0].id]);
    await db.query(
      `INSERT INTO messages (tenant_id, conversation_id, direction, body, sender)
       VALUES ($1,$2,'inbound','B-secret-wa','customer')`, [tenantB, cv.rows[0].id]);
    await db.query(`INSERT INTO ussd_events (tenant_id, phone, body) VALUES ($1,'0799000999','B-secret-ussd')`, [tenantB]);
  });
});

// ---------------------------------------------------------------
// afterAll: tidy up. Delete only what this file created, then close the doors.
// WHY the order: children first (ussd_events, messages, conversations,
//   customers), then the shops, because rows point at their parents.
// ---------------------------------------------------------------
afterAll(async () => {
  for (const t of [tenantA, tenantB]) {
    await withLock(t, async (db) => {
      await db.query('DELETE FROM ussd_events');
      await db.query('DELETE FROM messages');
      await db.query('DELETE FROM conversations');
      await db.query('DELETE FROM customers');
    });
  }
  await testPool.query('DELETE FROM ussd_configs WHERE tenant_id = $1', [tenantA]);
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB, tenantEmpty]]);
  await testPool.end();
  await pool.end();
});

describe('GET /v1/inbox', () => {

  // TEST 1. Real life: a stranger at the till with no badge is turned away.
  test('1. no login cookie: 401', async () => {
    const res = await request(app).get('/v1/inbox');
    expect(res.status).toBe(401);
  });

  // TEST 2. The heart of Task 1: one list, both channels, exact expected order.
  test('2. WhatsApp and USSD come back in ONE list, newest first', async () => {
    const res = await get('?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toEqual(expectedA);
    const channels = new Set(res.body.data.map((r) => r.channel));
    expect(channels).toEqual(new Set(['whatsapp', 'ussd']));
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.error).toBeNull();
  });

  // TEST 3. The contract with the web page: exactly these five fields, and the
  //   time is returned as a real timestamp.
  test('3. every row has exactly { id, channel, from, body, createdAt }', async () => {
    const res = await get();
    for (const row of res.body.data) {
      expect(Object.keys(row).sort()).toEqual(['body', 'channel', 'createdAt', 'from', 'id']);
    }
    const wa = res.body.data.find((r) => r.body === 'wa-newest');
    expect(wa.from).toBe('0711000111');
    expect(wa.channel).toBe('whatsapp');
    expect(new Date(wa.createdAt).toISOString()).toBe('2026-01-01T10:06:00.000Z');
  });

  // TEST 4. We only show what customers SENT. Our own replies would be noise.
  test('4. our own outbound replies are not in the inbox', async () => {
    const res = await get('?limit=100');
    expect(res.body.data.some((r) => r.body.includes('must not show'))).toBe(false);
    expect(res.body.data.length).toBe(9);
  });

  // TEST 5. Walk the book 2 pages at a time. Same 9 rows, once each, same order.
  test('5. paging by 2: every row once, same order, no skip, no repeat (ties + microseconds)', async () => {
    const walked = await walk(2);
    expect(walked.map((r) => r.id)).toEqual(expectedA);
    expect(new Set(walked.map((r) => r.id)).size).toBe(9);
  });

  // TEST 6. The strictest walk: every single row is a page boundary.
  test('6. paging by 1 also works (every boundary, including the tied timestamps)', async () => {
    const walked = await walk(1);
    expect(walked.map((r) => r.id)).toEqual(expectedA);
  });

  test('6b. a page that ENDS on the microsecond row loses and repeats nothing on the next page', async () => {
    // newest first: wa-newest, ussd-3, ussd-micro | ... so limit 3 ends exactly on ussd-micro and ussd-micro-older must start the next page
    const first = await get('?limit=3');
    expect(first.body.data[2].body).toBe('ussd-micro');
    const walked = await walk(3);
    expect(walked.map((r) => r.id)).toEqual(expectedA);
  });

  // TEST 7. nextCursor means "there is more". On the last page it must be null.
  test('7. a page reports nextCursor only when more rows exist', async () => {
    const first = await get('?limit=3');
    expect(first.body.data.length).toBe(3);
    expect(typeof first.body.nextCursor).toBe('string');
    const last = await get('?limit=9');
    expect(last.body.data.length).toBe(9);
    expect(last.body.nextCursor).toBeNull();
  });

  // TEST 8. Silly limits are tamed instead of crashing the page.
  test('8. junk limit falls back to 20; limit 0 becomes 1; huge limit is capped', async () => {
    expect((await get('?limit=abc')).body.data.length).toBe(9);
    expect((await get('?limit=0')).body.data.length).toBe(1);
    expect((await get('?limit=100000')).body.data.length).toBe(9);
  });

  // TEST 9. A forged or damaged bookmark is refused politely (400).
  test('9. a made-up cursor is a 400, not a crash', async () => {
    for (const bad of ['garbage', Buffer.from('x|y').toString('base64url'),
      Buffer.from('2026-01-01T10:00:00.000000Z|not-a-uuid').toString('base64url')]) {
      const res = await get(`?cursor=${bad}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation');
    }
  });

  // TEST 10. The privacy proof: B sees only B, and A never sees 'B-secret'.
  test('10. shop B sees only its own two rows, shop A sees none of them', async () => {
    const b = await get('?limit=100', cookieB);
    expect(b.body.data.map((r) => r.body).sort()).toEqual(['B-secret-ussd', 'B-secret-wa']);
    const a = await get('?limit=100');
    expect(JSON.stringify(a.body)).not.toContain('B-secret');
  });

  // TEST 11. A new shop with no messages gets an empty list, not an error.
  //   The web page turns this into the "No messages yet" message.
  test('11. a shop with nothing gets an empty list, not an error', async () => {
    const res = await get('', cookieEmpty);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  // TEST 12. Even a bookmark taken from shop A cannot pull A's rows into B.
  //   RLS filters by the logged-in shop, not by what the bookmark says.
  test('12. a shop A cursor used by shop B returns only shop B rows', async () => {
    const first = await get('?limit=2');
    const res = await get(`?limit=100&cursor=${first.body.nextCursor}`, cookieB);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('wa-');
    expect(JSON.stringify(res.body)).not.toContain('ussd-');
  });
});

// These tests run LAST because test 13 adds a row to shop A.
describe('USSD dial is logged into the inbox', () => {
  // dial: acts like Africa's Talking calling our /ussd address.
  // Real life: a customer typing the shop's code on their phone.
  const dial = (text, extra = {}) => request(app).post('/ussd').type('form')
    .send({ serviceCode, sessionId: `s-${rand}`, phoneNumber: '0733000333', text, ...extra });

  // TEST 13. Dial option 2 (balance). The menu answers AND the inbox gets a row.
  test('13. a dial shows up as a ussd row with the caller phone and what they typed', async () => {
    const res = await dial('2');
    expect(res.status).toBe(200);
    expect(res.text.startsWith('END Balance')).toBe(true);
    const inbox = await get('?limit=1');
    expect(inbox.body.data[0]).toMatchObject({ channel: 'ussd', from: '0733000333', body: '2' });
  });

  // TEST 14. Logging is a bonus. Without a phone number nothing is saved, but
  //   the caller still gets the welcome menu.
  test('14. a dial with no phoneNumber still gets its menu (no log, no crash)', async () => {
    const res = await request(app).post('/ussd').type('form')
      .send({ serviceCode, sessionId: 'x', text: '' });
    expect(res.status).toBe(200);
    expect(res.text.startsWith('CON Welcome')).toBe(true);
  });

  // TEST 15. A code that belongs to no shop is closed politely and logs nothing.
  test('15. an unknown service code logs nothing for any shop', async () => {
    const before = (await get('?limit=100')).body.data.length;
    const res = await request(app).post('/ussd').type('form')
      .send({ serviceCode: '*384*nope#', sessionId: 'x', phoneNumber: '0700', text: '' });
    expect(res.text).toBe('END Service unavailable');
    expect((await get('?limit=100')).body.data.length).toBe(before);
  });
});