// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/isolation/checkout.cross-tenant.test.js   (Week 30, customer checkout)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Proves the customer checkout door (/v1/storefront/:slug/checkout, /orders/...)
//   is safe: the server decides prices, only active products sell, one shop can
//   never touch another shop's order, the phone number never leaks, and nobody
//   can ring one phone with endless M-Pesa prompts.
//
// WHY IMPORTANT
//   This door needs NO login and it moves real money. Every protection a login
//   used to give now rests on server-side rules and the database lock. If this
//   test is green, a stranger cannot get a cheaper price, buy a hidden product,
//   read another shop's order, or spam a phone.
//
// DANGER
//   1. Never run this against a database holding real shops. Fake data only.
//   2. Safaricom must stay faked. Never put a real key in this file.
//   3. It writes real rows for a moment; afterAll deletes only what it made.
//
// WHAT IT SOLVES
//   Locks in the rules of checkout.controller.js so nobody weakens them later.
//
// SYSTEM DESIGN PRINCIPLE
//   "Test the attacker's view": try the cheats a clever customer would try.
//
// RULES
//   1. Never delete an attack test to make a change pass.
//   2. Every row this file creates is deleted in afterAll.
//   3. Names and phone numbers are fake.
//   4. Lives in tests/isolation so the pre-push hook runs it.
//
// PRACTICAL EXAMPLE
//   Test 1: the customer's page claims the dress costs KES 1 (priceCents: 100)
//   and quantity 1. The order total is still KES 80 + KES 1,500 = KES 1,580,
//   because the price is read from the database.
//
// DECISIONS
//   - Each test that starts a payment uses its OWN phone number, so the
//     "3 prompts per phone" limit of one test never leaks into another.
//   - Order status is moved to 'paid' directly in the database to simulate the
//     verified M-Pesa callback (which has its own tests).
//
// WHERE USED
//   `npm test`, `npm run test:isolation`, the Husky pre-push hook and CI.
//
// TRADEOFFS
//   + Real database and real lock; only Safaricom is faked.
//   - Slower than a unit test.
//
// HOW TO RUN
//   cd apps/api && npm test -- checkout
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE (the helpers) — real life: a mama mboga's kiosk
// ═══════════════════════════════════════════════════════════
//   withLock(shopId, fn)   = a key that opens ONE kiosk only. Real life: the
//                            mama mboga on Kenyatta Avenue cannot open the
//                            kiosk key of the one on Moi Avenue. We borrow one
//                            kiosk's key, do the job, give the key back.
//   checkout / status / pay / note
//                          = a stranger walking up to the kiosk with NO ID card
//                            (no login cookie), only knowing the kiosk's name
//                            (the slug).
//   makeCustomerOrder(...) = the stranger orders and gets a ticket number.
//                            Real life: the paper slip the vendor hands you.
//   fetch mock             = a pretend Safaricom. Real life: a rehearsal where
//                            a friend plays "M-Pesa" so no real money moves.
//   beforeAll / afterAll   = open two kiosks before the show, close and clean
//                            both after, leaving no trace.
//
// PIECE BY PIECE (the 14 checks)
//   1  Cheat price      = telling the vendor "the dress is KES 1". She checks
//                         her own price list, not your word.
//   2  Same product x2  = "2 sodas, then 1 more soda" is written as 3 sodas.
//   3  Draft product    = you cannot buy a dress still hidden in the back room.
//   4  Other shop's item= you cannot buy Mama Njeri's tomatoes at Mama Achieng's
//                         kiosk.
//   5  Bad forms        = a 5-digit "phone number" or an empty basket is
//                         refused at the counter before a slip is written.
//   6  Pay amount       = the M-Pesa prompt asks for the order's total, even if
//                         you shout "charge me KES 1".
//   7  3 prompts max    = a vendor who stops ringing your phone after 3 tries.
//   8  Same 404         = wrong slip, fake slip, or a slip from another kiosk
//                         all get the same "no such order". Nobody learns
//                         which slips exist.
//   9  Status screen    = the vendor tells you "paid / waiting" but never reads
//                         your phone number out loud.
//   10 Paid + note      = "deliver to Kilimani" is accepted only AFTER you pay.
//   11 Failed reason    = "you cancelled the prompt", never Safaricom's raw
//                         technical words.
//   12 No M-Pesa set up = a kiosk that has not joined M-Pesa says so kindly.
//   13 Console quiet    = the shopkeeper's notebook (logs) never holds phone
//                         numbers or keys.
//   14 Door closed      = the bare kiosk address still refuses to be changed.

