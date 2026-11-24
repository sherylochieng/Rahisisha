<!--
=====================================================================
FILE: docs/api-reference.md

WHY THIS FILE EXISTS
  One place that says, for every door of the Rahisisha API: what you send,
  what you get back, which errors can come, and whether you must be logged
  in. It replaces the Week 27 plan (capstone/api.md), which was written
  BEFORE the code and no longer matches it (see section 10).

WHY IMPORTANT
  The web app, your tests, a new teammate and your future self all depend on
  it. If it is wrong, people write code against doors that do not exist.

DANGER
  Docs drift. When a route, a field or an error changes, this file must
  change in the same commit. Every example below was written from the real
  controllers, not from memory.

WHAT IT SOLVES
  "What do I send to create an order, and what does the API say when it
  fails?"  Answer: look here, copy the curl, change the values.

SYSTEM DESIGN PRINCIPLE
  Contract first: the API is a promise to its callers. A promise that is
  written down and honest can be kept.

RULES
  1. Document what the code does today, including the ugly parts.
  2. One curl example per endpoint, runnable as written.
  3. Money is ALWAYS whole cents (KES 350 = 35000).
  4. Never put a shop id in a request body. The shop comes from the login
     cookie (or from the shop address on public doors).

WHERE USED
  Read by: you, teammates, the instructor. Linked from README.md.

TRADEOFFS
  Hand-written, so it can drift. A stretch goal is generating an OpenAPI
  file from the zod schemas so it cannot.

HOW TO USE
  Start the API (port 3000), then run the examples in Git Bash. In
  PowerShell type `curl.exe`, not `curl` (PowerShell's `curl` is a
  different program) and JSON quoting is painful, so Git Bash is easier.
=====================================================================
-->

# Rahisisha API Reference

Last checked against the code: Week 30 Day 2. Base URL on your laptop: `http://localhost:3000`.

---

## 1. Conventions

### Base URL and versioning

There is no `/api` prefix. Doors for the shop owner live under `/v1/...`. Three doors are outside `/v1` because other companies call them: `/ussd`, `/webhooks/whatsapp` and `/callbacks/mpesa/:tenantId`. Plus `/health`.

### Authentication

Login sets an HttpOnly cookie named `token` (a JWT, valid 7 days, `Secure` only when `NODE_ENV=production`). The browser sends it back by itself. In curl you keep it in a cookie file:

```bash
curl -c cookies.txt ...   # save the cookie (use on signup/login)
curl -b cookies.txt ...   # send the cookie (use on every protected call)
```

Each endpoint below says **Auth: cookie** (you must be logged in) or **Auth: none** (public).

The shop is read from the token. You never send a shop id. This is what keeps mama mboga's orders away from the electronics shop next door.

Auth errors on every cookie door:

| Situation | Status | Body |
| --- | --- | --- |
| No cookie | 401 | `{"error":"Not logged in"}` |
| Bad or expired token | 401 | `{"error":"Session expired — please log in again"}` |

### Response shapes (honest version)

The API has two styles. The newer doors (products, orders, payments, dashboard, inbox, wallet, tenants, storefront) use the envelope:

```json
{ "data": <thing or list>, "nextCursor": "<string or null>", "error": null }
```

Errors on those doors:

```json
{ "data": null, "error": { "code": "validation", "message": "...", "details": { "field": "reason" } } }
```

Two things to know: `code` is missing on some errors (for example `{"error":{"message":"Not found"}}`), and `data`/`nextCursor` can be missing on some error bodies. Check the HTTP status first, then `error.message`.

The older auth doors (`/v1/signup`, `/v1/login`, `/v1/me`) do NOT use the envelope. They answer plain objects, and errors look like `{"error":"Invalid credentials"}` (a string, not an object). This is a known inconsistency, listed in section 10.

### Error codes that really exist

| Code | Status | Where |
| --- | --- | --- |
| `validation` | 400 | Bad body, bad `?cursor`, malformed UUID in the URL (`details.id`) |
| `not_found` | 404 | Unknown route, or an order for `/pay` that is not yours |
| `forbidden` | 403 | WhatsApp verify with a wrong token |
| `order_not_payable` | 409 | Paying an order that is not in `created` status |
| `payment_in_progress` | 409 | A payment prompt was sent less than 2 minutes ago |
| `payments_not_set_up` | 409 | The shop has no M-Pesa keys saved |
| `payment_provider_error` | 502 | Safaricom refused or could not be reached |
| `service_unavailable` | 503 | Database is down (header `Retry-After: 10`) |

