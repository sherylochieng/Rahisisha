// =============================================================================
// FILE: apps/api/src/controllers/checkout.controller.js   (Week 30, customer checkout)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Until now only the shop OWNER (logged in) could create an order and start an
//   M-Pesa payment. A customer on the public shop page has no login. This file
//   is the customer's door. It has four small jobs:
//     1. createCheckout       POST  /v1/storefront/:slug/checkout
//        "Here is my name, my M-Pesa number and my basket." -> makes the order.
//     2. payCheckoutOrder     POST  /v1/storefront/:slug/orders/:orderId/pay
//        "Send the M-Pesa prompt to my phone." -> starts the payment.
//     3. getCheckoutOrder     GET   /v1/storefront/:slug/orders/:orderId
//        "Did my payment go through?" -> the status the waiting screen polls.
//     4. saveDeliveryNote     PATCH /v1/storefront/:slug/orders/:orderId/note
//        "Deliver to Kilimani, gate 3." -> allowed only AFTER payment.
//     5. checkCheckoutPayment POST  /v1/storefront/:slug/orders/:orderId/check-payment
//        "I have paid, check my payment." -> asks SAFARICOM what really
//        happened to a payment that is stuck on 'pending' and records the
//        answer. (Week 30 fix: a paid-but-unrecorded payment, and a second
//        charge, were found in real testing.)
//
// WHY IMPORTANT
//   This is where a stranger's tap becomes real money in the shop's till. Every
//   rule here protects either the customer (no wrong charge) or the shop (no
//   fake or free orders).
//
// DANGER
//   1. NEVER take a price or a total from the request. Prices are read from the
//      products table, here, on the server. A customer who edits the page cannot
//      make a KES 1,500 dress cost KES 15.
//   2. Only ACTIVE, not-deleted products can be bought (draft or archived
//      products must not be sellable through the public door).
//   3. The order id is the customer's ticket: a long random code that cannot be
//      guessed. Anyone WITH it can see that one order, so the status answer must
//      never contain the phone number, the shop's other orders or any secret.
//   4. A public Pay button can be abused to make a stranger's phone buzz with
//      M-Pesa prompts. We limit prompts per phone number (MAX_PROMPTS_PER_PHONE
//      in PROMPT_WINDOW_MINUTES).
//   5. Never log the phone, the amount or Safaricom's reply. This file has no
//      console calls on purpose.
//   6. This file never decides that something is paid. Only two things may
//      mark an order paid: the verified M-Pesa callback, and the reconcile
//      service, which asks SAFARICOM itself (never the customer's browser).
//      The check-payment job here only CALLS the reconcile service.
//   7. The check-payment route talks to Safaricom, so it is rate limited
//      (one check per order every 5 seconds) to protect the shop's M-Pesa
//      account from a customer who keeps pressing the button.
//
// WHAT IT SOLVES
//   A Shopify-style guest checkout that is tailored to Kenya: no account, two
//   boxes (name, phone), pay with the M-Pesa prompt, delivery details afterwards.
//
// SYSTEM DESIGN PRINCIPLE
//   Reuse, do not copy money code. Starting the payment is done by the existing,
//   already-tested payOrder() in payments.controller.js (write-ahead record,
//   one prompt at a time, amount from the order). This file only adds the
//   public rules around it.
//   Also: a "capability" link. The unguessable order id is the permission.
//
// RULES
//   1. Reply in the usual envelope: { data, error } (errors carry a code).
//   2. 400 validation / 404 not found (also for a wrong id shape) / 409 wrong
//      state / 429 too many prompts / 201 created / 202 payment started.
//   3. Phone numbers are stored in one shape: 2547XXXXXXXX (normalizePhone).
//   4. Money is whole cents; a checkout must total at least KES 1.
//   5. All database work uses req.db (the shop lock), never pool.query.
//
// PRACTICAL EXAMPLE
//   Amina opens brio-hardware, adds a soda (KES 80) and a dress (KES 1,500).
//     POST /checkout { name:"Amina", phone:"0712345678",
//                      items:[{productId:"<soda>",quantity:1},{productId:"<dress>",quantity:1}] }
//     -> 201 { data: { orderId, totalCents:158000, items:[...] } }
//     POST /orders/<orderId>/pay        -> 202 (prompt appears on her phone)
//     GET  /orders/<orderId> (every 2s) -> payment.status "pending" ... "paid"
//     PATCH /orders/<orderId>/note { note:"Kilimani, gate 3" } -> saved
//
// DECISIONS
//   - Two calls (create, then pay) so "Try again" repeats only the pay call and
//     the basket and details are kept.
//   - Delivery details come AFTER payment (the customer's idea): pay first, no
//     time to hesitate.
//   - The status answer turns Safaricom's codes into a few short reasons
//     (cancelled, wrong_pin, insufficient_funds, timeout, failed). Raw
//     Safaricom text never reaches the customer.
//   - No stock check yet (products have no stock number today).
//   - (Week 30) The status answer shows the PAID attempt if there is one, even
//     when a newer attempt exists. Otherwise a customer who paid, then tapped
//     "send again", would see the newer 'pending' attempt instead of their
//     receipt.
//   - (Week 30) The check-payment answer is the SAME shape as the status
//     answer, so the web page needs no new code to read it.
//   - The 5-second spacing is kept in memory (one Map). It resets when the
//     server restarts and is per server instance. That is enough to stop button
//     mashing; a shared limiter (Redis) is future work.
//
// WHERE USED
//   apps/api/src/routes/storefront.routes.js (mounted under /v1/storefront/:slug,
//   behind resolveShopBySlug + withTenant, so req.db and req.tenantId are set)
//
// TRADEOFFS
//   + Small, reuses tested money code, no database change needed.
//   - A customer who taps Pay and walks away leaves an unpaid 'created' order.
//     Harmless, but a clean-up job for old unpaid orders is future work.
//   - The per-phone limit is counted inside ONE shop (the shop lock hides other
//     shops' rows). A global limit across shops needs a different place.
//   - There is no per-IP limit yet.
//
// HOW TO USE
//   curl.exe -X POST http://localhost:3000/v1/storefront/<slug>/checkout `
//     -H "Content-Type: application/json" `
//     -d '{"name":"Amina","phone":"0712345678","items":[{"productId":"<id>","quantity":1}]}'
// =============================================================================

