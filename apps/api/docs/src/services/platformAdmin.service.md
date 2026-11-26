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

The create-admin script (next step), the admin login (later), and `apps/api/tests/platformAdmin.service.test.js`.

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
