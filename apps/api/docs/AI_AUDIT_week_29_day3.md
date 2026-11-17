<!-- FILE: apps/api/docs/AI_AUDIT_week_29_day3.md -->
<!-- WHY: Week 29 Day 3 submission requires an AI audit and a Money Audit. Linked from the root AI_AUDIT.md index. -->

# AI Audit: Week 29 Day 3 (Payments Per Tenant, M-Pesa Daraja)

**Author:** Sheryl
**Date:** 16 November 2026
**Week 29 rule:** 25% manual / 75% AI. AI **NOT allowed** for the **ledger update** and **callback verification**. Money Audit required.

This audit says what actually happened, including where the AI help went beyond what the rule allows.

---

## 1. The most important lines in this audit

**The ledger update and the callback verification were written by the AI.** The assignment says AI is NOT allowed for them.

- The AI flagged the rule before starting and offered two choices: Sheryl types them herself, or the AI writes them and the audit says so.
- Sheryl chose to have the AI write them (time pressure). Same choice as Week 29 Days 1 and 2.
- AI-written, manual-only areas:
  - `apps/api/src/controllers/mpesa.callback.controller.js`: verifies the callback and credits `wallet_entries` (callback verification and ledger update).
  - `apps/api/src/middleware/resolveMpesaTenant.js`: finds the shop from the callback URL.
  - `apps/api/src/services/daraja.service.js`: `queryStkStatus`, the second check that asks Safaricom before crediting (callback verification).
- `reconciliation.md` (the 5 to 7 sentences "in your own words"): the AI wrote a **first draft**, and Sheryl then **rewrote it in her own words** (commit `6ba2559`, 16 November 2026). This is Sheryl's statement; the AI has not read the final version.

**Sheryl's part in it:**

- **Decision (SELF):** chose that the AI writes the money code and that the audit says so.
- **Design decision (SELF):** after a plain-words explanation, chose "do both": check the callback against our own pending attempt (Level 1) AND confirm with Safaricom's STK Query before crediting (Level 2).
- **Applying (SELF):** saved every file, applied the `app.js` edit, and checked it with `git diff`.
- **Database (SELF):** ran migration 025 as `postgres` herself and checked the tables with `\d`.
- **Testing (SELF):** ran the tests herself. Isolation 109 passed, daraja service 13 passed, callback 18 passed.
- **Secrets (SELF):** no key, token or password was pasted in chat or committed. The demo seed uses placeholders.
- **Git (SELF):** one commit per file, each tagged `[Week 29 Day 3]`.
- **Not SELF:** she did not type the lines in the money files below.

**Re-read column:** only Sheryl ticks a box, after she has re-read that line. Sheryl confirmed on 16 November 2026 that she re-read all of them and asked for them to be ticked. The AI ticked them on her word; it cannot check that she read them.

---

## 2. Summary

| Task | Area | Files | Who did what |
|---|---|---|---|
| 1 | `daraja_configs` (all secrets encrypted) and `payment_attempts` | `sql/migrations/025_daraja_payments.sql`, `sql/SCHEMA.sql` | AI wrote the SQL. Sheryl ran it as `postgres` and checked it. |
| 1 | Encrypting the secrets | `apps/api/src/utils/kms.js` (Day 2, reused) | AI wrote it on Day 2 (declared there). |
| 2 | STK push | `services/daraja.service.js`, `controllers/payments.controller.js`, `routes/orders.routes.js` | **AI wrote all of it.** |
| 3 | Callback, verification, ledger | `controllers/mpesa.callback.controller.js`, `middleware/resolveMpesaTenant.js`, `routes/mpesa.routes.js`, `app.js` | **AI wrote all of it (see section 1).** |
| 3 | Wallet credit | `services/wallet.service.js` (`credit`) | Unchanged this week. Written Week 28 (see its audit). |
| - | Tests | `tests/daraja.service.test.js`, `tests/payments.pay.test.js`, `tests/mpesa.callback.test.js`, `tests/isolation.test.js` | AI wrote them. Sheryl ran them. |
| - | Demo data | `apps/api/scripts/seed-daraja-demo.js`, `.env.example` | AI wrote them. Placeholders only. |
| - | Count updates | `scripts/reset-db.sh`, `.github/workflows/ci.yml` | AI gave the edits (18 to 20 policies). Sheryl applied them. |
| 5 | Reconciliation notes | `reconciliation.md` | AI wrote a first draft. **Sheryl rewrote it in her own words** (her statement). |

