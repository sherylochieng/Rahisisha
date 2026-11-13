// =============================================================================
// FILE: apps/api/tests/isolation/ussd.cross-tenant.test.js
// ussd.cross-tenant.test.js — proves USSD shops cannot see each other
// =============================================================================
//
// THE STORY (read this first):
// - Picture two shops in one mall, sharing ONE phone line (POST /ussd).
//   Shop A has number *384*7xxxxx#, shop B has *384*8xxxxx#.
// - A caller dials A's number. They must see A's menu, A's products, A's
//   money. NEVER B's. Even if the caller knows B's product id.
//
// WHY THIS FILE EXISTS:
// - Task 4 of Week 29 Day 1: "request to service code A, look up Tenant B
//   data, get nothing". This file proves it two ways:
//     (a) through the real endpoint (supertest), and
//     (b) straight on the database with shop A's lock and shop B's id.
//
// WHY IT IS IMPORTANT:
// - USSD handles money and prices. A leak here shows one shop's balance to
//   another shop's customers.
//
// DANGER — IF THIS FILE DOES NOT EXIST:
// - Someone adds a new menu option and queries with the plain pool instead
//   of req.db. The menu works in every manual test, but silently shows
//   everybody's data. Only a test like this catches it.
//
// WHAT THIS TEST SOLVES (the checks):
// - 1. Dial A: welcome is A's, never B's
// - 2. Option 1 on A: only A's product. On B: only B's product
// - 3. Option 2 on A and B: each sees its own balance
// - 4. Unknown code: END Service unavailable
// - 5. Same phone number on both codes: still different shops
//      (the phone is NEVER the tenant)
// - 6. Every reply is 182 characters or less
// - 7. Task 4: with A's lock, B's rows are invisible, even by id
// - 8. Control: with B's lock, B's row IS visible (so check 7 is not empty)
//
// SYSTEM DESIGN PRINCIPLE: Every new door needs a test that tries to break it
//
// RULES:
// - Connect as rahisisha_user (never a superuser), or RLS is skipped and the
//   test proves nothing (same as the other isolation tests)
// - The test creates its OWN two shops, so it also works in CI where the
//   demo shops (Amina, Brio) do not exist
// - Clean up everything we created, even if a test fails
//
// PRACTICAL EXAMPLE:
// - Real life: two M-Pesa agents share one till number. Each agent must only
//   see their own float, not the other's.
//
// DECISIONS:
// - Random service codes: so a leftover from an old failed run cannot clash
// - set_config(..., true) inside BEGIN/COMMIT: the lock lasts only for that
//   transaction (same pattern as the other tests)
// - Delete order: products and wallet (RLS tables) first, then ussd_configs,
//   then tenants
//
// WHERE USED / FUTURE USES:
// - Runs in `npm test` and in the pre-push isolation suite. Copy the shape
//   for any new channel (WhatsApp webhook, SMS) that resolves a tenant from
//   a key instead of a login cookie.
//
// TRADEOFFS:
// + Self-contained, runs anywhere
// - A few more lines of setup than reusing the demo shops
//
// HOW TO RUN:
//   cd apps/api
//   npm run test:isolation
//
// GUIDE: apps/api/docs/tests/ussd.cross-tenant.test.md
// =============================================================================

// supertest: sends fake HTTP requests to our app without opening a real port.
// REAL LIFE: a mystery shopper who walks into the shop and asks for things.
import request from 'supertest';

// dotenv: reads DATABASE_URL from the .env file.
import dotenv  from 'dotenv';

// pg: the Postgres driver. We make our own pool for setup and cleanup.
import pg      from 'pg';

// The real app, exactly as production builds it (guard, lock, routes).
// WHY: testing the real thing is the whole point. A fake would prove nothing.
import app      from '../../src/app.js';

// The app's own pool. We import it ONLY so we can close it at the end,
// otherwise Jest hangs after the tests finish.
import { pool } from '../../src/db/pool.js';

dotenv.config();

const { Pool } = pg;

// Our own connection as rahisisha_user, so RLS applies like in the real app.
// WHY: a superuser would skip RLS and the test would prove nothing.
// REAL LIFE: test the lock with a normal key, not the master key.
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Random numbers so old leftovers can never clash with this run.
// WHY: service_code is UNIQUE. A fixed code from a crashed earlier run
// would make this run fail for the wrong reason.
// EXAMPLE: CODE_A = "*384*7482913#"
const rand = Math.floor(Math.random() * 900000) + 100000;
const CODE_A = `*384*7${rand}#`;
const CODE_B = `*384*8${rand}#`;