Other statuses without a `code`: `404 {"error":{"message":"Not found"}}` (product or order not yours or missing), `409` for a duplicate SKU or an illegal order status move.

### Money

Always whole cents in the API: KES 350 is `35000`. The web app divides by 100 for display. Never send decimals.

### Paging

List doors use a keyset cursor, newest first. Send `?limit=` (1 to 100) and `?cursor=` (the `nextCursor` from the last page). When `nextCursor` is `null` you are at the end. A cursor that does not match `[A-Za-z0-9_-]{1,300}` or does not decode gives `400 {"error":{"code":"validation","message":"Invalid cursor"}}`.

Default page sizes: orders 10, products 10, inbox 20, wallet 50, storefront 24 (max 48).

---

## 2. Health

### GET /health

**Auth: none.** Is the API alive? Used by uptime checks and the runbook.

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok" }
```

This does not touch the database. A healthy `/health` with a failing `/v1/...` means Postgres is the problem (see the runbook).

---

## 3. Accounts

### POST /v1/signup

**Auth: none.** Creates a shop, its owner and the login cookie in one go. The shop address (`slug`) is made for you from the business name (`Mama Njeri Fruits` becomes `mama-njeri-fruits`; a taken slug gets `-1`, `-2`...).

Body: `phone` (10 to 20 characters), `name` (2 to 100), `password` (8 to 72), `tenant_name` (2 to 100).

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"phone":"0712345678","name":"Njeri Wanjiku","password":"supersecret1","tenant_name":"Mama Njeri Fruits"}'
```

Success `201`, and a `Set-Cookie: token=...` header:

```json
{ "message": "Account created", "tenant_id": "uuid", "user_id": "uuid" }
```

Errors: `400 {"error":"Validation failed", ...}` (bad fields), `409 {"error":"An account with that phone number already exists"}`, `409 {"error":"That slug is already taken"}`, `503` (database down), `500 {"error":"Signup failed — please try again"}`.

Known bug: a business name made only of symbols gives an empty slug (to fix later).

### POST /v1/login

**Auth: none.** Checks phone and password and sets the cookie.

Body: `phone`, `password`.

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/v1/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"0712345678","password":"supersecret1"}'
```

Success `200`:

```json
{ "message": "Logged in", "tenant_id": "uuid", "user_id": "uuid" }
```

Errors: `400` validation; `401 {"error":"Invalid credentials"}` (unknown phone OR wrong password, the same message on purpose); `403 {"error":"Invalid credentials"}` (the person is not a member of the shop address they are logging in on); `404 {"error":"Tenant not found"}` (the shop address does not exist); `503`; `500`.

The shop address is read from the browser's `Origin`/`Host` when `ROOT_DOMAIN` is set. On a laptop with no `ROOT_DOMAIN` the user's first shop is used.

### GET /v1/me

**Auth: cookie.** Who am I and which shop am I in? The web app calls this to check the login.

```bash
curl -b cookies.txt http://localhost:3000/v1/me
```

```json
{ "user": { "id": "uuid", "name": "Njeri Wanjiku", "phone": "0712345678" },
  "tenant": { "id": "uuid", "name": "Mama Njeri Fruits", "slug": "mama-njeri-fruits" } }
```

Errors: the two 401s above, `404 {"error":"User not found"}`, `500`.

There is no logout door. To log out, the browser must delete the cookie (known gap).

---

## 4. Products

All product doors: **Auth: cookie.** Deleted products are hidden (soft delete). Product `status` is one of `draft`, `active`, `archived`.

### GET /v1/products

List your products, newest first. Query: `limit`, `cursor`.

```bash
curl -b cookies.txt "http://localhost:3000/v1/products?limit=5"
```

```json
{ "data": [ { "id": "uuid", "sku": "TOM-1KG", "name": "Tomatoes 1kg", "description": null,
              "price_cents": 12000, "status": "active", "created_at": "2026-11-20T08:00:00.000Z" } ],
  "nextCursor": null, "error": null }
