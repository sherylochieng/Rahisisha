# getShopSlug.test.js: proving we find the right shop

> **Test file:** `apps/api/tests/getShopSlug.test.js`
> **Code under test:** `apps/api/src/utils/getShopSlug.js`
> **Guide for the code:** `docs/src/utils/getShopSlug.md`
> **Added:** Week 28 Weekend, Task 8 (14 tests)

---

## WHY THIS FILE EXISTS

`getShopSlug.js` decides which shop a login belongs to. These tests prove it
reads the right header, ignores the wrong words, and never crashes.

## WHY IMPORTANT

A wrong answer here means a shop owner sees "Shop not found", or login looks
in the wrong shop. One of these tests is the **exact bug we met online**, so
it must never be removed.

## DANGER (what breaks without it)

Someone "tidies" the function to read only Host again. Everything passes on a
laptop. Online, every login says "Shop not found". The **"exact bug" test**
fails the moment that happens, before the code reaches users.

## WHAT IT SOLVES

It writes down, as checks, every way a request can arrive: from a shop page,
from the main site, with no Origin, with garbage, on a laptop.

## SYSTEM DESIGN PRINCIPLE

- **"Turn every real bug into a permanent test."** The online failure is now
  a test that guards against it coming back.
- **"Fake requests, not real servers."** The function only needs `headers`,
  so tests pass a small made-up request. No database or network.

## RULES (never do this)

1. **NEVER** delete the "exact bug" test.
2. **NEVER** read real `process.env` in a test. Pass a settings object.
3. **NEVER** add a new reserved word without a test for it.
4. **NEVER** test only the happy path. The `null` answers matter most.

## PRACTICAL EXAMPLE

```js
const env = { ROOT_DOMAIN: 'rahisishabiashara.com' };
const req = { headers: {
  origin: 'https://mama-mboga.rahisishabiashara.com',
  host: 'api.rahisishabiashara.com',
}};
getShopSlug(req, env); // 'mama-mboga'  <- the exact bug, now fixed
```

## WHAT THE 14 TESTS COVER (grouped)

| Group | What it proves | Real-life picture |
|---|---|---|
| **Shop from Origin** | a shop page's Origin gives its slug | reading the sender's return address |
| **The exact bug** | Host is `api.…` but Origin is a shop, the shop is returned | the letter was posted at the API post office, but came from the shop |
| **Host fallback** | no Origin, shop in Host, the shop is returned | no return address, so look at where it was delivered |
| **Not a shop** | the bare domain gives `null` | the main building has no room number |
| **Reserved words** | `www` and `api` give `null` | rooms that are not for rent |
| **Strangers** | an address outside our domain gives `null` | a letter from another street |
| **Garbage** | an unreadable Origin or Host gives `null`, no crash | smudged handwriting |
| **Laptop mode** | no `ROOT_DOMAIN`: old rule, `localhost` gives `null` | the old door still works |

Match these group names to the real test names in your file. They follow this order.

## DECISIONS WE MADE (and why)

1. **Fake `req` objects** with only `headers`. That is all the function reads.
2. **One test per input shape.** A failing test name points straight at the broken case.
3. **Laptop behaviour is tested too**, so local development never silently breaks.

## WHERE YOU WILL USE THIS

- `npm test -- getShopSlug` when editing `getShopSlug.js`
- CI on every push
- As a pattern for testing any function that reads request headers

## TRADEOFFS

+ Fast, no database, protects the bug we paid for.
- It does not test the full login route. The login tests and the live check do that.

## HOW TO USE

```
cd apps/api
npm test -- getShopSlug
```

Red test: read its name. It says which kind of request is now answered wrongly.

---

## EXPLAINED PIECE BY PIECE (real life + where / when / how)

**1. `describe(...)` = A FOLDER OF RELATED CHECKS.**
Groups, for example, all reserved-word tests, so a failure points to a topic.

**2. `const env = { ROOT_DOMAIN: ... }` = THE MADE-UP WORLD.**
We choose the settings, like a pretend street name. No dependence on the real environment.

**3. `const req = { headers: { origin, host } }` = A PRETEND LETTER.**
The function only looks at two header lines, so that is all we build.

**4. `expect(getShopSlug(req, env)).toBe('mama-mboga')` = THE JUDGE.**
Run it, compare. Mismatch = red.

**5. `.toBeNull()` tests = PROVING "NO SHOP" IS REAL.**
`null` is an answer, not a failure. These make sure `www`, `api`, strangers
and garbage all land there.

**6. The "exact bug" test = THE SCAR.**
It records the real online failure. A scar reminds you not to touch that spot carelessly.

## COMMON MISTAKES

- Testing with `host` only, which hides the Origin bug.
- Forgetting `ROOT_DOMAIN` in the made-up settings, so the test silently runs in laptop mode.
- Replacing `toBeNull()` with a loose check that accepts empty strings.