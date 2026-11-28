// =============================================================================
// FILE: apps/api/tests/notifications.outbox.test.js   (Week 30 Day 3, Batch 3b-1: the outbox, step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the notifications outbox (migration 031) does its job: each admin
//   action queues exactly one message for the owner, with the right words
//   (template + payload), in the SAME transaction as the shop change.
//
// WHY IMPORTANT
//   If a message were lost, an owner would find their shop closed with no word.
//   If a message were queued for a change that was rolled back, an owner would be
//   told something that never happened. Both are trust-breakers.
//
// DANGER
//   Makes its own throw-away admin, shops and owners with random names and
//   removes them afterwards. Never use real phone numbers or passwords here.
//   Never run against a database whose shops you care about.
//
// WHAT IT SOLVES
//   Confidence in: queueing on every action, the reason only in the suspend
//   message, "no owner" not breaking the action, a failed action queueing
//   nothing, and rollback taking the message with it.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the promises: "one change = one message", "no message without the
//   change", "a message problem never blocks head office".
//
// RULES
//   1. Random names per run so tests never collide.
//   2. Clean up everything made (messages go with the shop, receipts, owners, admin).
//   3. Read the outbox only inside withAdminLock (the table is head-office-only).
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- notifications.outbox
//
// DECISIONS
//   - Real pool and real services, no fakes: the database rules (RLS, CHECKs,
//     transactions) are exactly what we want to test.
//
// WHERE USED
//   Normal test run (and the pre-push hook only runs the isolation suites).
//
// TRADEOFFS
//   + End to end at the service level. - Needs the migration applied first.
//
// HOW TO USE
//   cd apps/api ; npm test -- notifications.outbox
// =============================================================================

// PIECE BY PIECE
//   randomPhone / randomPassword = made-up details.
//   makeShop()      = a throw-away shop, with or without an owner.
//   outboxFor()     = read the messages queued for one shop.
//   beforeAll / afterAll = hire the test admin / clean up.
//   Checks 1-4      = the four admin actions queue the right message.
//   Check 5         = no owner row: the action still works, phone is empty.
//   Check 6         = a refused action queues nothing.
//   Check 7         = rollback removes the queued message too.
//   Checks 8-9      = enqueueNotification refuses bad input; maskPhone hides digits.

import crypto from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import {
  suspendShop, reinstateShop, verifyShop, unverifyShop,
} from '../src/services/adminShops.service.js';
import {
  enqueueNotification, NOTIFICATION_TEMPLATES, maskPhone,
} from '../src/services/notifications.service.js';

const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;
const tag = `nb${crypto.randomBytes(4).toString('hex')}`;

let adminId;
const shops = {};        // label -> shop id
const shopNames = {};    // label -> shop name
const ownerIds = [];
const ownerPhones = {};  // label -> owner phone