```

### POST /v1/products

Body: `name` (required, 1+ characters), `priceCents` (required, whole number, 0 or more), `status` (optional), `sku` (optional), `description` (optional).

```bash
curl -b cookies.txt -X POST http://localhost:3000/v1/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Tomatoes 1kg","priceCents":12000,"sku":"TOM-1KG","status":"active"}'
```

Success `201 {"data":{...the new product row...},"error":null}`. Errors: `400 validation` with `details` such as `{"priceCents":"Expected number, received string"}`; `409 {"error":{"message":"Duplicate SKU for this tenant"}}`.

### GET /v1/products/:id

```bash
curl -b cookies.txt http://localhost:3000/v1/products/PRODUCT_ID
```

Success `200 {"data":{...},"error":null}`. Errors: `404 {"error":{"message":"Not found"}}` (missing, deleted, or another shop's), `400 validation` (id is not a UUID).

### PATCH /v1/products/:id

Same fields as create, all optional. Only the fields you send change. (You cannot set a field back to empty with this door.)

```bash
curl -b cookies.txt -X PATCH http://localhost:3000/v1/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{"priceCents":13000}'
```

Success `200` with the updated product. Errors as above.

### DELETE /v1/products/:id

Soft delete: the row stays, `deleted_at` is set.

```bash
curl -b cookies.txt -X DELETE http://localhost:3000/v1/products/PRODUCT_ID -i
```

Success `204` with no body. Error `404`.

These four doors work and are tested at the API. The web app has no screens for editing or deleting yet (GitHub issue #6).

---

## 5. Orders

All order doors: **Auth: cookie.**

Status flow (a one-way line, each step checked by the API):

```
created -> paid -> packed -> sent -> delivered
   any step before "delivered" -> cancelled
```

`delivered` and `cancelled` are final.

### GET /v1/orders

Query: `limit` (default 10, max 100), `cursor`.

```bash
curl -b cookies.txt "http://localhost:3000/v1/orders?limit=10"
```

```json
{ "data": [ { "id": "uuid", "customer_id": "uuid", "status": "created", "channel": "web",
              "total_cents": 24000, "created_at": "2026-11-20T09:15:00.000Z",
              "customer_name": null, "customer_phone": "254712345678" } ],
  "nextCursor": null, "error": null }
```

### POST /v1/orders

Body: `customerPhone` (required), `channel` (`whatsapp`, `web` or `ussd`), `items` (a list; each item has `productId`, a UUID, and `quantity`, a whole number above 0).

```bash
curl -b cookies.txt -X POST http://localhost:3000/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"customerPhone":"0712345678","channel":"web","items":[{"productId":"PRODUCT_ID","quantity":2}]}'
```

Success `201 {"data":{...order...},"error":null}`. The total is worked out by the API from the product prices, never from the request.

Errors: `400 validation` (for example `details["items.0.quantity"]`); `404 {"error":{"message":"One or more products not found"}}` (a product id that is not yours).

### GET /v1/orders/:id

```bash
curl -b cookies.txt http://localhost:3000/v1/orders/ORDER_ID
```

Success `200`. Errors: `404 {"error":{"message":"Not found"}}`, `400` (not a UUID).

### PATCH /v1/orders/:id

Moves the order to the next status. Nothing else about an order can be edited.

Body: `status`, one of `created`, `paid`, `packed`, `sent`, `delivered`, `cancelled`.

```bash
curl -b cookies.txt -X PATCH http://localhost:3000/v1/orders/ORDER_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"packed"}'
```

Success `200 {"data":{...},"error":null}`. Errors: `400 validation` (unknown status); `404`; `409 {"error":{"message":"Cannot move from 'created' to 'sent'"}}`.

### POST /v1/orders/:id/pay

Sends an M-Pesa prompt (STK push) to the customer's phone. Only a `created` order can be paid, and only once.

Body: `phone` (optional; if missing, the customer's phone on the order is used). Kenyan mobile numbers only.

```bash
curl -b cookies.txt -X POST http://localhost:3000/v1/orders/ORDER_ID/pay \
  -H "Content-Type: application/json" \
  -d '{"phone":"0712345678"}'
```

Success is `202 Accepted` ("started, not finished"):

```json
{ "data": { "paymentAttemptId": "uuid", "status": "pending",
            "message": "Check your phone and enter your M-Pesa PIN" }, "error": null }
