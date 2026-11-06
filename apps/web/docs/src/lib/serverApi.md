# Guide: serverApi.js (call the API from a server page)

**Code file:** `apps/web/src/lib/serverApi.js`
**Calls:** any protected API route, for example `GET /v1/dashboard`
**Used by:** `apps/web/src/app/(authed)/dashboard/page.js`
**Added:** Week 28 Day 5

---

## WHY THIS FILE EXISTS

Dashboard pages run on the website's server. To get data they must call the API **and** show it the visitor's login cookie, or the API answers 401. This helper does both in one line.

## WHY IMPORTANT

It is the only way private pages get their data. The data always comes from the API, which uses the shop-scoped connection (`req.db`) and the database lock.

## DANGER

- Every page repeats the cookie-forwarding code, and one gets it wrong.
- A page is tempted to read the database directly and skip the shop lock.
- A broken API shows a page full of zeros that look real.

## THE PICTURE

```
 serverGet('/dashboard')
   1. take the "token" note from the cookie jar
   2. none?                -> redirect to /login
   3. call the API with Cookie: token=...
   4. 401                  -> redirect to /login
   5. any other failure    -> THROW (never fake an empty page)
   6. success              -> return json.data
```

Like a waiter carrying your order slip to the kitchen: he always shows the slip (the cookie), and if the kitchen is on fire he tells you, instead of bringing you an empty plate.

## LINE BY LINE

| Part | What it does |
|---|---|
| `await cookies()` | Opens this visit's cookie jar (asynchronous in Next.js 16) |
| `if (!token) redirect('/login')` | Not logged in |
| `fetch(`${API_URL}${path}`, { headers: { Cookie }, cache: 'no-store' })` | Calls the API as the visitor. `no-store` means always fresh numbers, never an old copy |
| `res.status === 401` -> `redirect('/login')` | The note is expired or fake |
| `!res.ok` -> `throw new Error(...)` | A real problem (for example a 500). The error shows, and the page never shows invented zeros |
| `return json.data` | The API wraps its answer as `{ data: ... }`. We hand back just the data |

## RULES

- Server only (it uses `next/headers`). Never import it into a `'use client'` file.
- 401 means "not logged in": redirect. Any other failure **throws**.
- Do not wrap `redirect()` in `try/catch`.

## DECISIONS

- One door to the API: pages never talk to the database.
- Throw on unexpected errors, so a failure is visible and not disguised as an empty dashboard.
- `cache: 'no-store'` for always-fresh numbers.

## PRACTICAL EXAMPLE

```js
import { serverGet } from '../../../lib/serverApi';

const data = await serverGet('/dashboard');
// data.ordersToday, data.balanceCents, data.latestProducts
```

## WHERE YOU WILL USE THIS

Every server-rendered page that needs private data from a separate API.

## TRADEOFFS

- One place for cookie forwarding and error rules.
- Only handles GET for now. Add `serverPost` when a page needs to write.

## KNOWN GAPS

1. GET only.
2. It expects every API answer to be `{ data: ... }`, but the dashboard answer has no `error: null` (small envelope inconsistency on the API side).
3. The cookie-forwarding code is repeated in `session.js`.
4. No automated test.

## RELATED

- `apps/web/docs/src/lib/session.md`
- `apps/api/docs/src/controllers/dashboard.controller.md` (the endpoint it calls today)