<!--
=====================================================================
FILE: docs/RUNBOOK.md

WHY THIS FILE EXISTS
  The root RUNBOOK.md says how to START, STOP, BACK UP and RESET the system.
  This file answers a different question: "something is broken RIGHT NOW,
  what do I do?" Each incident has the same shape: what you see, how to
  confirm it, how to fix it, how to stop it happening again.

WHY IMPORTANT
  Breakages happen at bad times (a customer is waiting, you are tired).
  A tired person follows steps; they do not invent them.

DANGER
  - A runbook that is wrong is worse than none. Every incident below says
    whether it was REALLY reproduced or only worked out from the code.
  - Never "fix" a payment problem by editing the database by hand before
    you have checked what Safaricom says (incident 5).

WHAT IT SOLVES
  Fast diagnosis: symptom -> check -> fix, no guessing.

SYSTEM DESIGN PRINCIPLE
  Runbooks are written for the person on call at 2am: short steps, exact
  commands, and honesty about what is not known.

RULES
  1. One incident = Symptom, Check, Fix, Prevent, Evidence.
  2. Commands are for Windows PowerShell unless it says Git Bash.
  3. Health first: always run the section 1 checks before anything else.
  4. Never use `git push --no-verify`, never change KMS_KEY.

WHERE USED
  Linked from README.md. Procedures (start, stop, backup, reset, push) are
  in the root RUNBOOK.md and are not repeated here.

TRADEOFFS
  Only one incident (database down) was reproduced on purpose (the chaos
  test, root RUNBOOK.md section 13). The rest come from reading the code
  and from real mistakes made while building. They are marked.

HOW TO USE
  Find your symptom in the table, jump to that incident, follow the steps.
=====================================================================
-->

# Rahisisha Runbook: when something breaks

Last checked: Week 30 Day 2. Local setup: API on port 3000, web app on port 3001, Windows Postgres.

For start, stop, backup, restore, reset and push procedures, see the root [RUNBOOK.md](../RUNBOOK.md). This file does not repeat them.

## Find your symptom

| What you see | Incident | Severity |
| --- | --- | --- |
| Every `/v1` call fails with 503, but `/health` says ok | 1. Database is down | High |
| One shop can see another shop's data, or isolation tests fail | 2. The lock is off (wrong database user) | Critical |
| Everyone is suddenly logged out after a restart | 3. Sessions all expired | Medium |
| Login works in curl but the browser keeps sending you back to login, or says "Tenant not found" | 4. Cookie or shop address mismatch | Medium |
| Customer paid on their phone, order still `created` or attempt still `pending` | 5. Payment paid but not confirmed | Critical |
| WhatsApp messages do not appear in the inbox | 6. Messages ignored | Medium |
| `git push` is refused | 7. The pre-push guard stopped you | Low |
| API will not start: "address already in use" | 8. Port 3000 is taken | Low |

---

## 0. First two minutes (always do this)

1. Is the API alive?

```
curl.exe http://localhost:3000/health
```

Expect `{"status":"ok"}`. No answer means the API is not running: start it (root RUNBOOK.md section 4).

2. Is Postgres alive? `/health` does NOT check this.

```
Get-Service *postgres*
```

The service should say `Running`.

3. Read the API terminal. The newest red lines usually name the problem.

Write down the time and what you saw. You will need it if this happens again.

---

## 1. Database is down

**Symptom.** Pages show "We're having trouble right now". API calls to `/v1/...` answer `503` with `{"error":{"code":"service_unavailable"}}` and the header `Retry-After: 10`. `/health` still says `ok`.

**Why.** Postgres stopped, restarted or ran out of connections. The API answers 503 (not 500) on purpose: 503 means "temporarily unavailable, try again", 500 means "our code has a bug".

**Check.**

```
Get-Service *postgres*
```

**Fix.** Start the service (PowerShell opened as Administrator):

```
Start-Service <the name from the line above>
```

The API reconnects by itself; you do not need to restart it. Run `curl.exe` on `/v1/dashboard` with a login, or just reload the page.

**Prevent.** Keep Postgres on automatic start. Watch for lines starting `Database unavailable:` in the API log.

**Evidence.** REPRODUCED on purpose in the chaos test (root RUNBOOK.md section 13, run on 23 November 2026). The API stayed up, answered 503 while the database was cut and recovered after it came back. The fix in the code is the `pool.on('error')` handler in `apps/api/src/db/pool.js`.

---

## 2. The lock is off (wrong database user)

**Symptom.** A shop sees another shop's products or orders, OR `npm run test:isolation` fails, OR the push is refused (incident 7).

