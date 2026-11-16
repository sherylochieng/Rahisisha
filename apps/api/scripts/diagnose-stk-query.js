/**
 * ============================================================
 * FILE: apps/api/scripts/diagnose-stk-query.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   In the real sandbox run Safaricom's callback arrived and we answered 200,
 *   but the attempt stayed 'pending'. The callback only credits after
 *   Safaricom's STK Query confirms, so this script asks Safaricom the same
 *   question and shows what Safaricom actually answers, so we can see why the
 *   confirmation did not pass.
 *
 * WHY IMPORTANT
 *   queryStkStatus deliberately hides the reason (it only says "could not be
 *   confirmed"). To fix the real problem we must see the reason once.
 *
 * DANGER
 *   - It sends a status QUESTION to Safaricom. It cannot move money.
 *   - It refuses a database that is not on this computer.
 *   - It prints ONLY Safaricom's status words (HTTP status, ResponseCode,
 *     ResultCode, descriptions, error code). It never prints the token, the
 *     key, the secret, the passkey, receipts or phone numbers.
 *   - Throw-away debugging tool: do not commit it unless you want it.
 *
 * WHAT IT SOLVES
 *   Day 3 sandbox walk-through: why a real, successful payment stayed pending.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Look before you fix. Measure the real answer instead of guessing.
 *
 * RULES
 *   1. Local database only.
 *   2. Read from our database, ask Safaricom, print status words only.
 *   3. Use the shop lock like the app does.
 *
 * PRACTICAL EXAMPLE
 *   node scripts/diagnose-stk-query.js
 *   prints, for the newest pending attempt: "HTTP status: 200",
 *   "ResponseCode: 0", "ResultCode: 0" ... or Safaricom's error words.
 *
 * DECISIONS (and WHY)
 *   - It repeats the query call itself (instead of calling queryStkStatus)
 *     because queryStkStatus hides the details on purpose.
 *   - Shop defaults to aminas-boutique; set SHOP_SLUG for another.
 *
 * WHERE USED
 *   By hand, once, while diagnosing.
 *
 * TRADEOFFS
 *   + Shows the exact reason.
 *   - Duplicates a little of daraja.service.js; keep it out of the app.
 *
 * HOW TO USE
 *   cd apps/api
 *   node scripts/diagnose-stk-query.js
 *
 * AI AUDIT NOTE
 *   Written by AI at Sheryl's request. Moves no money and changes no data.
 * ============================================================
 */
import { pool } from '../src/db/pool.js';
import { decryptSecret } from '../src/utils/kms.js';

const BASES = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

function guard() {
  let host = '';
  try { host = new URL(process.env.DATABASE_URL).hostname; } catch { /* below */ }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('Refusing to run: the database is not on this computer');
  }
}

// Nairobi time (UTC+3) as YYYYMMDDHHmmss, as Daraja requires.
function nairobiTimestamp() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
         `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

async function main() {
  guard();
  const slug = process.env.SHOP_SLUG || 'aminas-boutique';
  const t = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
  if (!t.rows[0]) { console.log(`Shop not found: ${slug}`); return; }
  const tenantId = t.rows[0].id;

  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
    const cfgRes = await client.query(
      `SELECT env, consumer_key_encrypted, consumer_secret_encrypted, shortcode, passkey_encrypted
         FROM daraja_configs`);
    const cfg = cfgRes.rows[0];
    if (!cfg) { console.log('No Daraja settings for this shop'); return; }
    const att = await client.query(
      `SELECT checkout_request_id, status FROM payment_attempts
        ORDER BY created_at DESC LIMIT 1`);
    if (!att.rows[0]) { console.log('No payment attempts for this shop'); return; }
    console.log('Newest attempt status in our database:', att.rows[0].status);
    console.log('Environment in settings:', cfg.env);

    const key = decryptSecret(cfg.consumer_key_encrypted, tenantId);
    const secret = decryptSecret(cfg.consumer_secret_encrypted, tenantId);
    const passkey = decryptSecret(cfg.passkey_encrypted, tenantId);
    const base = BASES[cfg.env] || BASES.sandbox;

    const auth = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
    });
    console.log('Token request HTTP status:', auth.status);
    const tokenBody = await auth.json().catch(() => ({}));
    if (!tokenBody.access_token) { console.log('No token received'); return; }

    const timestamp = nairobiTimestamp();
    const password = Buffer.from(`${cfg.shortcode}${passkey}${timestamp}`).toString('base64');
    const res = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBody.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: att.rows[0].checkout_request_id,
      }),
    });
    const body = await res.json().catch(() => ({}));
    console.log('Query HTTP status:', res.status);
    for (const k of ['ResponseCode', 'ResponseDescription', 'ResultCode', 'ResultDesc', 'errorCode', 'errorMessage']) {
      if (body[k] !== undefined) console.log(`${k}:`, body[k]);
    }
    console.log('CheckoutRequestID matches ours:', body.CheckoutRequestID === att.rows[0].checkout_request_id);
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