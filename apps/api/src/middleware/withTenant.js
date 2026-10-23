import { pool } from '../db/pool.js';

// withTenant — the classroom teacher
// Runs after requireAuth
// Borrows a DB connection, tells PostgreSQL which tenant this request belongs to
// Attaches req.db so every handler uses the scoped connection
export async function withTenant(req, res, next) {
  // Borrow one specific connection from the pool
  const client = await pool.connect();

  try {
    // Tell PostgreSQL: "for this request, only show data for this tenant"
    // true = local setting — resets automatically when the connection is released
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [req.tenantId],
    );

    // Attach the scoped connection to the request
    // Every handler MUST use req.db — never pool directly
    req.db = client;

    // Open the next door
    await next();

  } finally {
    // Always return the connection — whether the handler succeeded or crashed
    client.release();
  }
}