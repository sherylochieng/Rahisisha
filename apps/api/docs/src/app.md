# app.js

**Location:** `apps/api/src/app.js`

---

## WHY THIS FILE EXISTS

It **builds** the Express app: security headers, JSON reading, cookies, routes, and the central error handler.

It does **not** start the server. `index.js` does that. This split lets tests import the app without opening a port.

---

## WHY IMPORTANT

It decides the **order** requests travel through. Order is security.

---

## DANGER

- Routes mounted **without** `requireAuth` and `withTenant` skip tenant safety.
- An error handler placed **before** the routes never sees their errors.

---

## WHAT IT SOLVES

- One place to see every route and its guards.
- One place where all errors get a safe, consistent answer.

---

## SYSTEM DESIGN PRINCIPLE

- **Separation of concerns:** `app.js` builds, `index.js` starts.
- **Fail loudly, in one place:** the central error handler.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Every Express project. Supertest tests import `app` directly.

---

## TRADEOFFS

- A single error handler is simple, but needs care to keep the response shape the same everywhere.

---

## HOW TO USE

Mount tenant-owned routes with all three guards, in this order:

```js
app.use('/v1/products', requireAuth, withTenant, productsRouter);
app.use('/v1/orders',   requireAuth, withTenant, ordersRouter);
```

1. `requireAuth` checks the login token and sets `req.tenantId`.
2. `withTenant` borrows a connection and tells Postgres who the tenant is.
3. The router runs the controller.

---

## THE ERROR HANDLER

It sits **after** the routes and has exactly **4 parameters**. Express uses the 4 parameters to know it is an error handler.

What it does, in order:

1. `if (res.headersSent) return next(err);` If an answer was already started, let Express finish it.
2. **Malformed ID** (Postgres code `22P02`): answer **400** with the standard validation envelope:

```json
{
  "data": null,
  "error": {
    "code": "validation",
    "message": "Request validation failed",
    "details": { "id": "must be a valid UUID" }
  }
}
```

3. **Anything else:** log the real error on the server (`console.error(err)`) and answer **500** with a generic message:

```json
{ "data": null, "error": { "code": "internal", "message": "Something went wrong" } }
```

**Why generic?** Real database errors can reveal table names and queries. Callers must never see them.

---

## STATUS CODES AT A GLANCE

| Code | Meaning here |
|---|---|
| 400 | Bad input, or a malformed ID |
| 401 | Not logged in |
| 404 | Not found, or belongs to another tenant |
| 409 | Duplicate SKU, or illegal order status move |
| 500 | Our fault. Details are only in the server log |

---

## AI NOTE

The error handler was AI-assisted. The wording of its validation response (message and `details`) was then changed by hand to match Task 3. Both are recorded in the AI audit.
