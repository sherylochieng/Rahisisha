// =============================================================================
// FILE: apps/api/src/services/platformAdmin.service.js   (Week 30, platform admin: step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Holds the two jobs that create and repair a PLATFORM ADMIN account (you, the
//   owner of Rahisisha, who will be able to see every shop and suspend one that
//   breaks the rules):
//     1. createPlatformAdmin(db, { phone, name, password })  make a new admin
//     2. resetPlatformAdminPassword(db, { phone, password }) set a new password
//   The command-line script (scripts/create-platform-admin.js) and, later, the
//   admin login all use THIS file, so the rules live in one place.
//
// WHY IMPORTANT
//   An admin account is the master key to every shop. It must be created
//   carefully: a long password, stored only as a scrambled hash, written through
//   the database lock, and never through a public sign-up page.
//
// DANGER
//   1. NEVER print or log the password or the hash. This file returns only the
//      id, the phone and the name.
//   2. The table platform_admins is locked by row level security (RLS). The lock
//      opens only while app.platform_admin = 'on'. We switch it on INSIDE a
//      transaction (set_config(..., true)), so it switches itself off at COMMIT
//      or ROLLBACK and can never leak to the next user of the same connection.
//   3. Never call these functions from a web route that a stranger can reach.
//      Admin accounts are created by a command on your own computer only.
//   4. Passwords are bcrypt-hashed. bcrypt only reads the first 72 BYTES of a
//      password, so we refuse anything longer instead of silently cutting it.
//
// WHAT IT SOLVES
//   A safe, repeatable way to make the first admin (and to recover from a lost
//   password) without any public door.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: the script asks questions, this file decides and
//   writes, the database enforces the lock. Three walls, not one.
//
// RULES
//   1. Phone: a valid Kenyan mobile number, stored as 2547XXXXXXXX (the same
//      shape as customers, via normalizePhone).
//   2. Name: 1 to 80 characters after trimming.
//   3. Password: 12 to 72 bytes. (Shop owners need 8; admins can do more damage,
//      so they need more.)
//   4. One admin per phone. A second create for the same phone is refused with
//      code 'admin_exists' (it never overwrites).
//   5. A reset needs an existing admin, else code 'admin_not_found'.
//   6. Every error has a code: 'invalid_phone', 'invalid_name', 'weak_password',
//      'admin_exists', 'admin_not_found'.
//
// PRACTICAL EXAMPLE
//   const admin = await createPlatformAdmin(pool, {
//     phone: '0712345678', name: 'Sheryl', password: 'a-long-private-phrase' });
//   // -> { id: '...', phone: '254712345678', name: 'Sheryl' }
//
// DECISIONS
//   - bcrypt cost 12, the same as shop owner sign-up.
//   - Takes the pool (not a request), so scripts and tests can use it.
//   - One short transaction per call: switch the lock on, write, commit.
//
// WHERE USED
//   scripts/create-platform-admin.js (next step), tests/platformAdmin.service.test.js,
//   and later the admin login.
//
// TRADEOFFS
//   + Small, testable, no web route needed.
//   - No "list admins" or "disable admin" job yet (add when a second admin exists).
//
// HOW TO USE
//   import { pool } from '../db/pool.js';
//   import { createPlatformAdmin } from './platformAdmin.service.js';
// =============================================================================

// PIECE BY PIECE
//   fail(code, message)        = an error with a short code, so callers can tell
//                                "weak password" from "already exists" without
//                                reading sentences.
//   withAdminLock(db, work)    = "open the head-office drawer, do the job, close
//                                it". Real life: the manager unlocks the staff
//                                book, writes one line, locks it again at once.
//   checkName / checkPassword  = the guard at the door of the head office.
//   bcrypt.hash(password, 12)  = scrambling the password so even we cannot read
//                                it back. Real life: you write a code only the
//                                owner can recognise, never the real password.
//   createPlatformAdmin        = adding a new person to the head-office staff book.
//   resetPlatformAdminPassword = writing a new scrambled password for someone
//                                already in the book.

import bcrypt from 'bcrypt';
import { normalizePhone } from './daraja.service.js';

// How hard bcrypt works to scramble (higher = slower for attackers, and for us).
const BCRYPT_COST = 12;

// An error with a short code attached.
function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Name: 1 to 80 characters once spaces at the ends are removed.
function checkName(name) {
  const clean = String(name ?? '').trim();
  if (clean.length < 1 || clean.length > 80) {
    throw fail('invalid_name', 'Name must be 1 to 80 characters');
  }
  return clean;
}

// Password: 12 to 72 bytes. (72 is bcrypt's limit: anything longer is cut off.)
function checkPassword(password) {
  const text = String(password ?? '');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes < 12) throw fail('weak_password', 'Password must be at least 12 characters');
  if (bytes > 72) throw fail('weak_password', 'Password must be at most 72 characters');
  return text;
}

// Run `work(client)` inside a transaction with the head-office lock OPEN.
// The lock is set with `true` = "only until this transaction ends", so it can
// never stay open on a connection that is reused later.
async function withAdminLock(db, work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.platform_admin', 'on', true)");
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Undo everything if anything went wrong, then hand the error on.
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    // Always give the connection back.
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 1: MAKE A NEW ADMIN
// ═════════════════════════════════════════════════════════════════════════════
export async function createPlatformAdmin(db, { phone, name, password }) {
  // Check everything BEFORE touching the database.
  const msisdn = normalizePhone(phone); // throws code 'invalid_phone'
  const cleanName = checkName(name);
  const cleanPassword = checkPassword(password);

  // Scramble the password (this takes a fraction of a second on purpose).
  const passwordHash = await bcrypt.hash(cleanPassword, BCRYPT_COST);

  try {
    return await withAdminLock(db, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO platform_admins (phone, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, phone, name`,
        [msisdn, cleanName, passwordHash]
      );
      return rows[0];
    });
  } catch (err) {
    // 23505 = "unique violation": this phone is already an admin.
    if (err.code === '23505') {
      throw fail('admin_exists', 'An admin with this phone number already exists');
    }
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 2: SET A NEW PASSWORD FOR AN EXISTING ADMIN (lost password)
// ═════════════════════════════════════════════════════════════════════════════
export async function resetPlatformAdminPassword(db, { phone, password }) {
  const msisdn = normalizePhone(phone);
  const cleanPassword = checkPassword(password);
  const passwordHash = await bcrypt.hash(cleanPassword, BCRYPT_COST);

  return withAdminLock(db, async (client) => {
    const { rows } = await client.query(
      `UPDATE platform_admins
          SET password_hash = $2, updated_at = NOW()
        WHERE phone = $1
        RETURNING id, phone, name`,
      [msisdn, passwordHash]
    );
    // No row changed = nobody with this phone is an admin.
    if (!rows[0]) throw fail('admin_not_found', 'No admin with this phone number');
    return rows[0];
  });
}