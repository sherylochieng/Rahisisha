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

// ── The tools we borrow ──────────────────────────────────────────────────────
// bcrypt = the password scrambling machine. It turns "my-long-phrase" into a long
// jumble that cannot be turned back. Real life: a safe where you can lock things
// in but nobody can read them out again.
import bcrypt from 'bcrypt';
// normalizePhone = turns "0712 345 678", "712345678" and "+254712345678" into one
// shape (254712345678). Real life: writing every phone number in the staff book
// the same way, so the same person is never written twice.
import { normalizePhone } from './daraja.service.js';

// ── The settings ─────────────────────────────────────────────────────────────
// How hard bcrypt works to scramble. Each +1 doubles the work. 12 takes about a
// quarter of a second: unnoticeable for one login, painful for a thief trying
// millions of guesses. Same value as shop owner sign-up.
const BCRYPT_COST = 12;

// ── Helper 1: an error that carries a short code ────────────────────────────
// Why: callers (the script, the tests, later the web) need to tell "weak
// password" from "already exists" WITHOUT reading English sentences.
// Real life: a rejection slip with a stamp "WEAK PASSWORD" on it.
function fail(code, message) {
  // Make a normal error with a human message ...
  const err = new Error(message);
  // ... and pin the short code on it.
  err.code = code;
  return err;
}

// ── Helper 2: check the name ────────────────────────────────────────────────
// Real life: the guard at the head-office door asking "is the name filled in,
// and is it a name, not a whole paragraph?"
function checkName(name) {
  // `?? ''` turns "nothing sent" (undefined or null) into an empty text, and
  // String(...) turns anything else into text. .trim() removes spaces at the
  // ends, so "   " counts as empty.
  const clean = String(name ?? '').trim();
  // Must be 1 to 80 characters.
  if (clean.length < 1 || clean.length > 80) {
    throw fail('invalid_name', 'Name must be 1 to 80 characters');
  }
  // Hand back the cleaned name (spaces removed), not the original.
  return clean;
}

// ── Helper 3: check the password ────────────────────────────────────────────
// Real life: the guard checking the password is long enough to be a real lock,
// and short enough for the scrambling machine to read completely.
function checkPassword(password) {
  // Same "make it text" step as above.
  const text = String(password ?? '');
  // Buffer.byteLength counts BYTES, not letters. An emoji or an accented letter
  // is more than 1 byte, and bcrypt's limit (72) is in bytes.
  const bytes = Buffer.byteLength(text, 'utf8');
  // At least 12 (admins can do more damage than shop owners, who need 8).
  if (bytes < 12) throw fail('weak_password', 'Password must be at least 12 characters');
  // At most 72: bcrypt silently ignores everything after byte 72, which would
  // make two different long passwords "equal". We refuse instead of cutting.
  if (bytes > 72) throw fail('weak_password', 'Password must be at most 72 characters');
  return text;
}

// ── Helper 4: open the head-office drawer for ONE job ───────────────────────
// This is the most important helper in the file. platform_admins is locked by
// row level security (RLS): the table looks EMPTY to everyone unless the
// connection says app.platform_admin = 'on'. This function says it, runs the job,
// and makes sure the "on" switch goes off again by itself.
// Real life: the manager unlocks the staff-book drawer, writes ONE line, and the
// drawer locks itself again, so it can never be left open for the next person.
// (Exported in step 4: the admin LOGIN reads the same locked table the same way.)
export async function withAdminLock(db, work) {
  // Borrow one connection from the pool. All the steps below MUST use this same
  // connection, because the lock switch belongs to one connection only.
  const client = await db.connect();
  try {
    // BEGIN starts a transaction: "write in pencil, nothing is final yet".
    await client.query('BEGIN');
    // Switch the head-office lock ON. The `true` at the end is the key detail:
    // it means "only until this transaction ends". When we COMMIT or ROLLBACK,
    // the setting disappears on its own, so it can never leak to the next user
    // of this connection.
    await client.query("SELECT set_config('app.platform_admin', 'on', true)");
    // Do the actual job (a function the caller gave us), using this connection.
    const result = await work(client);
    // COMMIT = "ink it": make everything final.
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Something went wrong: ROLLBACK = "rub it all out". The extra .catch makes
    // sure a failure to roll back cannot hide the REAL error below.
    await client.query('ROLLBACK').catch(() => {});
    // Pass the original problem upward so the caller can deal with it.
    throw err;
  } finally {
    // Always, whether it worked or not: give the connection back to the pool.
    // Forgetting this slowly uses up all connections and the site freezes.
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 1: MAKE A NEW ADMIN
// Real life: adding a new person to the head-office staff book.
// ═════════════════════════════════════════════════════════════════════════════
export async function createPlatformAdmin(db, { phone, name, password }) {
  // Step 1: check everything BEFORE touching the database. Bad input never gets
  // as far as the staff book.
  // normalizePhone throws an error with code 'invalid_phone' if it is not a
  // Kenyan mobile number.
  const msisdn = normalizePhone(phone);
  const cleanName = checkName(name);
  const cleanPassword = checkPassword(password);

  // Step 2: scramble the password. `await` because this takes a quarter of a
  // second on purpose. From here on we never use the real password again.
  const passwordHash = await bcrypt.hash(cleanPassword, BCRYPT_COST);

  try {
    // Step 3: open the drawer and write the new line.
    return await withAdminLock(db, async (client) => {
      const { rows } = await client.query(
        // $1, $2, $3 are filled from the list below. NEVER glue values into the
        // text yourself: that is how "SQL injection" attacks work.
        `INSERT INTO platform_admins (phone, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, phone, name`,
        [msisdn, cleanName, passwordHash]
      );
      // RETURNING gave us the new row. We hand back ONLY id, phone and name:
      // never the hash.
      return rows[0];
    });
  } catch (err) {
    // 23505 is the database's code for "unique violation": this phone is already
    // in the staff book (the unique index from migration 028). We turn it into
    // our own clear error instead of leaking a database message.
    if (err.code === '23505') {
      throw fail('admin_exists', 'An admin with this phone number already exists');
    }
    // Anything else is unexpected: pass it up unchanged.
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 2: SET A NEW PASSWORD FOR AN EXISTING ADMIN (lost password)
// Real life: you forgot your head-office password. The manager writes a new
// scrambled code on YOUR line in the staff book. She cannot do it for someone
// who is not in the book.
// ═════════════════════════════════════════════════════════════════════════════
export async function resetPlatformAdminPassword(db, { phone, password }) {
  // Same checks and scrambling as above (no name needed: it does not change).
  const msisdn = normalizePhone(phone);
  const cleanPassword = checkPassword(password);
  const passwordHash = await bcrypt.hash(cleanPassword, BCRYPT_COST);

  return withAdminLock(db, async (client) => {
    const { rows } = await client.query(
      // UPDATE ... WHERE phone = $1 changes ONLY that admin's line. updated_at is
      // set to now so we know when the password last changed.
      `UPDATE platform_admins
          SET password_hash = $2, updated_at = NOW()
        WHERE phone = $1
        RETURNING id, phone, name`,
      [msisdn, passwordHash]
    );
    // No row came back = nobody in the book has this phone. Say so, and write
    // nothing (the UPDATE changed zero rows, so there is nothing to undo).
    if (!rows[0]) throw fail('admin_not_found', 'No admin with this phone number');
    return rows[0];
  });
}