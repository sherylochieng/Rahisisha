# products.routes.js, orders.routes.js, dashboard.routes.js and tenants.routes.js

**Location:** `apps/api/src/routes/`
**Last updated:** Week 28 Day 5 (added dashboard and tenants)

---

## WHY THESE FILES EXIST

They are the **address book**. Each line says: "when someone calls this method and URL, run this function."

They contain **no logic**. The controllers do the work.

---

## WHY IMPORTANT

The addresses are a **contract**. A frontend, a grader or a customer depends on the exact paths. Changing one breaks them.

---

## DANGER

- Forgetting `asyncHandler` on a route: a crash hangs the request.
- Forgetting to **import** `asyncHandler` in the file: `ReferenceError`.
- Renaming an address without updating docs and callers.
- Mounting a private route without `requireAuth` and `withTenant`, which would expose a shop's data. The only route that is public on purpose is `/v1/tenants/by-slug/:slug`.

---

## WHAT THEY SOLVE

A clear, short map from URL to function.

---

## SYSTEM DESIGN PRINCIPLE

- **Separation of concerns:** routes wire, controllers think, middleware guards.
- **An API address is a contract.**

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Every Express project. One routes file per resource.

---

## TRADEOFFS

Wrapping every route in `asyncHandler` is a little repetitive, but it is explicit and impossible to forget quietly in review.

---

## HOW TO USE

```js
import { asyncHandler } from '../middleware/asyncHandler.js';
router.get('/:id', asyncHandler(getProduct));
```

---

## HOW EACH ROUTER IS MOUNTED (in `app.js`)

| Prefix | Guards before the controller | Who can call it |
|---|---|---|
| `/v1/products` | `requireAuth`, `withTenant` | A logged-in shop |
| `/v1/orders` | `requireAuth`, `withTenant` | A logged-in shop |
| `/v1/dashboard` | `requireAuth`, `withTenant` | A logged-in shop |
| `/v1/tenants` | **none (public on purpose)** | Anyone |

The auth routes (`/v1/signup`, `/v1/login`, `/v1/me`) are in `routes/auth/` and have their own guides in `docs/src/routes/auth/`.

---

## THE ADDRESSES

### Products: `/v1/products`

| Method | Path | Function |
|---|---|---|
| GET | `/` | listProducts |
| POST | `/` | createProduct |
| GET | `/:id` | getProduct |
| PATCH | `/:id` | updateProduct |
| DELETE | `/:id` | deleteProduct |

### Orders: `/v1/orders`

| Method | Path | Function |
|---|---|---|
| GET | `/` | listOrders |
| POST | `/` | createOrder |
| GET | `/:id` | getOrder |
| PATCH | `/:id` | updateOrderStatus |

**Why `PATCH /:id` and not `/:id/status`?** The assignment says `PATCH /v1/orders/:id`. We matched the contract. The state machine rules did not change, only the address.

### Dashboard: `/v1/dashboard` (file: `dashboard.routes.js`)

| Method | Path | Function |
|---|---|---|
| GET | `/` | getDashboard |

Returns `{ data: { ordersToday, balanceCents, latestProducts } }` for the logged-in shop. Guide: `docs/src/controllers/dashboard.controller.md`.

### Tenants: `/v1/tenants` (file: `tenants.routes.js`)

| Method | Path | Function |
|---|---|---|
| GET | `/by-slug/:slug` | getTenantBySlug |

**Public on purpose.** The website's gate guard (`proxy.js`) calls it to turn an address word into a shop, before anybody has logged in. It returns only `id`, `name` and `slug`, and the same 404 for a bad word, an unknown shop or an inactive shop. Guide: `docs/src/controllers/tenants.controller.md`.