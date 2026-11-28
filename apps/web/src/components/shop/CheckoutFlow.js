// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/shop/CheckoutFlow.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The "brain" of the checkout page. It decides which screen the customer sees:
//     the FORM          (CheckoutForm: review, name, phone, Pay)
//     the PAYMENT SCREEN(PaymentStatus: waiting, paid, failed)
//   and it remembers the order for as long as the browser tab is open, so a
//   refresh, a closed-and-reopened tab or a dropped connection in the middle of
//   paying puts the customer straight back on the payment screen.
//
// WHY IMPORTANT
//   Mobile browsers kill and reload tabs all the time (low memory, switching to
//   the M-Pesa app to look at a message). Without this memory, a customer who
//   came back from the M-Pesa app would find an EMPTY form, think nothing
//   happened, and pay AGAIN. This file is what makes paying twice unlikely.
//
// DANGER
//   1. Client file ('use client'). Must be used INSIDE <CartProvider>.
//   2. The remembered order lives in sessionStorage (dies with the tab). Never
//      move it to localStorage: an old order would "come back" days later.
//   3. A PAID order must never be confused with a NEW shopping trip. See the
//      "done" rule below.
//   4. Decide the first screen only AFTER the basket has loaded (`ready`), or
//      the customer sees the wrong screen for a moment.
//   5. Nothing secret is stored: an order id (the customer's ticket) and the
//      customer's own phone number for display, on their own device.
//
// WHAT IT SOLVES
//   - One place that switches between "pay" and "waiting / paid / failed".
//   - Resume after refresh. "Use a different number" and "stale order" both
//     return to the form cleanly.
//
// SYSTEM DESIGN PRINCIPLE
//   A small state machine: form -> paying -> (paid | failed -> retry or form).
//   Each screen is its own component and knows nothing about the others; this
//   file is the only one that connects them (separation of concerns).
//
// RULES
//   1. First load: if an order is remembered, resume it, EXCEPT:
//        a. it is marked "done" (paid) and the basket now has new items: that is
//           a new shopping trip, so forget the old order and show the form.
//        b. it is NOT paid, but the basket is no longer the one the order was
//           made from (the customer went back and added or removed things).
//           Resuming would charge the OLD total and lose the new items, so we
//           forget the old order and show the form with the new basket.
//   2. The payment is "done" when the basket was emptied (PaymentStatus empties
//      it only when the server confirms PAID). We then mark the remembered order
//      "done" so we can tell the two cases apart.
//   3. Starting a payment remembers the order. "Use a different number" or a
//      "not found" answer forgets it.
//   4. All storage access is wrapped in try/catch (private mode, full storage).
//
// PRACTICAL EXAMPLE
//   <CartProvider slug="aminas-boutique">
//     <CheckoutFlow slug="aminas-boutique" />
//   </CartProvider>
//
// DECISIONS
//   - sessionStorage key "rahisisha-order:<slug>" holds
//     { orderId, phoneDisplay, done, basketKey }. basketKey is a short text
//     describing the basket the order was made from (product ids + quantities).
//   - While deciding the first screen (a few milliseconds) we show a small
//     spinner, never a flash of the wrong screen.
//   - A paid receipt can be seen again by refreshing, until the tab is closed.
//
// WHERE USED
//   shop/[slug]/checkout/page.js
//
// TRADEOFFS
//   + Resumes safely, no account needed, nothing stored on the server.
//   - A customer who closes the tab and reopens the link later starts fresh
//     (their M-Pesa SMS is their record; the shop sees the order either way).
//   - Two tabs of the same shop can hold different remembered orders (each tab
//     has its own storage). That is correct: each tab is its own trip.
//
// HOW TO USE
//   import CheckoutFlow from '../../../../components/shop/CheckoutFlow';
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE — real life: the vendor's memory of your slip
// ═══════════════════════════════════════════════════════════
//   storageKey / readOrder / writeOrder / forgetOrder
//                       = the vendor keeping your slip in her apron pocket while
//                         you are around, and throwing it away when you leave.
//   view                = where we are: still deciding, at the FORM, or PAYING.
//   decide (first load) = you come back from checking M-Pesa: "ah, you again, your
//                         slip is here, let me show you where we were."
//   done rule           = if your slip is already PAID and you come back with a
//                         NEW basket, she does not hand you the old slip.
//   basketKey           = she clips a note to your slip: "2 sodas, 1 dress". If
//                         you come back with a different basket, the old slip
//                         is wrong, so she writes a fresh one.
//   onStarted           = "the request is sent": pin the slip in her apron.
//   onChangeDetails     = "use another number": tear the slip up, start a fresh one.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useCart } from './CartProvider';
import CheckoutForm from './CheckoutForm';
import PaymentStatus from './PaymentStatus';
import { toCheckoutItems } from '../../lib/cart';