---

## 3. Money Audit: every line that touches money

**AI** = AI wrote it. **SELF** = Sheryl wrote it. **MIXED** = AI wrote the shape, Sheryl supplied the value.

### `apps/api/src/controllers/mpesa.callback.controller.js` (ledger update and callback verification)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `const cb = parseCallback(req.body); if (!cb) return ack(res);` | Anything that is not exactly Daraja's shape is ignored | AI | ☑ |
| `parseCallback`: id must match `/^[A-Za-z0-9_-]{1,100}$/` | The CheckoutRequestID is checked before it is used anywhere | AI | ☑ |
| `parseCallback`: `Amount` must be a positive number and the receipt `/^[A-Za-z0-9]{6,20}$/` | A "paid" message without a real amount and receipt is ignored | AI | ☑ |
| `Math.round(amount * 100)` and the `> 1e-6` check | Shillings to whole cents; an amount with more than 2 decimals is refused | AI | ☑ |
| `SELECT id, status FROM payment_attempts WHERE checkout_request_id = $1` | Finds OUR attempt, for this shop only (RLS lock) | AI | ☑ |
| `if (!rows[0] \|\| rows[0].status !== 'pending') return ack(res);` | Unknown or already handled means nothing happens (duplicates are harmless) | AI | ☑ |
| `truth = await queryStkStatus(req.db, cb.checkoutRequestId)` in a `try`, `catch` returns `ack` | **Level 2:** asks Safaricom. If it cannot confirm, nothing changes | AI | ☑ |
| `if (truth === 'failed') { markFailed }` | Safaricom's answer wins over the callback | AI | ☑ |
| `if (truth === 'paid' && cb.resultCode === 0) { applyPayment }` | Credit only when BOTH agree and the callback has the receipt and amount | AI | ☑ |
| `BEGIN` ... `COMMIT` in `applyPayment`, `ROLLBACK` in `catch` | Wallet, attempt and order change together or not at all | AI | ☑ |
| `SELECT ... FROM payment_attempts WHERE checkout_request_id = $1 FOR UPDATE` and the second `status !== 'pending'` check | Row lock, so two callbacks at the same moment cannot both credit | AI | ☑ |
| `SELECT status FROM orders WHERE id = $1 FOR UPDATE` | Locks the order while we decide | AI | ☑ |
| `if (cb.amountCents !== Number(attempt.amount_cents))` then `failed`, `amount_mismatch`, no credit | A short or wrong payment is never credited; receipt kept for a human | AI | ☑ |
| `if (!orderRows[0] \|\| orderRows[0].status !== 'created')` then `failed`, `order_not_open`, no credit | Money for a cancelled or already paid order is never credited | AI | ☑ |
| `await credit(db, cb.amountCents, 'sale', cb.receipt)` | **The ledger line.** Adds the sale to `wallet_entries`, reference = M-Pesa receipt | AI | ☑ |
| `closeAttempt(... status: 'paid', receipt ...)` | Marks the attempt paid and stores the receipt | AI | ☑ |
| `UPDATE orders SET status = 'paid' ... WHERE id = $1 AND status = 'created'` and `rowCount !== 1` throws | Marks the order paid; if it did not change exactly one row, everything rolls back | AI | ☑ |
| `if (err && err.code === '23505') return;` | A repeated receipt or second paid attempt is refused by the database and treated as a harmless repeat | AI | ☑ |
| No `console.*` anywhere in the file | Amounts, receipts, phones and keys cannot be logged by this file | AI | ☑ |
| Always `res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })` | The same answer for everything except a server fault, so ids cannot be probed | AI | ☑ |

### `apps/api/src/middleware/resolveMpesaTenant.js` (tenant resolution)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `UUID.test(tenantId)` else `200 Accepted` | A badly shaped id is ignored | AI | ☑ |
| `SELECT id FROM tenants WHERE id = $1 AND status <> 'deleted'` | Finds the shop with a safe `$1` slot. A deleted shop is ignored, a suspended one is not | AI | ☑ |
| `req.tenantId = rows[0].id` | Stamps the shop from the URL. Never from the body | AI | ☑ |

