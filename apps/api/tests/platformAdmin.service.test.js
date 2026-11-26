// =============================================================================
// FILE: apps/api/tests/platformAdmin.service.test.js   (Week 30, platform admin: step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves that the platform admin account is created safely: password scrambled,
//   phone in one shape, no duplicates, and, most important, that the admin table
//   stays LOCKED to everyone except the admin code.
//
// WHY IMPORTANT
//   The admin account is the master key to every shop. A mistake here (a plain
//   password stored, or a shop owner able to read the admin table) would be
//   serious.
//
// DANGER
//   Never put a real admin phone or password in this file. It uses made-up
//   numbers and random passwords, and cleans up after itself.
//
// WHAT IT SOLVES
//   Confidence that platformAdmin.service.js and the database lock (migration
//   028) really work together.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the walls separately: the code's own rules (validation) AND the
//   database's lock (row level security).
//
// RULES
//   1. Each test uses its own random phone, so tests never collide.
//   2. Clean up every admin created (inside the lock, like the real code).
//   3. Never print passwords.
//
// PRACTICAL EXAMPLE
//   npm test -- platformAdmin
//
// DECISIONS
//   - Uses the app's real pool, because that is what the admin code will use.
//
// WHERE USED
//   Part of the normal test run (and the pre-push hook).
//
// TRADEOFFS
//   + Fast: the only slow part is bcrypt (a fraction of a second per account).
//   - Does not test the admin login yet (that comes in the next step).
//
// HOW TO USE
//   cd apps/api ; npm test -- platformAdmin
// =============================================================================

// PIECE BY PIECE (each test starts with a comment of its own, below)
//   randomPhone()  = a made-up valid Kenyan number, new for each test.
//   readAdmins()   = "open the head-office drawer, look, close it" (what the
//                    real admin code does). Used to look inside the table.
//   cleanUp        = after all tests, remove the admins we made.

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool.js';
import {
  createPlatformAdmin,
  resetPlatformAdminPassword,
} from '../src/services/platformAdmin.service.js';

// A made-up valid Kenyan number: 07 + 8 digits, random each time.
// Real life: a new pretend staff member for each test.
const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
// The shape we STORE (254...), for looking inside the database.
const stored = (p) => `254${p.slice(1)}`;
// A random long password, so no test ever uses a real one.
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;

// The ids we create, so afterAll can remove them.
const made = [];

