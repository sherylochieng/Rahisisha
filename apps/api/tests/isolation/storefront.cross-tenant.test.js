// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/isolation/storefront.cross-tenant.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Proves the PUBLIC shop door (GET /v1/storefront/:slug) is safe: a
//   stranger sees only the active products of the shop whose address they
//   opened, never another shop's, never drafts, never private fields.
//
// WHY IMPORTANT
//   This is the first endpoint that needs NO login. Every protection that
//   a login used to give now rests on the address word and the database
//   lock. If this test is green, shop A's window can never show shop B's
//   goods.
//
// HOW IT WORKS
//   Three throw-away shops with fixed product times:
//     Shop A: 3 active products, 1 draft, 1 archived, 1 deleted.
//     Shop B: 1 active product with a secret name (it must never appear
//             on A's page), plus 1 draft.
//     Shop E: no products at all.
//   And one suspended shop, to prove closed shops look like they do not
//   exist.
//   Every call is made with NO login cookie, like a real customer.
//
// DANGER
//   1. Never use "now" for product times: the expected order would change
//      from run to run. Fixed times only.
//   2. It writes real rows to the test database for a moment. Teardown
//      deletes only the rows it created.
//   3. Never add a login cookie to the main calls: the whole point is that
//      the door works for strangers.
//
// WHAT IT SOLVES
//   Proof for the public door: right shop, only active products, only five
//   fields (id, name, description, price_cents and, since Week 30, image_url),
//   paging that loses nothing, closed and unknown shops give the
//   same 404, and the door is read-only.
//
// SYSTEM DESIGN PRINCIPLE
//   "Test the attacker's view": try to get B's goods through A's door by
//   every route we can think of (address, bookmark, cookie, other methods).
//
// RULES
//   1. Fixed timestamps only.
//   2. Every row this file creates is deleted in afterAll.
//   3. Test names and phone-like data are fake.
//   4. Lives in tests/isolation so the pre-push hook runs it.
//
// PRACTICAL EXAMPLE
//   Test 4: GET /v1/storefront/<shop-a>?limit=2 then follow nextCursor
//   until it is null. The names that came back are exactly A's three
//   active products, once each, and never B's secret one.
//
// DECISIONS
//   - (Week 30) The agreed public fields grew from four to five: image_url, the
//     product photo address, joined on purpose. This test is the guard that
//     noticed (it failed until we updated the list deliberately). Nothing else
//     was added: still no SKU, status, dates or tenant id as fields.
//   - (Week 30) Prod-3 is given a photo address and the others have none, so
//     test 3b can prove "photo address when there is one, null when there is
//     not". The test address has no shop id in it on purpose. NOTE: a REAL photo
//     address contains the shop's folder, which is the shop id. That id is not a
//     secret (it gives no access; every protected call still needs the login and
//     the database lock), but it IS visible inside a photo link. Recorded in the
//     Week 30 notes as a known, accepted tradeoff.
//   - The expected order is newest first: Prod-3, Prod-2, Prod-1 (Prod-2
//     and Prod-3 are set apart in time so the order is certain; the tie
//     rule itself is proven by the Orders test).
//   - The suspended shop is made by updating status, then removed in
//     teardown.
//
// WHERE USED
//   `npm test`, `npm run test:isolation`, the Husky pre-push hook and CI.
//
// TRADEOFFS
//   + Real database, real lock: no mocks to drift from reality.
//   - Slower than a unit test (about a second).
//
// HOW TO RUN
//   cd apps/api && npm test -- storefront
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request (follow-up to Week 29 Day 4).
//   Declared in docs/AI_AUDIT_week_29_day4.md.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. testPool + withLock  =  "THE TEST'S OWN SET OF KEYS"
//    The test needs to put products into shops. It borrows a connection,
//    sets the shop lock, writes, and clears the lock. Real life: a
//    stocktaker who is allowed into one shop at a time.
//
// 2. get(slug, qs)  =  "A STRANGER WALKS UP TO THE WINDOW"
//    No cookie. Just an address.
//
// 3. walk(slug, limit)  =  "FLIP THROUGH EVERY PAGE"
//    Follows nextCursor until it is null and collects the names. Stops
//    with an error if it never ends.
//
// 4. beforeAll / afterAll  =  "SET THE SHOPS UP, THEN CLEAN UP"
//    Shops and products are created first and always deleted at the end.
//
// 5. The tests  =  "THE ATTACKS AND THE CHECKS"
//    Each test is one question a nervous shop owner would ask.
//
// 6. (Week 30) PHOTO_A and the sixth column of PRODUCTS_A  =  "ONE PRODUCT WITH A PHOTO"
//    Prod-3 gets a photo address, the rest get none. Real life: one item in
//    the shop window has a picture pinned to it, the others only a price tag.
//
// 7. (Week 30) Test 3 now lists five fields  =  "THE AGREED SHELF LABELS"
//    The test says exactly which five things a stranger may see. If someone
//    adds a sixth by accident (a phone number, a cost price), this test fails.
//    That is how we found out image_url was new: the pre-push check stopped
//    the push until we agreed the list on purpose.
//
// 8. (Week 30) Test 3b  =  "THE PICTURE IS THERE WHEN IT SHOULD BE"
//    Checks that Prod-3 returns its photo address exactly, and the others
//    return null (not a missing field, not an empty word).
// ═══════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import request from 'supertest';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

