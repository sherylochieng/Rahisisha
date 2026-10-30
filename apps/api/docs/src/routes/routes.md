# products.routes.js and orders.routes.js

**Location:** `apps/api/src/routes/`

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

## THE ADDRESSES

Mounted in `app.js` behind `requireAuth` and `withTenant`.

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