// The SAME phone dials BOTH shops.
// WHY: if the app wrongly picked the shop from the phone number, check 5
// would fail. The phone must NEVER decide the shop (assignment's first
// "common mistake").
const PHONE  = '+254799999999';

let tenantA;       // real UUID of shop A
let tenantB;       // real UUID of shop B
let productB_id;   // shop B's product id: the one A must never reach

// ---------------------------------------------------------------
// asTenant(tenantId, fn)
// Runs SQL holding ONE shop's key, inside a transaction.
// WHY set_config(..., true): "true" means the key lasts only for this
//   transaction, then it is dropped. Nothing leaks to the next query.
// WHY BEGIN/COMMIT: set_config(true) needs an open transaction to work.
// WHY ROLLBACK + finally release: if anything fails we undo, and we
//   ALWAYS give the connection back, or the pool runs dry.
// REAL LIFE: a bank clerk who can open your box only while you stand at
//   the counter.
// ---------------------------------------------------------------
async function asTenant(tenantId, fn) {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// dial(serviceCode, text)
// Pretends to be Africa's Talking: POST form data to /ussd.
// WHY .type('form'): Africa's Talking sends FORM data, not JSON. Without
//   it the body arrives empty and every call says "Service unavailable".
// WHY it goes through the real app: so the real guard and the real RLS
//   lock are part of the test.
// EXAMPLE: dial(CODE_A, '1')  = someone dials shop A and presses 1.
// ---------------------------------------------------------------
function dial(serviceCode, text = '') {
  return request(app)
    .post('/ussd')
    .type('form')
    .send({ serviceCode, sessionId: 'test-session', phoneNumber: PHONE, text });
}

// ---------------------------------------------------------------
// beforeAll: build the world once for all tests
// WHY our own shops: the demo shops (Amina, Brio) exist only on your
//   laptop. A test that needs them would FAIL in GitHub CI.
// WHY different data per shop: if they ever mix, we can SEE it
//   (a dress is never a hammer).
// ---------------------------------------------------------------
beforeAll(async () => {
  // Create two fresh shops (the tenants table has no RLS).
  const a = await testPool.query(
    "INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id",
    [`UssdTest A ${rand}`, `ussdtest-a-${rand}`]
  );
  const b = await testPool.query(
    "INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id",
    [`UssdTest B ${rand}`, `ussdtest-b-${rand}`]
  );
  tenantA = a.rows[0].id;
  tenantB = b.rows[0].id;

  // Their USSD phone book entries (ussd_configs has no RLS).
  // WHY: this is what the guard looks up to find the shop.
  await testPool.query(
    'INSERT INTO ussd_configs (tenant_id, service_code, welcome_text) VALUES ($1,$2,$3),($4,$5,$6)',
    [tenantA, CODE_A, 'Welcome to UssdTest A', tenantB, CODE_B, 'Welcome to UssdTest B']
  );

  // Shop A: one dress, KSh 1,000 in the wallet.
  // WHY asTenant: products and wallet_entries have RLS. An insert without
  //   the shop's key is rejected.
  await asTenant(tenantA, async (c) => {
    await c.query(
      "INSERT INTO products (tenant_id, name, price_cents, status) VALUES ($1,'Test Dress A',50000,'active')",
      [tenantA]
    );
    await c.query(
      "INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference) VALUES ($1,100000,'sale','USSD-TEST-A')",
      [tenantA]
    );
  });

  // Shop B: one hammer, KSh 2,000 in the wallet.
  // WHY we keep productB_id: check 7 tries to reach it from shop A.
  productB_id = await asTenant(tenantB, async (c) => {
    const p = await c.query(
      "INSERT INTO products (tenant_id, name, price_cents, status) VALUES ($1,'Test Hammer B',45000,'active') RETURNING id",
      [tenantB]
    );
    await c.query(
      "INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference) VALUES ($1,200000,'sale','USSD-TEST-B')",
      [tenantB]
    );
    return p.rows[0].id;
  });
});

// ---------------------------------------------------------------
// afterAll: tidy up, even if a test failed
// WHY this order: wallet and products are RLS tables (need the shop's
//   key), then ussd_configs, then the tenants themselves.
// WHY end both pools: otherwise Jest never exits.
// ---------------------------------------------------------------
afterAll(async () => {
  for (const t of [tenantA, tenantB]) {
    if (!t) continue;   // setup failed before this shop existed
    await asTenant(t, async (c) => {
      await c.query('DELETE FROM wallet_entries WHERE tenant_id = $1', [t]);
      await c.query('DELETE FROM products WHERE tenant_id = $1', [t]);
    });
    await testPool.query('DELETE FROM ussd_configs WHERE tenant_id = $1', [t]);
    await testPool.query('DELETE FROM tenants WHERE id = $1', [t]);
  }
  await testPool.end();
  await pool.end();
});

describe('Cross-tenant isolation — POST /ussd', () => {

  // CHECK 1: dial A, get A's welcome, never B's.
  // WHAT SHOULD HAPPEN: the guard finds shop A from the service code.
  // WHAT MUST NOT HAPPEN: any trace of shop B on A's screen.
  test('Dialling shop A shows shop A welcome, never shop B', async () => {
    const res = await dial(CODE_A);
    expect(res.status).toBe(200);
    expect(res.text).toContain('CON Welcome to UssdTest A');
    expect(res.text).not.toContain('UssdTest B');
  });

  // CHECK 2: option 1 shows only that shop's product.
  // WHY both directions: A must not see B's hammer AND B must not see
  //   A's dress. A one-way check could miss a half-broken lock.
  test('Option 1 lists only the dialled shop products', async () => {
    const a = await dial(CODE_A, '1');
    expect(a.text).toContain('Test Dress A');
    expect(a.text).not.toContain('Test Hammer B');

    const b = await dial(CODE_B, '1');
    expect(b.text).toContain('Test Hammer B');
    expect(b.text).not.toContain('Test Dress A');
  });

  // CHECK 3: option 2 shows only that shop's balance.
  // WHY toBe (exact text): A is 100000 cents = "1,000", B is 200000
  //   cents = "2,000". If balances were added together we would see 3,000.
  test('Option 2 shows each shop its own balance', async () => {
    const a = await dial(CODE_A, '2');
    expect(a.text).toBe('END Balance: KSh 1,000');

    const b = await dial(CODE_B, '2');
    expect(b.text).toBe('END Balance: KSh 2,000');
  });

  // CHECK 4: nobody owns this code.
  // WHY: an unknown code must close politely and reveal nothing.
  test('Unknown service code gets END Service unavailable', async () => {
    const res = await dial('*384*000000#');
    expect(res.text).toBe('END Service unavailable');
  });

  // CHECK 5: the phone number is NOT the tenant.
  // WHY: the same phone dials both shops. If the app used the phone to
  //   pick the shop, both screens would be the same.
  test('Same phone number on two codes gets two different shops', async () => {
    const a = await dial(CODE_A);
    const b = await dial(CODE_B);
    expect(a.text).toContain('UssdTest A');
    expect(b.text).toContain('UssdTest B');
    expect(a.text).not.toBe(b.text);
  });

  // CHECK 6: the 182 character rule.
  // WHY every screen and an invalid key ('9'): the cap must hold for the
  //   first screen, each option, and the "invalid choice" reply.
  test('Every reply is 182 characters or less', async () => {
    for (const code of [CODE_A, CODE_B]) {
      for (const text of ['', '1', '2', '3', '9']) {
        const res = await dial(code, text);
        expect(res.text.length).toBeLessThanOrEqual(182);
      }
    }
  });

  // CHECK 7 (Task 4): request to code A, look up shop B's data, get nothing.
  // WHY this is the heart of the assignment: even a developer who FORGETS a
  //   WHERE clause is saved by RLS. With A's key, B's rows do not exist.
  test('With shop A lock, shop B data is invisible even by id', async () => {
    // Resolve the shop from the service code, exactly like the guard does.
    const found = await testPool.query(
      'SELECT tenant_id FROM ussd_configs WHERE service_code = $1',
      [CODE_A]
    );
    expect(found.rows[0].tenant_id).toBe(tenantA);

    await asTenant(found.rows[0].tenant_id, async (c) => {
      // By B's tenant id: nothing.
      const byTenant = await c.query('SELECT id FROM products WHERE tenant_id = $1', [tenantB]);
      expect(byTenant.rows).toHaveLength(0);

      // By B's product id (the "I know your product id" attack): nothing.
      const byId = await c.query('SELECT id FROM products WHERE id = $1', [productB_id]);
      expect(byId.rows).toHaveLength(0);

      // B's money: nothing.
      const money = await c.query('SELECT id FROM wallet_entries WHERE tenant_id = $1', [tenantB]);
      expect(money.rows).toHaveLength(0);
    });
  });

  // CHECK 8: control.
  // WHY: without this, check 7 could pass because the table is simply empty.
  //   Here B's own key finds B's product, so we know the row is real and
  //   only the lock was hiding it from A.
  test('Control: with shop B lock, shop B product IS visible', async () => {
    await asTenant(tenantB, async (c) => {
      const byId = await c.query('SELECT id FROM products WHERE id = $1', [productB_id]);
      expect(byId.rows).toHaveLength(1);
    });
  });
});