**Why.** Isolation depends on row level security (RLS). A Postgres superuser such as `postgres` ignores RLS completely. If `DATABASE_URL` uses a superuser, every lock is silently open. The app must connect as `rahisisha_user`.

**Check.** Look at the user in `apps/api/.env` (read the line, never paste a password anywhere):

```
Select-String -Path apps/api/.env -Pattern "^DATABASE_URL" | ForEach-Object { $_.Line -replace ':[^:@]*@', ':****@' }
```

The user before the `:****@` must be `rahisisha_user`, not `postgres`.

**Fix.** Change `DATABASE_URL` to use `rahisisha_user`, restart the API, run:

```
cd apps/api
npm run test:isolation
```

All tests must pass before anyone uses the app again.

**Prevent.** The pre-push guard runs the isolation tests. Note: `apps/api/.env.example` still shows `postgres` as the user (to fix; listed in the documents to update later), so do not copy it blindly.

**Evidence.** From the design (ADR-0003, isolation-proof.md) and the isolation tests. Not reproduced by switching users on purpose.

---

## 3. Everyone is logged out after a restart

**Symptom.** Right after a restart or a deploy, every call answers `401 {"error":"Session expired — please log in again"}`.

**Why (most likely).** Login tokens are signed with `JWT_SECRET`. If that value changed or went missing, every old token fails the check. Tokens also expire after 7 days by themselves.

**Check.** Is `JWT_SECRET` set in `apps/api/.env`, and is it the same as before? (See docs/secrets.md section 1.) Log in again with curl and try `/v1/me`.

**Fix.** Put the right `JWT_SECRET` back and restart. If the secret was changed on purpose, users simply log in again, nothing else is lost.

**Prevent.** Change `JWT_SECRET` only on purpose, and tell users. Never commit it.

**Evidence.** Worked out from the code (`requireAuth` and login). Not reproduced.

---

## 4. Cookie or shop address mismatch

**Symptom.** `curl` login works, but in the browser you are sent back to login, or login says `404 {"error":"Tenant not found"}`.

**Why.** The cookie only travels if the addresses agree: `WEB_ORIGIN` (who may call the API), `ROOT_DOMAIN` (how the shop word is read from the address) and `COOKIE_DOMAIN` (which addresses the cookie is valid for). Online, the browser calls `api.<domain>`, so reading the shop word from the API's own address always gives "api" and the shop is never found. Also: private browser windows share cookies while any one is open, so a login can "leak" between windows and confuse a test.

**Check.**

1. Close all private windows, test in one clean window.
2. Browser dev tools, Network tab: does the login response contain `Set-Cookie`, and is the next request sending `Cookie: token=...`?
3. Compare `WEB_ORIGIN`, `ROOT_DOMAIN`, `COOKIE_DOMAIN` with docs/secrets.md.

**Fix.** Make the three values agree with the real address, restart the API and the web app (the web app reads its settings only at start).

**Prevent.** On a laptop leave `ROOT_DOMAIN` and `COOKIE_DOMAIN` unset. Set all three together when going online.

**Evidence.** PARTLY REAL. The "api" shop-word bug and the shared private-window cookie were both met while building (Week 29 and Week 30 Day 1). The settings checklist is from the code.

---

## 5. Payment paid but not confirmed

**Symptom.** The customer got the M-Pesa prompt, entered the PIN and was charged, but the order is still `created` and the payment attempt is still `pending` (or `failed`).

**Why.** The shop is only credited after TWO things: Safaricom calls our callback, and our own STK Query to Safaricom confirms the payment. Either one can fail. (a) The callback never arrived: the ngrok address changed, so `DARAJA_CALLBACK_BASE` points at a dead tunnel. (b) The callback arrived and we answered 200, but the confirmation query did not pass, so the attempt stays pending. This happened in the real sandbox run.

**Check (read only, nothing can change).**

```
cd apps/api
node scripts/check-payment.js
```

It shows whether the attempt is pending, paid or failed, whether the order is paid and whether the wallet grew. It never prints phone numbers or keys.

For case (b), ask Safaricom the same question we ask and read the answer:

```
node scripts/diagnose-stk-query.js
```

It prints only status words from Safaricom (the reason our code hides on purpose).

For case (a): open the ngrok window. Does the address there match `DARAJA_CALLBACK_BASE`? A free tunnel gets a NEW address every time ngrok restarts.

**Fix.**