```

The order only becomes `paid` after Safaricom calls back (section 8). Errors:

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `validation` | Phone not a Kenyan mobile, or total not whole shillings (at least KES 1) |
| 404 | `not_found` | Order not found (or another shop's) |
| 409 | `order_not_payable` | Order is not `created` (already paid or cancelled) |
| 409 | `payment_in_progress` | A prompt was sent under 2 minutes ago |
| 409 | `payments_not_set_up` | This shop has no M-Pesa keys |
| 502 | `payment_provider_error` | Safaricom refused or could not be reached |

Only the M-Pesa sandbox has been tested, not real money (see launch-blockers.md).

---

## 6. Shop pages

### GET /v1/dashboard

**Auth: cookie.** The numbers on the home screen.

```bash
curl -b cookies.txt http://localhost:3000/v1/dashboard
```

```json
{ "data": { "ordersToday": 3, "balanceCents": 120000,
            "latestProducts": [ { "id": "uuid", "name": "Tomatoes 1kg", "price_cents": 12000,
                                  "status": "active", "created_at": "..." } ] } }
```

This one has no `error` or `nextCursor` key. `balanceCents` comes from the wallet ledger, so it always agrees with `/v1/wallet/entries`.

### GET /v1/inbox

**Auth: cookie.** Messages that arrived (WhatsApp, USSD, web). Query: `limit` (default 20), `cursor`.

```bash
curl -b cookies.txt "http://localhost:3000/v1/inbox?limit=20"
```

```json
{ "data": [ { "id": "uuid", "channel": "whatsapp", "from": "254712345678",
              "body": "Do you have sukuma wiki?", "createdAt": "..." } ],
  "nextCursor": null, "error": null }
```

### GET /v1/wallet/entries

**Auth: cookie.** The money ledger (every shilling in or out), newest first. Query: `limit` (default 50), `cursor`.

```bash
curl -b cookies.txt "http://localhost:3000/v1/wallet/entries"
```

Each row has `reference`, `amountCents`, `balanceAfterCents`, `dayTotalCents`, `day` (Nairobi date, `YYYY-MM-DD`), `reason`, `createdAt`.

---

## 7. Public doors (no login)

### GET /v1/tenants/by-slug/:slug

**Auth: none.** Does this shop exist? Used by the web app to decide whether to show a shop page. Only `active` shops are found.

```bash
curl http://localhost:3000/v1/tenants/by-slug/mama-njeri-fruits
```

```json
{ "data": { "id": "uuid", "name": "Mama Njeri Fruits", "slug": "mama-njeri-fruits" }, "error": null }
```

Error: `404 {"data":null,"error":{"message":"Shop not found"}}` (also for a badly shaped slug).

### GET /v1/storefront/:slug

**Auth: none.** The public shop window: shop name plus only the four product fields a stranger may see (`id`, `name`, `description`, `price_cents`). Query: `limit` (default 24, max 48), `cursor`.

```bash
curl "http://localhost:3000/v1/storefront/mama-njeri-fruits?limit=24"
```

```json
{ "data": { "shop": { "name": "Mama Njeri Fruits", "slug": "mama-njeri-fruits" },
            "products": [ { "id": "uuid", "name": "Tomatoes 1kg", "description": null, "price_cents": 12000 } ] },
  "nextCursor": null, "error": null }
```

Errors: `404 {"error":{"message":"Shop not found"}}`; `400` bad cursor.

The storefront is view-only today. There is no cart, checkout or customer pay door yet (online shop roadmap).

---

## 8. Channels

### POST /ussd

**Auth: none** (Africa's Talking calls it). Form-encoded, not JSON. Fields: `serviceCode`, `sessionId`, `phoneNumber`, `text`. The `serviceCode` picks the shop. The reply is plain text starting `CON ` (keep the menu open) or `END ` (close it). No session is stored: the whole path is in `text` (`"1"`, `"2"`, `"1*2"`).

```bash
curl -X POST http://localhost:3000/ussd \
  -d "serviceCode=*384*1234#" -d "sessionId=abc123" \
  -d "phoneNumber=+254712345678" -d "text="