import crypto from 'node:crypto';
import request from 'supertest';
import pg from 'pg';
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { encryptSecret } from '../../src/utils/kms.js';

// Load the .env file (DATABASE_URL etc.) before we read process.env below.
dotenv.config();

// Our own database connection, used only to set things up and look inside.
// Real life: the back door key only the test uses to stock and inspect the kiosks.
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// A random tag so two test runs never collide.
// Real life: writing today's date on the tray so yesterday's goods are not mixed up.
const rand = crypto.randomBytes(4).toString('hex');

// The two shops' address words (the part after /storefront/ in the link).
const slugA = `ck-a-${rand}`;
const slugB = `ck-b-${rand}`;

// Boxes we fill in beforeAll and use in the tests (ids of shops and products).
let tenantA; let tenantB;
let sodaId; let dressId; let draftId; let bProductId;
// Boxes that remember the REAL settings so afterAll can put them back.
let realKey; let realFetch; let realBase;
// The pretend Safaricom, so tests can ask "was it called?".
let fetchMock;
// Console listeners, so tests can check nothing sensitive was printed.
const spies = [];

// A random valid Kenyan phone per test (07 + 8 digits), so prompt limits never overlap.
const newPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
// The shape we STORE (254...), for checking the database. 0712345678 -> 254712345678.
const stored = (p) => `254${p.slice(1)}`;

// ── SMALL HELPERS ────────────────────────────────────────────────────────────

// Borrow a database connection locked to ONE shop (so row-level security applies).
// Real life: take one kiosk's key, work inside that kiosk only, then return it.
async function withLock(tenantId, fn) {
  // Take a connection from our own pool.
  const c = await testPool.connect();
  try {
    // Lock it to this shop: from now on the database shows ONLY this shop's rows.
    await c.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
    // Run the job the caller asked for while the lock is on.
    return await fn(c);
  } finally {
    // Always remove the lock and give the connection back, even if the job failed.
    await c.query("SELECT set_config('app.current_tenant', '', false)");
    c.release();
  }
}

// Pretend Safaricom answers: a token for the login step, "prompt sent" for the push.
// Real life: the friend playing M-Pesa says "yes, I sent the prompt".
const reply = (status, body) => ({ status, json: async () => body });
function happyFetch(url) {
  // Step 1 of Daraja: the "give me a token" call. We hand back a fake token.
  if (String(url).includes('/oauth/')) return Promise.resolve(reply(200, { access_token: `tok-${rand}` }));
  // Step 2: the "send the prompt" call. ResponseCode '0' means accepted.
  return Promise.resolve(reply(200, {
    ResponseCode: '0',
    MerchantRequestID: `mr-${rand}`,
    CheckoutRequestID: `ws_CO_${rand}_${crypto.randomBytes(3).toString('hex')}`,
  }));
}

// Everything that was written to the console during a test (for leak checks).
// Real life: reading the shopkeeper's notebook at the end of the day.
const consoleText = () => JSON.stringify(spies.flatMap((s) => s.mock.calls));

// The customer's requests: NO login cookie, only the shop's address word.
// checkout = place an order, status = "has my payment come?", pay = send the
// M-Pesa prompt, note = add the delivery note.
const checkout = (slug, body) => request(app).post(`/v1/storefront/${slug}/checkout`).send(body);
const status = (slug, id) => request(app).get(`/v1/storefront/${slug}/orders/${id}`);
const pay = (slug, id, body = {}) => request(app).post(`/v1/storefront/${slug}/orders/${id}/pay`).send(body);
const note = (slug, id, body) => request(app).patch(`/v1/storefront/${slug}/orders/${id}/note`).send(body);

// Do a real checkout for shop A and return the order id (the customer's ticket).
async function makeCustomerOrder(phone = newPhone(), items = [{ productId: sodaId, quantity: 1 }]) {
  // Place the order exactly like the website will.
  const res = await checkout(slugA, { name: 'Amina', phone, items });
  // 201 = "created". If this is not 201 the helper itself is broken, so stop early.
  expect(res.status).toBe(201);
  // Hand back the ticket number.
  return res.body.data.orderId;
}

