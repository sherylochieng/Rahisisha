// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/tenants.happy-path.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   This is the public "which shop is this?" lookup. A customer
//   visits a shop's web address, and the browser asks this
//   endpoint who owns that name. This file checks it works,
//   and that it works WITHOUT logging in.
//
// WHAT IT TESTS (happy path = everything done correctly)
//   1. GET /v1/tenants/by-slug/:slug -> 200, public, no login,
//      returns only id, name and slug.
//
// WHY IMPORTANT
//   Customers are not logged in. If this endpoint starts asking
//   for login, nobody can open a shop's public page. If it
//   starts returning private fields, we leak data to strangers.
//
// DANGER (what breaks without it)
//   - Someone moves the route behind requireAuth by accident:
//     every customer gets 401.
//   - Someone adds a private field (owner phone, balance) to the
//     reply: anyone on the internet can read it.
//
// WHAT IT SOLVES
//   Isolation tests prove Shop A cannot see Shop B's PRIVATE
//   data (locks). They do NOT prove the PUBLIC lookup works and
//   stays minimal. This file proves both.
//
// SYSTEM DESIGN PRINCIPLE
//   "Public endpoints expose the minimum." by-slug has no login
//   on purpose, so it may only return what a shop sign shows:
//   id, name, slug. We check the exact list of fields.
//   Also: "each test file builds its own world". We sign up a
//   new shop with a unique name.
//
// RULES (never do this)
//   1. NEVER add private data to the by-slug reply (phone,
//      balance, owner). It has no login on purpose.
//   2. NEVER add a cookie to the by-slug request in this test.
//      Sending none is the whole point.
//   3. NEVER hard-code a shop name. Use a unique one.
//   4. NEVER log cookies or passwords.
//   5. NEVER edit a test just to make it pass. Ask first: is the
//      test wrong, or is the code wrong?
//
// PRACTICAL EXAMPLE
//   A customer opens mamanjeri.rahisisha.co.ke. The browser asks
//   by-slug "who is mamanjeri?" and gets back the shop's id and
//   name, so it can load the right shop. No login needed.
//
// DECISIONS
//   - Shop name is "Tenant" + stamp, one word, e.g. Tenant12345678.
//     The slug is the lowercase name, which is easy to predict.
//     (One word avoids the known slugify trailing-dash bug that
//     we fix after Day 6.)
//   - We compare the exact list of keys, so ANY new field added
//     to the reply makes this test fail on purpose.
//
// WHERE YOU WILL USE THIS
//   - By hand:  npm test -- tenants.happy-path
//   - CI (Task 7) runs it on every push.
//   - The "Core Polish" grader looks for one test per endpoint.
//
// TRADEOFFS
//   + Real database, real confidence.
//   - Leaves one test shop behind each run. The reset script
//     (Task 5) clears it.
//   - Failing on ANY new field is strict, but safe. If we add a
//     field on purpose later, we update this test on purpose.
//
// HOW TO USE
//   cd apps/api
//   npm test -- tenants.happy-path
//   Expect: 1 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. stamp  =  A TICKET NUMBER from the queue
//    Different every run, so the shop name never clashes.
//
// 2. slug  =  THE SHOP'S WEB NAME
//    "Tenant123" becomes "tenant123", like a shop sign painted
//    on the front: lowercase, no spaces.
//
// 3. tenantId  =  THE SHOP'S ID CARD NUMBER
//    Signup gives it to us. The lookup must return the same one.
//
// 4. GET by-slug WITHOUT .set('Cookie')  =  READING THE SHOP SIGN
//    Anyone walking past the street can read it. No badge needed.
//
// 5. expect(res.body.error).toBeNull()  =  "NO PROBLEM REPORTED"
//    The reply is { data, error }. error is null when all is well.
//
// 6. Object.keys(...).sort()  =  CHECKING THE SIGN SAYS ONLY
//    id, name and slug. Nothing private is painted on it.
//    sort() puts the names in order so the comparison is fair.
//
// 7. toEqual([...])  =  "THE LIST MATCHES EXACTLY"
//    Unlike toBe, toEqual compares what is INSIDE a list.
// ═══════════════════════════════════════════════════════════

// supertest: calls our Express app like a browser, no server needed.
import request from 'supertest';

// dotenv: loads DATABASE_URL, JWT_SECRET etc. from .env
import dotenv from 'dotenv';

// app: our real Express app.
import app from '../src/app.js';

dotenv.config();

// Unique ticket number for THIS run.
const stamp    = String(Date.now()).slice(-8);
const phone    = `07${stamp}`;
const password = 'Test1234!';

// One-word shop name, so the slug is easy to predict.
const shopName = `Tenant${stamp}`;
const slug     = shopName.toLowerCase();

let tenantId;

// ── SETUP: open a fresh shop ────────────────────────────
beforeAll(async () => {
  const signup = await request(app)
    .post('/v1/signup')
    .send({
      phone,
      name: 'Tenant Tester',
      password,
      tenant_name: shopName,
    });

  expect(signup.status).toBe(201);
  tenantId = signup.body.tenant_id;
  expect(tenantId).toBeDefined();
});

describe('Tenants happy path', () => {

  // ── TEST 1: PUBLIC LOOKUP ─────────────────────────────
  test('GET /v1/tenants/by-slug/:slug works without login', async () => {
    // NOTE: no .set('Cookie', ...). This route is public.
    const res = await request(app)
      .get(`/v1/tenants/by-slug/${slug}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();

    // The right shop comes back.
    expect(res.body.data.id).toBe(tenantId);
    expect(res.body.data.name).toBe(shopName);
    expect(res.body.data.slug).toBe(slug);

    // Public means MINIMUM: only these three fields.
    expect(Object.keys(res.body.data).sort()).toEqual(['id', 'name', 'slug']);
  });
});