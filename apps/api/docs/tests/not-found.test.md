# not-found.test.js — Unknown URLs Answer in JSON, Not HTML

**File:** `apps/api/tests/errors/not-found.test.js`
**Doc:** `apps/api/docs/tests/not-found.test.md`
**Protects:** the catch-all 404 handler in `apps/api/src/app.js`
**Run with:** `cd apps/api` then `npm test -- tests/errors/not-found.test.js`

---

## WHY THIS FILE EXISTS

Reviewer feedback (Best Practices): a URL that matched no route got Express's
default **HTML** page ("Cannot GET /..."), while every other error in the API is
**JSON** in this shape:

```json
{ "data": null, "error": { "code": "...", "message": "..." } }
```

We added a catch-all 404 handler in `app.js`. This test keeps it there.

Real-life picture: a restaurant that always answers in one language. A guest
asks for a table that does not exist. Without the handler, a stranger answers
in another language (HTML). With it, the same waiter says "no such table" in
the house language (JSON).

## WHY IMPORTANT

The website calls `res.json()` on every reply. HTML makes it crash with
`Unexpected token <` instead of showing a clean message. A clean JSON 404 lets
the page say "page not found" nicely.

## DANGER (if this file does not exist)

- Someone moves the catch-all ABOVE the routes "to tidy up". Real routes now
  answer 404 and nothing warns us.
- Someone deletes the handler. HTML errors come back silently, and the reviewer
  sees them again.

## WHAT IT SOLVES (the 4 checks)

| # | Check | What it proves |
|---|-------|----------------|
| 1 | GET an unknown URL | 404 with exactly `{ data: null, error: { code: 'not_found', message: 'Route not found' } }` |
| 2 | POST an unknown URL | The handler covers every HTTP method |
| 3 | Content-Type is JSON | The website can safely call `res.json()` |
| 4 | `/health` still works | Control: the catch-all is last, not too greedy |

## SYSTEM DESIGN PRINCIPLE

**Consistent error contract.** Every response, success or failure, has the same
shape. The client never has to guess whether an answer is JSON or HTML.

## RULES

1. No database needed. These checks never touch Postgres.
2. Never echo the requested URL in the message (small security smell: error
   text built from user input can be abused to show fake text).
3. The catch-all must come AFTER every route and BEFORE the error handler.

---

## THE CODE UNDER TEST (in app.js)

```js
app.use((_req, res) => {
  res.status(404).json({
    data: null,
    error: { code: 'not_found', message: 'Route not found' },
  });
});
```

- `app.use` with **no path**: matches every method and every URL not answered
  above.
- `_req`: unused, the underscore says so.
- `.status(404).json(...)`: "not found" in the same language as our other
  errors (`validation`, `service_unavailable`, `internal`).

## THE TEST, PIECE BY PIECE

```js
afterAll(async () => { await pool.end(); });
```
Hang up the app's database phone line so Jest can finish. (The app creates a
pool when imported, even though these tests never use it.)

```js
const res = await request(app).get('/v1/this-route-does-not-exist');
expect(res.status).toBe(404);
expect(res.body).toEqual({ data: null, error: { code: 'not_found', message: 'Route not found' } });
```
Knock on a door that does not exist and expect the exact JSON answer.
`toEqual` checks the **whole** shape, so an extra or renamed field fails.

```js
await request(app).post('/v1/this-route-does-not-exist').send({});
```
Same for POST. Proves the handler is not limited to GET.

```js
expect(res.headers['content-type']).toMatch(/application\/json/);
```
The header the browser reads. HTML would be `text/html`.

```js
const res = await request(app).get('/health');   // expects 200 + { status: 'ok' }
```
The control. If the catch-all were placed above the routes, even `/health`
would answer 404, and this check would fail.

---

## PRACTICAL EXAMPLES

- A typo `GET /v1/prodcuts` returns the JSON 404, so the page can show
  "something went wrong" instead of crashing.
- A developer adds a new router below the catch-all: its routes answer 404, and
  check 4 or that router's own tests fail.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| One catch-all in `app.js`, not per router | One place covers the whole API |
| Status 404 + code `not_found` | Same style as our other error codes |
| Message does not repeat the URL | Avoids reflecting user input |
| Test through supertest on the real app | Tests the real order of middleware |
| Include a control check on `/health` | Stops a "passes because it blocks everything" false pass |

## WHERE USED / FUTURE USES

- `npm test` and CI.
- When you add a new top-level router in `app.js`, add it ABOVE the catch-all.
- Later: log 404s to spot broken links or bots probing for `/admin`.

## TRADEOFFS

| Good | Cost |
|------|------|
| Consistent JSON everywhere | One more middleware per request that misses all routes |
| Tiny and fast test | Only proves the shape, not every URL |

## COMMON MISTAKES

- Putting the handler above the routes (everything becomes 404).
- Putting it below the error handler (it never runs for unmatched URLs).
- Giving the error handler 3 parameters (Express stops treating it as an
  error handler; it needs exactly 4).
- Echoing the URL back in the message.

## AI AUDIT NOTE

Handler and test written by AI (error handling and test scaffolding, allowed).
No tenant isolation or ledger logic touched.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check app.js` | no output | passed |
| `node --check not-found.test.js` | no output | passed |
| `npm test -- tests/errors/not-found.test.js` | 4 passing | 4 passed |
| Full `npm test` | all pass | (fill in) |