// PIECE BY PIECE
//
// 1. imports
//    z (Zod)        = the form checker. normalizePhone = turns 0712..., 712...,
//    +254712... into 254712.... payOrder = the existing "start the M-Pesa
//    prompt" function, reused as it is.
//
// 2. CheckoutBody (the Zod shape)
//    = the rules for what the customer may send: a name of 1 to 80 letters, a
//    phone, and 1 to 30 basket lines each with a product id and a quantity from
//    1 to 50. Real life: the order slip has fixed boxes, and anything outside
//    the boxes is not read.
//
// 3. isUuid / notFound
//    = "does this look like a real order ticket?" A made-up id gets the same
//    plain "not found" as an unknown one, so nobody learns anything by guessing.
//
// 4. createCheckout, step by step
//    a. check the form, and the phone (invalid -> 400 with a friendly note).
//    b. merge repeated lines (the same product twice becomes one line).
//    c. BEGIN: everything below is saved together or not at all.
//    d. upsert the customer: "find this phone in this shop's customer book, or
//       add it". Real life: mama mboga's debt notebook, one page per customer.
//    e. fetch ONLY active products of this shop; if any is missing or not on
//       sale, stop (404 items_unavailable). Real life: "sorry, that one just
//       finished".
//    f. total = sum of price x quantity, worked out here.
//    g. insert the order (channel 'web') and one order_item per line, copying
//       the name and price at purchase time, so a later price change never
//       rewrites history.
//    h. COMMIT, answer 201 with the order id and what was bought.
//
// 5. payCheckoutOrder
//    a. find the order; unknown -> 404.
//    b. work out which phone the prompt goes to (the body's, else the
//       customer's) and refuse after MAX_PROMPTS_PER_PHONE in the window (429).
//       Real life: the shop agrees not to ring the same number ten times.
//    c. hand over to payOrder with a tiny stand-in request (it only reads the
//       database client, the shop id, the order id and the phone).
//
// 6. getCheckoutOrder
//    = the waiting screen's question, "so, did I pay?". We read the order and
//    its MOST RECENT payment attempt and answer with status, total, items,
//    receipt code, and a short reason if it failed. toReason() is the
//    translator from Safaricom's numbers to our few kind words. The answer is
//    marked no-store so a phone never shows an old answer.
//
// 7. saveDeliveryNote
//    = only after payment (status 'paid' or 'packed'), at most 300 characters.
//    Real life: you tell the delivery boy where to go AFTER the money is in.
//
// 8. fail()
//    = one helper that sends { data: null, error: { code, message } } so every
//    failure looks the same.
//
// 9. loadOrderStatus (Week 30)
//    = the "read the order and its payment" question, now in ONE place, used by
//    both the status route and the check-payment route. It prefers the PAID
//    attempt over a newer one.
//
// 10. checkCheckoutPayment (Week 30)
//    a. unknown / made-up ticket -> the same plain 404.
//    b. too soon (under 5 seconds since the last check of this order) -> 429.
//       Real life: the shopkeeper will phone Safaricom, but not every second.
//    c. reconcileOrder: ask Safaricom about every pending attempt and record the
//       answer (paid, failed, or "not sure yet = change nothing").
//    d. answer with the fresh status (same shape as the status route).
//    The customer is told one of three things: it was paid (green screen), it
//    failed (kind reason, and only now may they try again), or Safaricom is
//    still processing (wait and check again).

