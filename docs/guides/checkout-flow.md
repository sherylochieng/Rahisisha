# Customer Checkout Flow (shop, basket, pay with M-Pesa, receipt)

**FILE:** `docs/guides/checkout-flow.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

A customer who finds a Rahisisha shop can now add products to a basket, pay with M-Pesa and get a receipt, all without an account. This guide explains how that journey works from the customer's phone to the shop owner's wallet, so that you (or anyone who joins later) can find the right file and understand why it was built that way.

## WHY IMPORTANT

This is the part of Rahisisha that makes money move. A mistake here means a wrong price, a customer charged twice, an order that is never marked paid, or one shop seeing another shop's customers.

## DANGER (what breaks without it)

1. **Prices must never come from the customer's browser.** The server reads every price from its own database. If a browser could send a price, anyone could buy a dress for KES 1.
2. **The order id is the customer's ticket.** It is a long random code. Anyone who has it can see that order's status, so it is never logged and never shown on a shared page.
3. **Only the verified M-Pesa answer marks an order paid.** The checkout code itself never marks anything paid.
4. **A customer can be charged twice** if "pay again" is allowed while an earlier payment is still unresolved. See `payment-safety-and-reconcile.md`.
5. **The public door writes data.** These are the only write routes a stranger can reach, so each one must have its own rules and its own test.

## WHAT IT SOLVES

A seamless, short checkout for impatient buyers: name and M-Pesa number only, pay first, and tell us where to deliver afterwards. No account, no password, no address form before paying.

## SYSTEM DESIGN PRINCIPLE

- **Separation of concerns:** the shop window (read only) and the till (writes) are two files. `storefront.routes.js` only reads. `checkout.routes.js` writes.
- **The server is the single source of truth about money.** The web page only asks and displays.
- **Defence in depth:** the route is public, but every query is locked to one shop by the database (row level security) after `resolveShopBySlug` and `withTenant` run.

## RULES

1. Two calls, not one: **create the order**, then **start the payment**. If the phone prompt fails, the order still exists, and "Try again" repeats only the payment on the SAME order (no ghost orders).
2. The total is always calculated by the server from the database prices. Money is whole cents (KES 320 = 32000).
3. A phone number may receive at most **3 M-Pesa prompts per 10 minutes** (429 when exceeded).
4. The delivery note is **optional, 1 to 300 characters, and only accepted after the order is paid** (or packed).
5. An order id that does not exist, belongs to another shop, or is badly shaped always gets the **same plain 404**, so a stranger cannot learn which ids exist.
6. The status answer never contains the customer's phone number, and is sent with `Cache-Control: no-store`.
7. The basket is emptied only when the server says PAID.

## PRACTICAL EXAMPLE

Amina's Boutique sells a Polo shirt for KES 320.

1. Wanjiru opens `aminas-boutique.localhost:3001` (later `aminas-boutique.rahisishabiashara.com`), taps **Add** on the shirt, then **Checkout**.
2. She types her name and her M-Pesa number and taps **Pay with M-Pesa**.
3. Our server creates the order (KES 320, taken from the database) and sends the prompt to her phone.
4. She enters her PIN. Safaricom tells our server. The order becomes **paid**, the shop's wallet is credited, and her screen shows the green tick and the M-Pesa receipt.
5. She optionally types "Kilimani, gate 3" as the delivery note.

## DECISIONS

- **Pay first, ask delivery later.** Fewer fields before paying means fewer people give up. The delivery note appears after the green tick.
- **M-Pesa only for now.** Pay on delivery is a no.
- **No customer account.** The order id in the browser's memory is the customer's ticket.
- **Name and phone are remembered on that device** so a returning customer taps once.
- **Shopify is the reference model**, tuned for Kenyan buyers on mobile data.

## WHERE USED

API: `apps/api/src/routes/checkout.routes.js`, `controllers/checkout.controller.js`, `controllers/payments.controller.js` (the prompt itself), `services/reconcile.service.js`.
Web: `apps/web/src/lib/checkoutApi.js`, `components/CheckoutForm.js`, `PaymentStatus.js`, `CheckoutFlow.js`, `app/shop/[slug]/checkout/page.js`.
Tests: `apps/api/tests/isolation/checkout.cross-tenant.test.js` (19 tests).

## TRADEOFFS

+ Very short for the customer, and safe by design.
- No customer accounts, so a customer cannot see "my past orders" later (a future feature).
- The pay step reuses the owner-side payment code through a stand-in request. This avoids duplicating money logic but means both must be changed together.
- The 3-prompts-per-phone limit is per phone, not per IP. A per-IP limit is still to do.

## HOW TO USE

Run the API (`npm run dev` in `apps/api`) and the web app (`npm run dev` in `apps/web`), set `ROOT_DOMAIN=localhost` in `apps/api/.env`, then open `http://<shop-slug>.localhost:3001`. To run the tests: `npm test -- checkout` in `apps/api`.

