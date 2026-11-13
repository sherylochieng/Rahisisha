/**
 * ============================================================
 * FILE: apps/api/src/controllers/whatsapp.controller.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   The two doors of the shared WhatsApp webhook:
 *   - GET  /webhooks/whatsapp : Meta's "verify challenge" handshake
 *   - POST /webhooks/whatsapp : incoming customer messages
 *
 * WHY IMPORTANT
 *   This is where a customer's WhatsApp message becomes a row in
 *   the right shop's inbox, exactly once.
 *
 * DANGER
 *   - By the time handleInbound runs, resolveWhatsappTenant has
 *     stamped the shop and withTenant has locked the database. Use
 *     ONLY req.db here. Never import the plain pool for shop data.
 *   - NEVER log the payload, the token, or customer phone numbers.
 *   - Dedupe by Meta's message id, NEVER by message text ("ok" and
 *     "ok" from two customers are two different messages).
 *   - Dedupe and processing must be in ONE transaction. Otherwise a
 *     crash after the dedupe row is saved would make Meta's retry
 *     look like a duplicate and the message would be lost forever.
 *
 * WHAT IT SOLVES
 *   Day 2, Tasks 2 and 4: process messages inside the shop's lock,
 *   and skip repeats per shop (whatsapp_dedupe).
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Idempotency: Meta retries webhooks, so receiving the same
 *   message twice must have the same result as once.
 *   Also: acknowledge with 200, fail with 500 so Meta retries.
 *
 * RULES
 *   1. Verify: answer the challenge ONLY when mode is "subscribe"
 *      and the verify token belongs to one of our shops. Else 403.
 *   2. Inbound: for each message, first INSERT into whatsapp_dedupe.
 *      Zero rows inserted = duplicate = skip.
 *   3. Save the customer, the open conversation and the message
 *      with req.db only. RLS does the shop filtering.
 *   4. Any error: ROLLBACK, pass to the error handler (500). Meta retries.
 *   5. Message types we do not handle (images, audio...) are saved as
 *      "[image]" etc. so nothing is silently dropped.
 *
 * PRACTICAL EXAMPLE
 *   A customer texts Amina's number "Hi, price of the dress?".
 *   Meta posts it. Guard finds Amina. Here: dedupe row saved, customer
 *   created (or found), conversation opened (or found), message saved.
 *   Meta retries the same message id: dedupe insert gets 0 rows, skip.
 *
 * DECISIONS (and WHY)
 *   - Verify reads whatsapp_configs with the plain pool (no RLS, and
 *     no shop is known yet). It selects only "1", never the token.
 *   - The challenge is echoed only if it is short and plain
 *     (letters, digits, - and _), so nobody can use this endpoint to
 *     reflect arbitrary text.
 *   - BEGIN/COMMIT on req.db: withTenant set the lock for the whole
 *     connection, so a transaction on it is safe.
 *   - Customer upsert uses the unique (tenant_id, phone) index.
 *   - messages already has a unique (tenant_id, channel_message_id)
 *     index: a second safety net behind whatsapp_dedupe.
 *   - Only the single message object is stored as raw_payload, not the
 *     whole Meta envelope.
 *
 * WHERE USED / FUTURE USES
 *   routes/whatsapp.routes.js. Later: AI replies via sendWhatsApp,
 *   status updates (delivered/read), media download.
 *
 * TRADEOFFS
 *   + Simple, correct on retries, no queue needed yet.
 *   - Messages are processed inside the request. A slow step would delay
 *     the 200 answer. Move to a worker/queue later (BullMQ).
 *
 * HOW TO USE
 *   router.get('/',  asyncHandler(handleVerify));
 *   router.post('/', resolveWhatsappTenant, withTenant, handleInbound);
 *
 * AI AUDIT NOTE
 *   Webhook boilerplate (allowed for AI). The tenant resolution it relies
 *   on is in middleware/resolveWhatsappTenant.js (AI-written at Sheryl's
 *   request, declared in apps/api/docs/AI_AUDIT_week_29_day2.md).
 * ============================================================
 */

// pool: the plain database connection. We use it in ONE place only: the
// verify handshake, where no shop is known yet (see handleVerify).
// Real life: the front-desk phone, used before we know which room the guest is in.
import { pool } from '../db/pool.js';

// The longest text we keep (WhatsApp's own limit is 4096 characters).
const MAX_TEXT = 4096;

// The only shape of challenge we are willing to echo back:
// letters, digits, "-" and "_", 1 to 200 characters. Meta's real challenge
// is a plain number, so this never blocks Meta.
const SAFE_CHALLENGE = /^[A-Za-z0-9_-]{1,200}$/;

// ── GET: Meta's verify challenge ─────────────────────────────
// WHEN: once, when a shop connects its webhook in the Meta dashboard.
// Meta sends:  hub.mode=subscribe, hub.verify_token=<the shop's secret>,
//              hub.challenge=<random number>
// We answer with the challenge ONLY if the token is one of ours.
// Real life: a courier phones and says "I have a parcel, what is the code
// word?". If the code word is right, you repeat the number on the parcel.
// That proves this really is your address.
async function handleVerify(req, res) {
  // Express keeps the dots in the names, so the keys are literally 'hub.mode'.
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // All four conditions must hold: right mode, a real token string,
  // and a safe-looking challenge. typeof checks stop arrays/objects
  // (?hub.mode[]=x) from slipping through.
  if (
    mode === 'subscribe' &&
    typeof token === 'string' && token.length > 0 &&
    typeof challenge === 'string' && SAFE_CHALLENGE.test(challenge)
  ) {
    // Does any shop own this verify token? ($1 is a safe slot.)
    // We select "1", never the token column.
    const { rows } = await pool.query(
      'SELECT 1 FROM whatsapp_configs WHERE webhook_verify_token = $1',
      [token]
    );
    if (rows[0]) {
      // Plain text, exactly the challenge. Meta wants nothing more.
      return res.status(200).type('text/plain').send(challenge);
    }
  }
  // Wrong mode, wrong token, or odd challenge: refuse and reveal nothing.
  return res.status(403).json({
    data: null,
    error: { code: 'forbidden', message: 'Verification failed' },
  });
}

