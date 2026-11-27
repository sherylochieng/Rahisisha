// =============================================================================
// FILE: apps/api/tests/adminShops.service.test.js   (Week 30 Day 3, Batch 1: admin core, step 3)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves that the admin's shop powers work and stay safe: the list and search,
//   one shop's file, suspend, reinstate, verify and un-verify, the required
//   reason, the state checks, and that every change leaves a receipt.
//
// WHY IMPORTANT
//   These functions can close a real trader's shop. A wrong rule (suspending a
//   deleted shop, a change with no receipt, a missing reason) would hurt a real
//   person or break trust in the platform.
//
// DANGER
//   Makes its own throw-away admin, owners and shops with random names and
//   removes them afterwards. Never put a real phone or password here. Never
//   run it against a database whose shops you care about.
//
// WHAT IT SOLVES
//   Confidence that adminShops.service.js, the audit receipts and the database
//   rules (migrations 028, 029, 030) work together.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the promises: "no change without a reason", "no change without a
//   receipt", "a bad request changes nothing".
//
// RULES
//   1. Every test uses its own random names, so tests never collide.
//   2. Clean up everything made (receipts, shops, owners, admin).
//   3. Never print passwords.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- adminShops
//
// DECISIONS
//   - Uses the app's real pool and the real services (no fakes), because the
//     real database rules are exactly what we want to test.
//   - A 'tag' (random word) is put in every shop name, so the search test finds
//     only OUR shops even if the database holds other shops.
//
// WHERE USED
//   Part of the normal test run (and the pre-push hook).
//
// TRADEOFFS
//   + Tests the real thing end to end at the service level.
//   - Slower than fakes (one bcrypt hash for the admin, a few database calls).
//
// HOW TO USE
//   cd apps/api ; npm test -- adminShops
// =============================================================================

// PIECE BY PIECE
//   randomPhone / randomPassword = made-up details, new for each run.
//   makeShop()   = open a throw-away shop with an owner (a user + a membership).
//   beforeAll    = hire a test admin and open the test shops.
//   afterAll     = remove the receipts, shops, owners and the admin.
//   readRow()    = look straight at a shop's row in the database.
//   receipts()   = read the receipt book for one shop.

import crypto from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import {
  listShops,
  getShop,
  suspendShop,
  reinstateShop,
  verifyShop,
  unverifyShop,
} from '../src/services/adminShops.service.js';

// Made-up valid Kenyan number: 07 + 8 digits.
const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
// Random long password.
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;
// Random word used inside shop names so the search test finds only our shops.
const tag = `tg${crypto.randomBytes(4).toString('hex')}`;

let adminId;
const shops = {};          // name -> shop id
const ownerIds = [];       // users we made
const ownerPhones = {};    // shop name -> owner phone we gave

