/**
 * ============================================================
 * FILE: apps/api/scripts/check-payment.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   After a real Safaricom sandbox payment you want to see what the system
 *   did: is the attempt still pending, paid or failed? Is the order paid?
 *   Did the wallet grow? This script shows exactly that, read-only.
 *
 * WHY IMPORTANT
 *   It lets you check a payment without typing a database password or
 *   opening psql, and it can never change anything.
 *
 * DANGER
 *   - READ-ONLY: it only runs SELECT queries.
 *   - It refuses a database that is not on this computer.
 *   - It never prints receipts, phone numbers, keys or tokens: only the
 *     status words, whether a receipt exists (yes/no) and the totals.
 *
 * WHAT IT SOLVES
 *   Day 3 sandbox walk-through: proving the callback and the wallet credit
 *   with a real Safaricom sandbox payment.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Look, do not touch. A checking tool must not be able to break what it checks.
 *
 * RULES
 *   1. Local database only.
 *   2. SELECT only.
 *   3. Set the shop lock (app.current_tenant) like the app does, because
 *      payment_attempts and wallet_entries are locked by shop.
 *   4. Nothing sensitive in the output.
 *
 * PRACTICAL EXAMPLE
 *   node scripts/check-payment.js de26aeb2-2d6a-4837-b134-5e37cb12787a
 *   prints the order status, each payment attempt (status, reason, has
 *   receipt) and the shop's wallet total in cents.
 *   With no order id, it checks the most recent order that has a payment
 *   attempt (handy right after a sandbox payment).
 *
 * DECISIONS (and WHY)
 *   - The shop defaults to aminas-boutique (the demo shop); set SHOP_SLUG to
 *     check another one.
 *   - It uses the app's own pool and .env, so no password is typed.
 *
 * WHERE USED
 *   By hand, after a sandbox payment.
 *
 * TRADEOFFS
 *   + Quick, safe.
 *   - Shows state only; it does not explain why.
 *
 * HOW TO USE
 *   cd apps/api
 *   node scripts/check-payment.js              (the latest paid-for order)
 *   node scripts/check-payment.js <order id>   (a specific order)
 *
 * AI AUDIT NOTE
 *   Written by AI at Sheryl's request. It touches no money (read-only).
 * ============================================================
 */
import { pool } from '../src/db/pool.js';

// STEP 1: refuse anything but a local database
function guard() {
  let host = '';
  try {
    host = new URL(process.env.DATABASE_URL).hostname;
  } catch {
    throw new Error('Refusing to run: DATABASE_URL is missing or not readable');
  }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('Refusing to run: the database is not on this computer');
  }
}

async function main() {
  guard();
  let orderId = process.argv[2];
  if (orderId && !/^[0-9a-f-]{36}$/i.test(orderId)) {
    throw new Error('Usage: node scripts/check-payment.js [order id]');
  }
  const slug = process.env.SHOP_SLUG || 'aminas-boutique';

  // STEP 2: find the shop (tenants has no lock)
  const t = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
  if (!t.rows[0]) {
    console.log(`Shop not found: ${slug}`);
    return;
  }

  // STEP 3: act as that shop, read only
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_tenant', $1, false)", [t.rows[0].id]);

    // No id given: use the order of the newest payment attempt for this shop.
    if (!orderId) {
      const latest = await client.query(
        'SELECT order_id FROM payment_attempts ORDER BY created_at DESC LIMIT 1');
      if (!latest.rows[0]) {
        console.log('No payment attempts found for this shop yet');
        return;
      }
      orderId = latest.rows[0].order_id;
      console.log('Checking the latest order with a payment attempt');
    }

    const order = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    console.log('Order status:', order.rows[0] ? order.rows[0].status : 'not found for this shop');

    const attempts = await client.query(
      `SELECT status, result_desc, (mpesa_reference IS NOT NULL) AS has_receipt, created_at
         FROM payment_attempts WHERE order_id = $1 ORDER BY created_at`, [orderId]);
    console.log('Payment attempts:');
    console.table(attempts.rows);

    const wallet = await client.query(
      'SELECT COALESCE(SUM(amount_cents), 0) AS wallet_cents FROM wallet_entries');
    console.log('Wallet total (cents):', wallet.rows[0].wallet_cents);
  } finally {
    await client.query('RESET app.current_tenant').catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error(err.message);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
