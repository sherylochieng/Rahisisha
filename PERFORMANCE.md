# PERFORMANCE

**FILE:** `PERFORMANCE.md` (repo root)

---

## WHY THIS FILE EXISTS

This file records how fast and how safely Rahisisha took orders when many arrived at once, with the real numbers from the run on 23 November 2026.

It answers the Week 29 weekend task: "Load test: 100 orders in 60 seconds across two tenants. Verify no data bleed."

---

## WHY IMPORTANT

One order at a time always works. Trouble shows up in a rush: slow answers, errors, or, worst of all for a multi-tenant product, one shop's order landing in another shop's books.

Numbers written down today let me notice tomorrow if a change made things slower, and let me say honestly what the system can and cannot do.

---

## DANGER

- These numbers are from **my laptop**, where the tester, the API and the database all share one computer. A real server will give different numbers. Do not quote them as "production performance".
- The test created real (practice) orders in the local database. It never paid anything.
- The speed numbers are not the safety proof. The safety proof is the SQL check in section 4.

---

## WHAT IT SOLVES

- A clear answer to "can it take 100 orders in 60 seconds?"
- A clear answer to "did any order end up in the wrong shop?"
- One honest finding about slow answers in a rush (section 3).

---

## SYSTEM DESIGN PRINCIPLE

Test from the outside, check from the inside. The script behaves like two shop owners using the API over HTTP. A separate SQL query, run as the database administrator, then checks the books directly. The API does not mark its own homework.

---

## RULES

1. Local database only, orders only, no payments.
2. 50 orders per shop. Customer phones carry a marker (Aminas Boutique `254722...`, Brio Hardware `254733...`) so the SQL check can tell them apart.
3. Report the bad news as plainly as the good.

---

## PRACTICAL EXAMPLE

Real life: a market morning where customers keep messaging two shops at once. The test sends 100 orders, one every 0.6 seconds (the 60-second run), and then 100 again as fast as possible (the rush). After both, each shop's book holds exactly its own customers.

---

## DECISIONS (and WHY)

- **Two runs, not one:** a paced run (the steady flow the assignment asks for) and a `--burst` run (a rush, 20 at a time).
- **Cheapest product, quantity 1 ("Sample: Sugar 1kg", KES 160):** every order is identical, so any slowness comes from the system and not from the data.
- **Orders only:** the M-Pesa sandbox has a real phone prompt and is a separate system.
- **SQL check, not an API check:** the check reads the tables directly, so it can prove something the API cannot.

---

## 1. The test

- **Date:** 23 November 2026
- **Script:** `apps/api/scripts/load-test-orders.js` (guide: `apps/api/docs/scripts/load-test-orders.md`)
- **Shops:** Aminas Boutique and Brio Hardware, each logged in as its own owner
- **Orders:** 100 per run, 50 per shop, alternating, each with a different customer phone
- **Where:** my laptop, API on port 3000, the Windows Postgres on port 5432, everything on one computer

---

## 2. Results

| | Paced run (the 60-second test) | Rush run (`--burst`, 20 at a time) |
|---|---|---|
| Orders sent | 100 | 100 |
| Created (201) | **100** | **100** |
| Failed | **0** | **0** |
| Per shop | 50 and 50 | 50 and 50 |
| Total time | 60.6 s | 1.2 s |
| Orders per second | 1.65 | 86.71 |
| Fastest answer | 5 ms | 7 ms |
| Median answer | 11 ms | 12 ms |
| 95% of orders under | 16 ms | **1,045 ms** |
| Slowest answer | 94 ms | **1,146 ms** |

Plain reading:

- **The target is met.** 100 orders in 60 seconds, all created, none failed, and every answer under 100 ms.
- **The rush also worked.** 100 orders in 1.2 seconds with zero failures.
- **But the rush has a slow tail.** The median stayed at 12 ms, yet the slowest 5% of orders waited about **1 second**. When 20 orders arrive at the same moment, most go straight through and the unlucky ones queue.

---

## 3. What I think causes the slow tail (not proven)

The database connection pool in `apps/api/src/db/pool.js` allows 20 connections (`max: 20`), and the rush sent 20 orders at a time. An order holds a connection from `BEGIN` to `COMMIT`, so a small mismatch between the number of orders and the number of connections could make some wait.

This is a **guess**, not a finding. I did not test it. Another cause could simply be one laptop doing the test, the API and the database at the same moment. To find out, run the rush at different sizes (10, 20 and 40 at a time) and see where the slow tail appears. That idea is in `NEXT.md`, not done this weekend.

---

## 4. No data bleed: the proof

After each run I checked the books as the database administrator, with SQL (queries in the load-test guide).

After both runs together (200 orders):

| Shop | Orders | With Amina's customer phones | With Brio's customer phones | Total |
|---|---|---|---|---|
| Aminas Boutique | 100 | **100** | **0** | KES 16,000 |
| Brio Hardware | 100 | **0** | **100** | KES 16,000 |

Two more checks, both answered `0`:

- Orders whose shop differs from their customer's shop: **0**
- Order lines whose shop differs from their order's shop: **0**

Each shop holds exactly its own 100 orders, and each total is exactly 100 orders of KES 160. After the first run alone (the paced one) the same check showed 50 and 50 with `0` crossed, and both mismatch checks were `0`.

---

## TRADEOFFS

- **+** The test needs no extra packages, and it exercises login, cookies, the locks (Row-Level Security) and the database together.
- **-** One computer plays every role, so the speeds are "on my laptop".
- **-** It tests creating orders only. Reading lists, USSD, WhatsApp and payments were not load tested.
- **-** 100 orders is small. It shows the system works, not where it breaks.

---

## WHERE USED / FUTURE USES

- **Before launch (Week 30):** run it again against the deployed server and compare with these numbers. That needs a deliberate change to the script's "localhost only" guard, never an accidental one.
- **After any change to the orders route or the database:** run the paced test and the SQL check again. It takes two minutes.
- **When the online shop checkout exists:** copy the idea for the checkout route, the first public door that accepts writes.
- **In any future multi-tenant project:** send traffic as two tenants at once and check from the database that nothing crossed.

---

## HOW TO USE

1. Start the API and the database (see `RUNBOOK.md`, section 4). The two demo shops must exist, with products.
2. Run the script, then the SQL check, as described in `apps/api/docs/scripts/load-test-orders.md`.
3. Add a row to the results table with the date and the numbers.

---

## What was not tested

- Reading orders, the inbox, the wallet, USSD or WhatsApp under load.
- Payments under load (M-Pesa sandbox only, and it prompts a real phone).
- More than 20 orders at the same moment, or more than two shops.
- A real server on a real network.

---

## AI AUDIT NOTE

The script and this write-up were written by AI at Sheryl's request. Sheryl ran the script and the SQL checks herself, and the numbers above are the ones she pasted. Declared in the weekend audit.