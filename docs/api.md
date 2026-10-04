# Rahisisha - API Reference (API.md)

Week 27 Day 4 · Sheryl Ochieng · Mctaba Labs Capstone

---

## Conventions

### Base URL
```
http://localhost:4000/api/v1          (local development)
https://api.rahisisha.co.ke/api/v1   (production)
```

### Versioning
Every endpoint starts with `/v1/`. Adding a new field to a response is NOT a
breaking change. Removing a field or changing a type IS a breaking change and
requires a new `/v2/` prefix alongside the existing `/v1/`.

### Authentication
Every protected endpoint requires a session cookie set at login.
Tenant identity is derived from the session — never from the request body.

### Request format
```
Content-Type: application/json
Cookie: session=<session_id>
```

### Success envelope
```json
{ "data": { ... } }
```

### Error envelope
```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable message",
    "details": { "field": "reason" }
  }
}
```

### Standard error codes
| Code | HTTP status | Meaning |
| --- | --- | --- |
| `validation_error` | 400 | Request body failed Zod validation |
| `unauthorized` | 401 | No session or session expired |
| `forbidden` | 403 | Authenticated but not allowed |
| `not_found` | 404 | Resource not found or belongs to another tenant |
| `conflict` | 409 | Duplicate slug, phone, SKU etc. |
| `unprocessable` | 422 | Business rule violation |
| `server_error` | 500 | Unexpected server error |

### Pagination
All list endpoints use cursor-based pagination:
```json
{
  "data": [ ... ],
  "meta": { "cursor": "next_cursor", "hasMore": true, "limit": 20 }
}
```
Pass `?cursor=<value>&limit=<n>` to get the next page.

### Money
All amounts are in KES cents (integer). KES 350.00 = 35000. Never floats.

---

## AUTH

### POST /api/v1/auth/signup
Create a new tenant + owner account atomically.
**Access:** Public

Request:
```json
{
  "businessName": "Amina's Boutique",
  "subdomain": "aminas-boutique",
  "phone": "+254700000001",
  "password": "Demo1234!",
  "name": "Amina Wanjiru"
}
```
Response 201: `{ "data": { "tenantId", "subdomain", "userId" } }`
Errors: 409 subdomain taken · 409 phone registered · 422 reserved subdomain · 400 validation

---

### POST /api/v1/auth/login
Log in and receive a session cookie.
**Access:** Public

Request: `{ "phone": "+254700000001", "password": "Demo1234!" }`
Response 200: `{ "data": { "userId", "tenantId", "role", "subdomain" } }`
Sets: `Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Strict`
Errors: 401 wrong credentials (same message for both — never leak which) · 403 suspended

---

### POST /api/v1/auth/logout
Destroy the session.
**Access:** Authenticated
Response 204: No body

---

### GET /api/v1/auth/me
Return current authenticated user and tenant.
**Access:** Authenticated
Response 200: `{ "data": { "userId", "name", "phone", "tenantId", "subdomain", "role", "plan" } }`

---

## BRAND SETTINGS

### GET /api/v1/brand
Get the tenant's brand profile.
**Access:** Authenticated (owner)
Response 200: `{ "data": { "logoUrl", "primaryColour", "tone", "deliveryAreas", "returnPolicy", "workingHours", "whatsappNumber" } }`

---

### PATCH /api/v1/brand
Update brand profile. All fields optional.
**Access:** Authenticated (owner)
Request: `{ "primaryColour", "tone", "deliveryAreas", "returnPolicy", "workingHours", "whatsappNumber" }`
Response 200: Updated brand profile

---

### POST /api/v1/brand/logo
Upload tenant logo. multipart/form-data, max 2MB.
**Access:** Authenticated (owner)
Response 200: `{ "data": { "logoUrl": "..." } }`

---

## PRODUCTS

### GET /api/v1/products
List products. Cursor-paginated. Query: `?status=active&cursor=xxx&limit=20`
**Access:** Authenticated (owner)
Response 200: Array of products with variantCount and totalStock

