// =============================================================================
// FILE: apps/api/tests/suspendedShop.doors.test.js   (Week 30 Day 3, Batch 1: admin core, step 5)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves that suspending a shop closes EVERY door that should close, and that
//   reinstating it opens them again: the public page, the USSD phone line, the
//   WhatsApp line, and the owner's own door (look, do not touch).
//
// WHY IMPORTANT
//   A padlock that holds on one door but not the others is worth nothing. This
//   test walks to every door, one by one, and tries the handle. It uses the REAL
//   admin service to suspend and reinstate, so the whole chain is tested: admin
//   action -> database -> every door.
//
// DANGER
//   Makes its own throw-away admin, owner, shop and phone lines with random
//   names and removes them afterwards. Never put real phone numbers or tokens
//   here (the WhatsApp token below is FAKE and stored encrypted, like the real
//   thing).
//
// WHAT IT SOLVES
//   Confidence that "suspended" really means gone on the web page, on USSD, on
//   WhatsApp and for owner changes, with one clear reason shown to the owner.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the promise at the edges: the customer's phone, the customer's
//   WhatsApp, the owner's browser. The inside can be perfect and the promise
//   still broken if one door was forgotten.
//
// RULES
//   1. Each run makes its own shop with random names.
//   2. Clean up everything made, shop rows first (they need the shop lock).
//   3. Never print passwords or tokens.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- suspendedShop
//
// DECISIONS
//   - The M-Pesa door is NOT closed on purpose: money that was already paid must
//     still be recorded. resolveMpesaTenant refuses only 'deleted' shops.
//   - The USSD answer for a suspended shop must be EXACTLY the answer for an
//     unknown code, so a caller cannot tell the difference.
//
// WHERE USED
//   Part of the normal test run (and the pre-push hook).
//
// TRADEOFFS
//   + Real database, real app, real admin service. Nothing is faked.
//   - Orders and inbox writes are covered by one shared guard, tested on
//     products, uploads and orders. The inbox mount uses the same guard.
//
// HOW TO USE
//   cd apps/api ; npm test -- suspendedShop
// =============================================================================

// PIECE BY PIECE
//   dial()          = a phone dialling the shop's USSD code.
//   whatsapp()      = Meta delivering a customer message to the shop's number.
//   inShop()        = "open the shop's own drawer with its own key" to count rows.
//   owner           = the shop owner's browser (a cookie jar with a real token).
//   beforeAll       = build the world: admin, shop, phone lines, owner.
//   afterAll        = remove it all.

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { encryptSecret } from '../src/utils/kms.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import { suspendShop, reinstateShop } from '../src/services/adminShops.service.js';

dotenv.config();

