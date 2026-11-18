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

---

## Follow-up to Week 29 Day 4: `listOrders` now pages by keyset and shows the customer

**What changed.** `listOrders` used to page by order id. It now pages newest first on `(created_at, id)`, the same keyset rule the Inbox and Payments pages use (`utils/keysetCursor.js`), and it joins `customers` so each order carries `customer_name` and `customer_phone`.

**Why.** The Orders page in the web app has to show "who ordered" and has to load older orders without skipping or repeating any. Paging by id cannot do that once orders are sorted by time, because two orders can share the same second.

**How it works, piece by piece.**
- `limit` is read as a whole number from 1 to 100; the default is 10. A value outside that range is clamped, not trusted.
- `cursor` is decoded with `decodeCursor`. A cursor that is not ours gives `400 { data: null, error: { code: 'validation', message: 'Invalid cursor' } }` and no database query runs. Real-life example: someone edits the address bar and types `cursor=hello`; they get a clear refusal, not a server error.
- The query is `ORDER BY o.created_at DESC, o.id DESC` with `WHERE (o.created_at, o.id) < ($cursorTime, $cursorId)`. Two orders created in the same microsecond still have a fixed order because the id breaks the tie.
- `CURSOR_TS_SQL('o.created_at')` gives the time as text with 6 decimals so the cursor does not lose microseconds. The helper column `cursor_ts` is used to build `nextCursor` and then removed from each row before the answer is sent.
- `LEFT JOIN customers`: an order whose customer is missing still shows up, with empty name and phone. Real-life example: a walk-in sale with no saved customer must not vanish from the list.

**Danger.** Both tables are covered by the `tenant_isolation` lock because the query runs inside `withTenant`. Never run it on the bare pool: the join would then be the one place another shop's customer names could leak.

**Tests.** `tests/orders.list.test.js` (8 checks): newest first, paging by 1, 2 and 3 loses and repeats nothing, customer fields present, bad cursor gives 400, limit is capped, and shop B never sees shop A's orders. Guide: `docs/tests/orders.list.test.md`.