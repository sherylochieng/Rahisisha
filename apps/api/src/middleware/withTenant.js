// import { pool } from '../db/pool.js';

// // =============================================================================
// // withTenant.js — Scoped database connection middleware
// // =============================================================================
// //
// // WHY THIS FILE EXISTS:
// // Every request needs a database connection scoped to ONE tenant.
// // This middleware borrows a connection from the pool, tells PostgreSQL
// // which tenant is active (via app.current_tenant), and attaches it to req.db.
// //
// // SYSTEM DESIGN PRINCIPLE: Resource lifecycle management
// // The connection must stay open for the ENTIRE request, then be released.
// // We use res.on('finish') to release AFTER the response is sent —
// // not in a finally block, which runs before the controller finishes.
// //
// // WHY NOT await next()?
// // next() in Express is synchronous — it does not return a Promise.
// // await next() returns immediately (next() returns undefined, not a Promise),
// // so finally would run before the controller query completes.
// // The fix: attach cleanup to the response 'finish' event instead.
// //
// // TRADEOFFS:
// // + Connection is held for exactly as long as the request needs it
// // + RLS tenant setting stays active for the full request lifecycle
// // - One connection per request — does not scale to thousands of concurrent users
// //   (connection pooling at a higher level solves this in production)
// // =============================================================================

// export async function withTenant(req, res, next) {
//   // Borrow one specific connection from the pool
//   const client = await pool.connect();

//   try {
//     // Tell PostgreSQL: "for this request, only show rows for this tenant"
//     // set_config(name, value, is_local):
//     //   is_local = true means this setting resets when the transaction ends
//     //   We use true so the setting does not leak to the next request
//     //   that reuses this connection from the pool
//     await client.query(
//       "SELECT set_config('app.current_tenant', $1, true)",
//       [req.tenantId]
//     );

//     // Attach the scoped connection to req so every controller uses it
//     // Rule: ALWAYS use req.db — never import pool and call pool.query directly
//     req.db = client;

//     // Release the connection AFTER the response is fully sent
//     // 'finish' fires when the last byte of the response leaves the server
//     // This keeps the connection (and the tenant setting) alive for the
//     // entire controller execution
//     res.on('finish', () => {
//       client.release();
//     });

//     // Hand off to the next middleware or controller
//     next();

//   } catch (err) {
//     // If set_config itself fails, release immediately and pass the error
//     client.release();
//     next(err);
//   }
// }

import { pool } from '../db/pool.js';

export async function withTenant(req, res, next) {
  const client = await pool.connect();

  let released = false;
  function release() {
    if (!released) {
      released = true;
      client.release();
    }
  }

  try {
    await client.query(
      "SELECT set_config('app.current_tenant', $1, false)",
      [req.tenantId]
    );
    req.db = client;

    // 'finish' fires when the response is fully sent (real HTTP)
    // 'close' fires when the connection is closed (supertest + real HTTP)
    // We guard with `released` so the client is only released once
    res.on('finish', release);
    res.on('close', release);

    next();
  } catch (err) {
    release();
    next(err);
  }
}