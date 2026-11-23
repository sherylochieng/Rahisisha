# seed-daraja-demo.js — Demo M-Pesa Settings for Amina's Shop

**File:** `apps/api/scripts/seed-daraja-demo.js`
**Doc:** `apps/api/docs/scripts/seed-daraja-demo.md`
**Added:** Week 29 Day 3
**Run:** `cd apps/api` then `node scripts/seed-daraja-demo.js`

---

## WHY THIS FILE EXISTS

Gives one demo shop (Amina's Boutique) its Daraja sandbox settings, with the key, secret and passkey stored encrypted, so you can try the pay route.

## WHY IMPORTANT

Without a settings row the pay route answers 409 `payments_not_set_up`.

## DANGER

- It REFUSES to run in production or on a database that is not on this computer.
- It reads your sandbox values from `apps/api/.env` and never prints them. Do not commit `.env`.

## WHAT IT SOLVES

Quick local setup for Day 3 demos.

## SYSTEM DESIGN PRINCIPLE

Seed scripts are safe by default: refuse risky places, never print secrets, safe to run twice.

## RULES

1. Local database only.
2. Secrets only from `.env`.
3. Running twice updates the same row.

## PRACTICAL EXAMPLE

After the script prints `OK aminas-boutique: env=sandbox shortcode=174379`, Amina's shop can start an M-Pesa payment against the sandbox.

## DECISIONS (and WHY)

`callback_url` is built as `DARAJA_CALLBACK_BASE` plus `/callbacks/mpesa/<shop id>`; it must be public https for Safaricom to reach it.

**Week 29 Day 5 (added):** the script now sets up **both** demo shops, Amina's Boutique and Brio Hardware, so the two-shop demo can run a sandbox payment for each. Both use the same sandbox keys, but each row is encrypted with its own shop id and its `callback_url` ends in its own shop id. Before Day 5 only Amina was seeded, so paying a Brio order failed cleanly; the automated tests still cover that case and do not use this script.

## WHERE USED / FUTURE USES

Local demos and the sandbox walk-through.

## TRADEOFFS

+ Repeatable.
- Needs real sandbox keys from Safaricom's developer portal and a public callback address (for example an ngrok tunnel).

## HOW TO USE

Put the `DARAJA_SANDBOX_*` values and `DARAJA_CALLBACK_BASE` in `apps/api/.env`, then run the script.

## PIECE BY PIECE (simple words, real-life examples)

### `guard()`

Refuses production and any database host that is not localhost.

### `readSettings()`

Reads the sandbox values from `.env` and refuses missing ones or a callback base that is not https.

### `seedShop()` and `main()`

(Day 5: the shop work moved into `seedShop()`, and `main()` checks the guard and settings once, then calls it for each shop in `SHOP_SLUGS`.)

Finds the shop (Amina's, then Brio's), encrypts the three secrets with the shop's id, then inserts or updates `daraja_configs` under that shop's lock. Prints only `OK ...`.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 23 November 2026 (Week 29 Day 5: both shops).*