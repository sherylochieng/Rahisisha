<!--
=============================================================================
FILE: load-check.md  (repo root)  (Week 30 Day 1, Task 4)
=============================================================================

WHY THIS FILE EXISTS
  Week 30 Day 1 asks for a 30-second load spot-check on the main endpoints,
  with p50, p95 and p99 recorded. This file is that record.

WHY IMPORTANT
  A number written down today is a baseline. If a change next month makes an
  endpoint slower, you can compare with this page and see it straight away.

DANGER
  - This is a SANITY CHECK, not a real load test. Do not quote it as "the app
    handles X users". See "What this does NOT prove" below.
  - The numbers are from one laptop, with a small amount of data.

WHAT IT SOLVES
  It answers "is anything obviously slow?" before launch.

SYSTEM DESIGN PRINCIPLE
  Measure before you worry. Measure the simplest thing first (the health
  check), then compare every other endpoint against it.

RULES
  1. Every number below was copied from the real autocannon output that
     Sheryl ran on her own computer. None are estimated.
  2. AI wrote this document. AI did not run the test.
  3. No pass/fail target is set here. Whether a number is good enough to
     launch is Sheryl's call (Week 30 AI rules: severity and launch blockers
     are NOT for AI).

WHERE USED
  Linked from the Week 30 Day 1 submission. Compare against it after any big
  change to a query or a library.

TRADEOFFS
  + Fast (about 10 minutes) and repeatable with one command per endpoint.
  - Small data, one shop, one laptop, one run each.
=============================================================================
-->

# Load check (Week 30 Day 1)

## How it was run

**Date:** 24 November 2026

**Tool:** `autocannon` 9.0.0

**Command shape (the same for every endpoint):**

```
npx autocannon -c 10 -d 30 -H "Cookie: token=$token" http://localhost:3000/<path>
```

**Meaning:** 10 connections at the same time, for 30 seconds. The logged-in
endpoints used the real login cookie of Aminas Boutique. The health check and
the public shop page need no cookie.

**Where it ran:** Sheryl's Windows laptop. The API ran with `npm run dev`
(nodemon), against the local Windows Postgres, and the test tool ran on the
same machine. The database pool size was 20.

---

## Results

All times are in milliseconds (ms). Lower is better.

| Endpoint | Needs login | p50 | p95 (see note) | p99 | Slowest | Requests per second | Total requests |
|---|---|---|---|---|---|---|---|
| `GET /health` | no | 2 | 8 | 12 | 192 | 3,232 | 97,000 |
| `GET /v1/storefront/aminas-boutique` | no | 14 | 28 | 37 | 791 | 632 | 19,000 |
| `GET /v1/dashboard` | yes | 22 | 56 | 69 | 852 | 393 | 12,000 |
| `GET /v1/products` | yes | 13 | 26 | 34 | 693 | 680 | 20,000 |
| `GET /v1/orders` | yes | 15 | 28 | 36 | 787 | 600 | 18,000 |
| `GET /v1/inbox` | yes | 15 | 28 | 36 | 758 | 590 | 18,000 |

**Note on p95.** `autocannon` does not print p95. It prints 2.5%, 50%, 97.5%
and 99%. The "p95" column above is the **97.5%** value, which is slightly
slower than the real p95, so it is a safe (pessimistic) stand-in. The real p95
is somewhere at or below that number.

**Errors.** No "non 2xx responses" line appeared in any of the six runs.

---

## How to read it

- **p50** is the typical request. Half were faster.
- **p95 and p99** are the slow ones. 1 request in 100 took longer than p99.
- **Health check** touches no database, so it is the fastest the server can
  go. Every other endpoint is compared with it.
- **The database costs time.** Endpoints that read Postgres are about 5 to 10
  times slower than the health check. That is normal.
- **The dashboard is the slowest of the logged-in pages.** It does three
  things in one call (today's orders, the wallet balance and the latest
  products), so it costs more than a single list.

---

## Things worth a second look

- **The slowest request in every database run was 690 to 850 ms**, while p99
  stayed under 70 ms. In each run the lowest requests-per-second sample was
  also far below the average. That pattern fits a slow first second (warming
  up), but this was **not proven**. Repeating a run after a warm-up would
  settle it.
- **The dashboard p99 (69 ms) is about twice the list pages (34 to 37 ms).**
  Not a problem today, but it is the first one to watch if data grows.

---

## What this does NOT prove

- **Small data.** The shop has about five products and few orders. Lists with
  thousands of rows will be slower.
- **One shop, one laptop.** The test tool and the server shared the same
  computer, which uses up some of its power.
- **Dev mode.** The API ran under nodemon, not as a production build.
- **One run each.** There is no average over several runs.
- **Reads only.** Writing orders under load was tested earlier by the 100
  orders in 60 seconds load test (see `PERFORMANCE.md`).

---

## Baseline for later

If you change a query, a library, or the pool size, run the same six commands
and compare with the table above.

<!--
=============================================================================
PIECE BY PIECE
=============================================================================
-c 10        : 10 customers at the same time. Real life: 10 people at the
               counter together.
-d 30        : keep going for 30 seconds.
-H "Cookie"  : shows the login cookie, like showing your shop card at the door.
p50          : the typical customer's wait.
p95 / p99    : the wait of the unlucky ones. People remember these.
97.5%        : the closest value autocannon gives to p95.
Requests per second : how many customers the shop served each second.
Slowest      : the one worst request. One slow customer among thousands.
=============================================================================
-->