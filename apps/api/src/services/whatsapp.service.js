/**
 * ============================================================
 * FILE: apps/api/src/services/whatsapp.service.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   One shared place that sends a WhatsApp text for the CURRENT
 *   shop. Any controller can call sendWhatsApp(req.db, to, body)
 *   and it uses that shop's own number and that shop's own token.
 *
 * WHY IMPORTANT
 *   The token is the key to a shop's WhatsApp. Sending with the
 *   wrong shop's token would send messages as the wrong business.
 *   Logging the token would leak it into log files for good.
 *
 * DANGER
 *   - NEVER log the token, the Authorization header, the config
 *     row, or the full Meta response. This file has NO console
 *     calls on purpose. Keep it that way.
 *   - whatsapp_configs has NO RLS. A SELECT without a WHERE would
 *     return EVERY shop's row. The query below filters by the
 *     shop the database lock is set to. Do not remove that.
 *   - Do not put the token (or the `to` number) in error messages.
 *
 * WHAT IT SOLVES
 *   Day 2, Task 3: "sendWhatsApp(db, to, body) uses req.db to find
 *   the tenant's decrypted token and calls Meta, never logs it".
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Least privilege + one shared sender. The shop comes from the
 *   database lock (set by withTenant), never from an argument the
 *   caller could get wrong. The token is decrypted only at the last
 *   moment, in memory, and never stored or returned.
 *
 * RULES
 *   1. The shop = whatever app.current_tenant is set to on `db`.
 *   2. Decrypt with decryptSecret(stored, tenantId) at the last moment.
 *   3. No logging in this file. Errors carry no secrets.
 *   4. `to` is digits only (country code first, no "+"), 7 to 15 digits.
 *   5. Message body: non-empty, at most 4096 characters (WhatsApp limit).
 *   6. A request timeout, so a slow Meta cannot hang the server.
 *
 * PRACTICAL EXAMPLE
 *   In the webhook for Amina's number:
 *     await sendWhatsApp(req.db, '254712345678', 'Karibu Amina!');
 *   -> finds Amina's phone_number_id and token, calls Meta, returns
 *      { messageId: 'wamid.XXXX' }.
 *
 * DECISIONS (and WHY)
 *   - First argument is `db` (req.db), as the assignment asks. It is
 *     already locked to one shop.
 *   - tenant_id comes back from the same query and is used as the
 *     "shop lock" when decrypting (see kms.js).
 *   - Node's built-in fetch: no extra package.
 *   - Base address and API version come from env with safe defaults,
 *     so tests can point at a fake server.
 *   - Errors say only "WhatsApp send failed (status N)". The reason
 *     from Meta is not copied in, in case it ever echoes something
 *     sensitive.
 *
 * WHERE USED / FUTURE USES
 *   - controllers/whatsapp.controller.js (auto replies)
 *   - Later: template messages (stretch), order updates, M-Pesa receipts.
 *
 * TRADEOFFS
 *   + One small function, easy to mock in tests.
 *   - One config query per send. Fine now; cache later if needed.
 *   - Text messages only. Templates are a stretch goal.
 *
 * HOW TO USE
 *   import { sendWhatsApp } from '../services/whatsapp.service.js';
 *   const { messageId } = await sendWhatsApp(req.db, '2547...', 'Hello');
 *
 * AI AUDIT NOTE
 *   Written by AI at Sheryl's request. The assignment says AI is NOT
 *   allowed for token handling. Declared in
 *   apps/api/docs/AI_AUDIT_week_29_day2.md.
 * ============================================================
 */
import { decryptSecret } from '../utils/kms.js';

const API_BASE = () => process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com';
const API_VERSION = () => process.env.WHATSAPP_API_VERSION || 'v21.0';
const TIMEOUT_MS = 10000;
const MAX_BODY = 4096;

async function sendWhatsApp(db, to, body) {
  // 1. Check what the caller gave us, before touching the database.
  if (!db || typeof db.query !== 'function') {
    throw new Error('sendWhatsApp needs a database connection');
  }
  const phone = String(to ?? '').replace(/^\+/, '');
  if (!/^\d{7,15}$/.test(phone)) {
    throw new Error('Invalid WhatsApp recipient number');
  }
  if (typeof body !== 'string' || body.length === 0 || body.length > MAX_BODY) {
    throw new Error('Invalid WhatsApp message body');
  }

  // 2. Find THIS shop's config. No RLS on this table, so we filter by the
  //    shop the lock is set to. NULLIF turns an empty setting into NULL, so
  //    "no shop set" finds nothing (never "all shops").
  const { rows } = await db.query(
    `SELECT tenant_id, phone_number_id, access_token_encrypted
       FROM whatsapp_configs
      WHERE tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID`
  );
  if (!rows[0]) {
    const err = new Error('WhatsApp is not set up for this shop');
    err.code = 'whatsapp_not_configured';
    throw err;
  }
  const { tenant_id, phone_number_id, access_token_encrypted } = rows[0];

  // 3. Unscramble the token at the last moment. It lives only in this
  //    function's memory and is never logged or returned.
  const token = decryptSecret(access_token_encrypted, tenant_id);

  // 4. Call Meta.
  const url = `${API_BASE()}/${API_VERSION()}/${encodeURIComponent(phone_number_id)}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // 5. Failure: say only the status. No body, no token, no number.
  if (!res.ok) {
    const err = new Error(`WhatsApp send failed (status ${res.status})`);
    err.status = res.status;
    // 401/403 usually means the shop revoked access or the token expired.
    if (res.status === 401 || res.status === 403) err.code = 'whatsapp_token_rejected';
    throw err;
  }

  // 6. Success: hand back only the message id Meta gave us.
  const data = await res.json().catch(() => ({}));
  return { messageId: data?.messages?.[0]?.id ?? null };
}

export { sendWhatsApp };