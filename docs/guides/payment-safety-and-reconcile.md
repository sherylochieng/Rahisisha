# Payment Safety: Lost Confirmations, Double Charges and the Check Button

**FILE:** `docs/guides/payment-safety-and-reconcile.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

M-Pesa confirms a payment by calling our server (the callback). If that call is lost, late or says "still processing", our system may not know a customer has paid. A customer who waits and presses "send again" can then be charged twice. This guide explains how Rahisisha prevents that and how to handle it when it happens anyway.

## WHY IMPORTANT

Money was taken twice from a real phone during testing (KES 640 for a KES 320 order). Every future shop owner will face this on bad networks. A shop that charges customers twice loses trust immediately.

## DANGER (what breaks without it)

1. Sending a second prompt while the first is unresolved can charge the customer twice.
2. Marking an order paid twice credits the shop's wallet twice. Two database rules stop this: one paid attempt per order (`payment_attempts_one_paid_per_order`) and a unique wallet reference (the checkout request id).
3. Crediting without asking Safaricom first would let a forged request mark an order paid.
4. If the server cannot reach Safaricom, it must say "unconfirmed" and change nothing. Guessing is never allowed.

## WHAT IT SOLVES

- A payment that went through but was never recorded is found and recorded (**reconcile**).
- A new prompt is refused while an older one might still succeed (**stale-pending guard**).
- A waiting customer has a safe button to find out what happened (**I've paid, check my payment**).
- A real double payment is recognised, closed and listed for a refund (`paid_but_order_not_open`).

## SYSTEM DESIGN PRINCIPLE

**Ask the source of truth before changing money.** We never decide "paid" ourselves. We ask Safaricom (`queryStkStatus`) and record only its answer. And **make repeats safe (idempotency):** pressing the check button ten times must credit the wallet at most once.

## RULES

1. `reconcileAttempt` asks Safaricom BEFORE opening the database transaction.
2. Then it locks the payment attempt, then the order (`FOR UPDATE`), always in that order, so two checks at once cannot both credit.
3. If Safaricom says **paid** and the order is still open: credit the shop (our own `amount_cents`, never an amount from outside), mark the attempt paid, mark the order paid. All or nothing.
4. If Safaricom says **paid** but the order is already paid or closed: it is a **double payment**. The attempt is closed as `failed` with `result_desc = 'paid_but_order_not_open'` and the outcome is `refund_needed`.
5. If Safaricom says **not paid**: the attempt is closed as failed (`not_paid_confirmed_by_query`), so a new prompt is allowed.
6. If Safaricom says **still processing**, or cannot be reached: nothing changes (`unconfirmed`).
7. The pay step refuses a new prompt while an older attempt (older than 2 minutes) with a checkout id is unresolved, after asking Safaricom about it first.
8. The check button is limited to one check per order every 5 seconds (429 `too_soon`).
9. Reconciled payments have **no M-Pesa receipt code** (Safaricom's query does not return one) and no failure reason.

## PRACTICAL EXAMPLE

Wanjiru pays KES 320. The money leaves her phone but our server never hears back. Her screen keeps loading.

- After 15 seconds she sees **I've paid, check my payment** and taps it.
- Our server asks Safaricom. Safaricom says "paid".
- The order becomes paid, the wallet is credited once, and her screen shows the receipt screen.

If instead Safaricom says "nothing was paid", the screen says **No payment was found** and shows **Try again**, which is now safe. If Safaricom says "still processing", she is told to wait a minute and **not to pay again**.

## DECISIONS

- **No "send again" button on the waiting screen.** It caused the real double charge. A second prompt is offered only after a check or the polling finds the first one failed.
- **Check button after 15 seconds,** not at once, to give the normal callback time to arrive.
- **The status shows the PAID attempt first,** even if a newer pending attempt exists, so a customer who paid and then tapped "send again" still sees their receipt.
- **A scheduled sweeper** that settles old pending payments without a click is planned (see `docs/PENDING_TASKS.md`).

## WHERE USED

`apps/api/src/services/reconcile.service.js` (the logic), `controllers/payments.controller.js` (the guard before a new prompt), `controllers/checkout.controller.js` (`checkCheckoutPayment`), `apps/web/src/components/PaymentStatus.js` (the button).
Tests: `tests/reconcile.service.test.js` (10), `tests/payments.stale-pending.test.js` (5), `tests/isolation/checkout.cross-tenant.test.js` tests 15 to 19.

## TRADEOFFS

+ A lost callback can no longer leave an order unpaid or cause a second charge.
- Reconciled payments have no receipt code on the screen. A later Transaction Status call can fetch it.
- The 5-second spacing is kept in memory, so it resets if the server restarts and is per server, not shared. Fine for one server, needs a shared store if we ever run many.
- A real double payment is only detected and listed. The **refund itself is still manual** until a refunds screen is built.

## HOW TO USE

To settle a stuck order by hand during an incident, open the shop's checkout page for that order and press the check button, or call the check-payment endpoint. To find double payments, list payment attempts where `result_desc = 'paid_but_order_not_open'` and refund the customer through the shop's M-Pesa.

---

## PIECE BY PIECE (real life, in simple terms)

**Callback**  
Safaricom phoning our shop to say 'she paid'. Sometimes the phone call is lost.

**Reconcile**  
When the call is lost, the shopkeeper phones Safaricom herself and asks 'did KES 320 come from this number?' Then she writes the answer in the book.

**Lock attempt then order**  
Two clerks must not both write 'paid' for the same sale. The first takes the notebook; the second waits until the first is done, then sees it is already written.

**Credit uses our own amount**  
She writes the amount from HER slip, never the amount a stranger tells her on the phone.

**Refund needed**  
Safaricom says she paid twice. The second payment is real money that belongs to the customer, so we mark it for a refund instead of hiding it.

**Unconfirmed**  
The line to Safaricom is down. The shopkeeper writes nothing and says 'I'll check again in a minute'.

---

## What each outcome means

| Outcome | What we saw | What changed |
|---|---|---|
| `paid` | Safaricom said paid and the order was open | Wallet credited once, attempt paid, order paid |
| `failed` | Safaricom said not paid | Attempt closed as failed, a new prompt is allowed |
| `refund_needed` | Safaricom said paid but the order was already paid or closed | Attempt closed as failed with `paid_but_order_not_open`, listed for a refund |
| `unconfirmed` | Safaricom still processing, or unreachable | Nothing |

## Incident checklist (customer says "I was charged but the shop did not get it")

1. Ask the customer for the M-Pesa message (amount, time). Never ask for their PIN.
2. Find the order, then its payment attempts.
3. Use check-payment on the order. If it says paid, you are done.
4. If an earlier payment exists for an already-paid order, it appears as `paid_but_order_not_open`. Refund that amount.
5. Note it in `docs/incidents/` (see the 26 Nov 2026 example).
