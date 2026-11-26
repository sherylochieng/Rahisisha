# platformAdmin.service.js: creating and repairing platform admin accounts

**FILE:** `apps/api/docs/src/services/platformAdmin.service.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains, in simple words, the code in `apps/api/src/services/platformAdmin.service.js`: the two jobs that create a platform admin account and set a new password for one.

## WHY IMPORTANT

A platform admin can see and stop every shop. If this account were created carelessly (a plain password, a public sign-up page, a lock left open) every shop owner would be at risk.

## DANGER (what breaks without it)

1. The password or its hash must never be printed, logged or returned. The service returns only `id`, `phone` and `name`.
2. The admin table is locked. If the lock were left open on a reused database connection, a later request from a shop owner could read the admin table. The lock is therefore opened only inside one transaction and closes by itself.
3. Never call these functions from a page a stranger can reach.
4. bcrypt only reads the first 72 bytes of a password. A longer password would be cut silently, so it is refused.

## WHAT IT SOLVES

A safe, repeatable way to make the first admin (and to recover from a forgotten password) without any public door.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns: the command-line script asks the questions, this service decides and writes, and the database lock (row level security) enforces who can see the table. Three walls, not one.

## RULES

1. Phone: a valid Kenyan mobile number, stored as `2547XXXXXXXX`.
2. Name: 1 to 80 characters after trimming.
3. Password: 12 to 72 bytes.
4. One admin per phone; a second create is refused with `admin_exists` and never overwrites.
5. A reset needs an existing admin, else `admin_not_found`.
6. Error codes: `invalid_phone`, `invalid_name`, `weak_password`, `admin_exists`, `admin_not_found`.

## PRACTICAL EXAMPLE

```js
const admin = await createPlatformAdmin(pool, {
  phone: '0712345678', name: 'Sheryl', password: 'a-long-private-phrase' });
