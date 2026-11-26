/**
 * ============================================================
 * FILE: apps/api/src/services/reconcile.service.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   One job: take a payment attempt that is still "pending", ASK SAFARICOM
 *   what really happened to it, and record the answer safely.
 *     paid      -> credit the shop's wallet and mark the order paid
 *     failed    -> mark the attempt failed (the customer can try again)
 *     unsure    -> change NOTHING (Safaricom is still processing, or down)
 *   It is used when the customer taps "I've paid, check my payment" and
 *   before the till ever sends a SECOND M-Pesa request for the same order.
 *
 * WHY IMPORTANT
 *   Safaricom's confirmation (the callback) can be late, lost, or can arrive
 *   at the moment Safaricom itself still says "processing". The attempt then
 *   stays "pending" for ever while the customer's money has really moved.
 *   Real case from our own testing: one payment was taken twice, because the
 *   first stayed "pending" and the till let a second request go out.
 *   This file is the safety net that closes that gap.
 *
 * DANGER
 *   1. THIS MOVES MONEY (it credits the wallet). Every line must be read by
 *      Sheryl. It is listed in the money audit (AI_AUDIT.md).
 *   2. The "paid" answer comes ONLY from Safaricom (queryStkStatus, using the
 *      shop's own keys). Never from the customer's browser, never from the
 *      request body.
 *   3. The amount credited is the amount WE asked for (payment_attempts
 *      .amount_cents). Safaricom's query answer has no amount, and an STK
 *      request can only ever be paid for the exact amount it was sent with.
 *   4. The shop lock (req.db with RLS) is what stops one shop touching another
 *      shop's attempt. This file never takes a tenant id from outside.
 *   5. NO console calls here, on purpose. Never log a phone, an amount, a
 *      checkout id or a key.
 *   6. A paid answer for an order that is already paid (the customer paid
 *      TWICE) is NEVER credited again. It is closed as "refund needed".
 *
 * WHAT IT SOLVES
 *   - Callback never recorded the payment (lost, late, or "still processing"
 *     at that moment).
 *   - A customer who paid and is staring at "Waiting..." can be told the truth.
 *   - A second M-Pesa request is never sent while the first might be paid.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Reconciliation: do not trust one message, verify with the source of truth.
 *   Idempotency: running it twice changes nothing the second time (the attempt
 *   is locked with FOR UPDATE and only a "pending" attempt is ever settled).
 *   One transaction: wallet credit, attempt and order change together or not at
 *   all.
 *
 * RULES
 *   1. Only attempts that are 'pending' are settled. Anything else is a no-op
 *      that just reports the attempt's current state.
 *   2. Ask Safaricom BEFORE opening the transaction, so a slow network call
 *      never holds a row lock.
 *   3. Lock the attempt, then the order (same order as the callback), to avoid
 *      two requests waiting on each other.
 *   4. Wallet credit reference = the checkout request id (we do not have the
 *      M-Pesa receipt: Safaricom's query does not carry it). The wallet's own
 *      unique rule makes a repeat harmless.
 *   5. If anything is unclear, answer 'unconfirmed' and change nothing.
 *
 * PRACTICAL EXAMPLE
 *   const outcome = await reconcileAttempt(req.db, {
 *     id: attempt.id, checkout_request_id: attempt.checkout_request_id });
 *   // 'paid' | 'failed' | 'refund_needed' | 'unconfirmed'
 *
 * DECISIONS
 *   - A reconciled payment has NO receipt code stored (mpesa_reference stays
 *     empty). The customer still has the code in their M-Pesa message. The
 *     owner can find it from the M-Pesa statement. Later we can fetch it with
 *     the Transaction Status API.
 *   - result_desc says HOW it was settled ('paid_confirmed_by_query'), so an
 *     auditor can tell a callback payment from a reconciled one.
 *   - A failed query answer gives no reason (cancelled, wrong PIN...), so the
 *     customer sees the generic "payment did not go through" message.
 *   - The duplicate case is closed as status 'failed' with result_desc
 *     'paid_but_order_not_open', the same wording the callback uses, so one
 *     future "refunds" screen can list both.
 *
 * WHERE USED
 *   - controllers/payments.controller.js (before a new prompt is allowed)
 *   - controllers/checkout.controller.js (the check-payment route)
 *   - Later: a scheduled job that sweeps old pending attempts.
 *
 * TRADEOFFS
 *   + Closes the "paid but not recorded" hole without trusting the browser.
 *   - One extra Safaricom call (login + query) per check.
 *   - No receipt code on reconciled payments, and no failure reason.
 *
 * HOW TO USE
 *   import { reconcileAttempt } from '../services/reconcile.service.js';
 *
 * AI AUDIT NOTE
 *   Written by AI at Sheryl's request. It credits a wallet, so it belongs in
 *   the money audit and every line must be re-read by Sheryl.
 * ============================================================
 *
 * PIECE BY PIECE (real life: the shopkeeper's phone call to the bank)
 *   reconcileAttempt   = the shopkeeper says "I do not see this payment in my
 *                        book. Let me phone Safaricom and ask what happened."
 *   queryStkStatus     = the phone call itself. The answer is "paid", "failed"
 *                        or "still working on it".
 *   'paid'             = she writes the money in the book, stamps the order
 *                        PAID, all in one go.
 *   'failed'           = she writes "not paid" next to that attempt.
 *   'refund_needed'    = the customer paid, but the order was ALREADY paid (a
 *                        second payment). She does NOT add it to the till's
 *                        takings. She marks it "give back".
 *   'unconfirmed'      = "Safaricom says wait". She writes nothing.
 *   FOR UPDATE         = she puts her hand on that page of the book so nobody
 *                        else writes on it while she does.
 */