// Open a throw-away shop with an owner. Real life: a new trader signs up.
async function makeShop(label, { status = 'active' } = {}) {
  const slug = `${tag}-${label}-${crypto.randomBytes(3).toString('hex')}`;
  const { rows: t } = await pool.query(
    'INSERT INTO tenants (name, slug, status) VALUES ($1, $2, $3) RETURNING id',
    [`${tag} ${label} Fashions`, slug, status]
  );
  const phone = `2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
  const { rows: u } = await pool.query(
    'INSERT INTO users (phone, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [phone, `Owner of ${label}`, 'not-a-real-hash']
  );
  // memberships is locked per shop, so we stamp the shop on our connection first
  // (inside a transaction), exactly like a real shop request does.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [t[0].id]);
    await client.query(
      "INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')",
      [t[0].id, u[0].id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  shops[label] = t[0].id;
  ownerIds.push(u[0].id);
  ownerPhones[label] = phone;
  return t[0].id;
}

// Look straight at a shop's row.
async function readRow(id) {
  const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
  return rows[0];
}

// Read the receipt book for one shop, newest first.
async function receipts(id) {
  const { rows } = await pool.query(
    'SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC',
    [id]
  );
  return rows;
}

beforeAll(async () => {
  // Hire the test admin.
  const admin = await createPlatformAdmin(pool, {
    phone: randomPhone(), name: 'Shops Test Admin', password: randomPassword(),
  });
  adminId = admin.id;
  // Open five test shops. Their created_at times differ, so the list order is clear.
  await makeShop('alpha');
  await makeShop('bravo');
  await makeShop('charlie');
  await makeShop('delta');
  await makeShop('gone', { status: 'deleted' });
});

afterAll(async () => {
  // Receipts first, then shops (memberships go with them), then owners, then admin.
  const ids = Object.values(shops);
  if (ids.length) {
    await pool.query('DELETE FROM audit_logs WHERE tenant_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM tenants WHERE id = ANY($1)', [ids]);
  }
  if (ownerIds.length) await pool.query('DELETE FROM users WHERE id = ANY($1)', [ownerIds]);
  if (adminId) {
    await withAdminLock(pool, (c) => c.query('DELETE FROM platform_admins WHERE id = $1', [adminId]));
  }
  await pool.end();
});

describe('admin shops service (Week 30 Day 3, Batch 1)', () => {

  // CHECK 1. The list shows our shops with the OWNER (this proves migration 029
  // works), newest first, and never shows a password.
  // Real life: head office opens the register: shop, owner, phone.
  test('1. lists shops newest first with the owner, hides deleted ones and never shows secrets', async () => {
    const page = await listShops(pool, { q: tag, limit: 100 });
    const names = page.items.map((s) => s.name);
    // Newest first: delta was made after charlie, and so on. 'gone' is deleted, so hidden.
    expect(names).toEqual([
      `${tag} delta Fashions`,
      `${tag} charlie Fashions`,
      `${tag} bravo Fashions`,
      `${tag} alpha Fashions`,
    ]);
    // The owner is shown (name + phone) and nothing else about them.
    const alpha = page.items.find((s) => s.id === shops.alpha);
    expect(alpha.owner).toEqual({ name: 'Owner of alpha', phone: ownerPhones.alpha });
    expect(alpha.verified).toBe(false);
    // No password or hash anywhere in the answer.
    expect(JSON.stringify(page)).not.toContain('not-a-real-hash');
    expect(JSON.stringify(page)).not.toContain('password');
    // The deleted shop appears ONLY when asked for by status.
    const deleted = await listShops(pool, { q: tag, status: 'deleted' });
    expect(deleted.items.map((s) => s.id)).toEqual([shops.gone]);
  });

  // CHECK 2. Pages work: a bookmark, no repeats, no gaps.
  // Real life: 100,000 shops are shown 25 at a time, and "next page" never repeats one.
  test('2. paginates with a bookmark and refuses a bad bookmark', async () => {
    const first = await listShops(pool, { q: tag, limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).toBeTruthy();
    const second = await listShops(pool, { q: tag, limit: 3, cursor: first.nextCursor });
    expect(second.items).toHaveLength(1);       // 4 visible shops: 3 + 1
    expect(second.nextCursor).toBeNull();       // last page
    const all = [...first.items, ...second.items].map((s) => s.id);
    expect(new Set(all).size).toBe(4);          // no repeats
    // A made-up bookmark is refused.
    await expect(listShops(pool, { cursor: 'not-a-cursor' })).rejects.toMatchObject({ code: 'validation' });
  });

  // CHECK 3. Filters and search are safe.
  // Real life: typing "50%" looks for the text "50%", not "50 and anything".
  test('3. filters by status and verified, and treats % and _ as plain letters', async () => {
    // Wildcards are plain letters. Our shop is called "<tag> alpha Fashions".
    // If % meant "anything", "<tag>%alpha" would find it. If _ meant "any one
    // letter", "<tag>_alpha" (the _ standing in for the space) would find it.
    // Neither may find anything, because the shop has no real % or _ in its name.
    expect((await listShops(pool, { q: `${tag}%alpha` })).items).toHaveLength(0);
    expect((await listShops(pool, { q: `${tag}_alpha` })).items).toHaveLength(0);
    // The plain words still find it.
    expect((await listShops(pool, { q: `${tag} alpha` })).items).toHaveLength(1);
    // Bad filters are refused.
    await expect(listShops(pool, { status: 'banana' })).rejects.toMatchObject({ code: 'validation' });
    await expect(listShops(pool, { verified: 'maybe' })).rejects.toMatchObject({ code: 'validation' });
    // Our shops are all 'active' and not verified yet.
    const act = await listShops(pool, { q: tag, status: 'active', verified: false, limit: 100 });
    expect(act.items).toHaveLength(4);
    const ver = await listShops(pool, { q: tag, verified: true, limit: 100 });
    expect(ver.items).toHaveLength(0);
  });

  // CHECK 4. One shop's file.
  test('4. opens one shop, refuses an unknown or badly formed id', async () => {
    const shop = await getShop(pool, shops.alpha);
    expect(shop.id).toBe(shops.alpha);
    expect(shop.status).toBe('active');
    expect(shop.owner.name).toBe('Owner of alpha');
    expect(shop.receipts).toEqual([]);
    await expect(getShop(pool, crypto.randomUUID())).rejects.toMatchObject({ code: 'shop_not_found' });
    await expect(getShop(pool, 'nope')).rejects.toMatchObject({ code: 'validation' });
  });

  // CHECK 5. A reason is REQUIRED, and a bad request changes nothing.
  // Real life: the clerk will not close a shop without a written "why".
  test('5. refuses a missing, too short or too long reason and changes nothing', async () => {
    const before = await readRow(shops.bravo);
    const base = { adminId, tenantId: shops.bravo };
    const bad = [undefined, null, 42, '', '    ', 'abcd', 'x'.repeat(501), '\u0000\u0001  '];
    for (const reason of bad) {
      await expect(suspendShop(pool, { ...base, reason })).rejects.toMatchObject({ code: 'validation' });
    }
    // (Exactly 500 characters, and 500 emoji, are accepted: see check 11.)
    // The shop is untouched and there is no receipt.
    expect(await readRow(shops.bravo)).toEqual(before);
    expect(await receipts(shops.bravo)).toHaveLength(0);
  });

  // CHECK 6. Suspend: the shop is marked, the reason kept, a receipt written.
  test('6. suspends a shop, keeps who/when/why, and writes the receipt', async () => {
    const reason = '  customers reported fake M-Pesa messages  ';
    const out = await suspendShop(pool, { adminId, tenantId: shops.alpha, reason, ip: '41.90.1.1' });
    // The answer shows the new state.
    expect(out.status).toBe('suspended');
    expect(out.suspendedReason).toBe('customers reported fake M-Pesa messages'); // trimmed
    expect(out.suspendedBy).toBe(adminId);
    expect(out.suspendedAt).toBeInstanceOf(Date);
    // The database agrees.
    const row = await readRow(shops.alpha);
    expect(row.status).toBe('suspended');
    // The receipt exists, with before and after, the admin and the address.
    const [r] = await receipts(shops.alpha);
    expect(r.action).toBe('shop.suspended');
    expect(r.actor_admin_id).toBe(adminId);
    expect(r.before).toEqual({ status: 'active' });
    expect(r.after).toEqual({ status: 'suspended', reason: 'customers reported fake M-Pesa messages' });
    expect(r.ip_address).toBe('41.90.1.1');
    // The list can now filter it.
    const susp = await listShops(pool, { q: tag, status: 'suspended' });
    expect(susp.items.map((s) => s.id)).toEqual([shops.alpha]);
    // And the storefront door (which shows only 'active' shops) no longer sees it.
    const { rows } = await pool.query("SELECT id FROM tenants WHERE slug LIKE $1 AND status = 'active'", [`${tag}-alpha-%`]);
    expect(rows).toHaveLength(0);
  });

  // CHECK 7. State rules.
  // Real life: you cannot close a shop that is already closed, or reopen one
  // that is not closed, or touch a shop that was deleted.
  test('7. enforces the state rules and refuses a deleted or unknown shop', async () => {
    const reason = 'checking the state rules';
    // alpha is already suspended (check 6).
    await expect(suspendShop(pool, { adminId, tenantId: shops.alpha, reason }))
      .rejects.toMatchObject({ code: 'already_suspended' });
    // bravo is active, so it cannot be reinstated.
    await expect(reinstateShop(pool, { adminId, tenantId: shops.bravo, reason }))
      .rejects.toMatchObject({ code: 'not_suspended' });
    // bravo is not verified, so it cannot be un-verified.
    await expect(unverifyShop(pool, { adminId, tenantId: shops.bravo, reason }))
      .rejects.toMatchObject({ code: 'not_verified' });
    // The deleted shop cannot be changed in any way.
    for (const fn of [suspendShop, reinstateShop, verifyShop, unverifyShop]) {
      await expect(fn(pool, { adminId, tenantId: shops.gone, reason }))
        .rejects.toMatchObject({ code: 'shop_deleted' });
    }
    // An unknown shop and a badly formed id.
    await expect(suspendShop(pool, { adminId, tenantId: crypto.randomUUID(), reason }))
      .rejects.toMatchObject({ code: 'shop_not_found' });
    await expect(suspendShop(pool, { adminId, tenantId: 'x', reason }))
      .rejects.toMatchObject({ code: 'validation' });
  });

  // CHECK 8. Reinstate: the shop opens again, the suspend marks are cleared,
  // the OLD reason survives in the earlier receipt.
  test('8. reinstates a suspended shop and keeps the history in the receipts', async () => {
    const out = await reinstateShop(pool, {
      adminId, tenantId: shops.alpha, reason: 'owner fixed the problem and proved it',
    });
    expect(out.status).toBe('active');
    expect(out.suspendedAt).toBeNull();
    expect(out.suspendedReason).toBeNull();
    expect(out.suspendedBy).toBeNull();
    // Two receipts now: newest first = reinstated, then suspended.
    const rows = await receipts(shops.alpha);
    expect(rows.map((r) => r.action)).toEqual(['shop.reinstated', 'shop.suspended']);
    // The reinstate receipt remembers what the suspension looked like.
    expect(rows[0].before.suspended_reason).toBe('customers reported fake M-Pesa messages');
    expect(rows[0].after).toEqual({ status: 'active', reason: 'owner fixed the problem and proved it' });
    // The shop's file lists both receipts with the admin's name.
    const file = await getShop(pool, shops.alpha);
    expect(file.receipts.map((r) => r.action)).toEqual(['shop.reinstated', 'shop.suspended']);
    expect(file.receipts[0].adminName).toBe('Shops Test Admin');
  });

  // CHECK 9. Verify and un-verify.
  test('9. verifies a shop once, un-verifies it, and writes a receipt each time', async () => {
    const out = await verifyShop(pool, {
      adminId, tenantId: shops.charlie, reason: 'business permit checked, matches the owner',
    });
    expect(out.verified).toBe(true);
    expect(out.verifiedBy).toBe(adminId);
    expect(out.verifiedAt).toBeInstanceOf(Date);
    // A second verify is refused.
    await expect(verifyShop(pool, { adminId, tenantId: shops.charlie, reason: 'checking again please' }))
      .rejects.toMatchObject({ code: 'already_verified' });
    // The list can find verified shops.
    const ver = await listShops(pool, { q: tag, verified: true });
    expect(ver.items.map((s) => s.id)).toEqual([shops.charlie]);
    // Un-verify clears it.
    const back = await unverifyShop(pool, {
      adminId, tenantId: shops.charlie, reason: 'verified the wrong shop by mistake',
    });
    expect(back.verified).toBe(false);
    expect(back.verifiedBy).toBeNull();
    const rows = await receipts(shops.charlie);
    expect(rows.map((r) => r.action)).toEqual(['shop.unverified', 'shop.verified']);
  });

  // CHECK 10. Atomic: if the receipt (or anything) cannot be written, the shop
  // does NOT change. An admin id that does not exist makes the database refuse.
  // Real life: no stamp on the shop's file without the receipt in the book.
  test('10. changes nothing when the whole action cannot complete', async () => {
    const before = await readRow(shops.delta);
    await expect(
      suspendShop(pool, {
        adminId: crypto.randomUUID(),             // a valid-looking id of an admin who does not exist
        tenantId: shops.delta,
        reason: 'this must not go through',
      })
    ).rejects.toBeTruthy();
    expect(await readRow(shops.delta)).toEqual(before);
    expect(await receipts(shops.delta)).toHaveLength(0);
  });

  // CHECK 11. The reason limit counts real characters, like the database does.
  test('11. accepts exactly 500 characters, including emoji, and refuses 501', async () => {
    const emoji500 = '😀'.repeat(500);              // 500 characters (1000 in UTF-16)
    const out = await suspendShop(pool, { adminId, tenantId: shops.bravo, reason: emoji500 });
    expect(Array.from(out.suspendedReason)).toHaveLength(500);
    await reinstateShop(pool, { adminId, tenantId: shops.bravo, reason: 'back to normal now' });
    await expect(suspendShop(pool, { adminId, tenantId: shops.bravo, reason: '😀'.repeat(501) }))
      .rejects.toMatchObject({ code: 'validation' });
  });
});