const rand = crypto.randomBytes(4).toString('hex');
const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const CODE = `*384*${crypto.randomInt(100000, 999999)}#`;
const PHONE_ID = `pid-${rand}`;
const CUSTOMER = `2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const REASON = 'customers reported fake M-Pesa messages';

let adminId;
let tenantId;
let userId;
let slug;
let ownerCookie;

// A phone dialling the shop's code (Africa's Talking posts FORM data).
const dial = (code, text = '') =>
  request(app).post('/ussd').type('form')
    .send({ serviceCode: code, sessionId: `s-${rand}`, phoneNumber: CUSTOMER, text });

// Meta delivering one customer message to the shop's WhatsApp number.
const whatsapp = (phoneNumberId, messageId) =>
  request(app).post('/webhooks/whatsapp').send({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-test',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '254700000000', phone_number_id: phoneNumberId },
          contacts: [{ profile: { name: 'Test Customer' }, wa_id: CUSTOMER }],
          messages: [{ from: CUSTOMER, id: messageId, timestamp: '1700000000', type: 'text', text: { body: 'hello' } }],
        },
      }],
    }],
  });

// Open the shop's own drawer with its own key (the shop lock), run a query, close it.
async function inShop(work) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const out = await work(c);
    await c.query('COMMIT');
    return out;
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}
const countMessages = (id) =>
  inShop(async (c) => (await c.query('SELECT count(*)::int AS n FROM messages WHERE channel_message_id = $1', [id])).rows[0].n);
const countProducts = () =>
  inShop(async (c) => (await c.query('SELECT count(*)::int AS n FROM products')).rows[0].n);

beforeAll(async () => {
  // The admin who will suspend and reinstate.
  const admin = await createPlatformAdmin(pool, {
    phone: randomPhone(), name: 'Doors Test Admin', password: `pw-${crypto.randomBytes(12).toString('hex')}`,
  });
  adminId = admin.id;

  // The shop, its owner, and its two phone lines (USSD and WhatsApp).
  slug = `doors-${rand}`;
  const t = await pool.query('INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id', [`Doors Test ${rand}`, slug]);
  tenantId = t.rows[0].id;
  const u = await pool.query(
    'INSERT INTO users (phone, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [`2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`, 'Doors Owner', 'not-a-real-hash']
  );
  userId = u.rows[0].id;
  await pool.query(
    'INSERT INTO ussd_configs (tenant_id, service_code, welcome_text) VALUES ($1, $2, $3)',
    [tenantId, CODE, `Welcome to Doors ${rand}`]
  );
  await pool.query(
    `INSERT INTO whatsapp_configs (tenant_id, phone_number_id, access_token_encrypted, webhook_verify_token)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, PHONE_ID, encryptSecret('FAKE-TOKEN', tenantId), `verify-${rand}`]
  );

  // The owner's browser: a real token, signed the same way signup and login do.
  const token = jwt.sign({ user_id: userId, tenant_id: tenantId, role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  ownerCookie = `token=${token}`;
});

