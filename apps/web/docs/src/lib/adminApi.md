# apps/web/src/lib/adminApi.js

**Week 30 Day 3, Batch 2 (admin web), part 1.** The one place the admin pages talk to the API.

## WHY THIS FILE EXISTS
Sign in, sign out and "who am I" for the platform admin. Later parts add the shop list and the suspend / verify buttons here.

## WHY IMPORTANT
The admin cookie lives only on the API's own address (`api.rahisishabiashara.com`). The website's server cannot read it. So admin pages must call the API **from the browser**, which attaches the cookie by itself. This file does that.

## DANGER
- Never make an admin call from a server component or `serverApi.js`: the server has no admin cookie.
- Never keep the admin token in `localStorage` or a variable. It stays in an httpOnly cookie, out of reach of page scripts.
- Never show raw server errors.

## WHAT IT SOLVES
One safe, friendly way to call the admin API. Callers can tell "signed out" (401) from "server down" (0 or 5xx).

## SYSTEM DESIGN PRINCIPLE
Separation of concerns: owner calls live in `api.js`, admin calls live here. Same-site cookies: the web and the API share `rahisishabiashara.com`, so the strict cookie may travel.

## RULES
1. `credentials: 'include'` on every call.
2. Read answers as `{ data, error }`.
3. `err.status = 0` means we never got an answer.

## PRACTICAL EXAMPLE (Kenya)
Like a SACCO manager's keys: the manager's key opens only the manager's office (the API). The branch teller's key (the owner cookie) is a different key and a different door.

## DECISIONS
The careful HOW of calling lives in `apiClient.js` (shared with `api.js`), so this file is only the list of admin endpoints. Nothing is repeated.

## WHERE USED
`AdminLoginForm.js`, `AdminShell.js`, and the shop pages next.

## TRADEOFFS
Pages using it must be client components. Fine for an admin panel.

## HOW TO USE
```js
import { adminApi } from '../../lib/adminApi';
try { const res = await adminApi.me(); } catch (err) { if (err.status === 401) { /* sign-in page */ } }
```

## LINE BY LINE
- `import { request } from './apiClient'`: the shared careful caller (cookie attached, friendly errors).
- `adminApi.login`: POST `/admin/auth/login` with phone and password.
- `adminApi.logout`: POST `/admin/auth/logout`. The API clears the cookie.
- `adminApi.me`: GET `/admin/auth/me`. 200 with the admin's name, or 401 when signed out.