```

Menu: empty text shows the welcome menu, `1` lists products, `2` shows the balance, `3` says goodbye. Tested by curl only, never on a real phone.

### GET /webhooks/whatsapp

**Auth: none** (Meta calls it, once, when you connect a number). Meta sends `hub.mode`, `hub.verify_token`, `hub.challenge`. If the token matches some shop, the plain-text challenge is returned with `200`. Otherwise `403 {"data":null,"error":{"code":"forbidden","message":"Verification failed"}}`.

```bash
curl "http://localhost:3000/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=12345"
```

### POST /webhooks/whatsapp

**Auth: none** (Meta). The body is Meta's message JSON. The shop is found from `phone_number_id`; each message is saved once, using its `wamid` to skip repeats. Answer: `200 {"data":{"received":1,"duplicates":0},"error":null}`, or `200 {"data":{"ignored":true},"error":null}` when the number belongs to no shop. WhatsApp is simulated, not connected to a real Meta account (see launch-blockers.md).

### POST /callbacks/mpesa/:tenantId

**Auth: none** (Safaricom calls it after the customer enters, or refuses to enter, their PIN). The body is Daraja's callback JSON. On a good payment: the attempt becomes `success`, the order becomes `paid` and the wallet is credited, exactly once. The answer to Safaricom is always:

```json
{ "ResultCode": 0, "ResultDesc": "Accepted" }
```

It is `200` for almost everything, even unknown shops or ids, so outsiders learn nothing. Locally it needs an ngrok tunnel (`DARAJA_CALLBACK_BASE`).

---

## 9. Quick walk-through (copy and run in order)

```bash
# 1 sign up (saves the cookie)
curl -c cookies.txt -X POST http://localhost:3000/v1/signup -H "Content-Type: application/json" \
  -d '{"phone":"0711000111","name":"Test Owner","password":"supersecret1","tenant_name":"Test Duka"}'
# 2 add a product, copy the "id" from the answer
curl -b cookies.txt -X POST http://localhost:3000/v1/products -H "Content-Type: application/json" \
  -d '{"name":"Maize flour 2kg","priceCents":15000,"status":"active"}'
# 3 make an order with that id
curl -b cookies.txt -X POST http://localhost:3000/v1/orders -H "Content-Type: application/json" \
  -d '{"customerPhone":"0711000222","channel":"web","items":[{"productId":"PASTE_ID","quantity":1}]}'
# 4 see the shop window anyone can open
curl http://localhost:3000/v1/storefront/test-duka
```

---

## 10. Differences from the Week 27 plan (capstone/api.md)

`capstone/api.md` was a design written before the code. It is kept for history. Where it disagrees with the code, this file is right:

| Week 27 plan said | Real API |
| --- | --- |
| Base URL `http://localhost:4000/api/v1` | `http://localhost:3000/v1` (no `/api`) |
| Cookie named `session` | Cookie named `token` |
| Error codes `validation_error`, `unauthorized`, `forbidden`, `conflict`, `unprocessable`, `server_error` | `validation`, `not_found`, `forbidden`, `order_not_payable`... (table in section 1); 401 and 409 often have no `code` |
| Every error is `{"error":{"code","message","details"}}` | True for the newer doors only; signup, login and me answer `{"error":"text"}` |

## 11. Not built yet (honest list)

- Product edit and delete screens in the web app (API doors exist). GitHub issue #6.
- Logout door, password reset, token refresh.
- Shop settings door (M-Pesa and WhatsApp keys are saved by seed scripts, not by an API).
- Cart, checkout and customer-side pay doors.
- No rate limiting on login.
- Error shapes are not yet the same on every door (section 1).

## PIECE BY PIECE (simple words)

**The cookie** is your wristband at a matatu SACCO office. You show it at the gate (login), and after that every door checks the band, never a shop id you type yourself.

**The envelope** `{data, nextCursor, error}` is the same brown paper bag every time: open it, look at `error` first. If it is `null`, `data` is your shopping.

**Cents** are like M-Pesa's whole shillings: no half coins, so no rounding fights.

**The cursor** is a bookmark. The API says "you stopped at this page", you give the bookmark back and it continues from there, even if new orders arrived meanwhile.

**202 on pay** means "I have sent the prompt to the phone", like a waiter who has taken your order to the kitchen. The food (the paid order) only arrives when Safaricom calls back.

**The 200 to Safaricom for everything** is a receptionist who says "received, thank you" to every courier, so nobody can learn which parcels belong here.