# getShopSlug.js: which shop is this person visiting?

> **Code file:** `apps/api/src/utils/getShopSlug.js`
> **Used by:** `apps/api/src/routes/auth/login.js`
> **Tested by:** `apps/api/tests/getShopSlug.test.js`
> **Added:** Week 28 Weekend, Task 8 (staging deploy)

---

## WHY THIS FILE EXISTS

Every shop has its own address, like `mama-mboga.rahisishabiashara.com`.
The first word (`mama-mboga`) is the shop's **slug**, its short name.
Login needs that slug to know **which shop the person is signing in to**.
This file reads the slug from the request.

## WHY IMPORTANT

Login uses the slug to find the shop, then checks the person belongs to
**that** shop. A wrong slug means one of two things:
- the wrong shop is checked (a security problem), or
- a real shop owner gets "Shop not found" (a broken product).

## DANGER (what broke online)

Before this file, login read the slug from the **Host** header (the address
the request was *sent to*). Online, the browser sends login requests to
`api.rahisishabiashara.com`, not to the shop's page. So the slug was always
`api`, and no shop was ever found. Result: **"Shop not found" for everyone.**

## WHAT IT SOLVES

It looks at the **Origin** header first (the address of the *page the person
was on*), which still says `mama-mboga.rahisishabiashara.com`. Then it falls
back to Host.

## SYSTEM DESIGN PRINCIPLE

- **"Ask who is calling, not who was called."** The page tells us the shop.
  The API address never does.
- **"Words that are not shops must never become shops."** `www` and `api`
  are reserved.
- **"Keep one place for one decision."** The slug rule lives here, not copied
  into every route.

## RULES (never do this)

1. **NEVER** treat the bare domain (`rahisishabiashara.com`) as a shop.
2. **NEVER** treat `www` or `api` as shops.
3. **NEVER** trust the slug alone. Login still checks that the person is a
   member of that shop, and the database locks (RLS) still apply.
4. **NEVER** crash on a strange header. Return `null` instead.
5. **NEVER** put slug logic inside a route file. Keep it here so it is tested once.

## PRACTICAL EXAMPLES (`ROOT_DOMAIN = rahisishabiashara.com`)

| Origin | Host | Slug returned | Why |
|---|---|---|---|
| `https://mama-mboga.rahisishabiashara.com` | `api.rahisishabiashara.com` | `mama-mboga` | **the exact bug, now fixed** |
| `https://rahisishabiashara.com` | `api.rahisishabiashara.com` | `null` | the main site, not a shop |
| `https://www.rahisishabiashara.com` | anything | `null` | `www` is reserved |
| (none) | `mama-mboga.rahisishabiashara.com` | `mama-mboga` | Host fallback |
| `not a url` | `api.rahisishabiashara.com` | `null` | garbage ignored, `api` reserved |

With **no** `ROOT_DOMAIN` (your laptop), the old behaviour applies:
`localhost:3000` gives `null`, `mama.localhost:3000` gives `mama`.

## DECISIONS WE MADE (and why)

1. **Origin first, Host second.** Origin is what the browser knows about the
   page. Host is the fallback for calls that have no Origin.
2. **`null` means "no shop"**, not an error. Login then decides what to do.
3. **No `ROOT_DOMAIN` keeps the old behaviour.** Local development must not break.
4. **Settings are passed in** (`env = process.env`), so tests can try any setup.
5. **Reserved list is tiny and explicit.** Easy to read, easy to extend.

## WHERE YOU WILL USE THIS

- `login.js`: decides which shop to log in to.
- Later: any route that needs "which shop is the visitor on" before login.

## TRADEOFFS

+ Fixes online login with one small, well-tested function.
- Origin can be set by a non-browser caller. That is fine: the slug is only a
  starting point, and the membership check plus the database locks do the real
  protecting.
- The reserved list is not yet enforced at **signup**. Someone could still
  register a shop named `api`. It is on the backlog.

## HOW TO USE

```js
import { getShopSlug } from '../../utils/getShopSlug.js';

const slug = getShopSlug(req);
if (slug === null) {
  // no shop in the address
} else {
  // look the shop up by slug
}
```

Test it: `npm test -- getShopSlug`

---

## EXPLAINED PIECE BY PIECE (real life + where / when / how)

**1. `RESERVED = new Set(['www', 'api'])` = ROOMS THAT ARE NOT SHOPS.**
Like "Reception" and "Storeroom" on a mall directory. They exist, but nobody
can rent them as a shop. A `Set` is used because "is this in the list?" is
instant and clear.

**2. `hostnameOf(value)` = READING THE ADDRESS ON AN ENVELOPE.**
Origin looks like `https://mama.rahisishabiashara.com`. Host looks like
`mama.rahisishabiashara.com:3000`. This pulls out just the address part and
returns `null` if it cannot be read. *When:* every call. *Why:* so one
messy header cannot crash login.

**3. `shopFromHostname(hostname, root)` = "WHICH ROOM IS THIS?"**
Returns `null` when:
- it is the main house itself (no room),
- it is not under our street at all (a stranger),
- the room name is empty or reserved (`www`, `api`).
Otherwise it returns the room name, which is the shop slug.
*Example:* `mama-mboga.rahisishabiashara.com` gives `mama-mboga`.

**4. `getShopSlug(req, env = process.env)` = THE RECEPTIONIST.**
Combines the pieces and follows this order:
1. No `ROOT_DOMAIN` set (laptop): use the old rule, first word of Host.
2. Otherwise read the **Origin** first. If it names a shop, use it.
3. Otherwise try **Host**.
4. Nothing found: `null`.

**5. The old laptop rule = KEEPING THE OLD DOOR WORKING.**
On `localhost` there is no shop word, so the answer is `null`. Everything that
worked before still works.

## COMMON MISTAKES

- Reading only Host. This was the original bug.
- Forgetting `ROOT_DOMAIN` on Render. The function then falls back to the
  laptop rule and shops are not found.
- Adding a new non-shop name (like `admin`) without adding it to `RESERVED`.
- Trusting the slug for permission. It only picks the shop. Permission comes
  from the login check and the database locks.