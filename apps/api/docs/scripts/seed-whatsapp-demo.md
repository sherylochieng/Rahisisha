# seed-whatsapp-demo.js — Fake WhatsApp Setup for the Demo Shops

**File:** `apps/api/scripts/seed-whatsapp-demo.js`
**Doc:** `apps/api/docs/scripts/seed-whatsapp-demo.md`
**Added:** Week 29 Day 2
**Run with:** `cd apps/api` then `node scripts/seed-whatsapp-demo.js`

---

## WHY THIS FILE EXISTS

The WhatsApp webhook only works for a shop that has a row in `whatsapp_configs`.
This script gives the two demo shops (Amina's Boutique and Brio Hardware) a FAKE
WhatsApp number and a FAKE token, so you can try the webhook by hand on your own
computer.

Real-life picture: putting toy goods on the shelf of a toy shop before you play
shop. Nothing in it is real.

## WHY IMPORTANT

Without it you would have to insert encrypted tokens by hand, which is easy to get
wrong. The script encrypts the same way the app does, so a demo row is built exactly
like a real one.

## DANGER

- The verify tokens (`demo-verify-amina`, `demo-verify-brio`) are GUESSABLE demo
  words. On a real server a stranger could connect to a shop's webhook. So the script
  REFUSES to run when `NODE_ENV` is `production`, or when the database is not on this
  computer.
- Never put a REAL Meta token in the script or in chat. Fake only.

## WHAT IT SOLVES

Trying Day 2 by hand: send a pretend Meta message and watch it land.

## SYSTEM DESIGN PRINCIPLE

Seeds are for development only, repeatable (safe to run twice) and guarded so they
can never touch real data.

## RULES

1. Local database only. Never production.
2. Fake tokens only. The script prints ids, never tokens.
3. Safe to run again: it updates the same rows instead of failing.
4. Needs `KMS_KEY` in `apps/api/.env` (the same key the app uses).

## WHY JAVASCRIPT AND NOT SQL (like the USSD seeds)?

The USSD seeds only inserted plain data (a code, a welcome text), so SQL was
enough. This one must **encrypt a token**. That scrambling is done by `encryptSecret()`
in `kms.js`, which needs the secret `KMS_KEY` and our exact stored format
(`v1.<iv>.<tag>.<ciphertext>`, locked to the shop id). Postgres cannot do that, and
the key must never be written into a committed SQL file.

---

## THE CODE, PIECE BY PIECE

```js
import { pool } from '../src/db/pool.js';
import { encryptSecret } from '../src/utils/kms.js';
```
The app's own database connection (importing it also loads `.env`) and the same
scrambler the app uses.

```js
const DEMO = [{ slug: 'aminas-boutique', phoneNumberId: 'demo-pid-amina', token: 'FAKE-DEMO-TOKEN-AMINA', verifyToken: 'demo-verify-amina' }, ...];
```
The two demo shops and their fake details. `demo-` in every value makes it obvious
this is practice data.

```js
function guard() { not production; DATABASE_URL host must be localhost or 127.0.0.1 }
```
Stops the script unless it is clearly a local, non-production setup. *Real life:* a
"training mode" key that only opens the practice room.

```js
const { rows } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [shop.slug]);
if (!rows[0]) { console.log(`SKIPPED ...`); continue; }
```
Find the shop by its slug. If it is not in this database (a fresh one), say so and
move on instead of crashing.

```js
const encrypted = encryptSecret(shop.token, tenantId);
```
Scramble the fake token, locked to THIS shop's id (same as the real app).

```js
INSERT INTO whatsapp_configs (...) VALUES (...) ON CONFLICT (tenant_id) DO UPDATE SET ...
```
Insert the row, or update it if the shop already has one, so running twice is safe.

```js
main().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => pool.end());
```
Print only the message (never the whole error object), set a failing exit code, and
always close the database connection so the script does not hang.

---

## HOW TO TRY THE WEBHOOK AFTER SEEDING

1. Start the API: `npm run dev`.
2. Handshake: `curl.exe "http://localhost:3000/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=demo-verify-amina&hub.challenge=12345"` prints `12345`.
3. Send a pretend message (PowerShell): build the payload with `phone_number_id='demo-pid-amina'` and POST it to `/webhooks/whatsapp`. The answer is `received 1`. Send it again: `duplicates 1`.
4. In psql, pretend to be each shop with `set_config('app.current_tenant', ...)` and select from `messages`: Amina sees the message, Brio sees nothing.

## PRACTICAL EXAMPLES

- First run: two `OK` lines. Second run: two `OK` lines again, same rows refreshed.
- Run on a fresh CI database: `SKIPPED` lines (the demo shops are not there).

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| JavaScript, using `kms.js` | The token has to be encrypted the real way |
| Find shops by slug | Same slugs as the USSD seeds |
| `ON CONFLICT ... DO UPDATE` | Safe to run twice |
| Guard on `NODE_ENV` and host | The demo verify tokens are guessable |
| Lives in `apps/api/scripts/` | It uses the API's own code and `.env` |

## WHERE USED / FUTURE USES

Local manual testing. Later a real "connect WhatsApp" screen replaces it.

## TRADEOFFS

| Good | Cost |
|------|------|
| Quick to try the webhook | Demo data only; real shops need a real setup flow (not built yet) |

## COMMON MISTAKES

- Running it against a hosted database (the guard refuses).
- Running it without `KMS_KEY` in `.env` (the script says so and stops).
- Putting a real token in the `DEMO` list.

## AI AUDIT NOTE

Written by AI at Sheryl's request (it handles tokens). Declared in
`apps/api/docs/AI_AUDIT_week_29_day2.md`.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check scripts/seed-whatsapp-demo.js` | no output | passed |
| `node scripts/seed-whatsapp-demo.js` | 2 `OK` lines | passed |
| Manual handshake, message, duplicate, isolation in psql | as described above | all passed |