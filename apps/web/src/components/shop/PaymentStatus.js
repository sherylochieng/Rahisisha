// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/shop/PaymentStatus.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Everything the customer sees AFTER tapping "Pay with M-Pesa":
//     WAITING   "Check your phone. Enter your M-Pesa PIN."   (updates by itself)
//               + after 15 seconds a button: "I've paid, check my payment"
//     PAID      a green tick, the M-Pesa receipt code, the order, and an
//               optional box: "Where should we deliver?"
//     FAILED    a kind reason ("You cancelled the request", "Wrong PIN"...)
//               with a big "Try again" button. Also shown when a check finds
//               that NOTHING was paid ("No payment was found").
//   It asks the shop's till "has the payment come through?" every 2 seconds
//   until the answer is final.
//
// WHY IMPORTANT
//   This is the most nerve-racking minute for a customer: their money is
//   involved and nothing seems to happen. A calm screen that says exactly what
//   to do, updates by itself, and never leaves them stuck is the difference
//   between "I trust this shop" and "I will never buy here again".
//
// DANGER
//   1. Client file ('use client'). Must be used INSIDE <CartProvider>.
//   2. The basket is emptied ONLY when the server says PAID. Never before: a
//      failed payment must keep the basket so "Try again" is one tap.
//   3. "Try again" repeats ONLY the M-Pesa request on the SAME order. It never
//      creates a new order (no ghost orders).
//   4. The polling loop MUST stop when the screen closes, or it keeps calling
//      the server forever on someone's phone data (the `cancelled` flag).
//   5. Show only our kind words for failures. Never the raw text from Safaricom.
//   6. The phone number shown is the one the customer typed on THIS device. The
//      server never sends it back.
//
// WHAT IT SOLVES
//   - The customer always knows what to do next.
//   - A paid order shows a receipt they can screenshot and show the rider.
//   - A failed or abandoned prompt can be retried safely, or they can use a
//     different number.
//   - A refresh, a closed tab or a dropped connection does not lose anything:
//     the order id is remembered by the page (CheckoutFlow) and this screen
//     simply asks the server again.
//
// SYSTEM DESIGN PRINCIPLE
//   The server is the single source of truth about money. This screen never
//   decides "paid"; it only ASKS (polling) and DISPLAYS. Resilience: every
//   network failure just means "ask again in a moment".
//
// RULES
//   1. Poll every 2 seconds for the first 2 minutes, then every 5 seconds
//      (gentle on a customer's data bundle).
//   2. Stop polling the moment the payment is PAID or FAILED.
//   3. After 15 seconds of waiting, offer "I've paid, check my payment". It asks
//      Safaricom (through our till) what really happened. There is NO "send
//      again" button while waiting: a second prompt is offered ONLY after a
//      check (or the polling) finds the first one failed. This is what stops a
//      customer being charged twice.
//   4. A "not found" answer means the remembered order is stale: hand control
//      back to the form (onChangeDetails).
//   5. The delivery note is OPTIONAL, 1 to 300 characters, and only offered
//      once paid (the server refuses it before).
//
// PRACTICAL EXAMPLE
//   <PaymentStatus slug="aminas-boutique" orderId="..." phoneDisplay="0712 345 678"
//                  onChangeDetails={() => backToForm()} />
//
// DECISIONS
//   - Solid colours: white page, navy text, orange buttons, a green tick for
//     success (green means "done" to everyone), red only for the error box.
//   - Failure reasons are short sentences that always say what happened and what
//     to do next.
//   - The receipt shows the M-Pesa code in a box so it is easy to screenshot.
//   - aria-live regions announce changes for screen readers.
//
// WHERE USED
//   CheckoutFlow.js, shown after the form says "payment started".
//
// TRADEOFFS
//   + Resilient and calm, no manual refreshing.
//   - Polling is simple but not instant (up to 2 seconds late). A push channel
//     (websocket) would be instant but is far heavier for a small shop.
//   - If Safaricom's callback never arrives, the screen stays on "waiting" until
//     the customer presses the check button (the till then asks Safaricom
//     directly and records the answer). A scheduled sweeper that does this
//     without a click is planned later.
//   - The old "Send the request again" button on the waiting screen was removed
//     on purpose: it caused a real double charge (KES 640 for a KES 320 order).
//
// HOW TO USE
//   import PaymentStatus from './PaymentStatus';
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE — real life: waiting at the kiosk after "I've sent it"
// ═══════════════════════════════════════════════════════════
//   polling loop      = the vendor looking at her phone every two seconds:
//                       "has the M-Pesa message come in yet?" She stops looking
//                       the moment she has an answer, and goes home when you do.
//   WaitingView       = "Check your phone, enter your PIN, I will wait here."
//   after 15 seconds  = "I paid but nothing happened." You ask her to phone
//                       Safaricom and check. She does NOT ring your phone again
//                       until she knows whether you paid.
//   handleCheck       = her phone call to Safaricom, and what she tells you:
//                       "yes, paid" (receipt), "nothing was paid, try again", or
//                       "they are still looking, please wait".
//   PaidView          = "Received, thank you!" She writes the M-Pesa code on
//                       your slip, then asks "where should the rider bring it?"
//   FailedView        = "That didn't go through, you cancelled it. Want to try
//                       again?" She does not make you queue again; she keeps
//                       your basket on the counter.
//   handleRetry       = pressing the same button on the till again, not writing
//                       a whole new order.
//   clear() on paid   = only after you have paid does she empty your basket.

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useCart } from './CartProvider';
import { formatKes } from '../../lib/format';
import { fetchOrderStatus, startPayment, saveDeliveryNote, checkPayment } from '../../lib/checkoutApi';