dotenv.config();

const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rand = crypto.randomBytes(4).toString('hex');

const slugA = `sf-a-${rand}`;
const slugB = `sf-b-${rand}`;
const slugE = `sf-e-${rand}`;
const slugS = `sf-s-${rand}`;   // suspended shop

let tenantA; let tenantB; let tenantE; let tenantS;

// Week 30: a stand-in photo address for one product. It has NO shop id inside
// on purpose, so test 3 can still prove that no tenant id leaks as a field.
const PHOTO_A = 'https://res.cloudinary.com/democloud/image/upload/v1/sf-photo-test.jpg';

// [name, status, deleted?, UTC time, price in cents, photo address (optional)]  (oldest first)
const PRODUCTS_A = [
  ['Prod-1',        'active',   false, '2026-01-01 06:00:00+00', 10000],
  ['Prod-2',        'active',   false, '2026-01-02 06:00:00+00', 20000],
  ['Prod-3',        'active',   false, '2026-01-03 06:00:00.123456+00', 30000, PHOTO_A],
  ['Draft-A',       'draft',    false, '2026-01-04 06:00:00+00', 40000],
  ['Archived-A',    'archived', false, '2026-01-05 06:00:00+00', 50000],
  ['Deleted-A',     'active',   true,  '2026-01-06 06:00:00+00', 60000],
];
const SECRET_B = `B-secret-${rand}`;

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

// A stranger at the window: no login cookie
const get = (slug, qs = '') => request(app).get(`/v1/storefront/${slug}${qs}`);

// Flip through every page, collecting the product names in order
async function walk(slug, limit) {
  const names = [];
  let cursor = null;
  for (let i = 0; i < 20; i++) {
    const res = await get(slug, `?limit=${limit}` + (cursor ? `&cursor=${cursor}` : ''));
    expect(res.status).toBe(200);
    names.push(...res.body.data.products.map((p) => p.name));
    cursor = res.body.nextCursor;
    if (!cursor) return names;
  }
  throw new Error('paging never ended');
}