afterAll(async () => {
  // Shop rows first (they need the shop lock), then the phone lines, then the shop.
  try {
    await inShop(async (c) => {
      await c.query('DELETE FROM messages');
      await c.query('DELETE FROM conversations');
      await c.query('DELETE FROM customers');
      await c.query('DELETE FROM whatsapp_dedupe');
      await c.query('DELETE FROM products');
    });
  } catch { /* keep cleaning */ }
  await pool.query('DELETE FROM whatsapp_configs WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM ussd_configs WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM audit_logs WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await withAdminLock(pool, (c) => c.query('DELETE FROM platform_admins WHERE id = $1', [adminId]));
  await pool.end();
});

describe('suspended shop: every door (Week 30 Day 3, Batch 1)', () => {

  // CHECK 1. CONTROL: while the shop is active, every door works.
  // Without this, "the door is shut" could simply mean "the door was broken".
  test('1. while ACTIVE: the page, USSD, WhatsApp and the owner all work', async () => {
    expect((await request(app).get(`/v1/storefront/${slug}`)).status).toBe(200);

    const ussd = await dial(CODE);
    expect(ussd.text).toContain(`CON Welcome to Doors ${rand}`);

    const wa = await whatsapp(PHONE_ID, `wamid-active-${rand}`);
    expect(wa.status).toBe(200);
    expect(await countMessages(`wamid-active-${rand}`)).toBe(1);

    const made = await request(app).post('/v1/products').set('Cookie', ownerCookie)
      .send({ name: 'Kitenge dress', priceCents: 250000 });
    expect(made.status).toBe(201);
    expect(await countProducts()).toBe(1);

    const me = await request(app).get('/v1/me').set('Cookie', ownerCookie);
    expect(me.status).toBe(200);
    expect(me.body.tenant.status).toBe('active');
    expect(me.body.tenant.suspended_reason).toBeNull();
  });

  // CHECK 2. THE PADLOCK: after the admin suspends the shop, the public doors close.
  test('2. after SUSPEND: the page, USSD and WhatsApp stop answering', async () => {
    await suspendShop(pool, { adminId, tenantId, reason: REASON });

    // The public page: not found (it never admits the shop exists).
    expect((await request(app).get(`/v1/storefront/${slug}`)).status).toBe(404);

    // USSD: EXACTLY the answer an unknown code gets, so nobody can tell the difference.
    const suspended = await dial(CODE);
    const unknown = await dial('*384*000000#');
    expect(suspended.text).toBe('END Service unavailable');
    expect(suspended.text).toBe(unknown.text);
    expect(suspended.text).not.toContain(REASON);

    // WhatsApp: 200 "ignored" (so Meta does not retry) and NOTHING is saved.
    const wa = await whatsapp(PHONE_ID, `wamid-suspended-${rand}`);
    expect(wa.status).toBe(200);
    expect(wa.body).toEqual({ data: { ignored: true }, error: null });
    expect(await countMessages(`wamid-suspended-${rand}`)).toBe(0);
  });

  // CHECK 3. LOOK, DO NOT TOUCH: the owner can read, but every write is refused with the reason.
  test('3. after SUSPEND: the owner can look but not touch, and is told why', async () => {
    // Looking works.
    const list = await request(app).get('/v1/products').set('Cookie', ownerCookie);
    expect(list.status).toBe(200);
    const me = await request(app).get('/v1/me').set('Cookie', ownerCookie);
    expect(me.status).toBe(200);
    expect(me.body.tenant.status).toBe('suspended');
    expect(me.body.tenant.suspended_reason).toBe(REASON);
    expect(me.body.tenant.suspended_at).toBeTruthy();

    // Touching is refused, with the reason, on every owner write door.
    const before = await countProducts();
    const attempts = [
      request(app).post('/v1/products').set('Cookie', ownerCookie).send({ name: 'Sneaky dress', priceCents: 100 }),
      request(app).patch(`/v1/products/${crypto.randomUUID()}`).set('Cookie', ownerCookie).send({ name: 'x' }),
      request(app).delete(`/v1/products/${crypto.randomUUID()}`).set('Cookie', ownerCookie),
      request(app).post('/v1/uploads/sign').set('Cookie', ownerCookie).send({}),
      request(app).post('/v1/orders').set('Cookie', ownerCookie).send({}),
    ];
    for (const attempt of attempts) {
      const res = await attempt;
      expect(res.status).toBe(403);
      expect(res.body.data).toBeNull();
      expect(res.body.error.code).toBe('shop_suspended');
      expect(res.body.error.details.reason).toBe(REASON);
    }
    // Nothing was created.
    expect(await countProducts()).toBe(before);
  });

  // CHECK 4. THE PADLOCK COMES OFF: reinstate, and every door opens on the very next request.
  test('4. after REINSTATE: every door works again, with no sign-out needed', async () => {
    await reinstateShop(pool, { adminId, tenantId, reason: 'owner fixed the problem and proved it' });

    expect((await request(app).get(`/v1/storefront/${slug}`)).status).toBe(200);
    expect((await dial(CODE)).text).toContain(`CON Welcome to Doors ${rand}`);

    const wa = await whatsapp(PHONE_ID, `wamid-back-${rand}`);
    expect(wa.status).toBe(200);
    expect(await countMessages(`wamid-back-${rand}`)).toBe(1);

    const made = await request(app).post('/v1/products').set('Cookie', ownerCookie)
      .send({ name: 'Back in business', priceCents: 1000 });
    expect(made.status).toBe(201);

    const me = await request(app).get('/v1/me').set('Cookie', ownerCookie);
    expect(me.body.tenant.status).toBe('active');
    expect(me.body.tenant.suspended_reason).toBeNull();
  });

  // CHECK 5. A deleted shop is refused too, and no reason is shown.
  test('5. a DELETED shop refuses owner writes with a different code and no reason', async () => {
    await pool.query("UPDATE tenants SET status = 'deleted' WHERE id = $1", [tenantId]);
    const res = await request(app).post('/v1/products').set('Cookie', ownerCookie)
      .send({ name: 'Ghost dress', priceCents: 100 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('shop_unavailable');
    expect(res.body.error.details).toBeUndefined();
    // Reads still pass the guard (the shop-lock rules decide what they see).
    await pool.query("UPDATE tenants SET status = 'active' WHERE id = $1", [tenantId]);
  });
});
