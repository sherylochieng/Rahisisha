# asyncHandler.js

**Location:** `apps/api/src/middleware/asyncHandler.js`

---

## WHY THIS FILE EXISTS

Express 4 does **not** catch errors thrown inside `async` functions.

If a controller crashes, nobody answers the caller, and the request hangs forever.

`asyncHandler` wraps a controller and says: **"if it crashes, tell the manager."**

---

## WHY IMPORTANT

Without it, one bad request (even `GET /v1/orders/not-a-uuid`) leaves a database connection stuck. Enough of those and the pool is empty and **every** request freezes.

---

## DANGER (if missing)

- Hanging requests.
- Leaked connections.
- A small mistake from one caller freezing the app for everyone.

---

## WHAT IT SOLVES

Sends every async error to the central error handler in `app.js`, so the caller always gets an answer.

---

## SYSTEM DESIGN PRINCIPLE

**Fail loudly, in one place.** Controllers stay clean. Errors are handled once, consistently.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Every Express 4 API. (Express 5 does this for you, but the idea still matters.)

---

## TRADEOFFS

- **Alternative:** `try/catch` in every controller. Works, but you will forget one.
- **Alternative:** a library such as `express-async-errors`. Less code, but hides how it works.
- **Placement:** it sits in `middleware/`, but strictly it is a **wrapper helper** (it is wrapped around a function, not plugged in with `app.use`). `utils/` would also be a fine home.

---

## HOW TO USE

```js
import { asyncHandler } from '../middleware/asyncHandler.js';

router.get('/:id', asyncHandler(getOrder));
```

**Rule:** if you use it in a routes file, you must **import it in that file**. Forgetting gave us `ReferenceError: asyncHandler is not defined`.

---

## THE CODE, PIECE BY PIECE

```js
export function asyncHandler(controller) {
  return function (req, res, next) {
    Promise.resolve(controller(req, res, next)).catch(next);
  };
}
```

- It takes a controller and returns a **new** function with the same shape Express expects.
- `controller(req, res, next)` runs your real code.
- `Promise.resolve(...)` makes sure we have a promise, even if the controller was not async.
- `.catch(next)` means: **if it fails, call `next(error)`**. Express then jumps to the error handler.

**Think of it like this:** the waiter's rule. If the kitchen says no, come back and tell the manager. Never stand there silently.