### `apps/api/src/routes/mpesa.routes.js` and `app.js`

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `router.post('/:tenantId', resolveMpesaTenant, withTenant, asyncHandler(handleMpesaCallback))` | Guard first, then the shop lock, then the handler. No `requireAuth` on purpose (Safaricom has no cookie) | AI | ☑ |
| `app.use('/callbacks/mpesa', mpesaRouter)` above the 404 | Mounts the public callback route | AI | ☑ |

### `apps/api/src/services/daraja.service.js` (STK push, and the second check)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `amountCents < 100 \|\| amountCents % 100 !== 0` throws `amount_not_whole_shillings` | Whole shillings only. Refuses, never rounds | AI | ☑ |
| `Amount: amountCents / 100` | Cents to shillings for Safaricom | AI | ☑ |
| `AccountReference: String(accountReference ?? '').slice(0, 12)` | Safaricom's 12 character limit | AI | ☑ |
| Config read with `decryptSecret(..., tenantId)`, no `console.*` | Keys are decrypted only in memory and never logged | AI | ☑ |
| `queryStkStatus`: id regex, status 200, `ResponseCode === '0'`, `ResultCode` present, `CheckoutRequestID` must match | Any odd answer throws `daraja_query_unconfirmed`, which means "do not credit" | AI | ☑ |
| `String(body.ResultCode) === '0' ? 'paid' : 'failed'` | Only ResultCode 0 counts as paid | AI | ☑ |

### `apps/api/src/controllers/payments.controller.js` and `routes/orders.routes.js` (STK push route)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `SELECT ... FROM orders o JOIN customers c ... WHERE o.id = $1` on `req.db` | Looks up the order inside the shop's lock. Another shop's order is 404 | AI | ☑ |
| `if (order.status !== 'created')` then 409 | Only an open order can be paid | AI | ☑ |
| `const amountCents = Number(order.total_cents)` | **The amount comes only from the order, never from the request body** | AI | ☑ |
| `payment_attempts ... status = 'pending' AND created_at > NOW() - make_interval(...)` | Blocks a second push within 2 minutes (double charge) | AI | ☑ |
| `INSERT INTO payment_attempts ... RETURNING id` BEFORE `stkPush` | Write-ahead: the attempt exists before the push, so a callback can always find it | AI | ☑ |
| `catch` marks the attempt `failed` with only an error code | A failed push leaves no hanging pending row, and no secrets in the reason | AI | ☑ |
| `res.status(202)` with status `pending` | The pay route never marks anything paid and never touches the wallet | AI | ☑ |
| `router.post('/:id/pay', asyncHandler(payOrder))` | Behind the existing login and shop lock | AI | ☑ |

### Database

| Change | Who | Re-read |
|---|---|---|
| `daraja_configs`: `consumer_key_encrypted`, `consumer_secret_encrypted`, `passkey_encrypted` (all secrets encrypted); has RLS | AI | ☑ |
| `payment_attempts.checkout_request_id UNIQUE` | AI | ☑ |
| Unique index `(tenant_id, mpesa_reference) WHERE mpesa_reference IS NOT NULL` | The database refuses a repeated M-Pesa receipt | AI | ☑ |
| Unique index `(order_id) WHERE status = 'paid'` | The database refuses two paid attempts for one order | AI | ☑ |
| `amount_cents BIGINT CHECK (amount_cents > 0)` | No zero or negative payments | AI | ☑ |
| `order_id ... ON DELETE RESTRICT` | An order with payment history cannot be deleted | AI | ☑ |
| RLS ENABLE + FORCE, `tenant_isolation` policy with `USING` and `WITH CHECK` | One shop cannot see or write another shop's rows | AI | ☑ |
| `EXPECTED_POLICIES` 18 to 20 in `reset-db.sh` and `ci.yml` | AI | ☑ |

---

## 4. Contract differences from the assignment sheet