// Count how many orders a shop has (to prove "nothing was created").
// Real life: counting the slips in the kiosk's drawer before and after.
const countOrders = (tenantId) => withLock(tenantId, async (db) =>
  Number((await db.query('SELECT count(*) AS n FROM orders')).rows[0].n));

// ── SET UP AND CLEAN UP ──────────────────────────────────────────────────────

// beforeAll runs ONCE before all the tests: it builds the two kiosks.
beforeAll(async () => {
  // Remember the real settings, then fake what we need.
  realKey = process.env.KMS_KEY;
  realFetch = global.fetch;
  realBase = process.env.DARAJA_API_BASE;
  // A throw-away encryption key, so we can store fake M-Pesa secrets safely.
  process.env.KMS_KEY = crypto.randomBytes(32).toString('base64');
  // Make sure the code uses its default (sandbox) Safaricom address.
  delete process.env.DARAJA_API_BASE;

  // The two shops. Each gets a name and an address word (slug).
  const a = await testPool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id', [`Checkout A ${rand}`, slugA]);
  const b = await testPool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1,$2) RETURNING id', [`Checkout B ${rand}`, slugB]);
  tenantA = a.rows[0].id;
  tenantB = b.rows[0].id;

  // Shop A's shelf: two active products and one draft.
  // Prices are in cents: 8000 = KES 80, 150000 = KES 1,500.
  await withLock(tenantA, async (db) => {
    const ins = (name, price, st) => db.query(
      `INSERT INTO products (tenant_id, name, price_cents, status) VALUES ($1,$2,$3,$4) RETURNING id`,
      [tenantA, name, price, st]);
    sodaId = (await ins('Soda 500ml', 8000, 'active')).rows[0].id;
    dressId = (await ins('Kitenge dress', 150000, 'active')).rows[0].id;
    // 'draft' = hidden from customers (the dress still in the back room).
    draftId = (await ins('Secret draft', 5000, 'draft')).rows[0].id;
  });

  // Shop B's shelf: one active product (must never be sold through A's door).
  await withLock(tenantB, async (db) => {
    bProductId = (await db.query(
      `INSERT INTO products (tenant_id, name, price_cents, status) VALUES ($1,'B-secret-item',9900,'active') RETURNING id`,
      [tenantB])).rows[0].id;
  });

  // Shop A has M-Pesa settings (fake, encrypted like the real ones) so a prompt can be started.
  // Shop B deliberately has none (used by test 12).
  await withLock(tenantA, (db) => db.query(
    `INSERT INTO daraja_configs
       (tenant_id, env, consumer_key_encrypted, consumer_secret_encrypted,
        shortcode, passkey_encrypted, callback_url)
     VALUES ($1, 'sandbox', $2, $3, '333333', $4, $5)`,
    [tenantA, encryptSecret(`KEY-${rand}`, tenantA), encryptSecret(`SECRET-${rand}`, tenantA),
      encryptSecret(`PASSKEY-${rand}`, tenantA), `https://ck-${rand}.example/cb`]));
});

// beforeEach runs before EVERY test: a fresh pretend-Safaricom and console listeners.
beforeEach(() => {
  // jest.fn remembers every call, so tests can ask "was Safaricom contacted?".
  fetchMock = jest.fn(happyFetch);
  // Replace the real internet-calling function with our pretend one.
  global.fetch = fetchMock;
  // Listen to every console method but print nothing; test 13 reads what was said.
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
  // Put the real settings back (as they were before the test).
  global.fetch = realFetch;
  if (realBase === undefined) delete process.env.DARAJA_API_BASE;
  else process.env.DARAJA_API_BASE = realBase;
  if (realKey === undefined) delete process.env.KMS_KEY;
  else process.env.KMS_KEY = realKey;

  // Delete what we made. ORDER MATTERS: payment attempts first (an order with a
  // payment attempt cannot be deleted), then orders (their lines go with them),
  // then customers and products, then the shops (their M-Pesa settings go too).
  for (const t of [tenantA, tenantB]) {
    await withLock(t, async (db) => {
      await db.query('DELETE FROM payment_attempts');
      await db.query('DELETE FROM orders');
      await db.query('DELETE FROM customers');
      await db.query('DELETE FROM products');
    });
  }
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB]]);
  // Close both database connections so the test run can finish.
  await testPool.end();
  await pool.end();
});

// ── THE CHECKS ───────────────────────────────────────────────────────────────

