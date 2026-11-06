# Guide: session.js (the bouncer)

**Code file:** `apps/web/src/lib/session.js`
**Calls:** `GET /v1/me`
**Called by:** the `(authed)` layout, before it draws any page
**Added:** Week 28 Day 5

---

## WHY THIS FILE EXISTS

Pages inside the dashboard must only be seen by logged-in people. Every one of them asks this bouncer first: "show me your login badge."

## WHY IMPORTANT

A page that forgets the check shows private shop data to anyone.

## DANGER

- Each page writes its own check. One forgets, and that page leaks.
- A page only checks that a cookie **exists**. A fake cookie exists too.

## THE PICTURE

```
 requireSession()
   1. open the cookie jar
   2. take out the note called "token"
   3. no note?                   -> redirect to /login
   4. show the note to the API:  GET /v1/me   (Cookie: token=...)
   5. API says no (expired, fake, tampered)  -> redirect to /login
   6. API says yes               -> { user, tenant }
```

Like a bouncer who does not read the ID himself. He phones the manager (the API), who owns the secret key, and asks "is this badge real?"

## LINE BY LINE

| Part | What it does |
|---|---|
| `import { cookies } from 'next/headers'` | Lets a server file read this visit's cookie jar |
| `import { redirect } from 'next/navigation'` | Sends the visitor to another page |
| `API_URL` | Already ends in `/v1` |
| `await cookies()` | In Next.js 16 `cookies()` is asynchronous, so we `await` it |
| `cookieStore.get('token')?.value` | The cookie name matches `signup.js` and `login.js`. `?.` avoids a crash when there is no cookie |
| `if (!token) redirect('/login')` | No note, not logged in |
| `fetch(`${API_URL}/me`, { headers: { Cookie: ... }, cache: 'no-store' })` | Passes the note on like a browser would. `no-store` means never reuse an old answer |
| `if (!res.ok) redirect('/login')` | The API refused the note |
| `const { user, tenant } = await res.json()` | `/me` answers `{ user, tenant }` |

## RULES

- Never decide "logged in" by only checking that a cookie exists. Always ask the API.
- Do not wrap `redirect()` in `try/catch`. It works by **throwing**, and catching it would cancel the redirect.
- Server only (it uses `next/headers`). Never import it into a `'use client'` file.

## DECISIONS

- The website never checks the badge itself. The secret key (`JWT_SECRET`) never leaves the API.
- One function, one place.

## PRACTICAL EXAMPLES

```js
const { user, tenant } = await requireSession();
// user   = { id, name, phone }
// tenant = { id, name, slug }
```

- Logged out, or a fake or expired cookie -> the visitor lands on `/login`.
- Logged in -> the layout can show the shop's name and the owner's name.

## WHERE YOU WILL USE THIS

Every app with a private area. The pattern: read the cookie on the server, ask the backend who it belongs to, redirect if nobody.

## TRADEOFFS

- The secret key stays in the API only. One check, one place.
- One extra API call per page load (can be cached later).

## KNOWN GAPS

1. **An API outage looks like "logged out".** Any non-OK answer from `/me`, even a 500, redirects to `/login`. `serverApi.js` is stricter: only 401 redirects, and other failures throw. Consider the same rule here.
2. **The two helpers read the API differently.** `session.js` expects `{ user, tenant }`; `serverApi.js` expects `{ data: ... }`.
3. **The cookie-forwarding code is repeated** here and in `serverApi.js`.
4. **The layout does not re-run on every client-side click.** The API's own cookie check is the second lock.
5. No automated test.

## RELATED

- `apps/web/docs/src/app/(authed)/` layout guide (when written)
- `apps/web/docs/src/lib/serverApi.md`
- `apps/api/docs/src/routes/auth/login.md` (where the cookie is set)