// Look inside platform_admins the way the admin code does: open the lock for
// the length of one transaction, run the query, close the lock.
async function readAdmins(sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.platform_admin', 'on', true)");
    const { rows } = await client.query(sql, params);
    await client.query('COMMIT');
    return rows;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// After all tests: remove every admin we made (the lock must be open to delete).
afterAll(async () => {
  if (made.length) await readAdmins('DELETE FROM platform_admins WHERE id = ANY($1)', [made]);
  await pool.end();
});

describe('platform admin accounts (Week 30)', () => {

  // CHECK 1. An admin is created, and the password is stored scrambled.
  // Real life: the manager adds you to the staff book, but writes only a
  // scrambled code of your password, never the password itself.
  test('1. creates an admin with a phone in 254 shape and a scrambled password', async () => {
    const phone = randomPhone();
    const password = randomPassword();
    const admin = await createPlatformAdmin(pool, { phone, name: '  Test Admin  ', password });
    made.push(admin.id);

    // The answer has only the id, the phone (254 shape) and the trimmed name.
    expect(admin.phone).toBe(stored(phone));
    expect(admin.name).toBe('Test Admin');
    expect(Object.keys(admin).sort()).toEqual(['id', 'name', 'phone']);

    // Inside the table: the password is NOT stored as text, and it checks out
    // against the hash (so a later login will work).
    const [row] = await readAdmins('SELECT password_hash, status FROM platform_admins WHERE id = $1', [admin.id]);
    expect(row.password_hash).not.toContain(password);
    expect(await bcrypt.compare(password, row.password_hash)).toBe(true);
    // A new admin starts active.
    expect(row.status).toBe('active');
  });

  // CHECK 2. The phone is normalised, so the same person cannot be added twice.
  // Real life: "0712 345 678" and "+254712345678" are the same person.
  test('2. the same phone written two ways is refused as a duplicate (admin_exists)', async () => {
    const phone = randomPhone();
    const first = await createPlatformAdmin(pool, { phone, name: 'One', password: randomPassword() });
    made.push(first.id);
    // Same number, written with the country code.
    await expect(
      createPlatformAdmin(pool, { phone: `+${stored(phone)}`, name: 'Two', password: randomPassword() })
    ).rejects.toMatchObject({ code: 'admin_exists' });
    // The first admin is untouched: still exactly one row for this phone.
    const rows = await readAdmins('SELECT id FROM platform_admins WHERE phone = $1', [stored(phone)]);
    expect(rows).toHaveLength(1);
  });

  // CHECK 3. Bad input is turned away before anything is written.
  // Real life: the guard at the door of the head office checks your papers.
  test('3. a bad phone, an empty name or a weak password is refused and nothing is saved', async () => {
    const before = await readAdmins('SELECT count(*)::int AS n FROM platform_admins');
    // Not a Kenyan mobile number.
    await expect(createPlatformAdmin(pool, { phone: '12345', name: 'X', password: randomPassword() }))
      .rejects.toMatchObject({ code: 'invalid_phone' });
    // A name of only spaces.
    await expect(createPlatformAdmin(pool, { phone: randomPhone(), name: '   ', password: randomPassword() }))
      .rejects.toMatchObject({ code: 'invalid_name' });
    // 11 characters is one too short.
    await expect(createPlatformAdmin(pool, { phone: randomPhone(), name: 'X', password: '12345678901' }))
      .rejects.toMatchObject({ code: 'weak_password' });
    // Over 72 bytes would be silently cut off by bcrypt, so we refuse it.
    await expect(createPlatformAdmin(pool, { phone: randomPhone(), name: 'X', password: 'a'.repeat(73) }))
      .rejects.toMatchObject({ code: 'weak_password' });
    // Nothing was added by any of those.
    const after = await readAdmins('SELECT count(*)::int AS n FROM platform_admins');
    expect(after[0].n).toBe(before[0].n);
  });

  // CHECK 4. THE LOCK. A normal request cannot see or change admin accounts.
  // Real life: a shop owner walks up to the head-office staff book. The drawer
  // is locked and she sees an empty shelf. She cannot add a line either.
  test('4. without the head-office lock open, the admin table looks empty and refuses writes', async () => {
    const phone = randomPhone();
    const admin = await createPlatformAdmin(pool, { phone, name: 'Locked', password: randomPassword() });
    made.push(admin.id);

    // A plain query, as any shop route would run it: the table looks EMPTY.
    const plain = await pool.query('SELECT id FROM platform_admins');
    expect(plain.rows).toHaveLength(0);

    // A plain insert is refused by the database lock itself.
    await expect(
      pool.query(`INSERT INTO platform_admins (phone, name, password_hash) VALUES ($1, 'Sneaky', 'x')`, [randomPhone()])
    ).rejects.toThrow(/row-level security/);

    // The lock does not stay open after the admin code finished: a plain query
    // right after createPlatformAdmin still sees nothing.
    const still = await pool.query('SELECT id FROM platform_admins WHERE id = $1', [admin.id]);
    expect(still.rows).toHaveLength(0);
  });

  // CHECK 5. Resetting a lost password works, and only for an existing admin.
  // Real life: you forgot your head-office password. The manager writes a new
  // scrambled code on YOUR line. She cannot do it for a person not in the book.
  test('5. reset changes the password for an existing admin and refuses an unknown phone', async () => {
    const phone = randomPhone();
    const oldPassword = randomPassword();
    const newPassword = randomPassword();
    const admin = await createPlatformAdmin(pool, { phone, name: 'Reset Me', password: oldPassword });
    made.push(admin.id);

    const result = await resetPlatformAdminPassword(pool, { phone, password: newPassword });
    expect(result.id).toBe(admin.id);

    // The new password works, the old one no longer does.
    const [row] = await readAdmins('SELECT password_hash FROM platform_admins WHERE id = $1', [admin.id]);
    expect(await bcrypt.compare(newPassword, row.password_hash)).toBe(true);
    expect(await bcrypt.compare(oldPassword, row.password_hash)).toBe(false);

    // Someone who is not an admin: refused, and nothing is created.
    await expect(resetPlatformAdminPassword(pool, { phone: randomPhone(), password: randomPassword() }))
      .rejects.toMatchObject({ code: 'admin_not_found' });
    // A weak new password is refused too.
    await expect(resetPlatformAdminPassword(pool, { phone, password: 'short' }))
      .rejects.toMatchObject({ code: 'weak_password' });
  });
});