beforeAll(async () => {
  const made = [];
  for (const [slug, label] of [[slugA, 'A'], [slugB, 'B'], [slugE, 'E'], [slugS, 'S']]) {
    const t = await testPool.query(
      'INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id',
      [`Storefront ${label} ${rand}`, slug]);
    made.push(t.rows[0].id);
  }
  [tenantA, tenantB, tenantE, tenantS] = made;

  await withLock(tenantA, async (db) => {
    for (const [name, status, deleted, ts, price, photo] of PRODUCTS_A) {
      await db.query(
        `INSERT INTO products (tenant_id, name, description, price_cents, status, sku, created_at, deleted_at, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenantA, name, `About ${name}`, price, status, `SKU-${name}-${rand}`, ts,
         deleted ? '2026-02-01 00:00:00+00' : null, photo ?? null]);
    }
  });

  await withLock(tenantB, async (db) => {
    await db.query(
      `INSERT INTO products (tenant_id, name, price_cents, status, created_at)
       VALUES ($1,$2,99999,'active','2026-01-10 06:00:00+00')`, [tenantB, SECRET_B]);
    await db.query(
      `INSERT INTO products (tenant_id, name, price_cents, status, created_at)
       VALUES ($1,'Draft-B',1,'draft','2026-01-11 06:00:00+00')`, [tenantB]);
  });

  // The suspended shop has a product, to prove it is hidden because it is
  // suspended and not because it is empty
  await withLock(tenantS, async (db) => {
    await db.query(
      `INSERT INTO products (tenant_id, name, price_cents, status)
       VALUES ($1,'Suspended-product',100,'active')`, [tenantS]);
  });
  await testPool.query("UPDATE tenants SET status = 'suspended' WHERE id = $1", [tenantS]);
});

afterAll(async () => {
  for (const t of [tenantA, tenantB, tenantS]) {
    await withLock(t, async (db) => { await db.query('DELETE FROM products'); });
  }
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB, tenantE, tenantS]]);
  await testPool.end();
  await pool.end();
});

describe('GET /v1/storefront/:slug (public door, follow-up to Week 29 Day 4)', () => {

  test('1. a stranger with no login sees the shop name and ONLY its active products, newest first', async () => {
    const res = await get(slugA);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.data.shop).toEqual({ name: `Storefront A ${rand}`, slug: slugA });
    expect(res.body.data.products.map((p) => p.name)).toEqual(['Prod-3', 'Prod-2', 'Prod-1']);
  });

  test('2. drafts, archived and deleted products never appear', async () => {
    const names = (await get(slugA)).body.data.products.map((p) => p.name);
    for (const hidden of ['Draft-A', 'Archived-A', 'Deleted-A']) {
      expect(names).not.toContain(hidden);
    }
  });

  test('3. only the agreed fields are public: no SKU, status, dates or tenant id', async () => {
    const res = await get(slugA);
    // Week 30: image_url (the product photo address) joined the agreed public
    // fields on purpose. It is a public Cloudinary link, null when no photo.
    expect(Object.keys(res.body.data.products[0]).sort())
      .toEqual(['description', 'id', 'image_url', 'name', 'price_cents']);
    expect(Number.isInteger(res.body.data.products[0].price_cents)).toBe(true);
    expect(Object.keys(res.body.data).sort()).toEqual(['products', 'shop']);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('SKU-');
    expect(text).not.toContain(tenantA);
    expect(text).not.toContain(tenantB);
  });

  // Week 30: the photo address is returned as-is when there is one, and is
  // null (present, but empty) when the owner added no photo.
  test('3b. a product with a photo returns its address, one without returns null', async () => {
    const products = (await get(slugA)).body.data.products;
    const withPhoto = products.find((p) => p.name === 'Prod-3');
    const withoutPhoto = products.find((p) => p.name === 'Prod-2');
    expect(withPhoto.image_url).toBe(PHOTO_A);
    expect(withoutPhoto.image_url).toBeNull();
  });

  test("4. shop A's window never shows shop B's goods, on any page size", async () => {
    for (const limit of [1, 2, 3, 48]) {
      const names = await walk(slugA, limit);
      expect(names).toEqual(['Prod-3', 'Prod-2', 'Prod-1']);   // each once, in order
      expect(names).not.toContain(SECRET_B);
    }
    const b = await get(slugB);
    expect(b.body.data.products.map((p) => p.name)).toEqual([SECRET_B]);
  });

  test("5. shop A's bookmark used on shop B's address still shows only B's goods", async () => {
    const first = await get(slugA, '?limit=1');
    expect(first.body.nextCursor).toBeTruthy();
    const res = await get(slugB, `?cursor=${first.body.nextCursor}`);
    expect(res.status).toBe(200);
    const names = res.body.data.products.map((p) => p.name);
    for (const n of names) expect(['Prod-1', 'Prod-2', 'Prod-3']).not.toContain(n);
  });

  test("6. a login cookie from shop B does not change which shop's window you see", async () => {
    const token = jwt.sign({ user_id: 1, tenant_id: tenantB, role: 'owner' },
      process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get(`/v1/storefront/${slugA}`).set('Cookie', `token=${token}`);
    expect(res.body.data.shop.slug).toBe(slugA);
    expect(res.body.data.products.map((p) => p.name)).toEqual(['Prod-3', 'Prod-2', 'Prod-1']);
  });

  test('7. an unknown shop, a badly shaped word and a suspended shop all get the SAME 404', async () => {
    const unknown = await get(`nobody-${rand}`);
    const badShape = await get('BAD_WORD!');
    const dashEnd = await get('ends-with-dash-');
    const suspended = await get(slugS);
    for (const r of [unknown, badShape, dashEnd, suspended]) {
      expect(r.status).toBe(404);
      expect(r.body).toEqual({ data: null, error: { message: 'Shop not found' } });
    }
    expect(JSON.stringify(suspended.body)).not.toContain('Suspended-product');
  });

  test('8. a shop with no active products is a normal 200 with an empty list', async () => {
    const res = await get(slugE);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.data.shop.slug).toBe(slugE);
  });

  test('9. a made-up bookmark is a 400 with a clear message', async () => {
    const res = await get(slugA, '?cursor=hello');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid cursor');
  });

  test('10. limit is kept between 1 and 48', async () => {
    expect((await get(slugA, '?limit=0')).body.data.products.length).toBe(1);
    expect((await get(slugA, '?limit=-5')).body.data.products.length).toBe(1);
    expect((await get(slugA, '?limit=100000')).body.data.products.length).toBe(3);
    expect((await get(slugA, '?limit=abc')).body.data.products.length).toBe(3);
  });

  test('11. the door is read-only: POST, PATCH and DELETE find nothing', async () => {
    for (const method of ['post', 'patch', 'put', 'delete']) {
      const res = await request(app)[method](`/v1/storefront/${slugA}`).send({ name: 'Hacked' });
      expect(res.status).toBe(404);
    }
    const names = (await get(slugA)).body.data.products.map((p) => p.name);
    expect(names).not.toContain('Hacked');
    expect(names.length).toBe(3);
  });
});