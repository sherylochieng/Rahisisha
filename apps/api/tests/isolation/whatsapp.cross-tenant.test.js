// FILE: apps/api/tests/isolation/whatsapp.cross-tenant.test.js
//
// WHY THIS FILE EXISTS
//   Many shops share ONE WhatsApp webhook (/webhooks/whatsapp). Each shop has
//   its own WhatsApp number (phone_number_id). This test proves that a
//   message for shop A lands ONLY in shop A, that repeats are skipped PER
//   SHOP, and that the verify handshake only works for a real shop token.
//   It also attacks whatsapp_dedupe, the one RLS table the generic loop in
//   isolation.test.js cannot test (it has no `id` column).
//
// WHY IMPORTANT
//   A leak here shows one shop's customer messages to another shop. Manual
//   tests only prove the webhook WORKS. Only an automatic test proves it
//   STAYS SAFE every time someone changes the code.
//
// DANGER (if this file does not exist)
//   - Someone dedupes on message text. Two customers who both say "ok" lose a
//     message. Check 7 fails at once.
//   - Someone dedupes on message_id ALONE (without the shop). Shop B's
//     message is dropped because shop A saw the same id. Check 5 fails.
//   - Someone queries with the plain pool instead of req.db. Messages leak
//     across shops. Check 3 fails.
//
// WHAT IT SOLVES (the 11 checks)
//    1  Verify: right token -> 200 and the challenge is echoed
//    2  Verify: wrong token / wrong mode / odd challenge -> 403
//    3  A message for A's number is saved for A and invisible to B
//    4  The same message id again -> skipped (duplicate)
//    5  The same message id on B's number -> still processed (dedupe is per shop)
//    6  Unknown phone_number_id -> 200 ignored, nothing saved
//    7  Different ids, same text -> BOTH saved (dedupe is on id, not text)
//    8  Payload with no phone_number_id -> 200 ignored
//    9  whatsapp_dedupe: with A's lock, B's rows are invisible
//   10  whatsapp_dedupe: A cannot INSERT a row for B (WITH CHECK)
//   11  Control: with B's lock, B's dedupe row IS visible
//
// SYSTEM DESIGN PRINCIPLE
//   Every new door needs a test that tries to break it.
//
// RULES
//   1. Connect as rahisisha_user (never a superuser): a superuser skips RLS.
//   2. The test creates its OWN two shops and a random throw-away KMS key, so
//      it also runs on GitHub CI.
//   3. Fake tokens only. Clean up everything, even when a check fails.
//
// HOW TO USE
//   cd apps/api
//   npm run test:isolation
//
// GUIDE DOC: apps/api/docs/tests/whatsapp.cross-tenant.test.md
//
// AI AUDIT NOTE
//   Test written by AI (allowed). The tenant resolution it checks was
//   AI-written at Sheryl's request, declared in AI_AUDIT_week_29_day2.md.

import crypto from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { encryptSecret } from '../../src/utils/kms.js';

dotenv.config();

// testPool: our own connection as rahisisha_user, so RLS applies like in the
// real app. (Real life: test the lock with a normal key, not the master key.)
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Random bits so leftovers from a failed old run can never clash (the phone
// number ids and verify tokens are UNIQUE).
const rand = crypto.randomBytes(4).toString('hex');
const PHONE_ID_A = `pid-a-${rand}`;
const PHONE_ID_B = `pid-b-${rand}`;
const VERIFY_A = `verify-a-${rand}`;
const VERIFY_B = `verify-b-${rand}`;
const CUSTOMER = '254711000111';       // the SAME customer messages both shops

let realKey;     // your own KMS_KEY, put back at the end
let tenantA;     // shop A id
let tenantB;     // shop B id

// inTenant: runs SQL holding ONE shop's key. `true` = the key lasts only for
// this transaction, then it is dropped. (Real life: a clerk who opens your
// box only while you are standing at the counter.)
async function inTenant(tenantId, fn) {
  const c = await testPool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
}

// payload: builds the shape Meta really sends (entry -> changes -> value).
function payload(phoneNumberId, messages) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-test',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '254700000000', phone_number_id: phoneNumberId },
          contacts: [{ profile: { name: 'Test Customer' }, wa_id: CUSTOMER }],
          messages,
        },
      }],
    }],
  };
}