---

## PIECE BY PIECE (real life, in simple terms)

**Create order (POST /checkout)**  
Like a vendor writing your items on a slip. She looks at HER price list, never at the price you shout. The slip gets a long random number: your ticket.

**Pay (POST /orders/:id/pay)**  
Like the vendor pressing the M-Pesa till for your number. She presses it for the amount on HER slip, not an amount you tell her.

**Status (GET /orders/:id)**  
Like asking at the counter 'has my payment come?'. She answers with the order, the amount and the receipt, but never reads out your phone number.

**Delivery note (PATCH /orders/:id/note)**  
After you have paid she asks 'where should the rider bring it?' She will not ask before you pay.

**Check payment (POST /orders/:id/check-payment)**  
You say 'I paid but nothing happened'. She phones Safaricom, finds out, writes it in the book and tells you. See `payment-safety-and-reconcile.md`.

**Same 404 for every wrong ticket**  
If you show a ticket from another kiosk, or a made-up one, she says the same 'I don't know this ticket' to all of them, so nobody can guess which tickets are real.

---

## The five customer endpoints in one table

| What | Method and address | Success | Common refusals |
|---|---|---|---|
| Create the order | `POST /v1/storefront/:slug/checkout` | 201 `{orderId, totalCents, items}` | 400 bad phone, empty basket, quantity 0; 400/404 draft or other shop's product |
| Start the M-Pesa prompt | `POST /v1/storefront/:slug/orders/:orderId/pay` | 202 | 404; 409 `order_not_payable`; 409 `payment_in_progress`; 409 `payments_not_set_up`; 429 too many prompts |
| Payment status | `GET /v1/storefront/:slug/orders/:orderId` | 200 `{orderStatus, totalCents, items, payment:{status,receipt,reason}, deliveryNote}` | 404 |
| Check my payment | `POST /v1/storefront/:slug/orders/:orderId/check-payment` | 200, same shape as status | 404; 429 `too_soon` |
| Delivery note | `PATCH /v1/storefront/:slug/orders/:orderId/note` | 200 | 404; 409 not paid yet; 400 empty or too long |

Full request and response shapes are in `docs/api/customer-checkout-endpoints.md`.

## Failure reasons shown to the customer

The server translates Safaricom's result codes into short words. The raw Safaricom text is never shown.

| Word | Meaning shown |
|---|---|
| `cancelled` | You cancelled the request. No money was taken. |
| `wrong_pin` | The PIN was not correct. |
| `insufficient_funds` | Not enough M-Pesa balance. |
| `timeout` | The request expired before a PIN was entered. |
| `failed` | Something went wrong. If you were charged, contact the shop. |

## Where each file lives (separation of concerns)

- `storefront.routes.js` is the shop window (read only).
- `checkout.routes.js` is the till (writes). It only wires addresses to functions.
- `checkout.controller.js` holds the rules for the five jobs.
- `payments.controller.js` sends the actual M-Pesa prompt (shared with the owner side).
- `reconcile.service.js` asks Safaricom what really happened to a payment.