// ── IMPORTS ──────────────────────────────────────────────────────────────────

// z = Zod, our "form checker". It reads what the customer sent and says whether
// it fits the rules (a name, a phone, a basket). Real life: the clerk who checks
// that an order slip is filled in properly before it goes to the kitchen.
import { z } from 'zod';

// normalizePhone turns "0712 345 678", "712345678" and "+254712345678" into one
// shape: 254712345678. Real life: writing every customer's number in the debt
// notebook the same way, so the same person is never listed twice.
import { normalizePhone } from '../services/daraja.service.js';

// payOrder = the code that already sends the M-Pesa prompt for the shop owner.
// We REUSE it instead of copying it, so the money rules live in one place.
import { payOrder } from './payments.controller.js';

// (Week 30) reconcileOrder = asks Safaricom what really happened to payments
// stuck on 'pending' and records the answer safely.
import { reconcileOrder } from '../services/reconcile.service.js';

// ── SETTINGS ─────────────────────────────────────────────────────────────────

// The limit on prompts to ONE phone number: at most 3 in 10 minutes.
// Real life: the shop agrees not to ring the same customer ten times in a row.
const MAX_PROMPTS_PER_PHONE = 3;
const PROMPT_WINDOW_MINUTES = 10;

// (Week 30) The check-payment button talks to Safaricom, so one order may be
// checked at most once every 5 seconds. Real life: the shopkeeper will phone
// Safaricom for you, but not every second.
const MIN_SECONDS_BETWEEN_CHECKS = 5;

// Remembers when each order was last checked (shop id + order id -> time).
// Kept in memory on purpose (see TRADEOFFS). Old entries are swept so it never
// grows without limit.
const lastCheckAt = new Map();

// What a real order id looks like (8-4-4-4-12 letters and numbers).
// Anything that does not look like this is "not found" straight away.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A tiny yes/no question: "does this text look like a real ticket number?"
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// ── THE FORM RULES ───────────────────────────────────────────────────────────

