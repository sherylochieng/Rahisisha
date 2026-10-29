// // import { pool } from '../db/pool.js';

// // // =============================================================================
// // // withTenant.js — Scoped database connection middleware
// // // =============================================================================
// // //
// // // WHY THIS FILE EXISTS:
// // // Every request needs a database connection scoped to ONE tenant.
// // // This middleware borrows a connection from the pool, tells PostgreSQL
// // // which tenant is active (via app.current_tenant), and attaches it to req.db.
// // //
// // // SYSTEM DESIGN PRINCIPLE: Resource lifecycle management
// // // The connection must stay open for the ENTIRE request, then be released.
// // // We use res.on('finish') to release AFTER the response is sent —
// // // not in a finally block, which runs before the controller finishes.
// // //
// // // WHY NOT await next()?
// // // next() in Express is synchronous — it does not return a Promise.
// // // await next() returns immediately (next() returns undefined, not a Promise),
// // // so finally would run before the controller query completes.
// // // The fix: attach cleanup to the response 'finish' event instead.
// // //
// // // TRADEOFFS:
// // // + Connection is held for exactly as long as the request needs it
// // // + RLS tenant setting stays active for the full request lifecycle
// // // - One connection per request — does not scale to thousands of concurrent users
// // //   (connection pooling at a higher level solves this in production)
// // // =============================================================================

// // export async function withTenant(req, res, next) {
// //   // Borrow one specific connection from the pool
// //   const client = await pool.connect();

// //   try {
// //     // Tell PostgreSQL: "for this request, only show rows for this tenant"
// //     // set_config(name, value, is_local):
// //     //   is_local = true means this setting resets when the transaction ends
// //     //   We use true so the setting does not leak to the next request
// //     //   that reuses this connection from the pool
// //     await client.query(
// //       "SELECT set_config('app.current_tenant', $1, true)",
// //       [req.tenantId]
// //     );

// //     // Attach the scoped connection to req so every controller uses it
// //     // Rule: ALWAYS use req.db — never import pool and call pool.query directly
// //     req.db = client;

// //     // Release the connection AFTER the response is fully sent
// //     // 'finish' fires when the last byte of the response leaves the server
// //     // This keeps the connection (and the tenant setting) alive for the
// //     // entire controller execution
// //     res.on('finish', () => {
// //       client.release();
// //     });

// //     // Hand off to the next middleware or controller
// //     next();

// //   } catch (err) {
// //     // If set_config itself fails, release immediately and pass the error
// //     client.release();
// //     next(err);
// //   }
// // }

// import { pool } from '../db/pool.js';

// export async function withTenant(req, res, next) {
//   const client = await pool.connect();

//   let released = false;
//   function release() {
//     if (!released) {
//       released = true;
//       client.release();
//     }
//   }

//   try {
//     await client.query(
//       "SELECT set_config('app.current_tenant', $1, false)",
//       [req.tenantId]
//     );
//     req.db = client;

//     // 'finish' fires when the response is fully sent (real HTTP)
//     // 'close' fires when the connection is closed (supertest + real HTTP)
//     // We guard with `released` so the client is only released once
//     res.on('finish', release);
//     res.on('close', release);

//     next();
//   } catch (err) {
//     release();
//     next(err);
//   }
// }

// =============================================================================
// withTenant.js — Scoped database connection middleware
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Every request needs a database connection scoped to ONE tenant
// - This middleware borrows a connection from the pool, tells PostgreSQL which
//   tenant is active (via app.current_tenant), and attaches it to req.db
// - Row Level Security (RLS) reads that setting to hide other tenants' rows
//
// WHY IT IS IMPORTANT:
// - This is the most critical security boundary in the app. If the tenant is
//   not set correctly, one shop could see another shop's data
//
// DANGER — WHAT HAPPENS IF THIS BREAKS:
// - Example 1: the tenant is not set, so RLS sees an empty tenant and queries
//   fail (we hit this bug: `set_config(..., true)` outside a transaction)
// - Example 2: the connection is never released, so the pool fills up and the
//   API freezes for EVERY shop
// - Example 3: a connection keeps a stale tenant and the next request reuses it
//   (this is why the tenant is set again on every single request)
//
// SYSTEM DESIGN PRINCIPLE: Resource lifecycle management
// - The connection must stay open for the ENTIRE request, then be released
// - We release it when the response is done ('finish' / 'close'), not in a
//   `finally` block, because next() is synchronous and returns BEFORE the
//   controller's database queries are complete
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any multi-tenant app that uses Postgres Row Level Security
// - Any code that borrows a pooled resource and must always give it back
//
// HOW IT IS USED:
//   app.use('/v1/products', requireAuth, withTenant, productsRouter);
//   (requireAuth runs first, because withTenant needs req.tenantId)
//
// TRADEOFFS:
// + The connection is held for exactly as long as the request needs it
// + The tenant setting stays active for the full request
// - One connection per request, so it does not scale to thousands of
//   simultaneous users (a pooler such as PgBouncer solves that in production)
// - The setting lasts for the whole connection, so it must be overwritten on
//   every request (it is) and ideally reset on release (a known follow-up)
// =============================================================================

import { pool } from '../db/pool.js';

// withTenant: Express middleware (req, res, next)
// - req.tenantId must already be set by requireAuth, from the signed JWT
// - On success it sets req.db and calls next()
// - On failure it releases the connection (if one was borrowed) and calls
//   next(err), so the central error handler can answer with a clean 500
export async function withTenant(req, res, next) {
  // The borrowed connection. It starts EMPTY on purpose: if borrowing from the
  // pool fails, `client` stays empty, and release() below knows there is
  // nothing to give back. It is declared here, outside the try, so that both
  // release() and the catch block can see it
  let client;

  // `released` remembers whether the connection was already given back.
  // 'finish' and 'close' can BOTH fire for one request, and releasing the
  // same connection twice would corrupt the pool.
  let released = false;

  // release: gives the connection back to the pool, at most once.
  // `&& client` makes it do nothing if the borrow never happened
  function release() {
    if (!released && client) {
      released = true;
      client.release();
    }
  }

  try {
    // Borrow one connection from the pool. Inside the try on purpose: if the
    // pool is exhausted this throws, and the catch below sends the error to
    // next(err) instead of hanging the request.
    // (No `let` or `const` here: `client` was already declared above)
    client = await pool.connect();

    // Tell PostgreSQL: "for this request, only show rows for this tenant".
    // set_config(name, value, is_local):
    //   is_local = false means the setting lasts for the whole connection.
    //   We do NOT open a transaction here, so `true` (transaction-only) would
    //   throw the setting away after this one query. The next query would see
    //   an empty tenant and fail with: invalid input syntax for type uuid: ""
    // Because the setting lasts for the connection, it is set again on every
    // request, so a reused connection never keeps the previous tenant.
    await client.query(
      "SELECT set_config('app.current_tenant', $1, false)",
      [req.tenantId]
    );

    // Attach the scoped connection to req so every controller uses it.
    // Rule: ALWAYS use req.db. Never import pool and call pool.query directly
    req.db = client;

    // Give the connection back once the response is over:
    // 'finish' fires when the last byte of the response leaves the server
    // 'close'  fires when the connection closes (also covers supertest and
    //          clients that disconnect early)
    // `release` ignores the second call, so it is safe to listen to both
    res.on('finish', release);
    res.on('close', release);

    // Hand off to the next middleware or controller
    next();

  } catch (err) {
    // Something failed while borrowing or setting the tenant.
    // Release (only does anything if a connection was actually borrowed),
    // then pass the error on to the central error handler in app.js
    release();
    next(err);
  }
}