- Tunnel changed: put the new address in `DARAJA_CALLBACK_BASE`, restart the API, run `node scripts/seed-daraja-demo.js` (expect two OK lines), then test again with a NEW order.
- Confirmation failed: read the diagnose output, fix what Safaricom names (wrong shortcode, passkey or sandbox settings), test again.
- Do NOT mark the order paid by hand until you have seen the payment on the Safaricom side. A wrong manual "paid" gives the customer goods for money the shop never received.
- A retry is blocked for 2 minutes (`payment_in_progress`), and a paid order cannot be paid twice (`order_not_payable`). That is the system protecting the customer from being charged twice.

**Prevent.** Today there is NO automatic retry of the confirmation and NO reconciliation job, so a stuck payment needs a person. Both are on the list for before real money (NEXT.md, reconciliation.md). Until then: sandbox only.

**Evidence.** REAL. The "paid but stayed pending" case happened in the Week 29 sandbox run and the two scripts were written to investigate it. The ngrok case is from the setup steps. Real money has NOT been tested.

---

## 6. WhatsApp messages do not appear

**Symptom.** Messages are sent to the shop's number but the inbox stays empty. The webhook answers `200 {"data":{"ignored":true}}`. Or the setup in Meta says "verification failed".

**Why.** The shop is found from the `phone_number_id` in the message. If no shop has that id saved, the message is ignored on purpose (so a stranger cannot write into a shop). A `403 Verification failed` means the verify token typed in Meta does not match any shop's saved token. Each message is saved once, so a repeat (same `wamid`) shows under `duplicates`, not as a second message.

**Check.** Call the webhook the way Meta does (see docs/api-reference.md section 8). Is the `phone_number_id` the one saved for the shop?

**Fix.** Save the right id and token for the shop (today by `apps/api/scripts/seed-whatsapp-demo.js`, because there is no Settings page yet) and retry.

**Prevent.** Settings page in the online shop roadmap.

**Evidence.** Worked out from the code. WhatsApp is SIMULATED; it has never run against a real Meta account.

---

## 7. The pre-push guard stopped you

**Symptom.** `git push` prints failing tests or a database error and cancels.

**Why.** The guard runs `npm run test:isolation` before anything leaves your laptop. It needs Postgres running. It also fails if the lock is broken (incident 2).

**Check and fix.** Run it yourself:

```
cd apps/api
npm run test:isolation
```

Database error: start Postgres (incident 1). A real test failure: fix the lock first.

**Prevent.** Never use `git push --no-verify`. That tells the guard to look away.

**Evidence.** REAL, seen on pushes during Week 29 and Week 30.

---

## 8. Port 3000 is taken

**Symptom.** The API says the address is already in use. The web app does the same on 3001.

**Why.** An old copy of the API is still running (a forgotten terminal), or another program uses the port.

**Check and fix.**

```
netstat -ano | findstr :3000
```

The last number on the line is the process id. Check what it is before stopping it:

```
tasklist /FI "PID eq <the number>"
```

If it is an old `node.exe` of yours:

```
taskkill /PID <the number> /F
```

Same steps for 3001.

**Prevent.** Stop services with Ctrl+C before closing a terminal.

**Evidence.** Common Windows behaviour; not a recorded incident in this project.

---

## What this runbook does not cover

- Real money. Only the Safaricom sandbox has been tested.
- A live deployment. Everything here is the laptop setup. There is no monitoring or alerting system yet.
- Changing `KMS_KEY`. It locks every saved WhatsApp and M-Pesa key. There is no rotation procedure (docs/secrets.md section 5). If you think it leaked, stop and write down what happened before touching it.
- The unfinished launch blockers: GitHub issues #6, #7, #8 (see launch-blockers.md).

## PIECE BY PIECE (simple words)

**Section 0** is like checking the matatu has fuel and a driver before you blame the road: is the API on, is Postgres on.

**503 vs 500** is the difference between "the shop is closed for lunch, come back at 2" (503) and "the shopkeeper made a mistake in the books" (500).

**The lock (incident 2)** is the shop's own key. A Postgres superuser is a master key that opens every shop, so the app must never carry it.

**Two checks for a payment (incident 5)** is the way a duka confirms an M-Pesa: first the SMS arrives (the callback), then you look at your own M-Pesa statement (the STK Query). Money counts only when both agree. If the SMS comes but the statement does not show it, you do not hand over the goods.

**Ngrok (incident 5)** is a temporary phone number for your laptop. Every time you restart it you get a new number, and Safaricom keeps calling the old one.

**Never `--no-verify` (incident 7)** is like paying the gate guard to look away: the guard exists because you might be tired one day.