- The assignment says to verify the callback "by shape". We also require the CheckoutRequestID to match our own pending attempt for that shop, and we confirm with Safaricom's STK Query before crediting. Daraja callbacks are not signed, so shape alone could be forged.
- The assignment says to find the order from the callback. Daraja does not return our AccountReference, so we find the order through the attempt we saved before the push.
- The pay route writes the `payment_attempts` row BEFORE calling Safaricom (write-ahead), so a fast callback can never arrive before its row exists.
- A payment that cannot be applied (wrong amount, order no longer open) is not credited. The attempt is marked `failed` with a reason and the receipt is kept for a human.
- Whole shillings only: an order total with cents is refused for M-Pesa, never rounded.
- The callback always answers 200 "Accepted" for anything that is not a server fault.

---

## 5. Honest assessment against the 25/75 rule

- Sheryl wrote **nearly all the code**, including the part (ledger update, callback verification). The reconciliation notes started as an AI draft, which Sheryl rewrote.
- **What Sheryl did herself:** the design decision (both checks), every run, check and test, the migration, all git work, rewriting the reconciliation notes in her own words, and deciding what to submit.
- **Tenant isolation:** proven by the isolation suite (109 checks) and by callback test 8, but the AI wrote the tests.
- **Mutation checks:** the AI broke the callback on purpose five ways. Four were caught by the tests. The fifth (skipping the "still pending" re-check) was not, because the database's unique receipt rule also stops a repeat. That is a backup, not a gap.
- **Not done (stretch goals):** refund endpoint, signature verification (Daraja does not sign), Slack alert for failures, the nightly reconciliation job itself.
- **Known gaps:**
  - If Safaricom's callback never arrives, the attempt stays `pending` until someone or something checks it. The reconciliation job is described in `reconciliation.md` but not built.
  - A callback that Safaricom cannot confirm yet (still processing) is not retried by us.
  - Late or wrong payments are marked `failed` with the receipt kept, but nothing alerts the shop owner.
  - There is no screen or endpoint to save a shop's Daraja settings; rows are created by SQL or the demo seed.
  - The real Safaricom sandbox run happened on 16 November 2026 (section 6). It worked once end to end and failed once at the confirmation step, so that step is fragile. Reversals are not handled.

---

## 6. Real Safaricom sandbox run (16 November 2026)

Sheryl ran the real sandbox herself: an ngrok tunnel, her own Safaricom sandbox app, Amina's shop and a KES 1,200 order. The AI guided each step and wrote two read-only helper scripts: `apps/api/scripts/check-payment.js` (committed) and `diagnose-stk-query.js` (a throw-away, not committed). What follows is what was seen, not guessed.

| Run | What happened |
|---|---|
| 1 | The STK push was accepted (202). The prompt reached Sheryl's own phone and she paid. Safaricom's callback arrived and we answered 200. The attempt stayed `pending`: Safaricom's STK Query answered HTTP 500, error code `500.001.1001`, with an empty message, so by design nothing was credited. The order stayed `created` and the wallet did not change. |
| 2 | The same steps with a fresh order. The callback arrived and the query answered 200 (`ResponseCode` 0, `ResultCode` 0, the id matched ours). The order became `paid`, the attempt became `paid` with a receipt, and the wallet grew by exactly 120000 cents, once. |

**Findings**
1. The whole path works against the real sandbox, once: STK push, callback, Safaricom confirmation, one transaction crediting the wallet.
2. The confirmation step is **intermittent**. The same code failed in run 1 and passed in run 2. The cause is not known (the error message was empty). Because a genuine payment can be left `pending`, the design needs a fix: **keep the callback's receipt and amount when the confirmation cannot be done, retry the confirmation later (the reconciliation job), and credit only when it passes.** This is **not built**. Safaricom's query returns no receipt number, so without keeping the callback data a late retry could not credit.
3. Two attempts remain `pending`: a push to Safaricom's test number that nobody paid, and run 1.
4. **The sandbox used Sheryl's real M-Pesa balance.** KES 1,200 left her account in run 1 and Safaricom reversed it (her report). Run 2 took KES 1,200 as well; she says it will reverse by itself, and that has **not been confirmed yet**.
5. **A reversal does not reach our system.** If Safaricom reverses a payment we already credited (run 2), our wallet keeps the credit. This is a real gap; for now it is demo data.
6. Lesson: do not test the sandbox with a real phone number unless you are ready for real money to move for a while.