---

### POST /api/v1/products
Create a new product.
**Access:** Authenticated (owner)
Request: `{ "name", "description", "priceCents", "sku" }`
Response 201: Created product with status = "draft"

---

### GET /api/v1/products/:id
Get a product with its variants and approved media.
**Access:** Authenticated (owner)
Response 200: Full product object
Errors: 404 not found or belongs to another tenant

---

### PATCH /api/v1/products/:id
Update product details. All fields optional.
**Access:** Authenticated (owner)
Request: `{ "name", "description", "priceCents", "status" }`
Response 200: Updated product
Errors: 404

---

### DELETE /api/v1/products/:id
Soft delete (sets deleted_at).
**Access:** Authenticated (owner)
Response 204: No body

---

## VARIANTS

### POST /api/v1/products/:id/variants
Add a variant to a product.
**Access:** Authenticated (owner)
Request: `{ "size", "colour", "measurements", "stock", "priceCents" }`
Response 201: Created variant

---

### PATCH /api/v1/products/:id/variants/:variantId
Update variant stock, price, or measurements.
**Access:** Authenticated (owner)
Response 200: Updated variant

---

### DELETE /api/v1/products/:id/variants/:variantId
Soft delete a variant.
**Access:** Authenticated (owner)
Response 204: No body

---

## MEDIA — PHOTO ENHANCEMENT

### POST /api/v1/products/:id/media
Upload a product photo and queue enhancement job.
**Access:** Authenticated (owner)
Request: multipart/form-data, field: photo, max 10MB
Response 202: `{ "data": { "mediaId", "originalUrl", "enhancedUrl": null, "approved": false } }`

---

### POST /api/v1/products/:id/media/:mediaId/approve
Owner approves enhanced photo — makes it public on storefront.
**Access:** Authenticated (owner)
Response 200: `{ "data": { "mediaId", "approved": true, "approvedAt" } }`

---

### DELETE /api/v1/products/:id/media/:mediaId
Delete a media item. Original retained server-side.
**Access:** Authenticated (owner)
Response 204: No body

---

## STOREFRONT (PUBLIC)

### GET /api/v1/public/:shopSlug
Get the tenant's public storefront — business details and active products.
**Access:** Public (no auth required)
Response 200: `{ "data": { "businessName", "logoUrl", "primaryColour", "whatsappNumber", "products": [...] } }`
Errors: 404 shop not found

---

### GET /api/v1/public/:shopSlug/products/:id
Get a single product on the public storefront.
**Access:** Public
Response 200: Product with variants and approved media only
Errors: 404 product not active or shop not found

---

## CHAT

### POST /api/v1/public/:shopSlug/chat
Customer sends a message via the web chat widget.
**Access:** Public
Request: `{ "phone": "+254711000001", "message": "Do you have size M?" }`
Response 200: `{ "data": { "reply": "AI answer here", "conversationId" } }`

---

### POST /api/v1/webhooks/whatsapp
Incoming WhatsApp message from Meta Cloud API.
**Access:** Webhook — Meta HMAC signature verified server-side before processing
Response 200: `{ "status": "received" }`
Note: Tenant identified by phone_number_id. Reply sent async via WhatsApp API.

---

## CHECKOUT

### POST /api/v1/public/:shopSlug/checkout
Reserve stock and trigger M-Pesa STK push.
**Access:** Public
Request: `{ "variantId", "quantity", "customerPhone", "customerName" }`
Response 202: `{ "data": { "orderId", "reservationId", "message": "Check phone for M-Pesa prompt", "expiresAt" } }`
Errors: 422 insufficient stock · 422 variant not active

---

### POST /api/v1/webhooks/mpesa
M-Pesa Daraja payment callback.
**Access:** Webhook — Daraja signature verified before processing
Response 200: `{ "ResultCode": 0, "ResultDesc": "Success" }`
Note: Idempotent — duplicate callbacks silently ignored via webhook_events table.
Stock only decrements here, never at checkout.

