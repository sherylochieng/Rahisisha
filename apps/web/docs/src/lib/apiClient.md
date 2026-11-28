# apps/web/src/lib/apiClient.js

**Week 30 Day 3, Batch 2.** The one careful way the browser calls the API.

## WHY THIS FILE EXISTS
Attach the cookie, read the answer, turn every failure into a friendly error. `adminApi.js` uses it now, and `api.js` (shop owner) can switch to it, so this logic exists once.

## WHY IMPORTANT
Two copies drift apart: someone fixes a bug in one and forgets the other. One copy means one fix helps both the owner side and the admin side.

## DANGER
- Never remove `credentials: 'include'`: the browser would send no cookie and every signed-in call would look signed out.
- Never show raw server or browser errors.
- Do not put endpoint lists here. This file knows HOW to call, not WHAT to call.

## WHAT IT SOLVES
Friendly errors for every failure, in one place, for every caller.

## SYSTEM DESIGN PRINCIPLE
DRY and separation of concerns: HOW we call lives here, WHAT we call lives in `api.js` and `adminApi.js`.

## RULES
1. `err.status = 0` means "we never got an answer".
2. Both answer shapes are understood: `{ error: 'text' }` (owner routes) and `{ error: { code, message } }` (admin routes).
3. Always throw an `Error` with a friendly message.

## PRACTICAL EXAMPLE (Kenya)
Like one customer-care line for the whole company: whichever branch you call, the same polite greeting when the network is down.

## DECISIONS
Exports `request()` only. `err.code` and `err.details` are attached when the API sends them.

## WHERE USED
`adminApi.js` now. `api.js` can switch to it next, so its own copy can go.

## TRADEOFFS
One fix helps everyone, but a change here affects both sides, so it deserves care.

## HOW TO USE
```js
import { request } from './apiClient';
const data = await request('/admin/auth/me');
await request('/login', { method: 'POST', body: JSON.stringify(body) });
```

## LINE BY LINE
- `API_URL`: the API address (ends in `/v1`).
- `NETWORK_MESSAGE` / `SERVER_MESSAGE`: the two friendly sentences.
- `pickMessage`: string error first, then `error.message`, then the server-trouble sentence, then "Something went wrong".
- `request`: `fetch` with JSON headers and `credentials: 'include'`. If `fetch` itself fails, throw with `status = 0`. Read the JSON carefully (`.catch(() => null)`). If not OK, throw an error with `status`, `code` and `details`. Otherwise return the data.