// -> { id: '...', phone: '254712345678', name: 'Sheryl' }
```

## DECISIONS

- bcrypt cost 12, the same as shop owner sign-up.
- The service takes the pool, not a request, so scripts and tests can use it.
- Admin passwords need 12 characters (shop owners need 8) because an admin can do more damage.

## WHERE USED

The create-admin script (`apps/api/scripts/create-platform-admin.js`), the admin login (`platformAdminAuth.service.js` reuses `withAdminLock`, which is exported for that reason), and `apps/api/tests/platformAdmin.service.test.js`.

## TRADEOFFS

+ Small and easy to test.
- No "list admins" or "disable admin" job yet; they will be added when a second admin exists.

## HOW TO USE

`import { createPlatformAdmin, resetPlatformAdminPassword } from './platformAdmin.service.js';` and pass the shared pool from `../db/pool.js`. Run it only from a script on your own computer.

---

## PIECE BY PIECE (real life, in simple terms)

**fail(code, message)**  
A short stamp on an error, like 'WEAK PASSWORD' written on the rejection slip, so the caller does not need to read sentences to know what went wrong.

**checkName(name)**  
The guard at the head-office door checking that the name is not empty and not a whole paragraph.

**checkPassword(password)**  
The guard checking the password is long enough (12) and not longer than the scrambling machine can read (72 bytes).

**withAdminLock(db, work)**  
The manager unlocks the staff-book drawer, does ONE job, and the drawer locks itself again at the end. `set_config(..., true)` means 'only until this job ends', so it can never be left open for the next person.

**BEGIN / COMMIT / ROLLBACK**  
Writing in pencil first. If everything is fine you ink it (COMMIT); if anything goes wrong you rub it all out (ROLLBACK).

**createPlatformAdmin**  
Adding a new person to the staff book. First check their papers, scramble the password, then write the line. If their phone is already in the book (error 23505) we say 'admin_exists' instead of writing a second line.

**bcrypt.hash(password, 12)**  
Scrambling the password so even we cannot read it back. Only a person who knows the real password can produce a matching scramble.

**resetPlatformAdminPassword**  
A lost password: the manager writes a new scrambled code on YOUR line. If you are not in the book she says 'admin_not_found' and writes nothing.

---

## Walk through `createPlatformAdmin`

1. `normalizePhone(phone)` turns `0712 345 678`, `712345678` and `+254712345678` into `254712345678`. A bad number stops here with `invalid_phone`.
2. `checkName` and `checkPassword` stop bad input before the database is touched.
3. `bcrypt.hash` scrambles the password. This takes a fraction of a second on purpose.
4. `withAdminLock` opens the lock, inserts the row, and commits.
5. Only `id`, `phone` and `name` are returned.

## Related documents

- Overview of the whole admin: `docs/guides/platform-admin.md`
- The database part: `sql/migrations/028_platform_admins.sql`
- The tests: `apps/api/docs/tests/platformAdmin.service.test.md`
- The sign-in rules that reuse the same lock: `apps/api/docs/src/services/platformAdminAuth.service.md`

---

## LINE BY LINE (the real code, explained)

### The settings

```js
const BCRYPT_COST = 12;
```
How hard the password-scrambling machine works. Each +1 doubles the work. At 12 it takes about a quarter of a second: you never notice it for one login, but a thief trying millions of guesses would. *Real life: a thicker safe door. Slower to open, much harder to break.*

### `fail(code, message)`

```js
function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}
```
- `new Error(message)` makes a normal error with a sentence a person can read.
- `err.code = code` pins a short label on it, like `weak_password`.
- Why: the script, the tests and later the web page can decide what to do from the **label**, without reading sentences. *Real life: a rejection slip with a big stamp, "WEAK PASSWORD".*

### `checkName(name)`

```js
const clean = String(name ?? '').trim();
if (clean.length < 1 || clean.length > 80) throw fail('invalid_name', ...);
return clean;
```
- `name ?? ''` means "if nothing was sent, use empty text".
- `String(...)` makes sure it is text. `.trim()` removes spaces at the ends, so a name of only spaces counts as empty.
- 1 to 80 characters is allowed. We return the **cleaned** name, not the original. *Real life: the guard checks that the name box is filled in and is a name, not a paragraph.*

### `checkPassword(password)`

```js
const bytes = Buffer.byteLength(text, 'utf8');
if (bytes < 12) throw fail('weak_password', ...);
if (bytes > 72) throw fail('weak_password', ...);
```
- We count **bytes**, not letters, because bcrypt's limit (72) is in bytes. An emoji or an accented letter is more than one byte.
- Under 12 is too weak for an account that can stop every shop.
- Over 72 is refused because bcrypt would silently ignore everything after byte 72. Two different long passwords could then look the same. We refuse instead of cutting.

### `withAdminLock(db, work)` (the most important helper)

```js
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.platform_admin', 'on', true)");
  const result = await work(client);
  await client.query('COMMIT');
  return result;
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
}
```
- `db.connect()` borrows **one** connection. Every step below uses the same one, because the lock switch belongs to a single connection.
- `BEGIN` starts a transaction: *write in pencil, nothing is final yet.*
- `set_config('app.platform_admin', 'on', true)` switches the head-office lock **on**. The last word, `true`, is the key: it means "only until this transaction ends". When we `COMMIT` or `ROLLBACK` the setting disappears by itself, so it can never leak to the next person who borrows this connection. *Real life: the manager unlocks the staff-book drawer for one job and it locks itself again.*
- `work(client)` is the job the caller gave us (an insert, a select...).
- `COMMIT` inks everything. `ROLLBACK` rubs it all out if anything failed. The little `.catch(() => {})` makes sure a failure to roll back cannot hide the real error.
- `finally { client.release() }` always gives the connection back, even after an error. Forgetting this slowly uses up every connection until the site freezes.

### `createPlatformAdmin`

```js
const msisdn = normalizePhone(phone);
const cleanName = checkName(name);
const cleanPassword = checkPassword(password);
const passwordHash = await bcrypt.hash(cleanPassword, BCRYPT_COST);
```
1. Check everything **before** touching the database. A bad phone, name or password stops here.
2. Scramble the password. From now on the real password is never used again, only its scramble.

```js
`INSERT INTO platform_admins (phone, name, password_hash)
 VALUES ($1, $2, $3) RETURNING id, phone, name`
```
- `$1 $2 $3` are filled from a separate list. We **never** glue values into the sentence ourselves, because that is how SQL injection attacks work.
- `RETURNING id, phone, name` gives back the new line, **without** the hash.

```js
if (err.code === '23505') throw fail('admin_exists', ...);
```
`23505` is the database's code for "this value must be unique, and it already exists": the same phone is already in the staff book. We turn it into our own clear error instead of leaking a database message.

### `resetPlatformAdminPassword`

```js
`UPDATE platform_admins SET password_hash = $2, updated_at = NOW()
  WHERE phone = $1 RETURNING id, phone, name`
```
- `WHERE phone = $1` changes **only** that admin's line.
- If `rows[0]` is empty, nobody had that phone, so we say `admin_not_found` and nothing was changed. *Real life: the manager cannot write a new password for someone who is not in the book.*