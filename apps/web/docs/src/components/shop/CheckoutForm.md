# CheckoutForm.js

**FILE:** `apps/web/src/components/shop/CheckoutForm.js` (Week 30 Day 3, Cleanup C2)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

The first checkout screen. The customer sees:
  1. YOUR ORDER   what is in the basket, and the total
  2. YOUR DETAILS their name and M-Pesa phone number (nothing else)
  3. one big button:  "Pay KES 480.00 with M-Pesa"
Tapping the button creates the order on the server and sends the M-Pesa
request to the customer's phone. Then it tells the page "payment started"
so the next screen (waiting for the PIN) can take over.

## WHY IMPORTANT

This is where money is won or lost. Every extra box, every confusing word,
every unclear error costs a sale. Kenyan customers are impatient and on a
phone: name + number + one button, nothing more.

## DANGER

1. Client file ('use client'). Must be used INSIDE <CartProvider>.
2. The prices on this screen are for SHOWING only. The server reads the real
   prices from its database and the M-Pesa request asks for the server's
   total. Never send prices from here.
3. A double tap must NOT make two orders or two M-Pesa prompts. While the
   button is working it is disabled (the `busy` flag).
4. If the order was created but the M-Pesa request FAILED (no internet, too
   many tries), "Try again" must repeat ONLY the payment. Making a second
   order would leave a ghost order behind. We remember the first order in
   `order` and reuse it as long as nothing the customer typed has changed.
5. The phone number must never be written to the console or the address bar.

## WHAT IT SOLVES

- Fewest possible boxes: name and M-Pesa number, both remembered on this
  phone for next time.
- Clear, kind errors, shown right next to the box that needs fixing.
- Safe retries (no duplicate orders, no double prompts).

## SYSTEM DESIGN PRINCIPLE

Fail early, fail kindly, retry safely. Checks run in the browser first (fast,
free), and the server checks AGAIN (never trust the browser). The same
phone rule is used on both sides.

## RULES

1. The phone rule here MIRRORS the server's normalizePhone (Daraja service):
   it ignores spaces, dashes, brackets and a leading +, and accepts
   07xxxxxxxx, 01xxxxxxxx, 7xxxxxxxx, 1xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx.
2. Name: 1 to 80 characters (the same as the server).
3. The basket is read-only here. To change it, the customer goes back to
   the shop (a link is provided).
4. Money is always shown with formatKes.

## PRACTICAL EXAMPLE

<CheckoutForm slug="aminas-boutique" onStarted={(orderId, phone) => ...} />

## DECISIONS

- Name and phone are saved to the phone's memory (lib/cart.js) when the
  customer taps Pay, so next time the form is already filled.
- The button says the amount: "Pay KES 480.00 with M-Pesa". No surprises.
- Errors from the server are shown in a red box above the button, in the
  server's own kind words. A refused product (sold out, hidden) also shows a
  link back to the shop.
- Solid colours only: white page, navy headings, orange Pay button.

## WHERE USED

CheckoutFlow.js (the page's brain) shows this first.

## TRADEOFFS

+ Very short, hard to get wrong.
- No delivery address box here on purpose: it is asked AFTER payment, so
  nothing stands between the customer and paying.
- The phone rule is copied from the server. If the server's rule changes,
  change it here too (a comment on both sides says so).

## HOW TO USE

import CheckoutForm from './CheckoutForm';

## PIECE BY PIECE — real life: paying at the kiosk

checkPhone        = the vendor squinting at your number: "that is not a
                    Safaricom/Airtel number, is it?" Cleans it and checks it.
prettyPhone       = writing your number neatly: 0712 345 678.
YOUR ORDER card   = the vendor reading your basket back to you with the total.
name / phone boxes= "Your name? Your M-Pesa number?" Nothing else.
order (remembered)= the paper slip. If the M-Pesa message fails to reach you,
                    she does NOT write a second slip. She just asks again.
busy              = the vendor is busy with you; a second tap does nothing.
Pay button        = "That will be KES 480. I am sending the request to your
                    phone now."
