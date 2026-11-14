/**
 * ============================================================
 * FILE: apps/api/src/controllers/payments.controller.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   The pay route: POST /v1/orders/:id/pay. It takes one order,
 *   writes down "we asked this customer to pay", and fires the
 *   M-Pesa STK push for the current shop.
 *
 * WHY IMPORTANT
 *   This is where money STARTS. It must charge the right amount (the
 *   order's own total, never a number from the request), to the right
 *   shop's till, and leave a written record BEFORE anything is sent,
 *   so a payment can never exist without a paper trail.
 *
 * DANGER
 *   - NEVER read the amount from req.body. The total comes from the
 *     orders table only. If a caller could send the amount, a customer
 *     could pay KES 1 for a KES 5,000 order.
 *   - NEVER log the phone, the amount, the keys or the Daraja reply.
 *     This file has NO console calls on purpose. Keep it that way.
 *   - This route does NOT mark anything paid and does NOT touch the
 *     wallet. It only STARTS a payment. Only the verified callback
 *     (Task 3) is allowed to say "paid" and credit the wallet.
 *   - Every INSERT carries tenant_id from req.tenantId (key pattern 7).
 *
 * WHAT IT SOLVES
 *   Day 3, Task 2: "Look up the order amount, look up the tenant's
 *   config, get a token, call STK push, insert a payment_attempts row
 *   with status pending, return 202".
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Write-ahead record. We insert the pending attempt FIRST, then call
 *   Safaricom, then fill in Safaricom's ids. If the call fails we mark
 *   the attempt failed. A payment prompt can never go out without a row
 *   that proves we sent it.
 *
 * RULES
 *   1. The amount = orders.total_cents. Nothing else.
 *   2. Only an order in status 'created' can be paid (else 409).
 *   3. Validate the phone and amount BEFORE writing any row.
 *   4. One prompt at a time per order: a pending attempt younger than
 *      2 minutes blocks a second tap (409), so a double tap does not
 *      send the customer two prompts.
 *   5. Reply 202 Accepted: the payment is only STARTED, not finished.
 *   6. All database work uses req.db (the shop lock), never pool.
 *
 * PRACTICAL EXAMPLE
 *   Amina taps Pay on order O1 (KES 1,500, customer 0712345678):
 *     POST /v1/orders/O1/pay          (body optional: { "phone": "0722..." })
 *   -> a pending row (amount 150000) is written,
 *      the customer's phone shows the M-Pesa PIN prompt,
 *      the reply is 202 { data: { paymentAttemptId, status: 'pending' } }.
 *   When the customer enters the PIN, Safaricom calls our callback.
 *
 * DECISIONS (and WHY)
 *   - The phone defaults to the order's customer phone. The body may
 *     override it (a customer paying from a different number).
 *   - AccountReference is 'ORD-' plus the first 8 characters of the
 *     order id: 12 characters, Daraja's limit. It is only for the
 *     customer's statement; matching uses checkout_request_id.
 *   - Provider errors (Safaricom down or refusing) become 502, our own
 *     setup problem (no M-Pesa settings) becomes 409, bad input 400.
 *   - If the database update that saves Safaricom's ids ever fails after
 *     the prompt went out, the attempt stays 'pending' without a
 *     checkout id. The callback then cannot match it. That is exactly
 *     what the reconciliation job in reconciliation.md exists to find.
 *
 * WHERE USED / FUTURE USES
 *   - routes/orders.routes.js: router.post('/:id/pay', ...)
 *   - Later: a Pay button in the dashboard, pay from WhatsApp or USSD.
 *
 * TRADEOFFS
 *   + Simple and safe: one row, one prompt, one answer.
 *   - The write-ahead insert and the final update are separate
 *     statements, not one transaction, on purpose: the pending row must
 *     exist even if Safaricom is slow.
 *   - No retry endpoint: tap Pay again after 2 minutes.
 *
 * HOW TO USE
 *   curl.exe -X POST http://localhost:3000/v1/orders/<order id>/pay `
 *     -H "Cookie: <login cookie>" -H "Content-Type: application/json" `
 *     -d "{}"
 *
 * AI AUDIT NOTE
 *   Written by AI at Sheryl's request. It starts a money movement, so
 *   it is listed in the Day 3 money audit (AI_AUDIT.md) and every line
 *   must be re-read by Sheryl.
 * ============================================================
 */
import { stkPush, normalizePhone } from '../services/daraja.service.js';

// A pending attempt younger than this blocks a second tap (Rule 4).
const IN_PROGRESS_MINUTES = 2;

