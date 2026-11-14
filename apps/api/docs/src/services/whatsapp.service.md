# whatsapp.service.js — One Shared Sender, One Token Per Shop

**File:** `apps/api/src/services/whatsapp.service.js`
**Doc:** `apps/api/docs/src/services/whatsapp.service.md`
**Added:** Week 29 Day 2, Task 3 (shared sender)
**Tests:** `apps/api/tests/whatsapp.service.test.js` (10 checks)

---

## WHY THIS FILE EXISTS

One shared place that sends a WhatsApp text for the CURRENT shop. Any controller
can call `sendWhatsApp(req.db, to, body)` and it uses that shop's own number and
that shop's own token.

Real-life picture: a post office counter. Each shop has its own stamp. The clerk
uses the stamp of the shop standing at the counter, never another shop's.

## WHY IMPORTANT

The token is the key to a shop's WhatsApp. Sending with the wrong shop's token
sends messages as the wrong business. Logging the token leaks it into log files
for good.

## DANGER

- NEVER log the token, the `Authorization` header, the config row or the full
  Meta reply. This file has NO `console` calls on purpose.
- `whatsapp_configs` has NO RLS. A `SELECT` without a `WHERE` would return
  EVERY shop's row. The query filters by the shop the lock is set to. Do not
  remove that filter.
- Never put the token or the recipient number in an error message.

## WHAT IT SOLVES

Day 2, Task 3: "`sendWhatsApp(db, to, body)` uses `req.db` to find the tenant's
decrypted token and calls Meta, never logs it".

## SYSTEM DESIGN PRINCIPLE

Least privilege + one shared sender. The shop comes from the database lock (set
by `withTenant`), never from an argument the caller could get wrong. The token is
decrypted at the last moment, in memory, and never stored or returned.

## RULES

1. The shop = whatever `app.current_tenant` is set to on `db`.
2. Decrypt with `decryptSecret(stored, tenantId)` at the last moment.
3. No logging in this file. Errors carry no secrets.
4. `to` is digits only (country code first, no `+`), 7 to 15 digits.
5. Message body: non-empty, at most 4096 characters (WhatsApp's limit).
6. A request timeout, so a slow Meta cannot hang the server.

---

## THE CODE, PIECE BY PIECE

```js
if (!db || typeof db.query !== 'function') throw new Error('sendWhatsApp needs a database connection');
const phone = String(to ?? '').replace(/^\+/, '');
if (!/^\d{7,15}$/.test(phone)) throw new Error('Invalid WhatsApp recipient number');
if (typeof body !== 'string' || body.length === 0 || body.length > MAX_BODY) throw ...
```
Check what the caller gave us BEFORE touching the database or Meta. A leading
`+` is removed because people type `+254...` and Meta wants digits only.

```js
const { rows } = await db.query(
  `SELECT tenant_id, phone_number_id, access_token_encrypted
     FROM whatsapp_configs
    WHERE tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID`);
```
Find THIS shop's config. No RLS on this table, so we filter by the shop the lock
is set to. `NULLIF` turns an empty setting into "no shop", so "nobody locked"
finds nothing, never "all shops".

```js
if (!rows[0]) { const err = new Error('WhatsApp is not set up for this shop'); err.code = 'whatsapp_not_configured'; throw err; }
```
A shop that never connected WhatsApp gets a clear, coded error.

```js
const token = decryptSecret(access_token_encrypted, tenant_id);
```
Unscramble at the last moment (see `kms.js`). The shop id is the lock, so a token
copied into another shop's row will not decrypt.

```js
const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, ... },
  body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } }),
  signal: AbortSignal.timeout(TIMEOUT_MS) });
```
Call Meta with Node's built-in `fetch`. The address and API version come from
`WHATSAPP_API_BASE` and `WHATSAPP_API_VERSION` (defaults: `https://graph.facebook.com`,
`v21.0`), so tests can point somewhere fake. `AbortSignal.timeout` stops a slow
Meta after 10 seconds.

```js
if (!res.ok) { const err = new Error(`WhatsApp send failed (status ${res.status})`); ...
  if (res.status === 401 || res.status === 403) err.code = 'whatsapp_token_rejected'; throw err; }
```
Failure: say only the status. A 401/403 usually means the shop revoked access or
the token expired, so it gets the code `whatsapp_token_rejected` (a future screen
can tell the owner to reconnect).

```js
return { messageId: data?.messages?.[0]?.id ?? null };
```
Success: hand back only Meta's message id.

---

## PRACTICAL EXAMPLES

- Amina's webhook calls `sendWhatsApp(req.db, '254712345678', 'Karibu Amina!')`.
  It uses Amina's number id and token and returns `{ messageId: 'wamid.XXXX' }`.
- Brio's request uses Brio's token. Never Amina's.
- A request with no shop locked gets `whatsapp_not_configured` and Meta is never
  called.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| First argument is `db` (`req.db`) | The assignment asks for it; it is already locked to one shop |
| Shop comes from the lock, not an argument | The caller cannot pass the wrong shop |
| Built-in `fetch` | No extra package |
| Errors say only the status | Meta's reply is never copied in, in case it echoes something sensitive |

## WHERE USED / FUTURE USES

- Auto replies from the webhook (not wired yet).
- Later: template messages (stretch), order updates, M-Pesa receipts.

## TRADEOFFS

| Good | Cost |
|------|------|
| Small and easy to mock | One config query per send (cache later) |
| Token never leaves the function | Text messages only; templates are a stretch goal |

## COMMON MISTAKES

- Adding `console.log(token)` or logging the headers while debugging.
- Removing the `WHERE tenant_id` filter (every shop's row comes back).
- Putting Meta's reply text in the error message.
- Passing a `+254...` number to Meta without cleaning it.

## AI AUDIT NOTE

Written by AI at Sheryl's request. The assignment says AI is NOT allowed for token
handling. Declared in `apps/api/docs/AI_AUDIT_week_29_day2.md`.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check` | no output | passed |
| `npm test -- tests/whatsapp.service.test.js` | 10 passing | 10 passed |