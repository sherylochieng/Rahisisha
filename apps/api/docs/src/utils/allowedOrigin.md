# allowedOrigin.js: which websites may talk to the API

> **Code file:** `apps/api/src/utils/allowedOrigin.js`
> **Used by:** `apps/api/src/app.js` (the `cors()` setting)
> **Tested by:** `apps/api/tests/allowedOrigin.test.js`
> **Added:** Week 28 Weekend, Task 8 (staging deploy)

---

## WHY THIS FILE EXISTS

A browser will not let one website call another website's API unless the API
says "yes, that website is allowed". That permission check is called **CORS**.
This file is the **rulebook** that answers: *"Is the website that is calling
us one of ours?"*

## WHY IMPORTANT

- **Too strict:** shops cannot log in. (This is what happened online.)
- **Too loose:** a stranger's website could call the API using a visitor's
  login cookie and act as that person.

## DANGER (what breaks without it)

Before this file, `app.js` allowed exactly **one** address (`WEB_ORIGIN`).
Online, every shop has its own address, like
`mama-mboga.rahisishabiashara.com`. The browser sent that as its origin, the
API compared it with the one allowed address, said no, and **no shop could
log in**.

## WHAT IT SOLVES

One safe rule covering the main site **and every shop**, with no list to
maintain when a new shop signs up.

## SYSTEM DESIGN PRINCIPLE

- **"Allow by rule, not by list."** Shops appear every day. A rule scales.
- **"Deny by default."** Anything we cannot prove is ours is refused.

## RULES (never do this)

1. **NEVER** allow `*` (everyone) while cookies are on (`credentials: true`).
2. **NEVER** match with a plain `endsWith("rahisishabiashara.com")`.
   `evilrahisishabiashara.com` would pass. Match the **dot**:
   `endsWith(".rahisishabiashara.com")`, or exact equality.
3. **NEVER** allow `http://` in production. Only `https://`.
4. **NEVER** crash on a strange origin. Refuse it quietly.

## PRACTICAL EXAMPLES (`ROOT_DOMAIN = rahisishabiashara.com`)

| Origin the browser sends | Answer | Why |
|---|---|---|
| `https://rahisishabiashara.com` | allowed | the main house |
| `https://mama-mboga.rahisishabiashara.com` | allowed | a room inside the house |
| `https://evilrahisishabiashara.com` | **refused** | no dot before our name |
| `https://rahisishabiashara.com.evil.com` | **refused** | our name is only the start of a stranger's |
| `http://mama-mboga.rahisishabiashara.com` | **refused** (production) | not secure |
| `not a url` | **refused** | garbage, no crash |
| (no Origin at all) | allowed | not a browser call (see decisions) |

## DECISIONS WE MADE (and why)

1. **No Origin = allowed.** Browsers always send an Origin on cross-site
   calls. A call without one comes from our own website's server, a test, or
   curl. That is not a browser attack, and the login cookie and the database
   locks still protect everything.
2. **The old `WEB_ORIGIN` still works.** Nothing that worked before breaks
   (on a laptop it is `http://localhost:3001`).
3. **No `ROOT_DOMAIN` = only `WEB_ORIGIN`.** A laptop behaves exactly as before.
4. **Settings are read when the function is called**, not when the file loads,
   so tests can pass their own settings.
5. **Refusing returns `false`, not an error.** The `cors` library then sends no
   permission slip and the browser blocks the call by itself. This is calmer
   than throwing a 500.

## WHERE YOU WILL USE THIS

- `app.js`: `app.use(cors({ origin: corsOrigin, credentials: true }))`
- Render settings: `ROOT_DOMAIN=rahisishabiashara.com`, `WEB_ORIGIN=https://rahisishabiashara.com`
- Any future API that serves many customer addresses

## TRADEOFFS

+ One rule for every shop. No redeploy when a shop is added.
- A bug on one shop's own page (an XSS hole) could call the API as that
  visitor. Every shared domain has this risk. The real defence is the login
  token and the database locks.
- Depends on `ROOT_DOMAIN` being set correctly in Render.

## HOW TO USE

```js
import { corsOrigin } from './utils/allowedOrigin.js';
app.use(cors({ origin: corsOrigin, credentials: true }));
```

Test it: `npm test -- allowedOrigin`

---

## EXPLAINED PIECE BY PIECE (real life + where / when / how)

**1. `isAllowedOrigin(origin, env = process.env)` = THE BOUNCER'S RULEBOOK.**
Takes the address the visitor says they come from, answers true or false.
It is a pure function: same input, same answer, so it is easy to test.
*Where:* inside `corsOrigin`. *When:* on every browser request.
*Example:* the bouncer reads the guest list rules, not the guest's face.

**2. `if (!origin) return true` = THE STAFF ENTRANCE.**
Our own website's server and our tests send no origin. They are not strangers
in a browser, so they walk straight in. The locks inside (login, database)
still apply.

**3. `origin === env.WEB_ORIGIN` = THE REGULAR WHO IS ALWAYS ON THE LIST.**
The one address we allowed before. Keeps the laptop working.

**4. `const root = (env.ROOT_DOMAIN || '').toLowerCase()` = OUR STREET NAME.**
If there is no street name (a laptop), there is no domain rule, so we stop.

**5. `new URL(origin)` inside `try/catch` = READING THE ID CARD CAREFULLY.**
If the card is nonsense, we refuse instead of crashing the whole API.

**6. The protocol checks = THE LOCK ON THE DOOR.**
In production only `https:` (the locked door) gets in. Anything that is not
`http:` or `https:` (for example `ftp:`) is refused.

**7. `hostname === root || hostname.endsWith('.' + root)` = "MAIN HOUSE OR A ROOM INSIDE IT?"**
The **dot** is the safety catch. `mama-mboga.rahisishabiashara.com` ends with
`.rahisishabiashara.com`, so it is a room. `evilrahisishabiashara.com` does
not (no dot), so it is a stranger with a similar name.

**8. `corsOrigin(origin, callback)` = THE FORM THE `cors` LIBRARY EXPECTS.**
The library does not want `true` or `false`. It hands us a callback and wants
us to call it. `callback(null, true)` = allowed. `callback(null, false)` =
refused (no permission slip, the browser blocks the call).

## COMMON MISTAKES

- Writing `endsWith('rahisishabiashara.com')` without the dot.
- Setting `origin: '*'` together with `credentials: true`. Browsers refuse the
  combination, and it would be unsafe anyway.
- Forgetting `ROOT_DOMAIN` on Render. Shop addresses are then refused again.
- Changing `WEB_ORIGIN` to a shop address. It should be the **main site**.