// CheckoutBody = what the customer is allowed to send when they tap Pay.
// Real life: the printed order slip has only these boxes; anything written
// outside the boxes is ignored.
const CheckoutBody = z.object({
  // name: 1 to 80 characters, spaces at the ends removed
  name: z.string().trim().min(1).max(80),

  // phone: just text here; the real Kenyan-number check is done by normalizePhone
  phone: z.string().trim().min(1).max(20),

  // items: the basket. 1 to 30 lines. Each line = which product + how many.
  items: z
    .array(
      z.object({
        // productId must look like a real id (we never trust a name or a price)
        productId: z.string().uuid(),
        // quantity: a whole number from 1 to 50 (no 0, no -3, no 2.5)
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1)
    .max(30),
});

// NoteBody = the delivery note: 1 to 300 characters of text.
const NoteBody = z.object({
  note: z.string().trim().min(1).max(300),
});

// ── SMALL HELPERS ────────────────────────────────────────────────────────────

// fail() sends every error in the SAME shape: { data: null, error: { code, message } }.
// Real life: one standard "sorry" card, so the website always knows how to read it.
function fail(res, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details; // details = which box was wrong
  return res.status(status).json({ data: null, error });
}

// notFound() = the one answer for "no such order". We use the SAME answer for a
// made-up id and for a real-looking but unknown id, so a guesser learns nothing.
const notFound = (res) => fail(res, 404, 'not_found', 'Order not found');

// toReason() turns Safaricom's number codes into a few kind words for the
// customer. Real life: the till operator says "you cancelled it" or "wrong PIN"
// instead of reading out a code from the bank's manual.
function toReason(resultCode, resultDesc) {
  const code = Number(resultCode);
  if (code === 1032) return 'cancelled';           // customer pressed cancel
  if (code === 2001) return 'wrong_pin';           // wrong M-Pesa PIN
  if (code === 1) return 'insufficient_funds';     // not enough money
  if (code === 1037) return 'timeout';             // never answered the prompt
  // Our own short codes (like daraja_not_configured) are not for the customer.
  void resultDesc;
  return 'failed';
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 1: CREATE THE ORDER   (POST /v1/storefront/:slug/checkout)
// Real life: the customer hands the shopkeeper the basket; the shopkeeper writes
// the order in the book. No money moves yet.
// ═════════════════════════════════════════════════════════════════════════════
export async function createCheckout(req, res) {
  // STEP 1: check the form. safeParse never crashes; it says yes or no.
  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    // Build { "phone": "message", "items.0.quantity": "message" } for the website
    const details = {};
    for (const issue of parsed.error.issues) details[issue.path.join('.')] = issue.message;
    return fail(res, 400, 'validation', 'Please check your details and try again', details);
  }
  const { name, items } = parsed.data;

  // STEP 1b: the phone. normalizePhone throws if it is not a Kenyan mobile.
  let phone;
  try {
    phone = normalizePhone(parsed.data.phone);
  } catch {
    // We stop BEFORE any money or order exists, with words the customer can fix.
    return fail(res, 400, 'validation', 'Enter a valid M-Pesa number like 0712345678', {
      phone: 'Enter a valid M-Pesa number like 0712345678',
    });
  }

  // STEP 2: if the same product appears twice, add the quantities together.
  // Real life: "2 sodas" and "1 soda" on the slip become "3 sodas".
  const wanted = new Map();
  for (const it of items) {
    wanted.set(it.productId, (wanted.get(it.productId) || 0) + it.quantity);
  }
  // After adding, one line must still be at most 50.
  for (const qty of wanted.values()) {
    if (qty > 50) {
      return fail(res, 400, 'validation', 'You can buy at most 50 of one item at a time');
    }
  }
  const productIds = [...wanted.keys()];

  // req.db = the database connection already LOCKED to this one shop
  // (by resolveShopBySlug + withTenant). It can only see this shop's rows.
  const db = req.db;
  try {
    // BEGIN = "start a bundle". Nothing below is saved until COMMIT.
    // If anything fails we ROLLBACK and it is as if nothing happened.
    await db.query('BEGIN');

    // STEP 3: find this customer in the shop's customer book, or add them.
    // ON CONFLICT = "if this phone is already in the book, just update it".
    // Real life: Amina already has a page in the notebook; we do not make a second.
    const { rows: custRows } = await db.query(
      `INSERT INTO customers (tenant_id, phone, name, channel)
       VALUES ($1, $2, $3, 'web')
       ON CONFLICT (tenant_id, phone)
       DO UPDATE SET name = COALESCE(EXCLUDED.name, customers.name), updated_at = NOW()
       RETURNING id`,
      [req.tenantId, phone, name]
    );
    const customerId = custRows[0].id;

    // STEP 4: read the products FROM THE DATABASE, never from the customer.
    // Only 'active' (on sale) and not deleted ones can be bought.
    // Real life: the shopkeeper looks at the shelf tag for the price.
    const { rows: products } = await db.query(
      `SELECT id, name, price_cents
         FROM products
        WHERE id = ANY($1) AND status = 'active' AND deleted_at IS NULL`,
      [productIds]
    );
    // If even one product is missing or not on sale, stop the whole order.
    if (products.length !== productIds.length) {
      await db.query('ROLLBACK');
      return fail(res, 404, 'items_unavailable',
        'One or more items are no longer available. Please refresh the shop page');
    }
    // A lookup table: { productId: product } so we can find each one quickly.
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));

    // STEP 5: work out the total HERE. Money is whole cents (KES 80 = 8000).
    // If the customer's phone said "total: 5", it would be ignored; we do not read it.
    let totalCents = 0;
    for (const [productId, qty] of wanted) totalCents += byId[productId].price_cents * qty;
    // M-Pesa cannot take less than KES 1 (100 cents).
    if (!Number.isInteger(totalCents) || totalCents < 100) {
      await db.query('ROLLBACK');
      return fail(res, 400, 'validation', 'The order total must be at least KES 1');
    }

    // STEP 6a: the order itself. Status starts at 'created' (not paid yet).
    // channel 'web' = it came from the shop page.
    const { rows: orderRows } = await db.query(
      `INSERT INTO orders (tenant_id, customer_id, total_cents, channel, status)
       VALUES ($1, $2, $3, 'web', 'created')
       RETURNING id, total_cents`,
      [req.tenantId, customerId, totalCents]
    );
    const order = orderRows[0];

    // STEP 6b: one line per product. We COPY the name and price into the line.
    // Real life: the receipt keeps the price of the day, even if you change the
    // price tomorrow.
    const lines = [];
    for (const [productId, qty] of wanted) {
      const p = byId[productId];
      await db.query(
        `INSERT INTO order_items (tenant_id, order_id, product_name, unit_price_cents, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.tenantId, order.id, p.name, p.price_cents, qty]
      );
      lines.push({ name: p.name, quantity: qty, unitPriceCents: p.price_cents });
    }

    // COMMIT = "save the whole bundle".
    await db.query('COMMIT');

    // 201 = Created. We return the order id: the customer's ticket for the next steps.
    return res.status(201).json({
      data: { orderId: order.id, totalCents: Number(order.total_cents), items: lines },
      error: null,
    });
  } catch (err) {
    // Something unexpected broke: undo the bundle, then let the central error
    // handler answer. .catch(() => {}) so a failed ROLLBACK cannot hide the real error.
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 2: START THE M-PESA PROMPT   (POST /v1/storefront/:slug/orders/:orderId/pay)
// Real life: the shopkeeper says "I'm sending the payment request to your phone now".
// ═════════════════════════════════════════════════════════════════════════════
export async function payCheckoutOrder(req, res) {
  const { orderId } = req.params;

  // A made-up id shape gets the plain "not found" answer.
  if (!isUuid(orderId)) return notFound(res);

  // Find the order and the customer's saved phone. Because req.db is locked to
  // this shop, another shop's order id simply finds nothing.
  const { rows } = await req.db.query(
    `SELECT o.id, o.status, c.phone AS customer_phone
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1`,
    [orderId]
  );
  if (!rows[0]) return notFound(res);

  // (Week 30) An order that is not open cannot be paid. Say so in plain words
  // for a paid order (the customer may have paid and not seen the receipt).
  if (rows[0].status !== 'created') {
    return fail(res, 409, 'order_not_payable',
      rows[0].status === 'paid'
        ? 'This order is already paid. No second payment is needed'
        : 'This order can no longer be paid');
  }

  // Which phone gets the prompt? The one typed just now, otherwise the one saved
  // on the order. Real life: Amina can pay from her sister's number if she wants.
  let phone;
  try {
    phone = normalizePhone(req.body?.phone ?? rows[0].customer_phone);
  } catch {
    return fail(res, 400, 'validation', 'Enter a valid M-Pesa number like 0712345678');
  }

  // THE ANTI-ANNOYANCE LIMIT: count prompts to this number in the last 10 minutes.
  // make_interval(mins => $2) = "$2 minutes" safely, without building text by hand.
  const { rows: counted } = await req.db.query(
    `SELECT count(*)::int AS n
       FROM payment_attempts
      WHERE phone = $1 AND created_at > NOW() - make_interval(mins => $2)`,
    [phone, PROMPT_WINDOW_MINUTES]
  );
  if (counted[0].n >= MAX_PROMPTS_PER_PHONE) {
    // 429 = "Too many requests"
    return fail(res, 429, 'too_many_attempts',
      'Too many payment tries for this number. Please wait a few minutes and try again');
  }

  // Hand over to the existing, tested money code. payOrder only needs four
  // things from the request, so we give it a small stand-in with exactly those:
  // the database connection, the shop id, the order id, and the phone.
  // It reads the amount from the ORDER (never from us), writes the "pending"
  // record BEFORE calling Safaricom, and answers 202 itself.
  return payOrder(
    { db: req.db, tenantId: req.tenantId, params: { id: orderId }, body: { phone } },
    res
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED PIECE: READ THE ORDER AND ITS PAYMENT (used by jobs 3 and 5)
// Returns the answer the waiting screen needs, or null if there is no such order.
// ═════════════════════════════════════════════════════════════════════════════
async function loadOrderStatus(db, orderId) {
  // The order: its status, its total and any delivery note.
  const { rows } = await db.query(
    `SELECT id, status, total_cents, note FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return null;

  // What was bought (the receipt lines), in the order they were added.
  const { rows: items } = await db.query(
    `SELECT product_name, unit_price_cents, quantity
       FROM order_items WHERE order_id = $1 ORDER BY created_at, id`,
    [orderId]
  );

  // The payment try to show. (Week 30) A PAID attempt always wins, even if a
  // newer attempt exists. Otherwise a customer who paid, then tapped "send
  // again", would see the newer 'pending' try instead of their receipt.
  // Among the rest, the most recent one is shown.
  const { rows: attempts } = await db.query(
    `SELECT status, mpesa_reference, result_code, result_desc
       FROM payment_attempts
      WHERE order_id = $1
      ORDER BY (status = 'paid') DESC, created_at DESC, id DESC
      LIMIT 1`,
    [orderId]
  );
  const a = attempts[0];

  // Shape the payment part: status is pending / paid / failed / none (not tried yet).
  // receipt (the M-Pesa code) only when paid, and only if we have one (a payment
  // settled by asking Safaricom has no receipt code). reason (kind words) only
  // when failed.
  const payment = a
    ? {
        status: a.status,
        receipt: a.status === 'paid' ? a.mpesa_reference : null,
        reason: a.status === 'failed' ? toReason(a.result_code, a.result_desc) : null,
      }
    : { status: 'none', receipt: null, reason: null };

  return {
    orderId: order.id,
    orderStatus: order.status,
    totalCents: Number(order.total_cents),
    items: items.map((i) => ({
      name: i.product_name,
      quantity: i.quantity,
      unitPriceCents: i.unit_price_cents,
    })),
    payment,
    deliveryNote: order.note,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 3: "DID MY PAYMENT GO THROUGH?"   (GET /v1/storefront/:slug/orders/:orderId)
// The waiting screen asks this every couple of seconds.
// Real life: the customer at the counter asks "has it come through yet?"
// ═════════════════════════════════════════════════════════════════════════════
export async function getCheckoutOrder(req, res) {
  const { orderId } = req.params;
  if (!isUuid(orderId)) return notFound(res);

  const data = await loadOrderStatus(req.db, orderId);
  if (!data) return notFound(res);

  // no-store = "do not keep an old copy of this answer", so the waiting screen
  // never shows yesterday's "pending". The phone number is deliberately NOT here.
  res.set('Cache-Control', 'no-store');
  return res.json({ data, error: null });
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 5: "I HAVE PAID, CHECK MY PAYMENT"
//        (POST /v1/storefront/:slug/orders/:orderId/check-payment)
// Real life: you say "I entered my PIN but nothing happened". The shopkeeper
// phones Safaricom, finds out what really happened, writes it in the book and
// tells you. She does NOT ring your phone again until she knows.
// ═════════════════════════════════════════════════════════════════════════════
export async function checkCheckoutPayment(req, res) {
  const { orderId } = req.params;
  if (!isUuid(orderId)) return notFound(res);

  // Make sure the order exists in THIS shop (another shop's id finds nothing)
  // BEFORE we spend a Safaricom call or remember anything about the id.
  const { rows } = await req.db.query('SELECT 1 FROM orders WHERE id = $1', [orderId]);
  if (!rows[0]) return notFound(res);

  // Not more than one check per order every few seconds.
  const key = `${req.tenantId}:${orderId}`;
  const now = Date.now();
  const last = lastCheckAt.get(key);
  if (last && now - last < MIN_SECONDS_BETWEEN_CHECKS * 1000) {
    return fail(res, 429, 'too_soon',
      'Please wait a few seconds before checking again');
  }
  lastCheckAt.set(key, now);
  // Sweep old entries now and then so the Map never grows without limit.
  if (lastCheckAt.size > 2000) {
    for (const [k, at] of lastCheckAt) {
      if (now - at > MIN_SECONDS_BETWEEN_CHECKS * 1000) lastCheckAt.delete(k);
    }
  }

  // Ask Safaricom about every payment of this order that is stuck on pending,
  // and record what it says. (Safe to repeat: see reconcile.service.js.)
  await reconcileOrder(req.db, orderId);

  // Answer with the fresh status (the same shape as the status route). If the
  // payment is still 'pending' afterwards, Safaricom has not decided yet, and
  // the screen says "still checking, wait a moment".
  const data = await loadOrderStatus(req.db, orderId);
  res.set('Cache-Control', 'no-store');
  return res.json({ data, error: null });
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 4: DELIVERY NOTE, ONLY AFTER PAYMENT   (PATCH /v1/storefront/:slug/orders/:orderId/note)
// Real life: once the money is in, the customer tells the rider where to go.
// ═════════════════════════════════════════════════════════════════════════════
export async function saveDeliveryNote(req, res) {
  const { orderId } = req.params;
  if (!isUuid(orderId)) return notFound(res);

  // Check the note: 1 to 300 characters.
  const parsed = NoteBody.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'validation', 'Write a short delivery note (up to 300 characters)', {
      note: 'Write a short delivery note (up to 300 characters)',
    });
  }

  // ONE statement does the check AND the save: update only if the order is
  // 'paid' or 'packed'. An unpaid order matches nothing, so nothing is saved.
  const { rows } = await req.db.query(
    `UPDATE orders
        SET note = $2, updated_at = NOW()
      WHERE id = $1 AND status IN ('paid', 'packed')
      RETURNING id`,
    [orderId, parsed.data.note]
  );
  if (rows[0]) return res.json({ data: { saved: true }, error: null });

  // Nothing was updated. Was it a wrong id, or an order that is not paid yet?
  const { rows: exists } = await req.db.query(`SELECT 1 FROM orders WHERE id = $1`, [orderId]);
  if (!exists[0]) return notFound(res);
  // 409 = "conflict with the order's current state"
  return fail(res, 409, 'order_not_paid',
    'You can add a delivery note once the payment is complete');
}