// fail response helpers: same envelope as the rest of the API.
function sendError(res, status, code, message) {
  return res.status(status).json({ data: null, error: { code, message } });
}

// -------------------------------------------------------------
// HANDLER: payOrder
// Route:   POST /v1/orders/:id/pay   (requireAuth + withTenant already ran)
// -------------------------------------------------------------
export async function payOrder(req, res) {
  // STEP 1: Find the order and its customer's phone.
  // req.db is locked to the shop, so another shop's order id simply finds
  // nothing (404). A malformed id makes Postgres throw 22P02, which the
  // central error handler turns into a 400.
  const { rows } = await req.db.query(
    `SELECT o.id, o.status, o.total_cents, c.phone AS customer_phone
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1`,
    [req.params.id]
  );
  const order = rows[0];
  if (!order) {
    return sendError(res, 404, 'not_found', 'Order not found');
  }

  // STEP 2: Only an unpaid, open order can be paid (Rule 2).
  if (order.status !== 'created') {
    return sendError(res, 409, 'order_not_payable',
      `Order is '${order.status}', only a 'created' order can be paid`);
  }

  // STEP 3: Check phone and amount BEFORE writing anything (Rule 3).
  // The amount is the order's own total (Rule 1). total_cents may arrive as
  // a string from some drivers, so make it a number first.
  const amountCents = Number(order.total_cents);
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents % 100 !== 0) {
    return sendError(res, 400, 'validation',
      'Order total must be whole shillings (at least KES 1) to pay with M-Pesa');
  }
  let phone;
  try {
    phone = normalizePhone(req.body?.phone ?? order.customer_phone);
  } catch {
    return sendError(res, 400, 'validation', 'A valid Kenyan mobile number is needed');
  }

  // STEP 4: One prompt at a time (Rule 4). A recent pending attempt means a
  // prompt is probably still on the customer's phone.
  const { rows: recent } = await req.db.query(
    `SELECT 1 FROM payment_attempts
      WHERE order_id = $1 AND status = 'pending'
        AND created_at > NOW() - make_interval(mins => $2)
      LIMIT 1`,
    [order.id, IN_PROGRESS_MINUTES]
  );
  if (recent.length > 0) {
    return sendError(res, 409, 'payment_in_progress',
      'A payment prompt was just sent for this order. Wait a moment, then try again');
  }

  // STEP 5: Write-ahead record. The attempt exists BEFORE the prompt goes
  // out. tenant_id comes from req.tenantId, never from the request body.
  const { rows: inserted } = await req.db.query(
    `INSERT INTO payment_attempts (tenant_id, order_id, amount_cents, phone)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [req.tenantId, order.id, amountCents, phone]
  );
  const attemptId = inserted[0].id;

  // STEP 6: Ask Safaricom to send the prompt.
  let pushed;
  try {
    pushed = await stkPush(req.db, {
      amountCents,
      phone,
      accountReference: `ORD-${order.id.replace(/-/g, '').slice(0, 8)}`,
    });
  } catch (err) {
    // The push did not go out. Record why (the short code only, never
    // Safaricom's text) so the owner and the reconciliation job can see it.
    await req.db.query(
      `UPDATE payment_attempts
          SET status = 'failed', result_desc = $2, updated_at = NOW()
        WHERE id = $1`,
      [attemptId, String(err.code || 'unknown')]
    );
    if (err.code === 'daraja_not_configured') {
      return sendError(res, 409, 'payments_not_set_up',
        'This shop has not set up M-Pesa yet');
    }
    if (err.code === 'invalid_phone' || err.code === 'amount_not_whole_shillings') {
      return sendError(res, 400, 'validation', 'The payment details are not valid');
    }
    // Safaricom refused, was unreachable, or rejected the shop's keys.
    return sendError(res, 502, 'payment_provider_error',
      'M-Pesa could not start the payment. Please try again shortly');
  }

  // STEP 7: Save Safaricom's ids on the attempt. checkout_request_id is the
  // key the callback will use to find this row (Task 3).
  await req.db.query(
    `UPDATE payment_attempts
        SET merchant_request_id = $2, checkout_request_id = $3, updated_at = NOW()
      WHERE id = $1`,
    [attemptId, pushed.merchantRequestId, pushed.checkoutRequestId]
  );

  // STEP 8: 202 Accepted = "started, not finished" (Rule 5). The customer
  // now enters their PIN; the callback finishes the job.
  return res.status(202).json({
    data: {
      paymentAttemptId: attemptId,
      status: 'pending',
      message: 'Check your phone and enter your M-Pesa PIN',
    },
    error: null,
  });
}