// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/lib/checkoutApi.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The four phone calls the checkout screens make to the shop's till (the API):
//     1. createOrder        POST  /storefront/:slug/checkout
//     2. startPayment       POST  /storefront/:slug/orders/:id/pay
//     3. fetchOrderStatus   GET   /storefront/:slug/orders/:id
//     4. saveDeliveryNote   PATCH /storefront/:slug/orders/:id/note
//   Each one returns the SAME simple shape, whatever happens:
//     { ok: true,  data }                       it worked
//     { ok: false, error: { code, message } }   it did not, with a kind message
//   The screens never see fetch, JSON, status codes or a network crash.
//
// WHY IMPORTANT
//   Customers pay on shaky mobile data. Calls fail, time out and get cut off.
//   If every screen handled that itself, one of them would forget and show a
//   white page or a raw error to someone holding their money. Here it is handled
//   ONCE: a lost connection becomes "Check your connection and try again".
//
// DANGER
//   1. No login is used and none is sent: this is the PUBLIC door. Never add
//      credentials: 'include' here (it would send the owner's cookie).
//   2. The order id in the address is the customer's "ticket". Never log it,
//      never put it in the address of a page that is shared.
//   3. Never show the raw error from the network or the server to the customer.
//      Only our short, kind messages are shown.
//   4. Prices are NOT sent. The server reads them from its own database.
//
// WHAT IT SOLVES
//   One place for the web addresses, the answers and every failure.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns + "never throw to the screen". A screen asks, and
//   gets either data or a polite error object. It can always show something
//   sensible.
//
// RULES
//   1. Every function returns { ok, data } or { ok, error }. They never throw.
//   2. Every call has a time limit (TIMEOUT_MS). A hung call becomes a clear
//      "taking too long" error instead of a screen that spins forever.
//   3. The status call is never cached (cache: 'no-store'), so the waiting
//      screen always sees the latest answer.
//   4. The slug and the order id are encoded with encodeURIComponent.
//
// PRACTICAL EXAMPLE
//   const r = await createOrder('aminas-boutique', { name, phone, items });
//   if (!r.ok) show(r.error.message);
//   else goToPayment(r.data.orderId);
//
// DECISIONS
//   - A call that fails because the phone is OFFLINE gets the code 'network'.
//     A call that is too slow gets 'timeout'. Both are safe to retry. The
//     server-side checks (a phone limit, a refused product) keep their own codes.
//   - Pay-start answers 202 ("accepted"): the money has NOT moved yet. The real
//     result arrives later, so the screen then polls fetchOrderStatus.
//
// WHERE USED
//   The checkout page and the payment waiting / result screens.
//
// TRADEOFFS
//   + Every screen is simpler and safer.
//   - A small amount of extra code compared with calling fetch directly.
//
// HOW TO USE
//   import { createOrder, startPayment, fetchOrderStatus, saveDeliveryNote }
//     from '../lib/checkoutApi';
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE — real life: sending a runner to the till
// ═══════════════════════════════════════════════════════════
//   API_URL / TIMEOUT_MS = the address of the till, and how long we wait for the
//                          runner before saying "he is taking too long".
//   call()               = the ONE runner. He goes to the till, brings back the
//                          answer, and if the road is flooded (no internet) he
//                          comes back and says so politely. Every other function
//                          just tells him which door to knock.
//   createOrder          = "Write me an order for these items." Brings back a
//                          ticket number.
//   startPayment         = "Send the M-Pesa request to my phone."
//   fetchOrderStatus     = "Has my payment come through yet?"
//   saveDeliveryNote     = "Deliver to Kilimani, gate 3." (after paying).

// The till's address, e.g. https://api.rahisishabiashara.com/v1 (ends in /v1).
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// How long we wait for ONE call before giving up (20 seconds). Mobile data is
// slow, but a call that takes longer than this is not going to help the customer.
const TIMEOUT_MS = 20000;

// The kind messages we show when the call never reached the till.
const NETWORK_ERROR = {
  code: 'network',
  message: 'No internet connection. Check your data or Wi-Fi and try again.',
};
const TIMEOUT_ERROR = {
  code: 'timeout',
  message: 'This is taking too long. Check your connection and try again.',
};

// The ONE runner every function uses. It never throws: it always returns
// { ok: true, data } or { ok: false, error }.
async function call(path, { method = 'GET', body } = {}) {
  // AbortController lets us cancel the call after TIMEOUT_MS.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      // The body is JSON, only when there is one.
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      // Always ask the till fresh. Never use an old answer.
      cache: 'no-store',
      signal: controller.signal,
    });

    // Read the answer. If it is not JSON (a proxy error page, say), treat it as empty.
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    // 200 / 201 / 202: it worked. 'data' is the till's answer.
    if (res.ok) return { ok: true, data: json?.data ?? null };

    // Anything else: the till refused, with a code and a message. Keep only the
    // parts we need. If the answer was unreadable, use a safe generic message.
    return {
      ok: false,
      error: {
        code: json?.error?.code || 'failed',
        message: json?.error?.message || 'Something went wrong. Please try again.',
        details: json?.error?.details || null,
        status: res.status,
      },
    };
  } catch (err) {
    // The call never reached the till. Either we cancelled it (too slow) or
    // the phone is offline.
    return { ok: false, error: err?.name === 'AbortError' ? TIMEOUT_ERROR : NETWORK_ERROR };
  } finally {
    // Always stop the timer so it does not fire later.
    clearTimeout(timer);
  }
}

// The start of every address for ONE shop's door.
const shopPath = (slug) => `/storefront/${encodeURIComponent(slug)}`;

// 1. "Write me an order." body = { name, phone, items: [{ productId, quantity }] }.
//    Success data = { orderId, totalCents, items }.
export function createOrder(slug, body) {
  return call(`${shopPath(slug)}/checkout`, { method: 'POST', body });
}

// 2. "Send the M-Pesa request." No body needed: the till uses the phone saved with
//    the order. Success means "accepted", NOT "paid yet".
export function startPayment(slug, orderId) {
  return call(`${shopPath(slug)}/orders/${encodeURIComponent(orderId)}/pay`, {
    method: 'POST',
    body: {},
  });
}

// 3. "Has my payment come through?"
//    Success data = { orderId, orderStatus, totalCents, items, deliveryNote,
//                     payment: { status, receipt, reason } }.
export function fetchOrderStatus(slug, orderId) {
  return call(`${shopPath(slug)}/orders/${encodeURIComponent(orderId)}`);
}

// 4. "Deliver here." Only accepted AFTER the order is paid.
export function saveDeliveryNote(slug, orderId, note) {
  return call(`${shopPath(slug)}/orders/${encodeURIComponent(orderId)}/note`, {
    method: 'PATCH',
    body: { note },
  });
}