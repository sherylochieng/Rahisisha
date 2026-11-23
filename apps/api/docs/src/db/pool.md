# pool.js

**Location:** `apps/api/src/db/pool.js`

---

## WHY THIS FILE EXISTS

Opening a database connection is slow. A **pool** keeps a small set of connections ready so requests can borrow and return them.

**Think of it like this:** a library with 20 books. You borrow one, read it, return it.

---

## WHY IMPORTANT

Every query in the app goes through this pool. If it is misconfigured, the whole API slows or freezes.

---

## DANGER

- **Connections borrowed but never returned** (a leak) slowly empty the pool.
- Once empty, every new request waits for ever.
- Putting the real connection string in code (instead of `.env`) leaks your database password to GitHub.

---

## WHAT IT SOLVES

- Reuses connections (fast).
- Limits how many exist (protects the database).
- Fails fast instead of hanging when the pool is empty.

---

## SYSTEM DESIGN PRINCIPLE

**Resource pooling and lifecycle.** Every borrow needs exactly one return.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Any app that talks to a database: Postgres, MySQL, Redis clients all use pools.

---

## TRADEOFFS

- Bigger pool: handles more at once, but uses more database memory.
- Smaller pool: safer for the database, but requests queue sooner.

---

## HOW TO USE

```js
import { pool } from '../db/pool.js';
const client = await pool.connect();   // borrow
// ... use it ...
client.release();                      // return (exactly once)
```

Controllers never do this themselves. `withTenant` does it and gives them `req.db`.

---

## THE SETTINGS

| Setting | Value | Meaning |
|---|---|---|
| `max` | 20 | At most 20 connections at once |
| `idleTimeoutMillis` | 30000 | Close a connection that sits unused for 30 seconds |
| `connectionTimeoutMillis` | 5000 | If no connection is free after 5 seconds, **throw an error** instead of waiting for ever |

The connection details come from the environment (your `.env` file). **That file must never be committed.**

---

## IN TESTS

Each test file gets its own copy of the pool. Close it in `afterAll` with `await pool.end()`, or Jest prints "did not exit one second after the test run".


---

## WEEK 29 WEEKEND FIX: WHAT HAPPENS WHEN THE LINE DROPS

**What was wrong.** The pool had no instruction for what to do when a connection drops. A connection that is sitting unused in the pool reports the problem as an "error event". If nobody is listening for that event, Node treats it as fatal and **stops the whole API**. The chaos test found it on 23 November 2026: cutting the connections with `pg_terminate_backend` crashed the API, and it stayed down until someone restarted it.

**Real life.** The phone line between the shop and the filing cabinet goes dead for a second. Before: the shop shuts and stays shut. Now: someone notes "the line dropped" in the logbook and the next customer is served on a fresh line.

**The fix.** At the end of `pool.js`:

```js
pool.on('error', (err) => {
  console.error('Database connection dropped (the pool will reconnect):', err.message);
});
```

- `pool.on('error', ...)` means "if a pooled connection reports a problem, run this".
- The pool then throws the dead connection away and opens a fresh one for the next request.
- It logs only `err.message`, never the whole error object. The whole object contains the connection details (user, database, host), which do not belong in a log.

**The guard.** `apps/api/tests/pool.error-handler.test.js` fails if this listener is removed. Never delete that test to make a change pass.

**Where you will use this in future projects.** Any Node app that uses a `pg` pool (or any pooled client) needs this listener. Add it the day you create the pool, and test it by cutting the connection on purpose.

**What it does not cover.** A request in the middle of a query when the connection dies still fails for that one customer, with a clean error, not a crash. See `RUNBOOK.md`, section 13.
