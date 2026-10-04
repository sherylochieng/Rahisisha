# Rahisisha - Query Exercise

Five real queries the application runs, with EXPLAIN ANALYZE confirmation
that each one uses the indexes we created. Run these in Beekeeper Studio
after running the seed script.

Replace `'<tenant_id>'` with the actual tenant UUID from your seed output.

---

## Query 1 - All orders for a tenant in the last 7 days

**When it runs:** Dashboard "Recent Orders" widget on page load.

```sql
EXPLAIN ANALYZE
SELECT
  o.id,
  o.status,
  o.total_cents,
  o.created_at,
  c.name   AS customer_name,
  c.phone  AS customer_phone
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.tenant_id = '<tenant_id>'
  AND o.created_at >= NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC;
```

**Index used:** `orders_tenant_created_idx` on `(tenant_id, created_at DESC)`

**Why it's fast:** The composite index covers both the `tenant_id` filter and
the `ORDER BY created_at DESC` sort — Postgres reads the rows already in the
right order, no sort step needed.

**Expected EXPLAIN output:** `Index Scan using orders_tenant_created_idx`
— NOT a Seq Scan.

---

## Query 2 - Top 5 products by order count for a tenant

**When it runs:** Dashboard "Best Sellers" card.

```sql
EXPLAIN ANALYZE
SELECT
  oi.product_name,
  COUNT(*)              AS total_orders,
  SUM(oi.quantity)      AS total_units_sold,
  SUM(oi.unit_price_cents * oi.quantity) AS total_revenue_cents
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.tenant_id = '<tenant_id>'
  AND o.status = 'paid'
GROUP BY oi.product_name
ORDER BY total_orders DESC
LIMIT 5;
```

**Index used:** `order_items_tenant_idx` on `(tenant_id)` +
`orders_tenant_status_idx` on `(tenant_id, status, created_at DESC)`

**Why it's fast:** Both joins filter by `tenant_id` first — the indexes
narrow the rows before the GROUP BY aggregation runs.

**Expected EXPLAIN output:** `Index Scan` on both tables — no Seq Scan.

---

## Query 3 - All variants with low stock for a tenant

**When it runs:** Dashboard "Low Stock Alerts" widget + nightly restock email.

```sql
EXPLAIN ANALYZE
SELECT
  p.name       AS product_name,
  pv.size,
  pv.colour,
  pv.stock,
  pv.id        AS variant_id
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.tenant_id = '<tenant_id>'
  AND pv.stock < 3
  AND pv.deleted_at IS NULL
ORDER BY pv.stock ASC;
```

**Index used:** `variants_tenant_stock_idx` on `(tenant_id, stock)`
WHERE deleted_at IS NULL

**Why it's fast:** The partial index already filters out deleted variants
and covers the `tenant_id + stock` combination — Postgres finds low-stock
rows without scanning the whole table.

**Expected EXPLAIN output:** `Index Scan using variants_tenant_stock_idx`

---

## Query 4 - Wallet balance and statement for a tenant

**When it runs:** Dashboard "Wallet" page — shows balance and recent transactions.

```sql
EXPLAIN ANALYZE
SELECT
  SUM(amount_cents)                              AS balance_cents,
  COUNT(*) FILTER (WHERE amount_cents > 0)       AS total_credits,
  COUNT(*) FILTER (WHERE amount_cents < 0)       AS total_debits
FROM wallet_entries
WHERE tenant_id = '<tenant_id>';
```

**And the statement (last 30 entries):**

```sql
EXPLAIN ANALYZE
SELECT
  amount_cents,
  reason,
  reference_id,
  created_at
FROM wallet_entries
WHERE tenant_id = '<tenant_id>'
ORDER BY created_at DESC
LIMIT 30;
```

**Index used:** `wallet_entries_tenant_idx` on `(tenant_id, created_at DESC)`

**Why it's fast:** The index covers the `tenant_id` filter and the
`ORDER BY created_at DESC` — no sort needed. Balance is calculated in
SQL from real rows, never stored as a separate column that could drift.

**Expected EXPLAIN output:** `Index Scan using wallet_entries_tenant_idx`

---

## Query 5 - Unified inbox — latest conversation per customer

**When it runs:** Dashboard "Inbox" page — one row per customer, most recent first.

```sql
EXPLAIN ANALYZE
SELECT
  conv.id             AS conversation_id,
  conv.status,
  conv.channel,
  conv.last_message_at,
  c.name              AS customer_name,
  c.phone             AS customer_phone,
  latest.body         AS last_message_body,
  latest.sender       AS last_message_sender
FROM conversations conv
JOIN customers c ON c.id = conv.customer_id
JOIN LATERAL (
  SELECT body, sender
  FROM messages
  WHERE conversation_id = conv.id
  ORDER BY created_at DESC
  LIMIT 1
) latest ON TRUE
WHERE conv.tenant_id = '<tenant_id>'
  AND conv.status = 'open'
ORDER BY conv.last_message_at DESC
LIMIT 20;
```

**Index used:**
- `conversations_tenant_idx` on `(tenant_id, last_message_at DESC)` for the outer query
- `messages_conversation_idx` on `(conversation_id, created_at DESC)` for the LATERAL join

**Why it's fast:** The LATERAL join fetches exactly one row per conversation
using the messages index — no subquery that scans the whole messages table.
Both indexes are used together for maximum efficiency.

**Expected EXPLAIN output:** `Index Scan` on both `conversations` and `messages`
— the lateral join is as fast as a single row lookup.

---

## How to run EXPLAIN ANALYZE in Beekeeper Studio

1. Open Beekeeper Studio
2. Connect to your local Postgres
3. Replace `'<tenant_id>'` with your actual UUID (copy it from the seed output)
4. Paste the query
5. Press Run
6. Look for **Index Scan** in the output — if you see **Seq Scan** on a large
   table, that means an index is missing or not being used

**The key thing to look for:**
- `Index Scan` = good - using our indexes 
- `Seq Scan` on a small table = fine for now
- `Seq Scan` on a large table = missing index 