// ── THE TAB'S MEMORY (sessionStorage) ────────────────────────────────────────

// The label under which this shop's remembered order is kept in this tab.
const storageKey = (slug) => `rahisisha-order:${slug}`;

// A short text describing a basket (product ids + quantities, no prices).
// Two baskets with the same things have the same key.
const basketKey = (items) => JSON.stringify(toCheckoutItems(items));

// Take the remembered order out of the tab's memory (or null).
function readOrder(slug) {
  try {
    const raw = window.sessionStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only trust a well-formed record: an order id that is a string.
    if (!parsed || typeof parsed.orderId !== 'string') return null;
    return {
      orderId: parsed.orderId,
      phoneDisplay: typeof parsed.phoneDisplay === 'string' ? parsed.phoneDisplay : null,
      done: parsed.done === true,
      basketKey: typeof parsed.basketKey === 'string' ? parsed.basketKey : '',
    };
  } catch {
    return null;
  }
}

// Remember an order in this tab.
function writeOrder(slug, record) {
  try {
    window.sessionStorage.setItem(storageKey(slug), JSON.stringify(record));
  } catch {
    // Storage blocked or full: the flow still works, it just cannot resume.
  }
}

// Forget the remembered order.
function forgetOrder(slug) {
  try {
    window.sessionStorage.removeItem(storageKey(slug));
  } catch {
    // Nothing to do.
  }
}

export default function CheckoutFlow({ slug }) {
  // The basket: we need to know when it has loaded and whether it is empty.
  const { ready, items } = useCart();

  // Where we are:
  //   null                                  = still deciding (first load)
  //   { mode: 'form' }                      = the form
  //   { mode: 'paying', orderId, phoneDisplay } = the payment screen
  const [view, setView] = useState(null);

  // So the first decision is made only ONCE.
  const decidedRef = useRef(false);

  // ── THE FIRST DECISION ──
  // Runs when the basket has loaded. Looks at what the tab remembers.
  useEffect(() => {
    if (!ready || decidedRef.current) return;
    decidedRef.current = true;

    const saved = readOrder(slug);

    // Nothing remembered: show the form.
    if (!saved) {
      setView({ mode: 'form' });
      return;
    }

    // A PAID order is remembered but the basket has NEW items: this is a new
    // shopping trip. Forget the old order and show the form.
    if (saved.done && items.length > 0) {
      forgetOrder(slug);
      setView({ mode: 'form' });
      return;
    }

    // An UNPAID order, but the basket is no longer the one it was made from:
    // resuming would charge the old total. Forget it and show the form.
    if (!saved.done && saved.basketKey !== basketKey(items)) {
      forgetOrder(slug);
      setView({ mode: 'form' });
      return;
    }

    // Otherwise resume where the customer was (waiting, failed or paid receipt).
    setView({ mode: 'paying', orderId: saved.orderId, phoneDisplay: saved.phoneDisplay });
  }, [ready, items, slug]);

  // ── MARK AS DONE WHEN PAID ──
  // PaymentStatus empties the basket only when the server confirms PAID. So
  // "paying + basket now empty" means the order is done. Remember that.
  useEffect(() => {
    if (view?.mode === 'paying' && ready && items.length === 0) {
      writeOrder(slug, {
        orderId: view.orderId,
        phoneDisplay: view.phoneDisplay,
        done: true,
        basketKey: '',
      });
    }
  }, [view, ready, items, slug]);

  // The form says "the M-Pesa request is on its way": remember the order and
  // show the payment screen.
  function handleStarted(orderId, phoneDisplay) {
    writeOrder(slug, { orderId, phoneDisplay, done: false, basketKey: basketKey(items) });
    setView({ mode: 'paying', orderId, phoneDisplay });
  }

  // "Use a different number" or a stale order: forget it and show the form.
  // useCallback keeps the function the same between draws (PaymentStatus is
  // built to cope either way, this is just tidy).
  const handleChangeDetails = useCallback(() => {
    forgetOrder(slug);
    setView({ mode: 'form' });
  }, [slug]);

  // Still deciding: a small spinner (solid colours), never the wrong screen.
  if (!view) {
    return (
      <div className="flex justify-center py-16" aria-label="Loading">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-navy"
        />
      </div>
    );
  }

  // The payment screen: waiting, paid or failed.
  if (view.mode === 'paying') {
    return (
      <PaymentStatus
        slug={slug}
        orderId={view.orderId}
        phoneDisplay={view.phoneDisplay}
        onChangeDetails={handleChangeDetails}
      />
    );
  }

  // The form.
  return <CheckoutForm slug={slug} onStarted={handleStarted} />;
}