# Auth Audit — Week 28 Day 1

**Project:** Rahisisha Biashara
**Author:** Sheryl Ochieng
**Date:** 2026-10-19
**Scope:** Every file written for authentication in Week 28 Day 1

---

## The Week 28 AI Boundary Rule

AI tools can help explain concepts, suggest patterns, and generate boilerplate. But in a multi-tenant SaaS, the logic that keeps one tenant's data away from another tenant's data must be written and understood by the developer — not copied blindly from an AI.

This audit proves that I, Sheryl Ochieng, have read every line of every auth file and can explain what it does, why it is there, and what would break if it were removed.

---

## File 1 — `apps/api/src/db/pool.js`

```javascript
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

**What it does:**

Creates a connection pool — a set of reusable database connections. Instead of opening and closing a new connection to PostgreSQL on every single request (which is slow and expensive), the pool keeps connections open and lends them out to routes that need them, then takes them back when done.

**Why `dotenv.config()` is here:**

`DATABASE_URL` lives in `.env`. Without calling `dotenv.config()`, `process.env.DATABASE_URL` would be `undefined` and the pool would fail to connect.

**Why `const { Pool } = pg` instead of `import { Pool } from 'pg'`:**

The `pg` package uses CommonJS exports. When you import it as an ES module, the whole package arrives as a default export object. You have to destructure `Pool` from that object. Trying to import it directly would throw `SyntaxError: The requested module 'pg' does not provide an export named 'Pool'`.

**What breaks if removed:**

Every route that needs the database imports `pool` from this file. Without it, nothing can query PostgreSQL.

---

## File 2 — `apps/api/src/routes/auth/signup.js`

### The Zod schema

```javascript
const signupSchema = z.object({
  phone:       z.string().min(10).max(20),
  name:        z.string().min(2).max(100),
  password:    z.string().min(8).max(72),
  tenant_name: z.string().min(2).max(100),
  slug:        z.string().regex(/^[a-z0-9-]{3,30}$/, {
                 message: 'Slug must be 3-30 lowercase letters, digits, or hyphens',
               }),
});
```

**What it does:**

Describes the exact shape of data we accept. Before we touch the database, we run `signupSchema.safeParse(req.body)`. If any field is missing, the wrong type, or fails the length or regex rule, we return 400 immediately. The database never sees bad data.

**Why `max(72)` on password:**

bcrypt has a maximum input length of 72 bytes. Anything longer is silently truncated. Enforcing `max(72)` in Zod means the user knows their full password was used rather than discovering later that characters after position 72 were ignored.

**Why the slug regex `^[a-z0-9-]{3,30}$`:**

Slugs become subdomains — `slug.rahisisha.co.ke`. Subdomains can only contain lowercase letters, digits, and hyphens. Uppercase, spaces, and special characters would break DNS. The regex enforces this before anything reaches the database.

### The reserved slugs check

```javascript
const RESERVED_SLUGS = new Set(['www', 'app', 'admin', 'api', 'staging']);

if (RESERVED_SLUGS.has(slug)) {
  return res.status(422).json({
    error: `"${slug}" is a reserved slug and cannot be used`,
  });
}
```

**What it does:**

Blocks slugs that would conflict with our own infrastructure. `www.rahisisha.co.ke` is our main site. `api.rahisisha.co.ke` is our API. If a tenant claimed one of these slugs, their subdomain would shadow our own infrastructure.

**Why a `Set` and not an array:**

`Set.has()` is O(1) — it checks in constant time regardless of how many reserved slugs exist. `array.includes()` is O(n) — it scans every element. For a small list this makes no practical difference, but `Set` communicates the intent clearly: this is a membership check, not a search.

**Why 422 and not 400:**

400 means the request was malformed — the client sent something technically invalid. 422 means the request was valid in shape but unprocessable in meaning. The slug `www` is a valid slug by the regex rules, but we cannot accept it for business reasons. 422 is the correct HTTP status for that case.

### The transaction

```javascript
const client = await pool.connect();

