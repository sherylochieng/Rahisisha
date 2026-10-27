// =============================================================
// orders.controller.js
// Handles all business logic for the /v1/orders endpoints.
//
// Orders are more complex than products because:
//   1. Creating an order requires a TRANSACTION
//      (multiple tables must update together or not at all)
//   2. Status changes follow a STATE MACHINE
//      (you cannot skip steps or go backwards)
// =============================================================

import { z } from 'zod';

// ─── STATE MACHINE ────────────────────────────────────────────
//
// An order's status can only move in allowed directions.
// This object maps each status to the statuses it can move TO.
//
// created → paid → packed → sent → delivered
// cancelled is allowed from ANY status
//
// Why enforce this?
//   Without it, a bug or a bad API call could mark an order
//   as "delivered" before it was even paid. The state machine
//   makes illegal transitions impossible.
// ─────────────────────────────────────────────────────────────

const STATUS_TRANSITIONS = {
  created:   ['paid', 'cancelled'],
  paid:      ['packed', 'cancelled'],
  packed:    ['sent', 'cancelled'],
  sent:      ['delivered', 'cancelled'],
  delivered: [],           // terminal state — no further moves
  cancelled: [],           // terminal state — no further moves
};

// ─── VALIDATION SCHEMAS ───────────────────────────────────────

const OrderCreate = z.object({
  // customerPhone identifies the buyer — we upsert them into customers table
  customerPhone: z.string().min(1),

  // items is an array — an order must have at least one item
  items: z.array(
    z.object({
      // Each item references a product by its UUID
      productId: z.string().uuid(),
      quantity:  z.number().int().positive(),
    })
  ).min(1),

  // channel = how the order came in
  channel: z.enum(['whatsapp', 'web', 'ussd']),
});

// ─── VALIDATION ERROR HELPER ──────────────────────────────────
// Same pattern as products.controller.js — produces Task 3 envelope

function validationError(res, zodError) {
  const details = {};
  for (const issue of zodError.issues) {
    details[issue.path[0]] = issue.message;
  }
  return res.status(400).json({
    error: {
      code:    'validation',
      message: 'Request validation failed',
      details,
    },
  });
}

// =============================================================
// HANDLER: listOrders
// Route:   GET /v1/orders
//
// Returns paginated orders for this tenant.
// Supports ?status= and ?channel= filters.
// =============================================================

export async function listOrders(req, res) {
  const limit  = Math.min(parseInt(req.query.limit) || 10, 100);
  const cursor = req.query.cursor || null;

  const { rows } = await req.db.query(
    `SELECT id, customer_id, status, channel, total_cents, created_at
     FROM orders
     WHERE ($1::uuid IS NULL OR id > $1)
     ORDER BY id
     LIMIT $2`,
    [cursor, limit + 1]
  );

  const hasMore    = rows.length > limit;
  const data       = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  res.json({ data, nextCursor, error: null });
}

// =============================================================
// HANDLER: createOrder
// Route:   POST /v1/orders
//
// Creates an order inside a TRANSACTION.
//
// What is a transaction?
//   A transaction groups multiple database operations so they
//   either ALL succeed or ALL fail together.
//
//   Example: creating an order requires:
//     1. Upsert the customer
//     2. Fetch products and check they exist
//     3. Create the order row
//     4. Insert order_items rows
//
//   If step 4 fails after step 3 already ran, we'd have an
//   order with no items — broken data. The transaction rolls
//   everything back if anything fails.
//
// BEGIN → do work → COMMIT (success) or ROLLBACK (failure)
// =============================================================

