# allowedOrigin.test.js: proving the website rulebook works

> **Test file:** `apps/api/tests/allowedOrigin.test.js`
> **Code under test:** `apps/api/src/utils/allowedOrigin.js`
> **Guide for the code:** `docs/src/utils/allowedOrigin.md`
> **Added:** Week 28 Weekend, Task 8 (13 tests)

---

## WHY THIS FILE EXISTS

`allowedOrigin.js` decides which websites may call our API. If it is wrong in
one direction, shops cannot log in. If it is wrong in the other, strangers
get in. These tests **prove it is right** and **keep it right** when someone
edits it later.

## WHY IMPORTANT

- The rule is **security-critical** but only a few lines long, so it looks
  harmless and invites "quick simplifications".
- It cannot be checked by hand for every look-alike address. A test can.

## DANGER (what breaks without it)

Someone "simplifies" `hostname.endsWith('.' + root)` into
`endsWith(root)`. Everything still works for real shops. But
`evilrahisishabiashara.com` now gets in, and **nobody notices** until it is
abused. A test with that exact address turns this into a red failure on the
same day.

## WHAT IT SOLVES

It fixes the rulebook's behaviour in writing: this address in, that answer out.

## SYSTEM DESIGN PRINCIPLE

- **"Test the attacker, not just the customer."** Most tests here are
  addresses that must be **refused**.
- **"Pure function, easy test."** `isAllowedOrigin` takes its settings as an
  argument, so no real server, database or environment variables are needed.

## RULES (never do this)

1. **NEVER** delete a refusal test to make a change pass. If it fails, the change is wrong.
2. **NEVER** read the real `process.env` inside a test. Pass a small settings object.
3. **NEVER** add a new allowed pattern without adding a refused look-alike test beside it.
4. **NEVER** skip (`.skip`) these tests in CI.

## PRACTICAL EXAMPLE

Settings used in the tests (made up on the spot):

```js
const env = { ROOT_DOMAIN: 'rahisishabiashara.com', NODE_ENV: 'production' };
isAllowedOrigin('https://mama-mboga.rahisishabiashara.com', env); // true
isAllowedOrigin('https://evilrahisishabiashara.com', env);        // false
```

## WHAT THE 13 TESTS COVER (grouped)

| Group | What it proves | Real-life picture |
|---|---|---|
| **Allowed** | the main site, a shop, and the old `WEB_ORIGIN` get in | the guest list works |
| **No Origin** | a call with no origin is allowed | staff entrance |
| **Look-alikes refused** | `evil…com`, and `rahisishabiashara.com.evil.com` are refused | a fake ID that looks nearly right |
| **Protocol** | `http://` is refused in production, other protocols refused | the unlocked door |
| **Garbage** | a non-URL string is refused, no crash | an unreadable ID card |
| **No ROOT_DOMAIN** | only `WEB_ORIGIN` is allowed (laptop behaviour) | no street name, so only the regular |
| **corsOrigin wrapper** | it calls the callback with `(null, true)` or `(null, false)` | the form the `cors` library expects |

Open your test file and match the group names to the real test names. They
follow this order.

## DECISIONS WE MADE (and why)

1. **Settings are passed in**, not read from `process.env`, so tests are independent and fast.
2. **Refusals outnumber acceptances.** The dangerous mistakes are the ones where a stranger gets in.
3. **The wrapper is tested too.** A correct rulebook plus a wrongly wired callback would still block every shop.

## WHERE YOU WILL USE THIS

- `npm test -- allowedOrigin` while editing `allowedOrigin.js`
- CI on every push (the robot runs it with the rest)
- As a template for testing any "allow / refuse" rule

## TRADEOFFS

+ Fast (no database), clear, and protects a security rule.
- Tests prove the **function**, not the live browser. The live check
  (logging in on a real shop address) is the final proof, and we did that on staging.

## HOW TO USE

```
cd apps/api
npm test -- allowedOrigin
```

All green means the rulebook behaves. A red test means: read its name, it
tells you which address is now answered wrongly.

---

## EXPLAINED PIECE BY PIECE (real life + where / when / how)

**1. `describe(...)` = A FOLDER OF RELATED CHECKS.**
Groups tests, for example all "look-alike" tests together. *Where:* around
each group. *Why:* a failure tells you which part broke.

**2. `test('...', () => {...})` = ONE QUESTION WITH ONE ANSWER.**
The name is a sentence saying what must be true. *Example:* "refuses an
address that only ends with our name".

**3. `const env = {...}` = A MADE-UP WORLD.**
We build the settings ourselves instead of using the real ones. Like testing
a fire drill with a pretend fire.

**4. `expect(isAllowedOrigin(x, env)).toBe(true/false)` = THE JUDGE.**
Run the function, compare to the answer we expect. Mismatch = red.

**5. The look-alike tests = THE MOST IMPORTANT ONES.**
They are the only tests that catch the missing-dot mistake.

**6. The callback test = CHECKING THE WIRING.**
We pass a pretend callback and check it received `(null, true)` or
`(null, false)`. This proves `corsOrigin` talks to the `cors` library correctly.

## COMMON MISTAKES

- Testing only addresses that should be allowed.
- Reading real environment variables, so the test passes on your laptop but fails in CI.
- Changing an expected `false` to `true` just to get green.