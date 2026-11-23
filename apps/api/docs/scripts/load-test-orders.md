# load-test-orders.js: the rush-hour test for two shops

**FILE:** `apps/api/docs/scripts/load-test-orders.md` (guide for `apps/api/scripts/load-test-orders.js`)

---

## WHY THIS FILE EXISTS

This guide explains the script that sends 100 orders to the API, 50 for each of two shops, and how to check afterwards that no order landed in the wrong shop.

It is the weekend assignment's load test: "100 orders in 60 seconds across two tenants. Verify no data bleed."

---

## WHY IMPORTANT

One order at a time always works. Trouble shows up when many arrive together: slow answers, errors, or, worst for Rahisisha, one shop's order ending up in another shop's books. The speed numbers go into `PERFORMANCE.md`, and the "no bleed" proof comes from a separate SQL check.

---

## DANGER

- It creates REAL orders in the database the API uses. Local practice database only. The script refuses any address that is not `localhost` or `127.0.0.1`.
- It never pays anything and never touches Safaricom.
- The two shop passwords come from environment variables, never from the file, so none can be committed.
- Never point it at an ngrok address or a server.

---

## WHAT IT SOLVES

- Can the API take 100 orders in 60 seconds? (default, paced mode)
- What happens if they all arrive at once? (`--burst` mode)
- How many worked, how many failed, and how long did each take?

---

## SYSTEM DESIGN PRINCIPLE

Test from the outside, the way a customer would (over HTTP, logged in). Check the result from the inside, with a different tool (SQL). The API must not be the one marking its own homework.

---

## RULES

1. Local API only.
2. 100 orders: 50 per shop, alternating A, B, A, B.
3. Each shop's orders use customer phones with their own marker (A: `254722...`, B: `254733...`). The SQL check uses the marker to prove no order crossed over.
4. Passwords only through `LOAD_PASSWORD_A` and `LOAD_PASSWORD_B`.
5. Print only counts and timings, never secrets.

---

## PRACTICAL EXAMPLE

Real life: a market stall owner's phone buzzes with orders all morning. The test pretends to be those customers for two shops at once, then checks each owner's book contains only their own customers.

In PowerShell, in `apps/api`, with the API running:

```powershell
$env:LOAD_PASSWORD_A = "the practice password for Aminas Boutique"
$env:LOAD_PASSWORD_B = "the practice password for Brio Hardware"
node scripts/load-test-orders.js
```

This takes about 60 seconds. It prints the number of orders created, failures, and the answer times. Then repeat with `--burst` for the rush version:

```powershell
node scripts/load-test-orders.js --burst
```

---

## DECISIONS (and WHY)

- **Paced by default:** "100 in 60 seconds" is a rate, one order every 0.6 seconds. Orders start on that beat even if an earlier one is still being answered, like customers walking in on a clock.
- **`--burst` as a second mode:** shows what happens in a rush, not just a steady flow.
- **Cheapest product, quantity 1:** every order is tiny and identical, so any slowness comes from the system, not from the data.
- **Orders only, no payments:** the M-Pesa sandbox is a separate system with a real phone prompt. It does not belong in a load test.
- **Built-in `fetch` (Node 18+):** no new package.

---

## WHERE USED / FUTURE USES

- Any time you change the orders route or the database and want to know it still holds up.
- Later, pointed at a staging server. Change the guard on purpose, never by accident.
- Extended to the checkout route once the online shop exists, which will be the first public door that takes writes.
- In any future multi-tenant project: send traffic as two tenants at once and check from the database that nothing crossed.

---

## TRADEOFFS

- **+** No dependencies, easy to read, and it exercises login, cookies, the locks (Row-Level Security) and the database together.
- **-** One computer is both tester and server, so the numbers mean "on my laptop", not "on a real server".
- **-** It measures the order route only.

---

## HOW TO USE

1. Start Docker, the API and the database as in `RUNBOOK.md` (section 4). The two demo shops must exist, with products.
2. Run the script (see PRACTICAL EXAMPLE) and keep the output.
3. Run the no-bleed check below, **right after** the run.
4. Write the numbers into `PERFORMANCE.md`.

---

## THE NO-BLEED CHECK (run in Git Bash, as the admin)

Run it within 15 minutes of the load test. The time filter keeps older orders out of the count.

```bash
psql -h localhost -U postgres -d rahisisha -c "SELECT t.name AS shop, count(*) AS orders, count(*) FILTER (WHERE c.phone LIKE '254722%') AS marker_A, count(*) FILTER (WHERE c.phone LIKE '254733%') AS marker_B, sum(o.total_cents) AS total_cents FROM orders o JOIN customers c ON c.id = o.customer_id JOIN tenants t ON t.id = o.tenant_id WHERE o.created_at > now() - interval '15 minutes' AND c.phone ~ '^2547(22|33)[0-9]{6}$' GROUP BY t.name ORDER BY t.name;"
```

What a clean result looks like:

| shop | orders | marker_A | marker_B |
|---|---|---|---|
| Aminas Boutique | 50 | 50 | **0** |
| Brio Hardware | 50 | **0** | 50 |

The zeros are the proof: no order with Brio's customers sits in Amina's shop, and none of Amina's customers in Brio's. The `total_cents` is 50 times the product price in each shop.

Two more checks, which must both print `0`:

```bash
psql -h localhost -U postgres -d rahisisha -c "SELECT count(*) AS order_customer_mismatch FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.tenant_id <> c.tenant_id;"
```

```bash
psql -h localhost -U postgres -d rahisisha -c "SELECT count(*) AS item_order_mismatch FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.tenant_id <> o.tenant_id;"
```

The first proves every order belongs to a customer of the same shop. The second proves every order line belongs to an order of the same shop.

---

## PIECE BY PIECE (simple words, real-life examples)

### `guard()`

Stops the script unless the API address is on this computer and both passwords were supplied. Real life: a practice-room key that cannot open the real shop.

### `login(shop)`

Logs in as the shop owner and keeps the login cookie called `token`. Real life: showing your staff badge at the door once, then carrying it.

### `pickProduct(shop)`

Lists the shop's products and picks the cheapest, so every order is tiny.

### `placeOrder(shop, n)`

Sends one order and times it. The customer phone is the shop's marker plus a number (`254722000001`, `254733000002`, ...). Real life: one customer walking up to the counter.

### `percentile(sorted, p)`

Finds the time that p percent of orders were faster than. "95% under 120 ms" means 95 of 100 customers waited less than 120 ms.

### `main()`

Logs in as both shops, builds the list of 100 orders alternating between them, sends them paced or in a burst, then prints: orders sent, created, failed, status codes, per-shop counts, total time, orders per second, and fastest, median, 95% and slowest answer times. It sets a failing exit code if any order failed.

---

*Written by AI at Sheryl's request (declared in the weekend audit). 23 November 2026.*