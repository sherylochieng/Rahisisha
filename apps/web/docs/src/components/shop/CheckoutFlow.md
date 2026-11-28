# CheckoutFlow.js

**FILE:** `apps/web/src/components/shop/CheckoutFlow.js` (Week 30 Day 3, Cleanup C2)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

The "brain" of the checkout page. It decides which screen the customer sees:
  the FORM          (CheckoutForm: review, name, phone, Pay)
  the PAYMENT SCREEN(PaymentStatus: waiting, paid, failed)
and it remembers the order for as long as the browser tab is open, so a
refresh, a closed-and-reopened tab or a dropped connection in the middle of
paying puts the customer straight back on the payment screen.

## WHY IMPORTANT

Mobile browsers kill and reload tabs all the time (low memory, switching to
the M-Pesa app to look at a message). Without this memory, a customer who
came back from the M-Pesa app would find an EMPTY form, think nothing
happened, and pay AGAIN. This file is what makes paying twice unlikely.

## DANGER

1. Client file ('use client'). Must be used INSIDE <CartProvider>.
2. The remembered order lives in sessionStorage (dies with the tab). Never
   move it to localStorage: an old order would "come back" days later.
3. A PAID order must never be confused with a NEW shopping trip. See the
   "done" rule below.
4. Decide the first screen only AFTER the basket has loaded (`ready`), or
   the customer sees the wrong screen for a moment.
5. Nothing secret is stored: an order id (the customer's ticket) and the
   customer's own phone number for display, on their own device.

## WHAT IT SOLVES

- One place that switches between "pay" and "waiting / paid / failed".
- Resume after refresh. "Use a different number" and "stale order" both
  return to the form cleanly.

## SYSTEM DESIGN PRINCIPLE

A small state machine: form -> paying -> (paid | failed -> retry or form).
Each screen is its own component and knows nothing about the others; this
file is the only one that connects them (separation of concerns).

## RULES

1. First load: if an order is remembered, resume it, EXCEPT:
     a. it is marked "done" (paid) and the basket now has new items: that is
        a new shopping trip, so forget the old order and show the form.
     b. it is NOT paid, but the basket is no longer the one the order was
        made from (the customer went back and added or removed things).
        Resuming would charge the OLD total and lose the new items, so we
        forget the old order and show the form with the new basket.
2. The payment is "done" when the basket was emptied (PaymentStatus empties
   it only when the server confirms PAID). We then mark the remembered order
   "done" so we can tell the two cases apart.
3. Starting a payment remembers the order. "Use a different number" or a
   "not found" answer forgets it.
4. All storage access is wrapped in try/catch (private mode, full storage).

## PRACTICAL EXAMPLE

<CartProvider slug="aminas-boutique">
  <CheckoutFlow slug="aminas-boutique" />
</CartProvider>

## DECISIONS

- sessionStorage key "rahisisha-order:<slug>" holds
  { orderId, phoneDisplay, done, basketKey }. basketKey is a short text
  describing the basket the order was made from (product ids + quantities).
- While deciding the first screen (a few milliseconds) we show a small
  spinner, never a flash of the wrong screen.
- A paid receipt can be seen again by refreshing, until the tab is closed.

## WHERE USED

shop/[slug]/checkout/page.js

## TRADEOFFS

+ Resumes safely, no account needed, nothing stored on the server.
- A customer who closes the tab and reopens the link later starts fresh
  (their M-Pesa SMS is their record; the shop sees the order either way).
- Two tabs of the same shop can hold different remembered orders (each tab
  has its own storage). That is correct: each tab is its own trip.

## HOW TO USE

import CheckoutFlow from '../../../../components/shop/CheckoutFlow';

## PIECE BY PIECE — real life: the vendor's memory of your slip

storageKey / readOrder / writeOrder / forgetOrder
                    = the vendor keeping your slip in her apron pocket while
                      you are around, and throwing it away when you leave.
view                = where we are: still deciding, at the FORM, or PAYING.
decide (first load) = you come back from checking M-Pesa: "ah, you again, your
                      slip is here, let me show you where we were."
done rule           = if your slip is already PAID and you come back with a
                      NEW basket, she does not hand you the old slip.
basketKey           = she clips a note to your slip: "2 sodas, 1 dress". If
                      you come back with a different basket, the old slip
                      is wrong, so she writes a fresh one.
onStarted           = "the request is sent": pin the slip in her apron.
onChangeDetails     = "use another number": tear the slip up, start a fresh one.
