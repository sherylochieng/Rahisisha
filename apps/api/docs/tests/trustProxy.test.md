# apps/api/tests/trustProxy.test.js

**Week 30 Day 3, Batch 1 (trust proxy).** Guide for the test that proves the `TRUST_PROXY` setting in `app.js`.

## WHY THIS FILE EXISTS
On Render, a front door (a proxy) sits between the visitor and your API. Without help, your API thinks every visitor is that front door. `TRUST_PROXY` tells Express how many front doors to believe. This test proves the setting is safe and correct.

## WHY IMPORTANT
The admin login brake counts tries per address, and every audit receipt records an address. Wrong setting = brake useless and receipts useless. Too-trusting setting (`true`) = a thief writes any address he likes and dodges the brake.

## DANGER
Never use `app.set('trust proxy', true)`. Render adds the real visitor to the END of the note but does not erase what the visitor wrote at the start. Believing the whole note believes the thief.

## WHAT IT SOLVES
Proves four things: unset means nothing is trusted, `1` reads the real visitor, a faked address is ignored, and nonsense values never switch trust on.

## SYSTEM DESIGN PRINCIPLE
Trust boundary. Only believe the doors you know. Always test with an attacker's header, not just the happy path.

## RULES
1. No database needed.
2. Each case loads a fresh copy of `app.js` with its own `TRUST_PROXY`.
3. Your real `TRUST_PROXY` is put back afterwards.

## PRACTICAL EXAMPLE (Kenya)
A thief in Kisumu guesses your admin password. He sends `X-Forwarded-For: 9.9.9.9` hoping to look like someone else. Render adds his real address after it: `9.9.9.9, 41.90.1.10`. With `TRUST_PROXY=1` the API uses `41.90.1.10`, so the brake counts him properly.

## DECISIONS
The test copies the app's own `'trust proxy'` value into a tiny test server that answers with `req.ip`. That way it checks exactly what `app.js` decided, and no fake route is added to the real app.

## WHERE USED
Normal test run and the pre-push hook.

## TRADEOFFS
Fast and database-free, but it cannot know how many doors Render really has. That is proved once on the live server: after setting `TRUST_PROXY=1` on Render, an admin action's audit receipt must show your real address.

## HOW TO USE
`cd apps/api ; npm test -- trustProxy`

## LINE BY LINE
- `REAL` / `FAKE`: the real visitor, and an address a thief wrote.
- `realSetting`: your own `TRUST_PROXY`, saved in `beforeAll`, restored in `afterAll`.
- `counter`: makes every `import()` a fresh copy of `app.js` (the `?trust=N` ending).
- `loadApp(value)`: sets or removes `TRUST_PROXY`, then loads a fresh `app.js`.
- `whoDoesItSee(app)`: a tiny server using the app's own `'trust proxy'` value, answering `{ ip: req.ip }`.
- Check 1: unset, the note is ignored, so the result is neither `REAL` nor `FAKE`.
- Check 2: `1`, header holds only the real visitor, so `req.ip` is `REAL`.
- Check 3: `1`, header is `FAKE, REAL`, so `req.ip` is `REAL` (the fake is ignored).
- Check 4: `0`, empty, `abc`, `-1` and `true` all leave trust off.

## FUTURE PROJECTS
Put `app.set('trust proxy', N)` right after `const app = express()` in any API behind Render, Railway, Heroku, Fly.io, nginx or Cloudflare. Find N by testing on the live host, never by guessing.