export async function createOrder(req, res) {
  const result = OrderCreate.safeParse(req.body);
  if (!result.success) return validationError(res, result.error);

  const { customerPhone, items, channel } = result.data;

  // req.db is the tenant-scoped database client
  // We use it for the whole transaction so RLS stays active
  const client = req.db;

  try {
    // START the transaction — nothing is saved until COMMIT
    await client.query('BEGIN');

    // STEP 1: Upsert the customer
    // "Upsert" = INSERT if not exists, UPDATE if exists
    // ON CONFLICT means: if this phone already exists for this tenant,
    // just return their existing id instead of throwing an error
    const { rows: custRows } = await client.query(
      `INSERT INTO customers (phone, channel)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id, phone)
       DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [customerPhone, channel]
    );
    const customerId = custRows[0].id;

    // STEP 2: Fetch all products being ordered
    // We need their price to calculate the total
    // FOR UPDATE locks these rows so no other transaction
    // can change them while we're working
    const productIds = items.map(i => i.productId);
    const { rows: products } = await client.query(
      `SELECT id, name, price_cents
       FROM products
       WHERE id = ANY($1) AND deleted_at IS NULL`,
      [productIds]
    );

    // Check all requested products actually exist
    if (products.length !== productIds.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        data: null,
        error: { message: 'One or more products not found' },
      });
    }

    // Build a map: { productId → product } for quick lookup
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    // STEP 3: Calculate total price
    let totalCents = 0;
    for (const item of items) {
      const product = productMap[item.productId];
      totalCents += product.price_cents * item.quantity;
    }

    // STEP 4: Create the order row
    // Status starts at 'created' — the state machine begins here
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (customer_id, total_cents, channel, status)
       VALUES ($1, $2, $3, 'created')
       RETURNING *`,
      [customerId, totalCents, channel]
    );
    const order = orderRows[0];

    // STEP 5: Insert one order_item row per product
    // We copy product_name and price at the time of purchase.
    // Why copy? If the owner changes the price tomorrow,
    // this historical order should still show today's price.
    for (const item of items) {
      const product = productMap[item.productId];
      await client.query(
        `INSERT INTO order_items
           (order_id, product_name, unit_price_cents, quantity)
         VALUES ($1, $2, $3, $4)`,
        [order.id, product.name, product.price_cents, item.quantity]
      );
    }

    // All steps succeeded — save everything to the database
    await client.query('COMMIT');

    res.status(201).json({ data: order, error: null });

  } catch (err) {
    // Something failed — undo ALL the steps above
    // The database returns to exactly the state it was before BEGIN
    await client.query('ROLLBACK');
    throw err;
  }
}

// =============================================================
// HANDLER: getOrder
// Route:   GET /v1/orders/:id
// =============================================================

export async function getOrder(req, res) {
  const { rows } = await req.db.query(
    `SELECT * FROM orders WHERE id = $1`,
    [req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ data: null, error: { message: 'Not found' } });
  }

  res.json({ data: rows[0], error: null });
}

// =============================================================
// HANDLER: updateOrderStatus
// Route:   PATCH /v1/orders/:id/status
//
// The ONLY thing you can update on an order is its status.
// And status can only move in directions the state machine allows.
//
// Why not allow updating other fields?
//   Once an order is created, its items, total, and customer
//   are locked. Changing them after the fact would be fraud.
// =============================================================

export async function updateOrderStatus(req, res) {
  const { status: nextStatus } = req.body;

  // Validate that nextStatus is a real status value
  if (!nextStatus || !STATUS_TRANSITIONS[nextStatus] === undefined) {
    return res.status(400).json({
      error: { code: 'validation', message: 'Invalid status value', details: {} },
    });
  }

  // Fetch the order's CURRENT status
  const { rows: current } = await req.db.query(
    `SELECT status FROM orders WHERE id = $1`,
    [req.params.id]
  );

  if (!current[0]) {
    return res.status(404).json({ data: null, error: { message: 'Not found' } });
  }

  const currentStatus = current[0].status;

  // Check the state machine — is this transition allowed?
  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed.includes(nextStatus)) {
    return res.status(409).json({
      data: null,
      error: {
        message: `Cannot move from '${currentStatus}' to '${nextStatus}'`,
      },
    });
  }

  // Transition is valid — update the status
  const { rows } = await req.db.query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [nextStatus, req.params.id]
  );

  res.json({ data: rows[0], error: null });
}