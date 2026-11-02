// =============================================================================
// isolation.test.js — Day 4: cross-tenant leak tests for EVERY tenant table
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Day 3 tested products and orders through the API. But Rahisisha has 16
//   tables that hold shop data, and most have no URL (customers, messages,
//   wallet_entries...). This file attacks ALL 16 at the database level
//
// WHY IT IS IMPORTANT:
// - Isolation is the promise the whole product stands on. One table with RLS
//   off is a data breach waiting to happen
//
// DANGER — IF THIS FILE DOES NOT EXIST:
// - Example 1: a new migration adds a table and forgets RLS. Every shop can
//   read every other shop's rows. Nothing crashes, nobody notices
// - Example 2: someone runs ALTER TABLE ... DISABLE ROW LEVEL SECURITY while
//   debugging and forgets to turn it back on
// - Example 3: wallet_entries has no URL, so no API test would ever catch a
//   leak of one shop's money records into another shop's view
//
// WHAT THIS TEST SOLVES:
// - For each tenant table, Brio tries to READ, UPDATE and DELETE a row that
//   belongs to Acme. All three must find nothing (0 rows)
// - Acme then checks her row is still there, so "0 rows" really means
//   "hidden", not "never existed"
//
// HOW IT DIFFERS FROM THE OTHER TESTS:
// - products.cross-tenant / orders.isolation: through HTTP, expect 404
// - THIS file: straight to the database, "404" becomes "0 rows"
//
// NOTHING IS LEFT BEHIND:
// - Everything runs inside ONE transaction that is ROLLED BACK at the end
//
// SYSTEM DESIGN PRINCIPLE: Trust but verify, and make forgetting impossible
// - The coverage guard fails if a new tenant table is not added here
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every multi-tenant SaaS: one suite that loops over ALL tenant tables
//
// TRADEOFFS:
// + Covers every table in one place, leaves no data behind
// - Needs a seed insert per table (new table = add one entry below)
//
// HOW TO RUN:
//   cd apps/api
//   npm test -- tests/isolation.test.js
// =============================================================================

// pg: PostgreSQL client, used to talk to the database directly
import pg     from 'pg';

// dotenv: loads .env so process.env.DATABASE_URL exists
import dotenv from 'dotenv';

// Load .env BEFORE we read process.env
dotenv.config();

const { Pool } = pg;

// testPool: our own pool for this test. Connects as rahisisha_user, so RLS
// applies to it, exactly as it does to the real app
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Every table that holds one shop's data (has tenant_id AND RLS).
// If you add a new tenant table to the database, ADD IT HERE
// (the coverage guard test below fails until you do)
const TENANT_TABLES = [
  'brand_profiles', 'content_posts', 'conversations', 'customers',
  'inventory_movements', 'memberships', 'messages', 'order_items', 'orders',
  'product_media', 'product_variants', 'products', 'stock_reservations',
  'subscriptions', 'usage_counters', 'wallet_entries',
];

// Tables that have a tenant_id but, BY DESIGN, no RLS. They are documented as
// exceptions in isolation-proof.md. audit_logs: platform admin reads all shops
const KNOWN_EXCEPTIONS = ['audit_logs'];

// Shared by all tests in this file
let client;          // ONE connection, one open transaction
let acmeTenantId;    // first tenant  (Amina)
let brioTenantId;    // second tenant (Brian, the attacker)
const ids = {};      // ids[tableName] = the id of the Acme row we seed

// asTenant: tells Postgres which shop is asking, from now on.
// `true` is correct here because a transaction is open (BEGIN below)
async function asTenant(tenantId) {
  await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
}

// one: runs an INSERT ... RETURNING id and gives back the new id
async function one(sql, params) {
  const { rows } = await client.query(sql, params);
  return rows[0].id;
}

