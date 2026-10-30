# withTenant.js

**Location:** `apps/api/src/middleware/withTenant.js`

---

## WHY THIS FILE EXISTS

Many shops share one database. Before any query runs, the database must be told **which shop is asking**.

`withTenant` does that. It borrows one database connection, writes the shop's ID on it, and gives it to the controller as `req.db`.

**Think of it like this:** the host at a restaurant writes "Acme" on your table card, so the kitchen only serves Acme's food.

---

## WHY IMPORTANT

This is **Lock 1** of the two locks that keep tenants apart.

Row Level Security (Lock 2) reads the name this file writes. No name, no filtering.

---

## DANGER (if this file is wrong or missing)

- **No tenant set:** queries fail (empty string cannot become a UUID).
- **Wrong tenant set:** one shop could see another shop's data. This is a data breach.
- **Connection never returned:** the pool slowly empties and the whole API freezes.

---

## WHAT IT SOLVES

- Tells Postgres who the current tenant is, on every request.
- Hands the controller a ready, tenant-scoped connection (`req.db`).
- Returns the connection to the pool exactly once, even when something fails.
- Cleans the tenant name off the connection before it is reused.

---

## SYSTEM DESIGN PRINCIPLE

- **Defence in depth:** app sets the tenant, database enforces it.
- **Resource lifecycle:** every borrow has exactly one return.
- **Least surprise:** a reused connection never carries the last tenant's name.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Any multi-tenant SaaS: CRMs, invoicing tools, booking systems, school systems. Anywhere many customers share one database.

---

## TRADEOFFS

- **One connection per request** is simple and safe, but uses more connections than sharing.
- **`set_config(..., false)`** lasts for the connection, so we must **RESET it on release**. Using `true` needs a transaction around every request, which is heavier.
- If RESET fails we **destroy** the connection instead of reusing it. Safe, but slightly slower.

---

## HOW TO USE

```js
app.use('/v1/products', requireAuth, withTenant, productsRouter);
```

`requireAuth` must come **first**, because `withTenant` reads `req.tenantId`.

In a controller, always use `req.db.query(...)`. Never `pool.query(...)`.

---

## THE CODE, PIECE BY PIECE

```js
import { pool } from '../db/pool.js';

export async function withTenant(req, res, next) {
  let client;
  let released = false;
```

- `client` is declared **above** the `try` so the cleanup code can see it.
- `released` remembers whether we already gave the connection back.

```js
  function release() {
    if (!released && client) {
      released = true;
      client.query('RESET app.current_tenant').then(
        () => client.release(),
        () => client.release(true)
      );
    }
  }
```

- The `if` makes sure we release **only once**, and only if a connection was ever borrowed.
- `RESET` wipes the tenant name (the hotel changes the sheets).
- `client.release()` returns it to the pool.
- `client.release(true)` **destroys** it if the wipe failed (the room is not rented out again).

```js
  try {
    client = await pool.connect();
    await client.query("SELECT set_config('app.current_tenant', $1, false)", [req.tenantId]);
    req.db = client;
    res.on('finish', release);
    res.on('close', release);
    next();
  } catch (err) { release(); next(err); }
}
```

- `pool.connect()` is **inside** the `try`, so an empty pool becomes a clean error and not a silent hang.
- `false` means the name lasts for the whole connection.
- `req.db = client` hands the connection to the controller.
- `'finish'` fires when the response is sent. `'close'` fires if the caller hangs up. Whichever comes first releases the connection.
- The `catch` releases and passes the error to the central error handler.

---

## BUGS THIS FILE TAUGHT US

| What we saw | Real cause | Lesson |
|---|---|---|
| `invalid input syntax for type uuid: ""` | `set_config(..., true)` with no transaction | Read the arguments. `true` needs `BEGIN` |
| Tests timing out | Crashed requests never released connections | A freeze can be a crash in disguise |
| `client is not defined` | Variable declared inside `try` | Declare above the `try` |

---

## AI NOTE

Parts of this file (release guard, safe borrow, RESET) were AI-written and are disclosed in `AI_AUDIT_week_28_day3.md`. The core isolation line (`set_config` on every request) is the original hand-written logic.