describe('customer checkout door (Week 30)', () => {

  // CHECK 1. The price is the SERVER's, never the customer's page.
  // Real life: you tell the mama mboga "the dress is KES 1". She looks at her
  // own price list and says "KES 1,500, please".
  test('1. the total comes from the database: a cheat price in the request is ignored', async () => {
    // A fresh fake customer phone.
    const phone = newPhone();
    // Place an order while TRYING to cheat: extra price fields at the top
    // and a price inside the soda line.
    const res = await checkout(slugA, {
      name: 'Amina', phone,
      // priceCents / totalCents are NOT part of the form. The server ignores them.
      priceCents: 100, totalCents: 100,
      items: [{ productId: sodaId, quantity: 1, priceCents: 1 }, { productId: dressId, quantity: 1 }],
    });
    // 201 = the order was created normally (the cheat fields were just ignored).
    expect(res.status).toBe(201);
    // No error in the answer.
    expect(res.body.error).toBeNull();
    // The total is the REAL prices added up: KES 80 + KES 1,500 = KES 1,580.
    expect(res.body.data.totalCents).toBe(8000 + 150000);

    // Look inside the database (through shop A's lock) to see what was really saved.
    const rows = await withLock(tenantA, async (db) => ({
      // The order itself: its state, how it was placed and its total.
      order: (await db.query('SELECT status, channel, total_cents FROM orders WHERE id = $1',
        [res.body.data.orderId])).rows[0],
      // The lines of the order (one per product), sorted so the check is stable.
      items: (await db.query('SELECT product_name, unit_price_cents, quantity FROM order_items WHERE order_id = $1 ORDER BY product_name',
        [res.body.data.orderId])).rows,
      // The customer record that was made from the name and phone.
      customer: (await db.query('SELECT phone, name FROM customers WHERE phone = $1', [stored(phone)])).rows[0],
    }));
    // The order is new ('created'), came from the website ('web') and totals KES 1,580.
    expect(rows.order).toEqual({ status: 'created', channel: 'web', total_cents: 158000 });
    // Both products are there as lines (alphabetical: dress, then soda).
    expect(rows.items.map((i) => i.product_name)).toEqual(['Kitenge dress', 'Soda 500ml']);
    // The soda line kept the DATABASE price (8000), not the cheat price (1).
    expect(rows.items.find((i) => i.product_name === 'Soda 500ml').unit_price_cents).toBe(8000);
    // The phone is saved in ONE shape (254...), not as typed.
    expect(rows.customer).toEqual({ phone: stored(phone), name: 'Amina' });
  });

  // CHECK 2. "2 sodas" + "1 soda" is one line of 3.
  // Real life: you ask for 2 sodas, then say "add 1 more". The vendor writes
  // "Soda x3", not two separate lines.
  test('2. the same product twice becomes one line with the quantities added', async () => {
    // Send the SAME product in two lines: 2 and 1.
    const res = await checkout(slugA, {
      name: 'Amina', phone: newPhone(),
      items: [{ productId: sodaId, quantity: 2 }, { productId: sodaId, quantity: 1 }],
    });
    expect(res.status).toBe(201);
    // Exactly ONE line, quantity 3, at the real price.
    expect(res.body.data.items).toEqual([{ name: 'Soda 500ml', quantity: 3, unitPriceCents: 8000 }]);
    // 3 x KES 80 = KES 240.
    expect(res.body.data.totalCents).toBe(24000);
  });

  // CHECK 3. A hidden (draft) product can never be bought through the public door.
  // Real life: the dress still in the back room is not on the shelf, so you
  // cannot buy it, and the vendor writes NO slip at all.
  test('3. a draft product cannot be bought, and no order is left behind', async () => {
    // How many slips were in the drawer before.
    const before = await countOrders(tenantA);
    // Try to buy a soda AND the hidden draft together.
    const res = await checkout(slugA, {
      name: 'Amina', phone: newPhone(),
      items: [{ productId: sodaId, quantity: 1 }, { productId: draftId, quantity: 1 }],
    });
    // The WHOLE order is refused (404 "items unavailable"), even the valid soda.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('items_unavailable');
    // Nothing half-saved: the drawer has the same number of slips as before.
    expect(await countOrders(tenantA)).toBe(before);
  });

  // CHECK 4. Shop A's door must never sell shop B's goods.
  // Real life: you cannot buy Mama Njeri's tomatoes at Mama Achieng's kiosk,
  // even if you know the exact name of the tomatoes.
  test("4. another shop's product cannot be bought through this shop's door", async () => {
    // Count slips in BOTH kiosks before.
    const beforeA = await countOrders(tenantA);
    const beforeB = await countOrders(tenantB);
    // At shop A's door, ask for shop B's product id.
    const res = await checkout(slugA, {
      name: 'Amina', phone: newPhone(), items: [{ productId: bProductId, quantity: 1 }],
    });
    // To shop A that product simply does not exist: 404.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('items_unavailable');
    // Neither kiosk got a new slip.
    expect(await countOrders(tenantA)).toBe(beforeA);
    expect(await countOrders(tenantB)).toBe(beforeB);
  });

  // CHECK 5. Bad forms are refused before anything is saved.
  // Real life: the vendor will not write a slip if the phone number has 5 digits,
  // the basket is empty, or you ask for zero sodas.
  test('5. a bad phone, an empty basket or quantity 0 are refused with 400 and nothing is saved', async () => {
    // Slips in the drawer before.
    const before = await countOrders(tenantA);

    // A phone that is clearly not a Kenyan number.
    const badPhone = await checkout(slugA, { name: 'A', phone: '12345', items: [{ productId: sodaId, quantity: 1 }] });
    expect(badPhone.status).toBe(400);
    // The error points at the "phone" field so the website can show it there.
    expect(badPhone.body.error.details.phone).toBeTruthy();

    // An empty basket.
    const empty = await checkout(slugA, { name: 'A', phone: newPhone(), items: [] });
    expect(empty.status).toBe(400);

    // Quantity zero.
    const zero = await checkout(slugA, { name: 'A', phone: newPhone(), items: [{ productId: sodaId, quantity: 0 }] });
    expect(zero.status).toBe(400);

    // A name made of spaces only.
    const noName = await checkout(slugA, { name: '  ', phone: newPhone(), items: [{ productId: sodaId, quantity: 1 }] });
    expect(noName.status).toBe(400);

    // After four refusals, the drawer still has the same number of slips.
    expect(await countOrders(tenantA)).toBe(before);
  });

  // CHECK 6. Starting the payment: the amount is the order's, and a pending record exists.
  // Real life: the till asks your phone for KES 1,500 (the real price), even if
  // you shout "charge me KES 1". A "waiting" note is written in the book.
  test('6. pay starts the prompt: 202, a pending attempt, the amount is the ORDER total not the request', async () => {
    const phone = newPhone();
    // An order for ONE dress (KES 1,500).
    const orderId = await makeCustomerOrder(phone, [{ productId: dressId, quantity: 1 }]);
    // Ask to pay, while TRYING to say "the amount is KES 1".
    const res = await pay(slugA, orderId, { amountCents: 100, amount: 1 });
    // 202 = "accepted, the prompt is on its way to the phone".
    expect(res.status).toBe(202);
    // The pretend Safaricom WAS contacted (the prompt was "sent").
    expect(fetchMock).toHaveBeenCalled();

    // Look inside: the payment attempt that was written.
    const attempts = await withLock(tenantA, async (db) => (await db.query(
      'SELECT status, amount_cents, phone FROM payment_attempts WHERE order_id = $1', [orderId])).rows);
    // Exactly one attempt, still waiting for the customer to enter the PIN.
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('pending');
    // The amount is KES 1,500 (150000 cents), NOT the KES 1 the cheater asked for.
    expect(Number(attempts[0].amount_cents)).toBe(150000);
    // The prompt goes to the phone saved at checkout.
    expect(attempts[0].phone).toBe(stored(phone));
  });

  // CHECK 7. The anti-spam limit: 3 prompts per phone number, then 429.
  // Real life: the vendor will ring your phone 3 times and then say "enough,
  // wait a bit", so nobody can annoy you with endless M-Pesa prompts.
  test('7. a phone number gets at most 3 prompts in 10 minutes, the 4th is refused with 429', async () => {
    const phone = newPhone();
    // Make FOUR separate orders for the SAME phone.
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push(await makeCustomerOrder(phone));

    // The first three prompts are accepted (202).
    for (let i = 0; i < 3; i++) expect((await pay(slugA, ids[i])).status).toBe(202);
    // The fourth is refused: 429 "too many attempts".
    const fourth = await pay(slugA, ids[3]);
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe('too_many_attempts');
    // The refused try wrote no attempt (so it cannot be counted or charged).
    const rows = await withLock(tenantA, async (db) => (await db.query(
      'SELECT count(*)::int AS n FROM payment_attempts WHERE order_id = $1', [ids[3]])).rows[0].n);
    expect(rows).toBe(0);
  });

  // CHECK 8. A ticket from the wrong shop, a made-up ticket and a wrong-shaped ticket all look the same.
  // Real life: hand any vendor a slip from another kiosk, a fake slip or a
  // scribble, and you always hear the same "I don't know that order". Nobody
  // can learn which slip numbers exist.
  test("8. another shop's order, an unknown id and a badly shaped id all get the SAME 404", async () => {
    // A real order in shop A.
    const orderId = await makeCustomerOrder();
    // A well-shaped id that does not exist anywhere.
    const unknown = '00000000-0000-4000-8000-000000000000';

    // Five attempts that should ALL be turned away the same way.
    const results = [
      await status(slugB, orderId),            // A's order read through B's door
      await status(slugA, unknown),            // an id that was never made
      await status(slugA, 'not-a-ticket'),     // not even shaped like an id
      await pay(slugB, orderId),               // paying A's order through B's door
      await note(slugB, orderId, { note: 'hello' }), // writing a note on A's order through B's door
    ];
    // Every answer is the SAME 404 with the SAME words.
    for (const r of results) {
      expect(r.status).toBe(404);
      expect(r.body).toEqual({ data: null, error: { code: 'not_found', message: 'Order not found' } });
    }
  });

  // CHECK 9. The status answer: right fields, never the phone, never cached.
  // Real life: while you wait, the vendor says "still waiting for your PIN".
  // She never reads your phone number out loud, and never tells the next
  // customer the old answer (no-store).
  test('9. status shows what the waiting screen needs and never the phone number', async () => {
    const phone = newPhone();
    // An order of 2 sodas (KES 160).
    const orderId = await makeCustomerOrder(phone, [{ productId: sodaId, quantity: 2 }]);

    // Before any payment try: nothing has started yet.
    let res = await status(slugA, orderId);
    expect(res.status).toBe(200);
    // "no-store" tells browsers and phones never to remember this answer.
    expect(res.headers['cache-control']).toBe('no-store');
    // payment 'none' = no prompt sent yet.
    expect(res.body.data.payment).toEqual({ status: 'none', receipt: null, reason: null });
    // The total and the lines are what the customer ordered.
    expect(res.body.data.totalCents).toBe(16000);
    expect(res.body.data.items).toEqual([{ name: 'Soda 500ml', quantity: 2, unitPriceCents: 8000 }]);

    // After the prompt is sent: pending (waiting for the PIN).
    await pay(slugA, orderId);
    res = await status(slugA, orderId);
    expect(res.body.data.payment.status).toBe('pending');

    // The phone number appears nowhere in the answer (typed shape or stored shape),
    // and neither does the shop's internal id.
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(phone);
    expect(text).not.toContain(stored(phone));
    expect(text).not.toContain(tenantA);
  });

  // CHECK 10. The "paid" state: receipt appears; the delivery note becomes possible.
  // Real life: "where should we deliver?" is asked only AFTER the M-Pesa
  // message "Confirmed" arrives, never before.
  test('10. once paid, status shows the receipt and the delivery note can be saved (only then)', async () => {
    const orderId = await makeCustomerOrder();

    // BEFORE payment: a note is refused (409) and nothing is saved.
    const early = await note(slugA, orderId, { note: 'Kilimani, gate 3' });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('order_not_paid');

    // Simulate the verified M-Pesa callback: attempt paid + order paid.
    // (The real callback has its own tests; here we only need the "paid" state.)
    await pay(slugA, orderId);
    await withLock(tenantA, async (db) => {
      await db.query(`UPDATE payment_attempts SET status = 'paid', mpesa_reference = 'QK81TEST9', result_code = 0 WHERE order_id = $1`, [orderId]);
      await db.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);
    });

    // Now the status shows "paid" and the M-Pesa receipt code.
    let res = await status(slugA, orderId);
    expect(res.body.data.orderStatus).toBe('paid');
    expect(res.body.data.payment).toEqual({ status: 'paid', receipt: 'QK81TEST9', reason: null });

    // AFTER payment: the note is saved and shows in the status.
    const saved = await note(slugA, orderId, { note: 'Kilimani, gate 3' });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toEqual({ saved: true });
    res = await status(slugA, orderId);
    expect(res.body.data.deliveryNote).toBe('Kilimani, gate 3');

    // Empty (spaces only) or too-long (301 characters) notes are refused with 400.
    expect((await note(slugA, orderId, { note: '   ' })).status).toBe(400);
    expect((await note(slugA, orderId, { note: 'x'.repeat(301) })).status).toBe(400);
  });

  // CHECK 11. Failure reasons are kind words, never Safaricom's raw text.
  // Real life: the vendor says "you cancelled the prompt, want to try again?"
  // instead of reading out a technical error from the phone company.
  test('11. a failed payment shows a short reason and never the raw provider text', async () => {
    const orderId = await makeCustomerOrder();
    await pay(slugA, orderId);
    // Simulate Safaricom reporting "customer cancelled" (result code 1032),
    // with some raw technical text we must NOT pass on to the customer.
    await withLock(tenantA, async (db) => {
      await db.query(
        `UPDATE payment_attempts SET status = 'failed', result_code = 1032,
                result_desc = 'Request cancelled by user RAW-PROVIDER-TEXT' WHERE order_id = $1`, [orderId]);
    });
    const res = await status(slugA, orderId);
    // Our own short reason word: 'cancelled'.
    expect(res.body.data.payment).toEqual({ status: 'failed', receipt: null, reason: 'cancelled' });
    // The raw provider text is nowhere in the answer.
    expect(JSON.stringify(res.body)).not.toContain('RAW-PROVIDER-TEXT');
  });

  // CHECK 12. A shop with no M-Pesa settings cannot take payments, and says so kindly.
  // Real life: a kiosk that has not joined M-Pesa yet tells you "we are not
  // taking M-Pesa today", it does not crash.
  test("12. a shop with no M-Pesa settings answers 409 payments_not_set_up", async () => {
    // Shop B has no daraja_configs. Make an order there by hand
    // (a customer row first, then an order that belongs to it).
    const orderId = await withLock(tenantB, async (db) => {
      const c = await db.query(`INSERT INTO customers (tenant_id, phone) VALUES ($1,$2) RETURNING id`, [tenantB, stored(newPhone())]);
      return (await db.query(
        `INSERT INTO orders (tenant_id, customer_id, total_cents, channel) VALUES ($1,$2,5000,'web') RETURNING id`,
        [tenantB, c.rows[0].id])).rows[0].id;
    });
    // Try to pay: the shop has no keys, so the answer is a clear 409.
    const res = await pay(slugB, orderId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('payments_not_set_up');
  });

  // CHECK 13. Nothing sensitive is printed to the console.
  // Real life: the shopkeeper's notebook (the logs) must never hold customers'
  // phone numbers or the till's secret keys, because many people can read logs.
  test('13. no phone number, key or token appears in the console', async () => {
    const phone = newPhone();
    // Do the whole journey: order, pay, check status.
    const orderId = await makeCustomerOrder(phone);
    await pay(slugA, orderId);
    await status(slugA, orderId);
    // Read everything that was printed during this test.
    const text = consoleText();
    // No phone (typed or stored shape) and no M-Pesa keys.
    expect(text).not.toContain(phone);
    expect(text).not.toContain(stored(phone));
    expect(text).not.toContain(`KEY-${rand}`);
    expect(text).not.toContain(`SECRET-${rand}`);
  });

  // CHECK 14. The door stays closed for everything else.
  // Real life: anyone may ask the kiosk "what do you sell?" (the window), but
  // nobody may walk up and rewrite the kiosk's own sign.
  test('14. the shop address itself still refuses writes, and unknown shops get 404', async () => {
    // Try to change the bare shop address with each "writing" method.
    // Every one must be refused with 404 (the door simply does not exist).
    for (const method of ['post', 'patch', 'put', 'delete']) {
      const res = await request(app)[method](`/v1/storefront/${slugA}`).send({ name: 'Hacked' });
      expect(res.status).toBe(404);
    }
    // A shop that does not exist: checkout answers 404 as well.
    const ghost = await checkout(`nobody-${rand}`, {
      name: 'A', phone: newPhone(), items: [{ productId: sodaId, quantity: 1 }],
    });
    expect(ghost.status).toBe(404);
  });
});