// How often we ask the till (milliseconds).
const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 5000;
// After this long, we ask less often.
const SLOW_AFTER_MS = 120000;
// After this many seconds of waiting, we show "I've paid, check my payment".
const CHECK_AFTER_SECONDS = 15;

// What to tell the customer for each failure reason the server can give.
// Every one says what happened AND what to do.
const REASONS = {
  cancelled: {
    title: 'Payment cancelled',
    text: 'You cancelled the M-Pesa request. No money was taken.',
  },
  wrong_pin: {
    title: 'Wrong M-Pesa PIN',
    text: 'The PIN was not correct. No money was taken. Please try again.',
  },
  insufficient_funds: {
    title: 'Not enough M-Pesa balance',
    text: 'Top up your M-Pesa, then try again. No money was taken.',
  },
  timeout: {
    title: 'The request expired',
    text: 'The M-Pesa request ran out of time before a PIN was entered. No money was taken.',
  },
  failed: {
    title: 'The payment did not go through',
    text: 'Something went wrong with the payment. If you were charged, please contact the shop.',
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// THE MAIN PIECE: asks the till, then shows the right screen
// ═════════════════════════════════════════════════════════════════════════════
export default function PaymentStatus({ slug, orderId, phoneDisplay, onChangeDetails }) {
  // The basket's "clear" action (used once, when the payment is confirmed).
  const { clear } = useCart();

  // The latest answer from the till (null until the first answer arrives).
  const [order, setOrder] = useState(null);
  // True when the last question could not reach the till (offline, slow).
  const [trouble, setTrouble] = useState(false);
  // How many seconds the customer has been waiting on this attempt.
  const [waitedSec, setWaitedSec] = useState(0);
  // Bumped to restart the polling loop after "Try again".
  const [attempt, setAttempt] = useState(0);
  // "Try again" in progress, and its error if the till refused.
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);
  // "I've paid, check my payment" in progress, and what it told the customer.
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState(null);
  // True once a check found that NOTHING was paid (changes the failed wording).
  const [confirmedUnpaid, setConfirmedUnpaid] = useState(false);

  // So the polling loop can call the latest onChangeDetails without restarting.
  const resetRef = useRef(onChangeDetails);
  useEffect(() => {
    resetRef.current = onChangeDetails;
  });

  // The basket must be emptied only ONCE, when the payment is confirmed.
  const clearedRef = useRef(false);

  // ── What the answer means ──
  const paymentStatus = order?.payment?.status;
  // Paid: the payment says paid, or the order itself is already paid / packed.
  const isPaid =
    paymentStatus === 'paid' || order?.orderStatus === 'paid' || order?.orderStatus === 'packed';
  const isFailed = !isPaid && paymentStatus === 'failed';
  // Everything else (none, pending, no answer yet) means we are still waiting.
  const isWaiting = !isPaid && !isFailed;

  // ── THE POLLING LOOP ──
  // Ask the till "has the payment come through?" again and again, until the
  // answer is final. Restarts when `attempt` changes (after "Try again").
  useEffect(() => {
    // `cancelled` is flipped when the screen closes, so the loop stops at once.
    let cancelled = false;
    let timer;
    const startedAt = Date.now();

    async function tick() {
      const r = await fetchOrderStatus(slug, orderId);
      // The screen was closed while we were waiting for the answer: do nothing.
      if (cancelled) return;

      if (r.ok) {
        setTrouble(false);
        setOrder(r.data);
        const ps = r.data.payment.status;
        const done =
          ps === 'paid' || ps === 'failed' ||
          r.data.orderStatus === 'paid' || r.data.orderStatus === 'packed';
        // Final answer: stop asking.
        if (done) return;
      } else if (r.error.code === 'not_found') {
        // The remembered order does not exist (old or wrong). Start fresh.
        resetRef.current();
        return;
      } else {
        // Could not reach the till (offline, slow). Keep trying quietly.
        setTrouble(true);
      }

      // Ask again later: every 2 seconds at first, then every 5.
      const wait = Date.now() - startedAt > SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS;
      timer = setTimeout(tick, wait);
    }

    tick();

    // Cleanup: stop the loop when the screen closes or the attempt restarts.
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, orderId, attempt]);

  // ── THE WAITING CLOCK ──
  // Counts seconds while we are waiting, so we can offer the check button after 15 seconds.
  useEffect(() => {
    if (!isWaiting) return undefined;
    setWaitedSec(0);
    const id = setInterval(() => setWaitedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isWaiting, attempt]);

  // ── EMPTY THE BASKET, ONLY WHEN PAID ──
  useEffect(() => {
    if (isPaid && !clearedRef.current) {
      clearedRef.current = true;
      clear();
    }
  }, [isPaid, clear]);

  // ── "TRY AGAIN" / "SEND THE REQUEST AGAIN" ──
  // Repeats ONLY the M-Pesa request on the SAME order. No new order is made.
  async function handleRetry() {
    // A double tap does nothing.
    if (retrying) return;
    setRetrying(true);
    setRetryError(null);
    const r = await startPayment(slug, orderId);
    setRetrying(false);
    if (!r.ok) {
      // Show the till's kind message (for example "too many tries, wait a bit").
      setRetryError(r.error);
      return;
    }
    // Show "waiting" straight away, then restart the polling loop.
    setOrder((prev) =>
      prev ? { ...prev, payment: { status: 'pending', receipt: null, reason: null } } : prev
    );
    setAttempt((a) => a + 1);
  }

  // ── "I'VE PAID, CHECK MY PAYMENT" ──
  // Asks the till to phone Safaricom and find out what really happened.
  // Three possible answers: paid (receipt screen), failed (nothing was paid, so
  // "Try again" is now safe), or pending (Safaricom is still deciding: wait).
  async function handleCheck() {
    // A double tap does nothing.
    if (checking) return;
    setChecking(true);
    setCheckNote(null);
    const r = await checkPayment(slug, orderId);
    setChecking(false);

    if (!r.ok) {
      if (r.error.code === 'not_found') {
        // The remembered order is stale: start fresh.
        resetRef.current();
        return;
      }
      // Offline, too soon, or any other refusal: show the kind message.
      setCheckNote({ kind: 'error', text: r.error.message });
      return;
    }

    // Show the fresh answer straight away (the polling loop agrees on its next ask).
    setOrder(r.data);
    const ps = r.data.payment.status;
    if (ps === 'failed') {
      // Safaricom confirmed nothing was paid.
      setConfirmedUnpaid(true);
    } else if (ps !== 'paid' && r.data.orderStatus !== 'paid' && r.data.orderStatus !== 'packed') {
      // Still pending: Safaricom has not decided yet.
      setCheckNote({
        kind: 'info',
        text: 'We asked Safaricom and it is still processing your payment. Please wait a minute and check again. Do not pay again.',
      });
    }
  }

  // The first answer has not arrived yet.
  if (!order) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" aria-live="polite">
        <Spinner />
        <p className="mt-4 text-sm text-gray-600">Checking your payment…</p>
        {trouble && <TroubleNote />}
      </div>
    );
  }

  if (isPaid) return <PaidView slug={slug} order={order} />;

  if (isFailed) {
    return (
      <FailedView
        reason={order.payment.reason}
        totalCents={order.totalCents}
        retrying={retrying}
        retryError={retryError}
        confirmedUnpaid={confirmedUnpaid}
        onRetry={handleRetry}
        onChangeDetails={onChangeDetails}
      />
    );
  }

  return (
    <WaitingView
      phoneDisplay={phoneDisplay}
      totalCents={order.totalCents}
      waitedSec={waitedSec}
      trouble={trouble}
      checking={checking}
      checkNote={checkNote}
      onCheck={handleCheck}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SMALL PIECES
// ═════════════════════════════════════════════════════════════════════════════

// A spinning ring (solid navy and light grey, no gradient).
function Spinner() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-navy"
    />
  );
}