---

## ORDERS

### GET /api/v1/orders
List orders. Query: `?status=paid&cursor=xxx&limit=20`
**Access:** Authenticated (owner)
Response 200: Array of orders with customer name, total, status, itemCount

---

### GET /api/v1/orders/:id
Get a single order with full line items.
**Access:** Authenticated (owner)
Response 200: Order with items array (product name, variant label, unit price, quantity)
Errors: 404

---

### PATCH /api/v1/orders/:id/status
Update order status.
**Access:** Authenticated (owner)
Request: `{ "status": "packed" }`
Valid transitions: paid → packed → sent → delivered · any → cancelled
Response 200: Updated order
Errors: 422 invalid transition · 404

---

### POST /api/v1/orders/:id/rating
Customer rates a delivered order.
**Access:** Public (customer identified by phone)
Request: `{ "customerPhone", "score": 5, "comment": "Beautiful dress!" }`
Response 201: Rating saved

---

## DASHBOARD

### GET /api/v1/dashboard/summary
Owner dashboard numbers — all calculated in SQL, never by AI.
**Access:** Authenticated (owner)
Response 200:
```json
{
  "data": {
    "today": { "orderCount": 3, "revenueCents": 1050000 },
    "thisMonth": { "orderCount": 24, "revenueCents": 8400000 },
    "walletBalanceCents": 7560000,
    "lowStockVariants": [ { "productName", "variantLabel", "stock" } ],
    "recentOrders": [ ... ],
    "aiMessagesUsed": 4,
    "aiMessagesLimit": 1000
  }
}
```

---

### POST /api/v1/dashboard/ask
Owner asks the AI a free-text question about their business.
**Access:** Authenticated (owner)
Request: `{ "question": "How many blue dresses do I have left?" }`
Response 200: `{ "data": { "answer": "You have 3 blue dresses across all sizes..." } }`
Note: SQL calculates numbers first. AI only phrases the answer in plain language.

---

## INBOX

### GET /api/v1/inbox
Unified inbox — latest conversation per customer, all channels.
**Access:** Authenticated (owner)
Response 200: Array of conversations with customer info and last message preview

---

### GET /api/v1/inbox/:conversationId/messages
All messages in a conversation, oldest first.
**Access:** Authenticated (owner)
Response 200: Array of messages with direction, sender, body, createdAt

---

## WALLET

### GET /api/v1/wallet
Wallet balance and recent statement.
**Access:** Authenticated (owner)
Response 200: `{ "data": { "balanceCents": 7560000, "entries": [...], "meta": {...} } }`

---

## PLATFORM ADMIN

### GET /api/v1/admin/tenants
List all tenants on the platform.
**Access:** Platform admin only
Response 200: Array of tenants with plan, status, AI usage this month

---

### PATCH /api/v1/admin/tenants/:id/suspend
Suspend a tenant — blocks all logins immediately.
**Access:** Platform admin only
Request: `{ "reason": "Payment overdue" }`
Response 200: `{ "data": { "tenantId", "status": "suspended" } }`

---

## Summary

| Area | Endpoints | Access |
| --- | --- | --- |
| Auth | 4 | Public + authenticated |
| Brand settings | 3 | Owner |
| Products | 5 | Owner |
| Variants | 3 | Owner |
| Media | 3 | Owner |
| Storefront | 2 | Public |
| Chat | 2 | Public + webhook |
| Checkout | 2 | Public + webhook |
| Orders | 4 | Owner + public |
| Dashboard | 2 | Owner |
| Inbox | 2 | Owner |
| Wallet | 1 | Owner |
| Platform admin | 2 | Admin |
| **Total** | **35** | |

---

## Versioning notes

- All endpoints prefixed `/v1/` from day one
- Adding a new field to a response = NOT a breaking change
- Removing a field or changing a type = breaking change → needs `/v2/`
- `/v1/` stays alive until all clients confirm migration to `/v2/`
- Deprecation notice added to response headers 90 days before removal