// Open a throw-away shop. withOwner=false makes a shop with NO owner row.
async function makeShop(label, { withOwner = true } = {}) {
  const slug = `${tag}-${label}-${crypto.randomBytes(3).toString('hex')}`;
  const name = `${tag} ${label} Fashions`;
  const { rows: t } = await pool.query(
    "INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id", [name, slug]);
  shops[label] = t[0].id;
  shopNames[label] = name;
  if (!withOwner) return t[0].id;
  const phone = `2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
  const { rows: u } = await pool.query(
    'INSERT INTO users (phone, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [phone, `Owner of ${label}`, 'not-a-real-hash']);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [t[0].id]);
    await client.query(
      "INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [t[0].id, u[0].id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  ownerIds.push(u[0].id);
  ownerPhones[label] = phone;
  return t[0].id;
}

// Read the queued messages for one shop, oldest first (head office view).
async function outboxFor(shopId) {
  return withAdminLock(pool, async (c) => {
    const { rows } = await c.query(
      'SELECT * FROM notifications WHERE tenant_id = $1 ORDER BY created_at ASC, id ASC', [shopId]);
    return rows;
  });
}

// The latest receipt for a shop (to compare with audit_log_id).
async function latestReceipt(shopId) {
  const { rows } = await pool.query(
    'SELECT id FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1', [shopId]);
  return rows[0];
}

beforeAll(async () => {
  const admin = await createPlatformAdmin(pool, {
    phone: randomPhone(), name: 'Outbox Test Admin', password: randomPassword(),
  });
  adminId = admin.id;
  await makeShop('alpha');
  await makeShop('bravo', { withOwner: false });
  await makeShop('charlie');
});

afterAll(async () => {
  const ids = Object.values(shops);
  if (ids.length) {
    // Receipts first, then shops (their messages and memberships go with them).
    await pool.query('DELETE FROM audit_logs WHERE tenant_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM tenants WHERE id = ANY($1)', [ids]);
  }
  if (ownerIds.length) await pool.query('DELETE FROM users WHERE id = ANY($1)', [ownerIds]);
  if (adminId) {
    await withAdminLock(pool, (c) => c.query('DELETE FROM platform_admins WHERE id = $1', [adminId]));
  }
  await pool.end();
});

describe('notifications outbox (Week 30 Day 3, Batch 3b-1)', () => {

  // CHECK 1. Suspend queues ONE message, with the reason, linked to the receipt.
  // Real life: the clerk closes the shop and drops "tell the owner why" in the tray.
  test('1. suspend queues one message for the owner, with the reason and the receipt id', async () => {
    await suspendShop(pool, { adminId, tenantId: shops.alpha, reason: 'customers reported fake M-Pesa messages' });
    const rows = await outboxFor(shops.alpha);
    expect(rows).toHaveLength(1);
    const m = rows[0];
    expect(m.template).toBe(NOTIFICATION_TEMPLATES.SHOP_SUSPENDED);
    expect(m.channel).toBe('test');
    expect(m.status).toBe('queued');
    expect(m.attempts).toBe(0);
    expect(m.recipient_phone).toBe(ownerPhones.alpha);
    expect(m.payload).toEqual({ shopName: shopNames.alpha, reason: 'customers reported fake M-Pesa messages' });
    // The message points at the receipt of this very action.
    const receipt = await latestReceipt(shops.alpha);
    expect(m.audit_log_id).toBe(receipt.id);
  });

  // CHECK 2. Reinstate queues a message WITHOUT the internal reason.
  test('2. reinstate queues a message and does not leak the admin reason', async () => {
    await reinstateShop(pool, { adminId, tenantId: shops.alpha, reason: 'owner fixed the problem (internal note)' });
    const rows = await outboxFor(shops.alpha);
    expect(rows).toHaveLength(2);
    const m = rows[1];
    expect(m.template).toBe(NOTIFICATION_TEMPLATES.SHOP_REINSTATED);
    expect(m.payload).toEqual({ shopName: shopNames.alpha });
    expect(JSON.stringify(m.payload)).not.toContain('internal note');
  });

  // CHECK 3. Verify queues a message without the reason.
  test('3. verify queues a message without the reason', async () => {
    await verifyShop(pool, { adminId, tenantId: shops.alpha, reason: 'saw the business permit (internal)' });
    const rows = await outboxFor(shops.alpha);
    expect(rows).toHaveLength(3);
    expect(rows[2].template).toBe(NOTIFICATION_TEMPLATES.SHOP_VERIFIED);
    expect(rows[2].payload).toEqual({ shopName: shopNames.alpha });
  });

  // CHECK 4. Un-verify queues a message without the reason.
  test('4. un-verify queues a message without the reason', async () => {
    await unverifyShop(pool, { adminId, tenantId: shops.alpha, reason: 'permit was for another shop (internal)' });
    const rows = await outboxFor(shops.alpha);
    expect(rows).toHaveLength(4);
    expect(rows[3].template).toBe(NOTIFICATION_TEMPLATES.SHOP_UNVERIFIED);
    expect(rows[3].payload).toEqual({ shopName: shopNames.alpha });
  });

  // CHECK 5. A shop with no owner: the action works, the line has an empty phone.
  // Real life: nobody to tell must never stop head office from acting.
  test('5. a shop with no owner still gets suspended; the message has no phone', async () => {
    const shop = await suspendShop(pool, { adminId, tenantId: shops.bravo, reason: 'no owner on file test' });
    expect(shop.status).toBe('suspended');
    expect(shop.owner).toBeNull();
    const rows = await outboxFor(shops.bravo);
    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_phone).toBeNull();
    expect(rows[0].status).toBe('queued');
  });

  // CHECK 6. A refused action queues nothing.
  test('6. a refused action (already suspended) queues no extra message', async () => {
    await expect(suspendShop(pool, { adminId, tenantId: shops.bravo, reason: 'second try test' }))
      .rejects.toMatchObject({ code: 'already_suspended' });
    await expect(suspendShop(pool, { adminId, tenantId: shops.charlie, reason: 'abc' }))
      .rejects.toMatchObject({ code: 'validation' });
    expect(await outboxFor(shops.bravo)).toHaveLength(1);
    expect(await outboxFor(shops.charlie)).toHaveLength(0);
  });

  // CHECK 7. Rollback removes the queued message with everything else.
  // Real life: if the whole job is cancelled, the slip in the tray is thrown away too.
  test('7. a rolled-back transaction leaves no queued message', async () => {
    await expect(withAdminLock(pool, async (c) => {
      await enqueueNotification(c, {
        tenantId: shops.charlie,
        template: NOTIFICATION_TEMPLATES.SHOP_VERIFIED,
        recipientPhone: ownerPhones.charlie,
        payload: { shopName: shopNames.charlie },
      });
      throw new Error('something went wrong after queueing');
    })).rejects.toThrow('something went wrong');
    expect(await outboxFor(shops.charlie)).toHaveLength(0);
  });

  // CHECK 8. Bad input is refused before any SQL.
  test('8. enqueueNotification refuses bad input', async () => {
    const good = { tenantId: shops.charlie, template: NOTIFICATION_TEMPLATES.SHOP_VERIFIED, payload: {} };
    const run = (override) => withAdminLock(pool, (c) => enqueueNotification(c, { ...good, ...override }));
    await expect(run({ tenantId: 'not-an-id' })).rejects.toMatchObject({ code: 'validation' });
    await expect(run({ template: 'shop.invented' })).rejects.toMatchObject({ code: 'validation' });
    await expect(run({ channel: 'pigeon' })).rejects.toMatchObject({ code: 'validation' });
    await expect(run({ payload: [1, 2] })).rejects.toMatchObject({ code: 'validation' });
    await expect(run({ payload: null })).rejects.toMatchObject({ code: 'validation' });
    await expect(run({ payload: { big: 'x'.repeat(2500) } })).rejects.toMatchObject({ code: 'validation' });
    await expect(run({ auditLogId: 'nope' })).rejects.toMatchObject({ code: 'validation' });
    expect(await outboxFor(shops.charlie)).toHaveLength(0);
  });

  // CHECK 9. The plain pool (no admin lock) cannot write to the outbox.
  test('9. writing to the outbox without the admin lock is refused by the database', async () => {
    await expect(enqueueNotification(pool, {
      tenantId: shops.charlie, template: NOTIFICATION_TEMPLATES.SHOP_VERIFIED, payload: {},
    })).rejects.toThrow();
    expect(await outboxFor(shops.charlie)).toHaveLength(0);
  });

  // CHECK 10. Phone masking for logs.
  test('10. maskPhone hides the middle digits', () => {
    expect(maskPhone('254712345678')).toBe('2547*****678');
    expect(maskPhone(null)).toBe('****');
    expect(maskPhone('123')).toBe('****');
  });
});