// textMsg: one incoming text message.
function textMsg(id, text) {
  return { from: CUSTOMER, id, timestamp: '1700000000', type: 'text', text: { body: text } };
}

// countMessages: how many rows with this Meta id are visible to ONE shop.
async function countMessages(tenantId, messageId) {
  return inTenant(tenantId, async (c) => {
    const { rows } = await c.query(
      'SELECT count(*)::int AS n FROM messages WHERE channel_message_id = $1', [messageId]);
    return rows[0].n;
  });
}

beforeAll(async () => {
  // A throw-away encryption key, so CI (which has no KMS_KEY) still works.
  realKey = process.env.KMS_KEY;
  process.env.KMS_KEY = crypto.randomBytes(32).toString('base64');

  // Two fresh shops (the tenants table has no RLS).
  const a = await testPool.query(
    "INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id",
    [`WA Test A ${rand}`, `wa-a-${rand}`]);
  const b = await testPool.query(
    "INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id",
    [`WA Test B ${rand}`, `wa-b-${rand}`]);
  tenantA = a.rows[0].id;
  tenantB = b.rows[0].id;

  // Each shop's WhatsApp config. Tokens are FAKE and stored ENCRYPTED, like
  // the real thing. (whatsapp_configs has no RLS, so a plain insert works.)
  await testPool.query(
    `INSERT INTO whatsapp_configs
       (tenant_id, phone_number_id, access_token_encrypted, webhook_verify_token)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      tenantA, PHONE_ID_A, encryptSecret('FAKE-TOKEN-A', tenantA), VERIFY_A,
      tenantB, PHONE_ID_B, encryptSecret('FAKE-TOKEN-B', tenantB), VERIFY_B,
    ]);
});

afterAll(async () => {
  // Delete in a safe order: shop rows first (they need the lock), then the
  // configs, then the shops. try/catch so one failure cannot hide the rest.
  for (const t of [tenantA, tenantB]) {
    if (!t) continue;
    try {
      await inTenant(t, async (c) => {
        await c.query('DELETE FROM messages');
        await c.query('DELETE FROM conversations');
        await c.query('DELETE FROM customers');
        await c.query('DELETE FROM whatsapp_dedupe');
      });
    } catch { /* keep cleaning */ }
  }
  await testPool.query('DELETE FROM whatsapp_configs WHERE tenant_id = ANY($1)', [[tenantA, tenantB]]);
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB]]);

  // Put your real key back, then hang up both phone lines so Jest can exit.
  if (realKey === undefined) delete process.env.KMS_KEY;
  else process.env.KMS_KEY = realKey;
  await testPool.end();
  await pool.end();
});

describe('WhatsApp webhook: shops cannot see each other', () => {
  // CHECK 1: the handshake works for a real shop token and echoes the challenge.
  test('1. verify: right token returns the challenge', async () => {
    const res = await request(app).get('/webhooks/whatsapp').query({
      'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_A, 'hub.challenge': '1158201444',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('1158201444');
  });

  // CHECK 2: anything else is refused and reveals nothing.
  test('2. verify: wrong token, wrong mode or odd challenge gives 403', async () => {
    const bad = [
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '123' },
      { 'hub.mode': 'unsubscribe', 'hub.verify_token': VERIFY_A, 'hub.challenge': '123' },
      { 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_A, 'hub.challenge': '<script>x</script>' },
      { 'hub.mode': 'subscribe', 'hub.challenge': '123' },
    ];
    for (const q of bad) {
      const res = await request(app).get('/webhooks/whatsapp').query(q);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
    }
  });

  // CHECK 3: the message goes to A and only A. B's lock cannot see it.
  test("3. a message for A's number is saved for A and invisible to B", async () => {
    const res = await request(app).post('/webhooks/whatsapp')
      .send(payload(PHONE_ID_A, [textMsg('wamid.only-a', 'hello A')]));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ received: 1, duplicates: 0 });
    expect(await countMessages(tenantA, 'wamid.only-a')).toBe(1);
    expect(await countMessages(tenantB, 'wamid.only-a')).toBe(0);
  });

  // CHECK 4: Meta retries. The second delivery must change nothing.
  test('4. the same message id again is skipped', async () => {
    const res = await request(app).post('/webhooks/whatsapp')
      .send(payload(PHONE_ID_A, [textMsg('wamid.only-a', 'hello A')]));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ received: 0, duplicates: 1 });
    expect(await countMessages(tenantA, 'wamid.only-a')).toBe(1);   // still ONE
  });

  // CHECK 5: dedupe is PER SHOP. The same id arriving for B is new for B.
  test("5. the same message id on B's number is still processed", async () => {
    const res = await request(app).post('/webhooks/whatsapp')
      .send(payload(PHONE_ID_B, [textMsg('wamid.only-a', 'hello B')]));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ received: 1, duplicates: 0 });
    expect(await countMessages(tenantB, 'wamid.only-a')).toBe(1);
    expect(await countMessages(tenantA, 'wamid.only-a')).toBe(1);   // A untouched
  });

  // CHECK 6: a number nobody owns. 200 so Meta stops retrying, nothing saved.
  test('6. an unknown phone_number_id is ignored with 200', async () => {
    const res = await request(app).post('/webhooks/whatsapp')
      .send(payload(`pid-nobody-${rand}`, [textMsg('wamid.nobody', 'hi')]));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ignored: true });
    expect(await countMessages(tenantA, 'wamid.nobody')).toBe(0);
    expect(await countMessages(tenantB, 'wamid.nobody')).toBe(0);
  });

  // CHECK 7: dedupe is on the Meta id, NOT the text. Two different messages
  // that both say "ok" must both be saved. (Assignment "common mistake" 3.)
  test('7. different ids with the same text are BOTH saved', async () => {
    const res = await request(app).post('/webhooks/whatsapp')
      .send(payload(PHONE_ID_A, [textMsg('wamid.ok-1', 'ok'), textMsg('wamid.ok-2', 'ok')]));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ received: 2, duplicates: 0 });
    expect(await countMessages(tenantA, 'wamid.ok-1')).toBe(1);
    expect(await countMessages(tenantA, 'wamid.ok-2')).toBe(1);
  });

  // CHECK 8: a payload with no phone_number_id (a strange shape) is ignored.
  test('8. a payload with no phone_number_id is ignored with 200', async () => {
    const res = await request(app).post('/webhooks/whatsapp').send({ object: 'whatsapp_business_account' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ignored: true });
  });

  // CHECK 9: whatsapp_dedupe is a shop table. With A's lock, B's rows are
  // invisible. (This is the table the generic loop cannot test.)
  test("9. whatsapp_dedupe: with A's lock, B's rows are invisible", async () => {
    const rows = await inTenant(tenantA, async (c) =>
      (await c.query('SELECT message_id FROM whatsapp_dedupe WHERE tenant_id = $1', [tenantB])).rows);
    expect(rows.length).toBe(0);
  });

  // CHECK 10: A cannot write a dedupe row that belongs to B (WITH CHECK).
  test('10. whatsapp_dedupe: A cannot INSERT a row for B', async () => {
    await expect(
      inTenant(tenantA, (c) => c.query(
        "INSERT INTO whatsapp_dedupe (tenant_id, message_id) VALUES ($1, 'wamid.sneaky')", [tenantB]))
    ).rejects.toThrow(/row-level security/i);
  });

  // CHECK 11: the control. Without it, check 9 could pass on an empty table.
  test("11. control: with B's lock, B's dedupe row IS visible", async () => {
    const rows = await inTenant(tenantB, async (c) =>
      (await c.query('SELECT message_id FROM whatsapp_dedupe')).rows);
    expect(rows.map((r) => r.message_id)).toContain('wamid.only-a');
  });
});