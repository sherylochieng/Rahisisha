# orders.controller.js

**Location:** `apps/api/src/controllers/orders.controller.js`

---

## WHY THIS FILE EXISTS

It holds the work for `/v1/orders`.

Orders are harder than products for two reasons:

1. Creating one touches **several tables**, so it needs a **transaction**.
2. Status changes follow a **state machine** (you cannot skip steps).

---

## WHY IMPORTANT

Orders are money. A wrong status or a half-saved order is a real business problem.

---

## DANGER

- No transaction: an order with no items.
- No state machine: an order "delivered" before it was paid.
- Missing `tenant_id` in an INSERT: rows that belong to nobody.

---

## WHAT IT SOLVES

Four endpoints: list, create, get one, change status.

---

## SYSTEM DESIGN PRINCIPLE

- **Transactions:** all or nothing.
- **State machine:** only legal moves.
- **Snapshot of price at purchase:** history never changes.
- **Money as integer cents.**

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Orders, bookings, subscriptions, payments, support tickets. Anything with steps.

---

## TRADEOFFS

- A transaction is safer, but holds locks a little longer.
- The state machine is strict. New statuses mean editing one table.
- Orders cannot be edited after creation. Safer, but corrections need a new order.

---

## HOW TO USE

```js
router.post('/', asyncHandler(createOrder));
router.patch('/:id', asyncHandler(updateOrderStatus));
```

---

## THE STATE MACHINE

```
created → paid → packed → sent → delivered
```

`cancelled` is allowed from created, paid, packed and sent.
`delivered` and `cancelled` are **final**.

```js
const STATUS_TRANSITIONS = {
  created:   ['paid', 'cancelled'],
  paid:      ['packed', 'cancelled'],
  packed:    ['sent', 'cancelled'],
  sent:      ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};
```

**Think of it like this:** a board game. Only some moves are legal.

---

## THE FUNCTIONS, ONE BY ONE

### validationError(res, zodError)

Same helper as in products. Uses `issue.path.join('.')`, so a bad item shows as `items.0.quantity`.

### listOrders: GET /v1/orders

Cursor pagination, exactly like products (`limit + 1`, `ORDER BY id`).

### createOrder: POST /v1/orders

Validates the body, then runs inside `BEGIN ... COMMIT`:

1. **Upsert the customer** (insert, or reuse if the phone already exists for this tenant).
2. **Fetch the products** being ordered.
3. If any product is missing, **ROLLBACK** and return **404**.
4. **Calculate the total** in cents.
5. **Insert the order** with status `created` (with `tenant_id`).
6. **Insert one `order_items` row per product**, copying name and price **at that moment**.
7. **COMMIT**, return **201**.

If anything throws: **ROLLBACK**, then re-throw so the central handler answers.

**Why copy the price?** If the owner changes the price tomorrow, today's order must still show today's price.

### getOrder: GET /v1/orders/:id

**404** if not found or if it belongs to another tenant.

### updateOrderStatus: PATCH /v1/orders/:id

The **only** thing an order allows you to change is its status.

1. Check the new status is a real one:

```js
if (!nextStatus || !Object.hasOwn(STATUS_TRANSITIONS, nextStatus)) {
  // 400 validation, details: { status: 'must be one of the valid statuses' }
}
```

`Object.hasOwn` asks "is this on **my own** list?". The older `in` also matched hidden names like `constructor`.

2. Fetch the current status. **404** if missing.
3. Check `STATUS_TRANSITIONS[current].includes(next)`. If not, **409**.
4. Update the status and `updated_at`, return the order.

---

## STATUS CODES USED

| Code | When |
|---|---|
| 201 | Order created |
| 400 | Bad input, unknown status, malformed ID |
| 404 | Order or product not found (or another tenant's) |
| 409 | Illegal status move |

---

## KNOWN POINTS TO WATCH

- Two comments are out of date: a mention of `FOR UPDATE` in `createOrder` (the query does not use it) and a claim that `listOrders` supports `?status=` and `?channel=` filters (it does not yet).
- Order status check returns 400, but a legal-format-but-illegal move returns 409 on purpose: the input is valid, the **state** conflicts.
