# PaymentStatus.js

**FILE:** `apps/web/src/components/shop/PaymentStatus.js` (Week 30 Day 3, Cleanup C2)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

Everything the customer sees AFTER tapping "Pay with M-Pesa":
  WAITING   "Check your phone. Enter your M-Pesa PIN."   (updates by itself)
            + after 15 seconds a button: "I've paid, check my payment"
  PAID      a green tick, the M-Pesa receipt code, the order, and an
            optional box: "Where should we deliver?"
  FAILED    a kind reason ("You cancelled the request", "Wrong PIN"...)
            with a big "Try again" button. Also shown when a check finds
            that NOTHING was paid ("No payment was found").
It asks the shop's till "has the payment come through?" every 2 seconds
until the answer is final.

## WHY IMPORTANT

This is the most nerve-racking minute for a customer: their money is
involved and nothing seems to happen. A calm screen that says exactly what
to do, updates by itself, and never leaves them stuck is the difference
between "I trust this shop" and "I will never buy here again".

## DANGER

1. Client file ('use client'). Must be used INSIDE <CartProvider>.
2. The basket is emptied ONLY when the server says PAID. Never before: a
   failed payment must keep the basket so "Try again" is one tap.
3. "Try again" repeats ONLY the M-Pesa request on the SAME order. It never
   creates a new order (no ghost orders).
4. The polling loop MUST stop when the screen closes, or it keeps calling
   the server forever on someone's phone data (the `cancelled` flag).
5. Show only our kind words for failures. Never the raw text from Safaricom.
6. The phone number shown is the one the customer typed on THIS device. The
   server never sends it back.

## WHAT IT SOLVES

- The customer always knows what to do next.
- A paid order shows a receipt they can screenshot and show the rider.
- A failed or abandoned prompt can be retried safely, or they can use a
  different number.
- A refresh, a closed tab or a dropped connection does not lose anything:
  the order id is remembered by the page (CheckoutFlow) and this screen
  simply asks the server again.

## SYSTEM DESIGN PRINCIPLE

The server is the single source of truth about money. This screen never
decides "paid"; it only ASKS (polling) and DISPLAYS. Resilience: every
network failure just means "ask again in a moment".

## RULES

1. Poll every 2 seconds for the first 2 minutes, then every 5 seconds
   (gentle on a customer's data bundle).
2. Stop polling the moment the payment is PAID or FAILED.
3. After 15 seconds of waiting, offer "I've paid, check my payment". It asks
   Safaricom (through our till) what really happened. There is NO "send
   again" button while waiting: a second prompt is offered ONLY after a
   check (or the polling) finds the first one failed. This is what stops a
   customer being charged twice.
4. A "not found" answer means the remembered order is stale: hand control
   back to the form (onChangeDetails).
5. The delivery note is OPTIONAL, 1 to 300 characters, and only offered
   once paid (the server refuses it before).

## PRACTICAL EXAMPLE

<PaymentStatus slug="aminas-boutique" orderId="..." phoneDisplay="0712 345 678"
               onChangeDetails={() => backToForm()} />

## DECISIONS

- Solid colours: white page, navy text, orange buttons, a green tick for
  success (green means "done" to everyone), red only for the error box.
- Failure reasons are short sentences that always say what happened and what
  to do next.
- The receipt shows the M-Pesa code in a box so it is easy to screenshot.
- aria-live regions announce changes for screen readers.

## WHERE USED

CheckoutFlow.js, shown after the form says "payment started".

## TRADEOFFS

+ Resilient and calm, no manual refreshing.
- Polling is simple but not instant (up to 2 seconds late). A push channel
  (websocket) would be instant but is far heavier for a small shop.
- If Safaricom's callback never arrives, the screen stays on "waiting" until
  the customer presses the check button (the till then asks Safaricom
  directly and records the answer). A scheduled sweeper that does this
  without a click is planned later.
- The old "Send the request again" button on the waiting screen was removed
  on purpose: it caused a real double charge (KES 640 for a KES 320 order).

## HOW TO USE

import PaymentStatus from './PaymentStatus';

## PIECE BY PIECE — real life: waiting at the kiosk after "I've sent it"

polling loop      = the vendor looking at her phone every two seconds:
                    "has the M-Pesa message come in yet?" She stops looking
                    the moment she has an answer, and goes home when you do.
WaitingView       = "Check your phone, enter your PIN, I will wait here."
after 15 seconds  = "I paid but nothing happened." You ask her to phone
                    Safaricom and check. She does NOT ring your phone again
                    until she knows whether you paid.
handleCheck       = her phone call to Safaricom, and what she tells you:
                    "yes, paid" (receipt), "nothing was paid, try again", or
                    "they are still looking, please wait".
PaidView          = "Received, thank you!" She writes the M-Pesa code on
                    your slip, then asks "where should the rider bring it?"
FailedView        = "That didn't go through, you cancelled it. Want to try
                    again?" She does not make you queue again; she keeps
                    your basket on the counter.
handleRetry       = pressing the same button on the till again, not writing
                    a whole new order.
clear() on paid   = only after you have paid does she empty your basket.