try {
  await client.query('BEGIN');

  const tenantResult = await client.query(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
    [tenant_name, slug],
  );
  const tenant_id = tenantResult.rows[0].id;

  const userResult = await client.query(
    `INSERT INTO users (phone, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    [phone, name, password_hash],
  );
  const user_id = userResult.rows[0].id;

  await client.query(
    `INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [tenant_id, user_id],
  );

  await client.query('COMMIT');

} catch (err) {
  await client.query('ROLLBACK');
  // error handling
} finally {
  client.release();
}
```

**Why `pool.connect()` instead of `pool.query()`:**

A transaction must run on the same connection from BEGIN to COMMIT or ROLLBACK. `pool.query()` picks any available connection from the pool for each query — different queries could land on different connections, breaking the transaction. `pool.connect()` checks out one specific connection and holds it until we call `client.release()`.

**Why `RETURNING id` on the inserts:**

PostgreSQL generates UUIDs for new rows. We need the `tenant_id` from the tenants insert to use in the memberships insert, and the `user_id` from the users insert. `RETURNING id` gives us those values back immediately without a second SELECT query.

**Why `client.release()` is in `finally`:**

`finally` runs whether the try succeeded or the catch fired. If we put `client.release()` only in the try block, a failure would skip it and that connection would never return to the pool. After enough failures, the pool would have no connections left and the server would hang. `finally` guarantees the connection is always returned.

### The error handler

```javascript
if (err.code === '23505') {
  if (err.constraint && err.constraint.includes('slug'))
    return res.status(409).json({ error: 'That slug is already taken' });
  if (err.constraint && err.constraint.includes('phone'))
    return res.status(409).json({ error: 'An account with that phone number already exists' });
  return res.status(409).json({ error: 'Duplicate value' });
}
```

**What `23505` means:**

This is the PostgreSQL error code for a unique constraint violation. Our `tenants.slug` column and `users.phone` column both have UNIQUE constraints. If someone tries to register a slug or phone that already exists, PostgreSQL throws `23505`.

**Why we check `err.constraint`:**

Both slug and phone can trigger `23505`. We check which constraint name was violated so we can return a specific, helpful message instead of a generic one. Constraint names are set in the migration files.

**Why 409:**

409 Conflict — the request conflicted with the current state of the database. The data already exists. This is the correct HTTP status for a duplicate-record situation.

### The JWT

```javascript
const token = jwt.sign(
  { user_id, tenant_id, role: 'owner' },
  process.env.JWT_SECRET,
  { expiresIn: '7d' },
);
```

**What it does:**

Creates a JSON Web Token — a digitally signed string that contains the user's identity. The payload `{ user_id, tenant_id, role }` is what every protected route will read to know who is making the request and which tenant they belong to.

**Why `tenant_id` is in the token:**

This is the multi-tenancy boundary. Every future request carries the token. When a route fetches data, it will filter by `tenant_id` from the token — a user can only ever see data belonging to their own tenant. The token is signed with `JWT_SECRET`, so a user cannot forge a different `tenant_id` without knowing the secret.

**Why `httpOnly: true` on the cookie:**

`httpOnly` means JavaScript running in the browser cannot read the cookie. This blocks XSS attacks — if a malicious script is injected into the page, it cannot steal the token. The browser sends the cookie automatically on every request but cannot expose it to JavaScript.

**Why `secure: process.env.NODE_ENV === 'production'`:**

`secure: true` means the cookie is only sent over HTTPS. In development we use HTTP (localhost), so forcing `secure: true` would break local testing. In production the site runs on HTTPS, so the cookie must only travel over encrypted connections.

---

## File 3 — `apps/api/src/routes/auth/login.js`

### The query and password check

```javascript
const userResult = await pool.query(
  `SELECT id, password_hash FROM users WHERE phone = $1`,
  [phone],
);

if (userResult.rows.length === 0) {
  return res.status(401).json({ error: 'Invalid credentials' });
}

const user = userResult.rows[0];
const valid = await bcrypt.compare(password, user.password_hash);

if (!valid) {
  return res.status(401).json({ error: 'Invalid credentials' });
}
```

**Why we only SELECT `id` and `password_hash`:**

We need exactly those two columns and nothing else. Selecting only what you need is good practice — it reduces the data moving between the database and the server, and it avoids accidentally exposing sensitive fields.

**Why `bcrypt.compare` and not comparing strings:**

Passwords are never stored as plain text. What is stored is a bcrypt hash — a one-way transformation. `bcrypt.compare(plaintext, hash)` runs the same transformation on the submitted password and checks if the result matches the stored hash. You cannot reverse a hash to get the original password, so even if the database was stolen, the attacker would not have the passwords.

**Why both "phone not found" and "wrong password" return the same `"Invalid credentials"` message:**

If we returned different messages, an attacker could enumerate phone numbers by sending requests and reading which error appears. "Invalid credentials" for both cases reveals nothing — the attacker cannot tell which field was wrong.

### The membership query

```javascript
const membershipResult = await pool.query(
  `SELECT tenant_id, role FROM memberships WHERE user_id = $1 LIMIT 1`,
  [user.id],
);

if (membershipResult.rows.length === 0) {
  return res.status(403).json({ error: 'No tenant found for this account' });
}
```

**Why we fetch membership separately:**

The JWT needs `tenant_id` and `role`. These live in the `memberships` table, not the `users` table. A user could theoretically belong to multiple tenants — `LIMIT 1` takes their primary one for now.

**Why 403 and not 401:**

401 means unauthenticated — we do not know who you are. 403 means authenticated but forbidden — we know who you are but you do not have access. At this point we have verified the password, so we know who the user is. The problem is they have no tenant. 403 is correct.

---

## File 4 — `apps/api/src/routes/auth/auth.js`

```javascript
import { Router } from 'express';
import signupRouter from './signup.js';
import loginRouter from './login.js';

const router = Router();

router.use(signupRouter);
router.use(loginRouter);

export default router;
```

**What it does:**

A combiner file. It imports the individual route files and mounts them on one router, which is then exported to `index.js`. This is the separation of concerns pattern — each route lives in its own file and knows nothing about the others. The combiner assembles them.

**Why `router.use()` and not `router.post()`:**

Each sub-router already defines its own path (`/signup`, `/login`) internally. `router.use()` mounts the entire sub-router, including whatever paths it defines. `router.post('/signup', signupRouter)` would try to nest a router inside a path, which does not work the same way.

---

## File 5 — `apps/api/src/index.js`

```javascript
app.use('/v1', authRouter);
```

**Why `/v1`:**

API versioning. Every route is prefixed with `/v1` so that in the future, if we need to change how signup or login works in a breaking way, we can release `/v2` endpoints alongside the old ones without breaking existing clients. Clients that haven't upgraded keep using `/v1`. This is standard practice for production APIs.

---

## Summary

| File | Lines I understand | Lines I wrote |
|---|---|---|
| `db/pool.js` | 100% | Yes |
| `routes/auth/signup.js` | 100% | Yes |
| `routes/auth/login.js` | 100% | Yes |
| `routes/auth/auth.js` | 100% | Yes |
| `index.js` (auth section) | 100% | Yes |

Every line of isolation logic — the `tenant_id` in the JWT payload, the reserved slug check, the transaction rollback, the `httpOnly` cookie — was written by me and is explained above. No line is a black box.