// ─── SETUP ───────────────────────────────────────────────────────────────────
// beforeAll: runs ONCE. Opens the transaction and gives Acme one row in each
// of the 16 tables. Order matters: parents first (a product before its
// variants, a customer before its orders)
beforeAll(async () => {
  client = await testPool.connect();

  // Find two real tenants (the tenants table has no RLS)
  const t = await client.query('SELECT id FROM tenants ORDER BY created_at LIMIT 2');
  if (t.rows.length < 2) throw new Error('Need at least 2 tenants in the database.');
  acmeTenantId = t.rows[0].id;
  brioTenantId = t.rows[1].id;

  // Open the transaction. Everything below is undone at the end
  await client.query('BEGIN');

  // From here on, every INSERT happens AS ACME
  await asTenant(acmeTenantId);
  const A = acmeTenantId;
  const tag = `iso-${Date.now()}`;   // makes phone numbers unique per run

  // users has no RLS, memberships needs one
  const userId = await one(
    "INSERT INTO users (phone, name, password_hash) VALUES ($1, 'Iso Test', 'x') RETURNING id",
    [tag]
  );

  ids.products = await one(
    "INSERT INTO products (tenant_id, name, price_cents) VALUES ($1, 'iso', 100) RETURNING id", [A]);
  ids.product_variants = await one(
    'INSERT INTO product_variants (tenant_id, product_id) VALUES ($1, $2) RETURNING id',
    [A, ids.products]);
  ids.product_media = await one(
    "INSERT INTO product_media (tenant_id, product_id, original_url) VALUES ($1, $2, 'http://x') RETURNING id",
    [A, ids.products]);
  ids.customers = await one(
    'INSERT INTO customers (tenant_id, phone) VALUES ($1, $2) RETURNING id', [A, tag]);
  ids.conversations = await one(
    'INSERT INTO conversations (tenant_id, customer_id) VALUES ($1, $2) RETURNING id',
    [A, ids.customers]);
  ids.messages = await one(
    "INSERT INTO messages (tenant_id, conversation_id, direction, body, sender) VALUES ($1, $2, 'inbound', 'hi', 'customer') RETURNING id",
    [A, ids.conversations]);
  ids.stock_reservations = await one(
    "INSERT INTO stock_reservations (tenant_id, variant_id, quantity, expires_at) VALUES ($1, $2, 1, NOW() + INTERVAL '1 hour') RETURNING id",
    [A, ids.product_variants]);
  ids.inventory_movements = await one(
    "INSERT INTO inventory_movements (tenant_id, variant_id, type, quantity) VALUES ($1, $2, 'adjustment', 1) RETURNING id",
    [A, ids.product_variants]);
  ids.orders = await one(
    'INSERT INTO orders (tenant_id, customer_id, total_cents) VALUES ($1, $2, 100) RETURNING id',
    [A, ids.customers]);
  ids.order_items = await one(
    "INSERT INTO order_items (tenant_id, order_id, product_name, unit_price_cents, quantity) VALUES ($1, $2, 'iso', 100, 1) RETURNING id",
    [A, ids.orders]);
  ids.wallet_entries = await one(
    "INSERT INTO wallet_entries (tenant_id, amount_cents, reason) VALUES ($1, 100, 'sale') RETURNING id", [A]);
  ids.content_posts = await one(
    'INSERT INTO content_posts (tenant_id) VALUES ($1) RETURNING id', [A]);
  ids.usage_counters = await one(
    "INSERT INTO usage_counters (tenant_id, month) VALUES ($1, '2026-01-01') RETURNING id", [A]);
  ids.memberships = await one(
    'INSERT INTO memberships (tenant_id, user_id) VALUES ($1, $2) RETURNING id', [A, userId]);

  // brand_profiles and subscriptions allow only ONE row per shop, and Acme may
  // already have one. So: try to insert (skip if it exists), then read it back
  await client.query('INSERT INTO brand_profiles (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING', [A]);
  ids.brand_profiles = (await client.query('SELECT id FROM brand_profiles LIMIT 1')).rows[0].id;
  await client.query('INSERT INTO subscriptions (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING', [A]);
  ids.subscriptions = (await client.query('SELECT id FROM subscriptions LIMIT 1')).rows[0].id;
});

// afterAll: UNDO everything (ROLLBACK), then give the connection back
afterAll(async () => {
  await client.query('ROLLBACK');
  client.release();
  await testPool.end();
});

// ─── COVERAGE GUARDS ─────────────────────────────────────────────────────────

describe('Coverage guards', () => {

  // Fails if the database has a tenant table this file does not test
  test('every tenant-owned table is covered by this suite', async () => {
    const { rows } = await client.query(`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM information_schema.columns k
                    WHERE k.table_schema = 'public'
                      AND k.table_name = c.relname
                      AND k.column_name = 'tenant_id')
      ORDER BY c.relname`);
    const found = rows.map((r) => r.relname).filter((n) => !KNOWN_EXCEPTIONS.includes(n));
    expect(found).toEqual([...TENANT_TABLES].sort());
  });

  // Fails if any covered table has RLS off, or not forced
  test('RLS is enabled AND forced on every covered table', async () => {
    const { rows } = await client.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = ANY($1) AND relkind = 'r'`, [TENANT_TABLES]);
    expect(rows.length).toBe(TENANT_TABLES.length);
    for (const r of rows) {
      expect({ table: r.relname, rls: r.relrowsecurity, forced: r.relforcerowsecurity })
        .toEqual({ table: r.relname, rls: true, forced: true });
    }
  });
});

// ─── THE ATTACKS: same 3 checks for EVERY table ──────────────────────────────
// Table names come from OUR constant list (never from a user), so putting
// them into the SQL text is safe here

describe.each(TENANT_TABLES)('Isolation — %s', (table) => {

  // ATTACK 1 (READ): Brio asks for Acme's row by its id
  test('Brio cannot READ an Acme row by id', async () => {
    await asTenant(brioTenantId);
    const { rows } = await client.query(
      `SELECT id FROM ${table} WHERE id = $1`, [ids[table]]);
    expect(rows.length).toBe(0);
  });

  // ATTACK 2 (UPDATE): Brio tries to change Acme's row.
  // "SET tenant_id = tenant_id" changes nothing, but it still has to FIND
  // the row first, so it works for every table with no table-specific column
  test('Brio cannot UPDATE an Acme row by id', async () => {
    await asTenant(brioTenantId);
    const res = await client.query(
      `UPDATE ${table} SET tenant_id = tenant_id WHERE id = $1`, [ids[table]]);
    expect(res.rowCount).toBe(0);
  });

  // ATTACK 3 (DELETE): Brio tries to delete Acme's row
  test('Brio cannot DELETE an Acme row by id', async () => {
    await asTenant(brioTenantId);
    const res = await client.query(
      `DELETE FROM ${table} WHERE id = $1`, [ids[table]]);
    expect(res.rowCount).toBe(0);
  });

  // CONTROL: Acme looks again. The row must still exist and be hers.
  // Without this, "0 rows" above could just mean "the row never existed"
  test('Acme still sees her own row afterwards', async () => {
    await asTenant(acmeTenantId);
    const { rows } = await client.query(
      `SELECT id FROM ${table} WHERE id = $1`, [ids[table]]);
    expect(rows.length).toBe(1);
  });
});