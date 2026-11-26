# API Reference: public storefront and customer checkout endpoints

**FILE:** `docs/api/customer-checkout-endpoints.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

The main `docs/api-reference.md` has not yet been updated for the customer checkout. This file holds the exact shapes of the public endpoints so they can be merged into the main reference when all documents are updated at the end.

## WHY IMPORTANT

These are the only write endpoints a stranger can call without logging in. Anyone building a client (web, WhatsApp, USSD) must know exactly what they accept and refuse.

## DANGER (what breaks without it)

Clients that guess the shapes may send prices (ignored), show raw errors to customers, or retry payment in ways that could double charge.

## WHAT IT SOLVES

One place with the request, the answer and every error code for each public customer endpoint.

## SYSTEM DESIGN PRINCIPLE

Every answer uses the same envelope: `{ "data": ..., "nextCursor": ..., "error": null }` on success, `{ "data": null, "error": { "code", "message", "details"? } }` on failure.

## RULES

1. All addresses start with `/v1/storefront/:slug` (the shop's address word). No login cookie is needed or sent.
2. Money is whole cents.
3. Phone numbers are accepted like `0712345678` and stored like `254712345678`. Status answers never include the phone.
4. Status-type answers are sent with `Cache-Control: no-store`.

## PRACTICAL EXAMPLE

`POST /v1/storefront/aminas-boutique/checkout` with `{"name":"Wanjiru","phone":"0712345678","items":[{"productId":"<uuid>","quantity":1}]}` returns 201 with the new `orderId` and the server's own total.

## DECISIONS

- The unknown order, another shop's order and a badly shaped id all return the identical 404 `not_found` ("Order not found").
- `check-payment` is a POST because it can change data (it records what Safaricom says).

## WHERE USED

Web app `apps/web/src/lib/checkoutApi.js`; future WhatsApp and USSD buying flows.

## TRADEOFFS

+ Small, uniform, easy to test.
- No per-IP rate limit yet (only per phone for prompts, per order for checks).

## HOW TO USE

Merge the tables below into `docs/api-reference.md` when the final documentation update is done.

---

## PIECE BY PIECE (real life, in simple terms)

**Envelope**  
Every answer comes in the same envelope, like every M-Pesa message having the same layout. Clients always know where to look.

**Ticket (orderId)**  
The long random number on the customer's slip. Whoever holds it can ask about that order, so it is never printed in logs.

---

## 1. Create the order

`POST /v1/storefront/:slug/checkout`

Request:
```json
{ "name": "Wanjiru", "phone": "0712345678",
  "items": [ { "productId": "<uuid>", "quantity": 1 } ] }
```
Rules: `name` 1 to 80 characters; `phone` a valid Kenyan M-Pesa number; 1 to 30 `items`; each `quantity` 1 to 50. The same product listed twice becomes one line with the quantities added.

Answer 201: `{ "data": { "orderId": "<uuid>", "totalCents": 32000, "items": [ { "name", "quantity", "unitPriceCents" } ] }, "error": null }`

Errors: 400 `validation` (bad details, bad phone, quantity too big, total under KES 1); 404 `items_unavailable` (a product is not for sale in this shop, or is a draft or another shop's product); 404 for an unknown shop.

## 2. Start the M-Pesa prompt

`POST /v1/storefront/:slug/orders/:orderId/pay` (empty body; the phone saved with the order is used)

Answer 202: the prompt was sent. This does NOT mean paid.

Errors: 404 `not_found`; 409 `order_not_payable` (already paid, or can no longer be paid); 409 `payment_in_progress` (an earlier payment is still being checked with M-Pesa); 409 `payments_not_set_up` (the shop has no M-Pesa settings); 429 `too_many_attempts` (3 prompts per phone in 10 minutes); 400 `validation` (bad phone).

## 3. Payment status

`GET /v1/storefront/:slug/orders/:orderId`

Answer 200:
```json
{ "data": { "orderId": "<uuid>", "orderStatus": "created|paid|packed|...",
  "totalCents": 32000,
  "items": [ { "name": "Polo shirt", "quantity": 1, "unitPriceCents": 32000 } ],
  "payment": { "status": "none|pending|paid|failed", "receipt": null, "reason": null },
  "deliveryNote": null }, "error": null }
```
`receipt` is set only when paid and only if Safaricom gave a receipt (a payment settled by a check has none). `reason` is set only when failed: `cancelled`, `wrong_pin`, `insufficient_funds`, `timeout`, `failed`. If a paid attempt exists, it is the one shown.

## 4. Check my payment

`POST /v1/storefront/:slug/orders/:orderId/check-payment` (empty body)

Asks Safaricom what happened to any pending payment of this order, records the answer, and returns the same shape as the status endpoint. Look at `payment.status`: `paid` (show the receipt screen), `failed` (nothing was paid; a new prompt is allowed), `pending` (Safaricom has not decided; wait and do not pay again).

Errors: 404 `not_found`; 429 `too_soon` (one check per order every 5 seconds).

## 5. Delivery note

`PATCH /v1/storefront/:slug/orders/:orderId/note` with `{ "note": "Kilimani, gate 3" }`

Rules: 1 to 300 characters, accepted only when the order is paid or packed.
Errors: 400 `validation`; 404 `not_found`; 409 `order_not_paid`.

## Public shop window

`GET /v1/storefront/:slug?limit=24&cursor=<bookmark>` returns `{ data: { shop: { name, slug }, products: [ { id, name, description, price_cents, image_url } ] }, nextCursor, error }`. Only active products. `limit` 1 to 48. 404 for an unknown, suspended or deleted shop.
