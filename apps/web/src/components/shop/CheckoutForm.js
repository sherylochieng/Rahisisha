// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/shop/CheckoutForm.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The first checkout screen. The customer sees:
//     1. YOUR ORDER   what is in the basket, and the total
//     2. YOUR DETAILS their name and M-Pesa phone number (nothing else)
//     3. one big button:  "Pay KES 480.00 with M-Pesa"
//   Tapping the button creates the order on the server and sends the M-Pesa
//   request to the customer's phone. Then it tells the page "payment started"
//   so the next screen (waiting for the PIN) can take over.
//
// WHY IMPORTANT
//   This is where money is won or lost. Every extra box, every confusing word,
//   every unclear error costs a sale. Kenyan customers are impatient and on a
//   phone: name + number + one button, nothing more.
//
// DANGER
//   1. Client file ('use client'). Must be used INSIDE <CartProvider>.
//   2. The prices on this screen are for SHOWING only. The server reads the real
//      prices from its database and the M-Pesa request asks for the server's
//      total. Never send prices from here.
//   3. A double tap must NOT make two orders or two M-Pesa prompts. While the
//      button is working it is disabled (the `busy` flag).
//   4. If the order was created but the M-Pesa request FAILED (no internet, too
//      many tries), "Try again" must repeat ONLY the payment. Making a second
//      order would leave a ghost order behind. We remember the first order in
//      `order` and reuse it as long as nothing the customer typed has changed.
//   5. The phone number must never be written to the console or the address bar.
//
// WHAT IT SOLVES
//   - Fewest possible boxes: name and M-Pesa number, both remembered on this
//     phone for next time.
//   - Clear, kind errors, shown right next to the box that needs fixing.
//   - Safe retries (no duplicate orders, no double prompts).
//
// SYSTEM DESIGN PRINCIPLE
//   Fail early, fail kindly, retry safely. Checks run in the browser first (fast,
//   free), and the server checks AGAIN (never trust the browser). The same
//   phone rule is used on both sides.
//
// RULES
//   1. The phone rule here MIRRORS the server's normalizePhone (Daraja service):
//      it ignores spaces, dashes, brackets and a leading +, and accepts
//      07xxxxxxxx, 01xxxxxxxx, 7xxxxxxxx, 1xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx.
//   2. Name: 1 to 80 characters (the same as the server).
//   3. The basket is read-only here. To change it, the customer goes back to
//      the shop (a link is provided).
//   4. Money is always shown with formatKes.
//
// PRACTICAL EXAMPLE
//   <CheckoutForm slug="aminas-boutique" onStarted={(orderId, phone) => ...} />
//
// DECISIONS
//   - Name and phone are saved to the phone's memory (lib/cart.js) when the
//     customer taps Pay, so next time the form is already filled.
//   - The button says the amount: "Pay KES 480.00 with M-Pesa". No surprises.
//   - Errors from the server are shown in a red box above the button, in the
//     server's own kind words. A refused product (sold out, hidden) also shows a
//     link back to the shop.
//   - Solid colours only: white page, navy headings, orange Pay button.
//
// WHERE USED
//   CheckoutFlow.js (the page's brain) shows this first.
//
// TRADEOFFS
//   + Very short, hard to get wrong.
//   - No delivery address box here on purpose: it is asked AFTER payment, so
//     nothing stands between the customer and paying.
//   - The phone rule is copied from the server. If the server's rule changes,
//     change it here too (a comment on both sides says so).
//
// HOW TO USE
//   import CheckoutForm from './CheckoutForm';
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE — real life: paying at the kiosk
// ═══════════════════════════════════════════════════════════
//   checkPhone        = the vendor squinting at your number: "that is not a
//                       Safaricom/Airtel number, is it?" Cleans it and checks it.
//   prettyPhone       = writing your number neatly: 0712 345 678.
//   YOUR ORDER card   = the vendor reading your basket back to you with the total.
//   name / phone boxes= "Your name? Your M-Pesa number?" Nothing else.
//   order (remembered)= the paper slip. If the M-Pesa message fails to reach you,
//                       she does NOT write a second slip. She just asks again.
//   busy              = the vendor is busy with you; a second tap does nothing.
//   Pay button        = "That will be KES 480. I am sending the request to your
//                       phone now."

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCart } from './CartProvider';
import { formatKes } from '../../lib/format';
import { loadCustomer, saveCustomer, toCheckoutItems } from '../../lib/cart';
import { createOrder, startPayment } from '../../lib/checkoutApi';

