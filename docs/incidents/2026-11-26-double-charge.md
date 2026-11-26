# Incident: Double charge during checkout testing (26 Nov 2026)

**FILE:** `docs/incidents/2026-11-26-double-charge.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Records what happened when a real M-Pesa payment was taken twice during local testing, why it happened, and what we changed. A future you, or a reviewer, should be able to see that the problem was found, understood and fixed, not hidden.

## WHY IMPORTANT

It is a real example of a payments failure and proof that the money system was tested with real money, not only simulations. It is also a good item for the Week 30 Day 3 launch checklist and the AI audit.

## DANGER (what breaks without it)

Forgetting it means repeating it: the "send again" button and the weak handling of "still processing" would charge future customers twice.

## WHAT IT SOLVES

Gives one place for the timeline, the cause, the fix, the open follow-ups and the lesson.

## SYSTEM DESIGN PRINCIPLE

Blameless post-mortem: describe what the system did, not who clicked what. Fix the system so the same click cannot cause the same harm.

## RULES

1. State facts and times as seen in the database.
2. Say what is still open.
3. No customer phone numbers or secrets in this file.

## PRACTICAL EXAMPLE

Order for one Polo shirt, KES 320, paid by the developer's own phone against the live Daraja environment from a local machine.

## DECISIONS

- Build a reconcile service that asks Safaricom directly.
- Remove the "Send the request again" button from the waiting screen.
- Add a customer-facing check button and refuse new prompts while an older one is unresolved.
- Keep refunds manual for now; list them for a later refunds screen.

## WHERE USED

Linked from `docs/guides/payment-safety-and-reconcile.md` and the launch checklist.

## TRADEOFFS

We accepted a short delay (15 seconds before the check button) and a manual refund process in exchange for never guessing about money.

## HOW TO USE

Read before changing anything in `payments.controller.js`, `reconcile.service.js` or `PaymentStatus.js`.

---

## PIECE BY PIECE (real life, in simple terms)

**Timeline**  
The customer paid. The first attempt stayed `pending` in our database because the callback handler asks Safaricom before crediting and Safaricom answered 'still processing'. The screen kept loading. After a long wait the customer pressed the then-available 'Send the request again' (a second attempt, 5 minutes later). That second payment was recorded and the order became paid with a receipt. The phone showed two charges: KES 640 for a KES 320 order.

**Cause**  
Three things together: (1) the first confirmation was never applied; (2) a 'send again' button and a 2-minute guard let a second prompt go out while the first might still succeed; (3) nothing asked Safaricom afterwards to settle the first attempt.

**Fix**  
A reconcile service; a guard that asks Safaricom about an older pending attempt before allowing a new prompt; a customer check button; the waiting screen no longer offers 'send again'; status prefers the paid attempt.

**Still open**  
The extra KES 320 has not been refunded (manual refund through M-Pesa). The first attempt stays `pending` in the test database until a check settles it as `refund_needed`. An automatic sweeper and a refunds screen are on the pending list.

**Lesson**  
Never let the customer, or the screen, decide that a payment 'did not happen'. Only the payment provider can say that.

---

## Evidence kept
Database rows at the time: attempt 1 `pending` (08:46), attempt 2 `paid` (08:51), order `paid`. A manual attempt to mark attempt 1 paid was refused by the one-paid-per-order rule, which is exactly the safety we want.