import { queryStkStatus } from './daraja.service.js';
import { credit } from './wallet.service.js';

// Undo a half-finished transaction. If the connection is already gone there is
// nothing to undo, so a failure here is ignored.
async function rollback(db) {
  try { await db.query('ROLLBACK'); } catch { /* connection already gone */ }
}

// ── MAIN: settle ONE pending attempt, using Safaricom's answer ───────────────
// `attempt` needs { id, checkout_request_id }.
// Returns 'paid' | 'failed' | 'refund_needed' | 'unconfirmed'.
export async function reconcileAttempt(db, attempt) {
  // An attempt with no checkout id was never confirmed by Safaricom as sent.
  // There is nothing to ask about. Do not guess.
  if (!attempt || !attempt.id || !attempt.checkout_request_id) return 'unconfirmed';

  // 1. ASK SAFARICOM (before any transaction, so no row stays locked while we wait).
  //    queryStkStatus loads THIS shop's keys through the shop lock. It throws for
  //    "still processing", "Safaricom down", an odd answer, or no M-Pesa
  //    settings. All of those mean: we do not know. Change nothing.
  let truth;
  try {
    truth = await queryStkStatus(db, attempt.checkout_request_id);
  } catch {
    return 'unconfirmed';
  }

  // 2. SAFARICOM SAYS THE PAYMENT FAILED (cancelled, wrong PIN, no money, ...).
  //    Mark it failed, but only if it is still pending (a callback may have got
  //    there first). No money moved, so nothing is credited.
  if (truth === 'failed') {
    await db.query(
      `UPDATE payment_attempts
          SET status = 'failed', result_desc = 'not_paid_confirmed_by_query',
              updated_at = NOW()
        WHERE id = $1 AND status = 'pending'`,
      [attempt.id]
    );
    return 'failed';
  }

  // 3. SAFARICOM SAYS PAID. Settle it in ONE transaction.
  try {
    await db.query('BEGIN');

    // Lock the attempt (and re-read it, because a callback may have settled it
    // while we were waiting for Safaricom).
    const { rows } = await db.query(
      `SELECT id, order_id, amount_cents, status, checkout_request_id
         FROM payment_attempts
        WHERE id = $1 FOR UPDATE`,
      [attempt.id]
    );
    const row = rows[0];

    // Not visible under this shop's lock (another shop's attempt, or it does not
    // exist): do nothing.
    if (!row) {
      await db.query('COMMIT');
      return 'unconfirmed';
    }

    // Already settled by someone else (the callback): nothing to do, just report.
    if (row.status !== 'pending') {
      await db.query('COMMIT');
      return row.status === 'paid' ? 'paid' : 'failed';
    }

    // Lock the order too, and see whether it is still open.
    const { rows: orderRows } = await db.query(
      'SELECT status FROM orders WHERE id = $1 FOR UPDATE',
      [row.order_id]
    );

    // THE ORDER IS NOT OPEN (already paid by another attempt, or cancelled).
    // The customer's money moved, but we must NOT credit it again. Close this
    // attempt as "paid but unusable" so a refund can be found later.
    if (!orderRows[0] || orderRows[0].status !== 'created') {
      await db.query(
        `UPDATE payment_attempts
            SET status = 'failed', result_code = 0,
                result_desc = 'paid_but_order_not_open', updated_at = NOW()
          WHERE id = $1`,
        [row.id]
      );
      await db.query('COMMIT');
      return 'refund_needed';
    }

    // THE NORMAL CASE: the order is open and Safaricom confirms the payment.
    // The amount is the one WE asked for (never from the browser or the query).
    await credit(db, Number(row.amount_cents), 'sale', row.checkout_request_id);

    // Mark the attempt paid. No receipt code is known here, so it stays empty.
    await db.query(
      `UPDATE payment_attempts
          SET status = 'paid', result_code = 0,
              result_desc = 'paid_confirmed_by_query', updated_at = NOW()
        WHERE id = $1`,
      [row.id]
    );

    // Mark the order paid. It must change exactly one row, or we roll back
    // everything (a half-finished update leaks money).
    const updated = await db.query(
      `UPDATE orders SET status = 'paid', updated_at = NOW()
        WHERE id = $1 AND status = 'created'`,
      [row.order_id]
    );
    if (updated.rowCount !== 1) {
      throw new Error('order could not be marked paid');
    }

    await db.query('COMMIT');
    return 'paid';
  } catch (err) {
    await rollback(db);
    // 23505 = the wallet already has this entry: a harmless repeat. Report what
    // the database now says instead of failing.
    if (err && err.code === '23505') return 'paid';
    throw err;
  }
}

// ── HELPER: settle every pending attempt of ONE order, newest first ──────────
// Used by the check-payment route and by the "do not send a second request"
// rule. Returns the list of outcomes (one per pending attempt that has a
// checkout id), so the caller can decide what to tell the customer.
export async function reconcileOrder(db, orderId) {
  // Only 'pending' attempts that Safaricom knows about (they have a checkout id).
  const { rows } = await db.query(
    `SELECT id, checkout_request_id
       FROM payment_attempts
      WHERE order_id = $1 AND status = 'pending' AND checkout_request_id IS NOT NULL
      ORDER BY created_at DESC, id DESC`,
    [orderId]
  );

  const outcomes = [];
  for (const attempt of rows) {
    outcomes.push(await reconcileAttempt(db, attempt));
  }
  return outcomes;
}