// ── THE PHONE RULE (mirrors the server's normalizePhone) ─────────────────────

// Clean what the customer typed and check it is a Kenyan mobile number.
// Returns { ok: true, msisdn: '2547...' } or { ok: false, message }.
export function checkPhone(input) {
  // Remove spaces, dashes and brackets, then a leading +.
  const digits = String(input ?? '').replace(/[\s\-()]/g, '').replace(/^\+/, '');
  let msisdn = digits;
  // 0712345678 -> 254712345678
  if (/^0[17]\d{8}$/.test(digits)) msisdn = `254${digits.slice(1)}`;
  // 712345678 -> 254712345678
  else if (/^[17]\d{8}$/.test(digits)) msisdn = `254${digits}`;
  // Must now be 254 + 7 or 1 + 8 more digits.
  if (!/^254[17]\d{8}$/.test(msisdn)) {
    return { ok: false, message: 'Enter a valid M-Pesa number, like 0712 345 678' };
  }
  return { ok: true, msisdn };
}

// Show a clean number the way people write it: 254712345678 -> 0712 345 678.
export function prettyPhone(msisdn) {
  const local = `0${msisdn.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

export default function CheckoutForm({ slug, onStarted }) {
  // The shared basket: the lines, the total and whether it has loaded.
  const { items, ready, totalCents } = useCart();

  // What the customer typed.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Messages next to each box, and one general message above the button.
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  // True while we are talking to the server (blocks double taps).
  const [busy, setBusy] = useState(false);
  // The order we already made, so a retry does not make a second one.
  // Shape: { id, key } where key describes what the order was made from.
  const [order, setOrder] = useState(null);

  // After the first paint: fill the boxes with the name and phone remembered
  // on this phone (if any). Done in an effect so the server's page and the
  // phone's page match on first paint.
  useEffect(() => {
    const saved = loadCustomer();
    setName(saved.name);
    setPhone(saved.phone);
  }, []);

  // Not loaded yet: draw nothing (avoids a flash of "basket is empty").
  if (!ready) return null;

  // Empty basket: nothing to pay for. Send the customer back to the shop.
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold text-brand-navy">Your basket is empty</h2>
        <p className="mt-1 text-sm text-gray-500">Pick something from the shop first.</p>
        <Link
          href={`/shop/${slug}`}
          className="mt-4 inline-block rounded-lg bg-brand-orange px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-orange-dark"
        >
          Back to the shop
        </Link>
      </div>
    );
  }

  // The customer tapped "Pay".
  async function handleSubmit(event) {
    // Stop the browser from reloading the page.
    event.preventDefault();
    // A second tap while we are busy does nothing.
    if (busy) return;

    // 1. Check the boxes in the browser first (fast, free).
    const cleanName = name.trim();
    const phoneCheck = checkPhone(phone);
    const errors = {};
    if (!cleanName) errors.name = 'Please enter your name';
    if (cleanName.length > 80) errors.name = 'That name is too long';
    if (!phoneCheck.ok) errors.phone = phoneCheck.message;
    setFieldErrors(errors);
    setFormError(null);
    // Something is wrong: stop here and let the customer fix it.
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    // Remember the name and phone for next time (even if payment fails).
    saveCustomer(cleanName, phone.trim());

    // A short description of what this order is made from. If it changes (a new
    // phone, a new name, a different basket) we must make a NEW order.
    const key = JSON.stringify([cleanName, phoneCheck.msisdn, toCheckoutItems(items)]);

    // 2. Make the order, unless we already made the same one (a retry).
    let orderId = order && order.key === key ? order.id : null;
    if (!orderId) {
      const created = await createOrder(slug, {
        name: cleanName,
        phone: phoneCheck.msisdn,
        items: toCheckoutItems(items),
      });
      if (!created.ok) {
        // Show the server's kind message; point at the box it names, if any.
        setFieldErrors({
          name: created.error.details?.name || undefined,
          phone: created.error.details?.phone || undefined,
        });
        setFormError(created.error);
        setBusy(false);
        return;
      }
      orderId = created.data.orderId;
      // Remember it, so "Try again" does not make a second order.
      setOrder({ id: orderId, key });
    }

    // 3. Send the M-Pesa request to the customer's phone.
    const started = await startPayment(slug, orderId);
    if (!started.ok) {
      setFormError(started.error);
      setBusy(false);
      return;
    }

    // 4. Tell the page: the request is on its way, show the waiting screen.
    setBusy(false);
    onStarted(orderId, prettyPhone(phoneCheck.msisdn));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* ── 1. YOUR ORDER: the basket read back, with the total ── */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-brand-navy">Your order</h2>
          {/* To change the basket, go back to the shop. */}
          <Link href={`/shop/${slug}`} className="text-sm text-gray-600 underline hover:text-brand-navy">
            Change
          </Link>
        </div>

        <ul className="mt-3 divide-y divide-gray-100">
          {items.map((line) => (
            <li key={line.productId} className="flex items-center gap-3 py-3">
              {/* The product's photo, or a letter tile if it has none. */}
              {line.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.imageUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded bg-gray-50 object-contain"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-brand-cream font-display text-lg font-bold text-brand-orange"
                >
                  {line.name.trim().charAt(0).toUpperCase()}
                </div>
              )}
              {/* Name and "2 × KES 80.00". */}
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-brand-navy">{line.name}</p>
                <p className="text-xs text-gray-500">
                  {line.quantity} × {formatKes(line.priceCents)}
                </p>
              </div>
              {/* The line total. */}
              <p className="text-sm font-semibold text-brand-navy">
                {formatKes(line.priceCents * line.quantity)}
              </p>
            </li>
          ))}
        </ul>

        {/* The total, big and clear. */}
        <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-sm text-gray-600">Total</span>
          <span className="text-xl font-bold text-brand-navy">{formatKes(totalCents)}</span>
        </div>
      </section>

      {/* ── 2. YOUR DETAILS: only a name and an M-Pesa number ── */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-brand-navy">Your details</h2>

        {/* The name box. */}
        <div>
          <label htmlFor="checkout-name" className="block text-sm font-medium text-gray-700">
            Your name
          </label>
          <input
            id="checkout-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-invalid={fieldErrors.name ? 'true' : 'false'}
            aria-describedby={fieldErrors.name ? 'checkout-name-error' : undefined}
            className="mt-1 h-12 w-full rounded-lg border border-gray-300 px-3 text-base text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
          />
          {fieldErrors.name && (
            <p id="checkout-name-error" className="mt-1 text-sm text-red-600">
              {fieldErrors.name}
            </p>
          )}
        </div>

        {/* The M-Pesa phone box. type="tel" + inputMode open the number pad. */}
        <div>
          <label htmlFor="checkout-phone" className="block text-sm font-medium text-gray-700">
            M-Pesa phone number
          </label>
          <input
            id="checkout-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            aria-invalid={fieldErrors.phone ? 'true' : 'false'}
            aria-describedby="checkout-phone-help"
            className="mt-1 h-12 w-full rounded-lg border border-gray-300 px-3 text-base text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
          />
          {fieldErrors.phone ? (
            <p id="checkout-phone-help" className="mt-1 text-sm text-red-600">
              {fieldErrors.phone}
            </p>
          ) : (
            <p id="checkout-phone-help" className="mt-1 text-xs text-gray-500">
              We will send the M-Pesa request to this number.
            </p>
          )}
        </div>
      </section>

      {/* ── A general error (no internet, too many tries, product no longer available) ── */}
      {formError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{formError.message}</p>
          {/* A refused product: let the customer go and fix the basket. */}
          {formError.code === 'items_unavailable' && (
            <Link href={`/shop/${slug}`} className="mt-1 inline-block font-semibold underline">
              Back to the shop
            </Link>
          )}
        </div>
      )}

      {/* ── 3. THE PAY BUTTON: says the amount, blocks double taps ── */}
      <button
        type="submit"
        disabled={busy}
        className="h-14 w-full rounded-lg bg-brand-orange text-base font-bold text-white transition hover:bg-brand-orange-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? 'Sending M-Pesa request…' : `Pay ${formatKes(totalCents)} with M-Pesa`}
      </button>
      <p className="text-center text-xs text-gray-500">
        You will get an M-Pesa message on your phone. Enter your PIN to pay.
      </p>
    </form>
  );
}