// A quiet note when the phone's connection is bad. Polling continues by itself.
function TroubleNote() {
  return (
    <p className="mt-3 text-xs text-gray-500">
      Your connection is weak. We keep trying, there is no need to refresh.
    </p>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// WAITING: "Check your phone"
// ═════════════════════════════════════════════════════════════════════════════
function WaitingView({
  phoneDisplay, totalCents, waitedSec, trouble, checking, checkNote, onCheck,
}) {
  // After 15 seconds with no answer, show the "check my payment" button.
  const canCheck = waitedSec >= CHECK_AFTER_SECONDS;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center" aria-live="polite">
      {/* A phone drawing that gently pulses to say "look at your phone". */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mx-auto h-16 w-16 animate-pulse text-brand-navy"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <line x1="11" y1="18.5" x2="13" y2="18.5" strokeLinecap="round" />
      </svg>

      <h2 className="mt-4 text-xl font-bold text-brand-navy">Check your phone</h2>
      <p className="mt-2 text-sm text-gray-600">
        We sent an M-Pesa request to{' '}
        <span className="font-semibold text-brand-navy">{phoneDisplay || 'your phone'}</span> for{' '}
        <span className="font-semibold text-brand-navy">{formatKes(totalCents)}</span>.
      </p>

      {/* Three simple steps, in the order the customer does them. */}
      <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-gray-700">
        <li className="flex gap-3">
          <span className="font-bold text-brand-orange">1.</span> Look for the M-Pesa message
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-brand-orange">2.</span> Enter your M-Pesa PIN
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-brand-orange">3.</span> Stay on this page. It updates by itself.
        </li>
      </ol>

      <div className="mt-6">
        <Spinner />
        <p className="mt-3 text-xs text-gray-500">Waiting for your payment…</p>
        {trouble && <TroubleNote />}
      </div>

      {/* After 15 seconds: let the customer ask what really happened. There is
          deliberately NO "send again" button here: a second prompt is offered only
          after a check finds that nothing was paid. */}
      {canCheck && (
        <div className="mt-6 border-t border-gray-100 pt-5">
          <p className="text-sm text-gray-600">Already entered your PIN, or got an M-Pesa message?</p>
          {checkNote && (
            <p
              role={checkNote.kind === 'error' ? 'alert' : 'status'}
              className={`mt-2 text-sm ${checkNote.kind === 'error' ? 'text-red-600' : 'text-brand-navy'}`}
            >
              {checkNote.text}
            </p>
          )}
          <button
            type="button"
            onClick={onCheck}
            disabled={checking}
            className="mt-3 h-12 w-full rounded-lg bg-brand-orange text-base font-bold text-white transition hover:bg-brand-orange-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {checking ? 'Checking with M-Pesa…' : "I've paid, check my payment"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FAILED: a kind reason and a big "Try again"
// ═════════════════════════════════════════════════════════════════════════════
function FailedView({
  reason, totalCents, retrying, retryError, confirmedUnpaid, onRetry, onChangeDetails,
}) {
  // Our own wording for the reason; an unknown reason uses the generic one.
  // When a check has just confirmed that nothing was paid, say that plainly
  // (the generic wording would wrongly tell the customer to contact the shop).
  const words = confirmedUnpaid && (!reason || reason === 'failed')
    ? {
        title: 'No payment was found',
        text: 'We checked with M-Pesa and no money was taken for this order. You can safely try again.',
      }
    : REASONS[reason] || REASONS.failed;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center" aria-live="polite">
      {/* A red circle with a cross. */}
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl font-bold text-red-600"
      >
        ×
      </div>

      <h2 className="mt-4 text-xl font-bold text-brand-navy">{words.title}</h2>
      <p className="mt-2 text-sm text-gray-600">{words.text}</p>
      <p className="mt-1 text-xs text-gray-500">Your basket is safe: {formatKes(totalCents)}.</p>

      {retryError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {retryError.message}
        </p>
      )}

      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-5 h-14 w-full rounded-lg bg-brand-orange text-base font-bold text-white transition hover:bg-brand-orange-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {retrying ? 'Sending M-Pesa request…' : 'Try again'}
      </button>
      <button
        type="button"
        onClick={onChangeDetails}
        className="mt-3 text-sm text-gray-600 underline hover:text-brand-navy"
      >
        Use a different number
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAID: tick, receipt, the order, and the optional delivery note
// ═════════════════════════════════════════════════════════════════════════════
function PaidView({ slug, order }) {
  // The delivery note box. If a note was already saved (the page was refreshed),
  // start from it.
  const [note, setNote] = useState(order.deliveryNote || '');
  const [saved, setSaved] = useState(Boolean(order.deliveryNote));
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState(null);

  // The customer tapped "Save delivery details".
  async function handleSaveNote(event) {
    event.preventDefault();
    if (saving) return;
    const text = note.trim();
    // An empty note is not worth a trip to the server.
    if (!text) {
      setNoteError('Type the delivery details first, or skip this step.');
      return;
    }
    setSaving(true);
    setNoteError(null);
    const r = await saveDeliveryNote(slug, order.orderId, text);
    setSaving(false);
    if (!r.ok) {
      setNoteError(r.error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="space-y-6" aria-live="polite">
      {/* ── The big "done" message ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-3xl font-bold text-white"
        >
          ✓
        </div>
        <h2 className="mt-4 text-xl font-bold text-brand-navy">Payment received</h2>
        <p className="mt-1 text-sm text-gray-600">Thank you! The shop has your order.</p>

        {/* The M-Pesa receipt, easy to screenshot. */}
        {order.payment.receipt && (
          <div className="mx-auto mt-5 max-w-xs rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">M-Pesa receipt</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wider text-brand-navy">
              {order.payment.receipt}
            </p>
          </div>
        )}
      </div>

      {/* ── What was ordered ── */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-semibold text-brand-navy">Your order</h3>
        <ul className="mt-3 divide-y divide-gray-100">
          {order.items.map((line) => (
            <li key={`${line.name}-${line.unitPriceCents}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 break-words text-sm text-brand-navy">
                {line.quantity} × {line.name}
              </span>
              <span className="text-sm font-semibold text-brand-navy">
                {formatKes(line.unitPriceCents * line.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-sm text-gray-600">Paid</span>
          <span className="text-lg font-bold text-brand-navy">{formatKes(order.totalCents)}</span>
        </div>
      </section>

      {/* ── The optional delivery note ── */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-semibold text-brand-navy">Where should we deliver?</h3>
        <p className="mt-1 text-xs text-gray-500">Optional. Skip this if you will collect it.</p>

        {saved ? (
          // After saving: show what was saved, with a tick.
          <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <p className="font-semibold">✓ Delivery details saved</p>
            <p className="mt-1 break-words text-green-900">{note}</p>
          </div>
        ) : (
          <form onSubmit={handleSaveNote} noValidate className="mt-3">
            <label htmlFor="delivery-note" className="sr-only">
              Delivery details
            </label>
            <textarea
              id="delivery-note"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Kilimani, Argwings Kodhek Road, gate 3. Call me on arrival."
              className="w-full rounded-lg border border-gray-300 p-3 text-base text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>{note.length}/300</span>
            </div>
            {noteError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {noteError}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="mt-3 h-12 w-full rounded-lg bg-brand-navy text-base font-bold text-white transition hover:bg-brand-navy-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving…' : 'Save delivery details'}
            </button>
          </form>
        )}
      </section>

      {/* ── Back to the shop ── */}
      <div className="text-center">
        <Link
          href={`/shop/${slug}`}
          className="inline-block rounded-lg border border-brand-navy px-6 py-3 text-sm font-semibold text-brand-navy transition hover:bg-gray-100"
        >
          Back to the shop
        </Link>
      </div>
    </div>
  );
}