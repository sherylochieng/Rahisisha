# whatsapp.service.test.js — Proof That the Token Never Leaks

**File:** `apps/api/tests/whatsapp.service.test.js`
**Doc:** `apps/api/docs/tests/whatsapp.service.test.md`
**Protects:** `apps/api/src/services/whatsapp.service.js`
**Run with:** `cd apps/api` then `npm test -- tests/whatsapp.service.test.js`

---

## WHY THIS FILE EXISTS

`sendWhatsApp()` holds the most sensitive thing in the whole WhatsApp feature:
each shop's decrypted Meta token. This test proves it uses the RIGHT shop's token,
never logs it, never leaks it in errors, and that tokens are encrypted in the
database.

Real-life picture: checking a bank clerk. Does the clerk use the right customer's
key? Does the clerk ever read the key out loud? Does the safe-deposit slip show the
key? We test all three.

## WHY IMPORTANT

A leaked token lets a stranger send WhatsApp messages as that business. A wrong-shop
token sends messages as the wrong business. Neither crashes anything, so only a
test can catch them.

## DANGER (if this file does not exist)

- Someone adds `console.log(token)` while debugging. The token lands in log files for
  good. Check 3 fails.
- Someone removes the shop filter in the query. `whatsapp_configs` has no RLS, so
  the first row (maybe another shop's) is used. Check 2 fails.
- Someone copies one shop's scrambled token into another shop's row. Check 9 proves
  it will not decrypt.

## WHAT IT SOLVES (the 10 checks)

| # | Check | What it proves |
|---|-------|----------------|
| 1 | Locked to A: Meta gets A's number id and A's token | The happy path, with the exact address, header and body |
| 2 | Locked to B: B's number id and B's token, never A's | The shop filter works |
| 3 | The token never appears in console output (success or failure) | No logging of secrets |
| 4 | Meta says 401: code `whatsapp_token_rejected`, no token in the message | Revoked access is reported cleanly |
| 5 | Meta says 500: plain failure, no token in the message | Other failures leak nothing |
| 6 | No shop locked: `whatsapp_not_configured`, Meta NOT called | "No shop" never means "any shop" |
| 7 | Bad number or bad body refused, Meta NOT called | Input checked before anything is sent |
| 8 | `+254...` is cleaned to digits | People type the plus |
| 9 | A's scrambled token copied into B's row will not decrypt | The row-swap attack fails |
| 10 | The token is stored encrypted (`v1.` format, no plain text) | Encrypted at rest |

## SYSTEM DESIGN PRINCIPLE

Least privilege, and secrets never leave the function. Test the secret's exits:
logs, errors and the database.

## RULES

1. NO real Meta calls. `fetch` is replaced by a fake.
2. Fake tokens only. A throw-away KMS key. Own two shops.
3. Clean up everything, and put the real `fetch` and `KMS_KEY` back.

---

## THE CODE, PIECE BY PIECE

```js
import { jest } from '@jest/globals';
```
This project runs Jest in ESM mode, so `jest` must be imported. It gives us
`jest.fn()` (a fake function that remembers its calls) and `jest.spyOn()` (a hidden
microphone on an existing function).

```js
const TOKEN_A = `FAKE-TOKEN-A-${rand}`;
```
A fake token with a random part, so searching the logs for it cannot match by
accident.

```js
async function withLock(tenantId, fn) { set_config('app.current_tenant', id, false); fn(client); finally unlock + release }
```
Gives a check a connection locked to ONE shop, like the real `withTenant`
middleware does. `false` means the lock lasts for the whole connection. Passing `''`
means "no shop locked". It always unlocks and releases, even if the check throws.

```js
beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.SENT1' }] }) });
  global.fetch = fetchMock;
  for (const m of ['log','info','warn','error','debug']) spies.push(jest.spyOn(console, m).mockImplementation(() => {}));
});
```
Before every check: a fake Meta that always answers "sent", and a hidden microphone
on every `console` method. The mock also remembers every call, so checks can read
exactly what we "sent".

```js
const [url, options] = fetchMock.mock.calls[0];
expect(options.headers.Authorization).toBe(`Bearer ${TOKEN_A}`);
```
Check 1: read back what the fake Meta received: the address with A's number id, the
header with A's token, and the body.

```js
fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
```
Checks 3, 4 and 5: for the NEXT call only, make Meta fail.

```js
const printed = consoleText();
expect(printed).not.toContain(TOKEN_A); expect(printed).not.toContain('Bearer');
```
Check 3: search every console line printed during a success AND a failure.

```js
UPDATE whatsapp_configs SET access_token_encrypted = (SELECT ... WHERE tenant_id = A) WHERE tenant_id = B;
... await expect(sendWhatsApp(c, '254712345678', 'hi')).rejects.toThrow('Could not decrypt');
... finally { ROLLBACK }
```
Check 9: copy A's scrambled token into B's row INSIDE a transaction, try to send as B,
and expect a refusal. `ROLLBACK` puts everything back, so no real data changes.

---

## PRACTICAL EXAMPLES

- A developer adds `console.log(headers)`: check 3 fails because "Bearer" shows up.
- A developer removes the shop filter: check 2 fails, B's message goes out with A's
  token.
- A shop revokes access: Meta answers 401, the error code is `whatsapp_token_rejected`.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| Fake `fetch`, no real server | Fast, free, and we can read exactly what we "sent" |
| Real database, not a mock | The shop filter lives in the SQL, so the SQL must really run |
| Hidden microphones on `console` | Proves nothing prints a secret |
| `ROLLBACK` in the row-swap check | Tests an attack without changing real data |

## WHERE USED / FUTURE USES

`npm test`, the Husky pre-push hook (full suite) and CI. Future: add checks when
template messages are added.

## TRADEOFFS

| Good | Cost |
|------|------|
| Proves every secret exit is closed, with no real WhatsApp account | Does not prove Meta accepts our message shape (needs Meta's sandbox) |

## COMMON MISTAKES

- Forgetting to restore `global.fetch` (other test files then see the fake).
- Using a real token in a test.
- Forgetting to take the console microphones off (`afterEach`).
- Skipping the control that Meta is NOT called on refusals.

## AI AUDIT NOTE

Test written by AI (allowed). The sender it checks was AI-written at Sheryl's
request, declared in `apps/api/docs/AI_AUDIT_week_29_day2.md`.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check` | no output | passed |
| `npm test -- tests/whatsapp.service.test.js` | 10 passing | 10 passed |
| Full `npm test` | all pass | 198 passed (22 suites); CI green |