// ── helper: the text of one message ──────────────────────────
// Text messages give us their words. Everything else (image, audio,
// location...) becomes a label like "[image]", so the shop owner can see
// that something arrived, and nothing is silently lost.
function messageText(msg) {
  const text = msg?.text?.body;
  if (typeof text === 'string' && text.length > 0) return text.slice(0, MAX_TEXT);
  return `[${typeof msg?.type === 'string' ? msg.type : 'unknown'}]`;
}

// ── POST: incoming messages ──────────────────────────────────
// WHEN: every time a customer messages ANY shop's WhatsApp number.
// Before this runs: resolveWhatsappTenant set req.tenantId, and
// withTenant locked req.db to that shop.
async function handleInbound(req, res, next) {
  const db = req.db;             // the connection locked to ONE shop
  const tenantId = req.tenantId; // that shop's id
  let received = 0;              // new messages saved (for the answer)
  let duplicates = 0;            // repeats we skipped (for the answer)

  try {
    // Start ONE transaction around everything below.
    // Real life: a bank transfer. Either both the debit and the credit
    // happen, or neither does.
    await db.query('BEGIN');

    // Meta's payload is nested: entry -> changes -> value -> messages.
    // "?? []" means "if it is missing, treat it as an empty list", so a
    // strange payload never crashes us.
    for (const entry of req.body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        // The customer's WhatsApp display name, if Meta sent it.
        const profileName = value.contacts?.[0]?.profile?.name ?? null;

        // Status updates (delivered, read) have no "messages" list, so the
        // loop below simply does nothing for them.
        for (const msg of value.messages ?? []) {
          const messageId = msg?.id;     // Meta's unique id: "wamid.XXXX"
          const from = msg?.from;        // the customer's number
          // Skip anything that is not shaped like a real message.
          if (typeof messageId !== 'string' || typeof from !== 'string') continue;

          // 1. DEDUPE FIRST.
          // Try to write "this shop has seen this message id". If the row
          // already exists, ON CONFLICT DO NOTHING inserts nothing and
          // rowCount is 0. That means we handled this message before.
          // The primary key is (tenant_id, message_id), so two different
          // shops can never block each other.
          // Real life: the stamp on a delivered parcel. A second delivery
          // attempt sees the stamp and goes home.
          const fresh = await db.query(
            `INSERT INTO whatsapp_dedupe (tenant_id, message_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [tenantId, messageId]
          );
          if (fresh.rowCount === 0) { duplicates += 1; continue; }

          // 2. THE CUSTOMER (one row per phone number per shop).
          // First time: create. Next times: keep the old name if we have
          // one (COALESCE), and just touch updated_at.
          const cust = await db.query(
            `INSERT INTO customers (tenant_id, phone, name, channel)
             VALUES ($1, $2, $3, 'whatsapp')
             ON CONFLICT (tenant_id, phone)
             DO UPDATE SET name = COALESCE(customers.name, EXCLUDED.name),
                           updated_at = NOW()
             RETURNING id`,
            [tenantId, from, profileName]
          );
          const customerId = cust.rows[0].id;

          // 3. THE CONVERSATION. Find this customer's open WhatsApp chat.
          // There is no "WHERE tenant_id": the RLS lock already limits us
          // to this shop. If there is no open chat, start one.
          let conv = await db.query(
            `SELECT id FROM conversations
              WHERE customer_id = $1 AND channel = 'whatsapp' AND status = 'open'
              ORDER BY created_at DESC LIMIT 1`,
            [customerId]
          );
          if (!conv.rows[0]) {
            conv = await db.query(
              `INSERT INTO conversations (tenant_id, customer_id, channel)
               VALUES ($1, $2, 'whatsapp') RETURNING id`,
              [tenantId, customerId]
            );
          }
          const conversationId = conv.rows[0].id;

          // 4. THE MESSAGE. Saved as "inbound" from the "customer".
          // channel_message_id is Meta's id (a second dedupe safety net,
          // via the unique index on messages). raw_payload keeps just this
          // one message object for audit, not the whole envelope.
          await db.query(
            `INSERT INTO messages
               (tenant_id, conversation_id, direction, body, sender,
                channel_message_id, raw_payload)
             VALUES ($1, $2, 'inbound', $3, 'customer', $4, $5)`,
            [tenantId, conversationId, messageText(msg), messageId, JSON.stringify(msg)]
          );
          // Move this chat to the top of the shop's inbox.
          await db.query(
            'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
            [conversationId]
          );

          received += 1;
        }
      }
    }

    // Everything worked: make it permanent, then tell Meta "got it" (200).
    await db.query('COMMIT');
    return res.status(200).json({ data: { received, duplicates }, error: null });
  } catch (err) {
    // Something failed: undo EVERYTHING, including the dedupe rows.
    // That is what lets Meta's retry be processed instead of skipped.
    // The inner try/catch is for the rare case where the connection is
    // already gone and ROLLBACK itself fails.
    try { await db.query('ROLLBACK'); } catch { /* connection already gone */ }
    // Hand the error to Express's error handler, which answers 500.
    // Meta sees a failure and retries later.
    return next(err);
  }
}

export { handleVerify, handleInbound };