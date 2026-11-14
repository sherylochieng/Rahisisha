// =============================================================
// orders.routes.js
// Maps HTTP methods + URLs to order controller functions.
//
// One job: wiring. No logic here.
// =============================================================
//
// FILE: apps/api/src/routes/orders.routes.js
//
// WHY THIS FILE EXISTS
//   It is the "switchboard" for everything under /v1/orders. It says:
//   "a GET on /v1/orders goes to listOrders, a POST on /v1/orders/:id/pay
//   goes to payOrder", and so on. The controllers hold the real work; this
//   file only connects a URL to the right function.
//
// WHY IMPORTANT
//   One place to see every order URL the API offers. If a URL is not
//   listed here, it does not exist (it falls through to the JSON 404).
//   Real life: the directory board in a building lobby. It does not do the
//   work in any office, it only tells you which door to knock on.
//
// DANGER
//   - Every route here is mounted in app.js as
//       app.use('/v1/orders', requireAuth, withTenant, ordersRouter)
//     so by the time a request reaches this file the person is logged in and
//     the database is locked to their shop. Never mount this router anywhere
//     else without those two guards.
//   - Every async controller MUST be wrapped in asyncHandler (Express 4 does
//     not catch errors thrown inside async functions; the request would hang
//     and the database connection would never be given back).
//   - Put no logic and no SQL in this file. That belongs in controllers.
//
// WHAT IT SOLVES
//   Keeps URLs and logic separate, so you can read all order URLs in 20
//   seconds and change a controller without touching the URL list.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: routes decide WHERE a request goes, controllers
//   decide WHAT happens. Guards (login, shop lock) are applied once, in
//   app.js, instead of being repeated on every route.
//
// RULES
//   1. No logic here, only wiring.
//   2. Wrap every async controller in asyncHandler().
//   3. List the most specific URLs deliberately: '/:id/pay' is a different
//      path from '/:id', so the two do not clash.
//   4. Do not add auth checks here; app.js already applied them.
//
// PRACTICAL EXAMPLE
//   POST /v1/orders/9f1c.../pay
//     -> requireAuth (who are you?) -> withTenant (lock to Amina's shop)
//     -> this file matches '/:id/pay' -> payOrder() in payments.controller.js
//
// DECISIONS (and WHY)
//   - The pay route lives here (under /v1/orders/:id) because paying is
//     something you do TO an order, so the URL reads naturally. Its logic
//     is in payments.controller.js, not orders.controller.js, to keep money
//     code in one small file that is easy to audit.
//   - payOrder is a POST (it changes state: it creates a payment attempt),
//     never a GET.
//
// WHERE USED
//   app.js mounts it at /v1/orders. The dashboard and any future Pay button
//   call these URLs.
//
// TRADEOFFS
//   + Tiny and obvious.
//   - Adding a route means touching two files (this one and a controller).
//
// HOW TO USE (add a new order URL)
//   1. Write the handler in a controller and export it.
//   2. Import it below and add:  router.<method>('/path', asyncHandler(handler));
//   3. Update apps/api/docs/INDEX.md (endpoints table).
//
// THE ROUTES IN THIS FILE
//   GET    /v1/orders           list orders (cursor pagination)
//   POST   /v1/orders           create an order (inside a transaction)
//   GET    /v1/orders/:id       fetch one order
//   PATCH  /v1/orders/:id       change status only (state machine)
//   POST   /v1/orders/:id/pay   start an M-Pesa STK push (Week 29 Day 3)

// Router: Express's mini-app for a group of related URLs.
import { Router } from 'express';

// The order handlers (the real work lives in orders.controller.js).
import {
  listOrders,
  createOrder,
  getOrder,
  updateOrderStatus,
} from '../controllers/orders.controller.js';

// payOrder: starts a payment for one order (Week 29 Day 3).
// It lives in its own file so all money-starting code is in one place.
import { payOrder } from '../controllers/payments.controller.js';

// asyncHandler: wraps a handler so a thrown error reaches the central error
// handler instead of hanging the request.
import { asyncHandler } from '../middleware/asyncHandler.js';

// A new router. app.js attaches it under /v1/orders, so '/' below means
// /v1/orders and '/:id' means /v1/orders/<some order id>.
const router = Router();

// GET  /v1/orders     → list orders (paginated)
// POST /v1/orders     → create a new order
router.get('/', asyncHandler(listOrders));
router.post('/', asyncHandler(createOrder));

// GET   /v1/orders/:id         → fetch one order
   // PATCH /v1/orders/:id         → update status only (state machine)..removed nt compatible with assifgnmnt
router.get('/:id', asyncHandler(getOrder));
router.patch('/:id', asyncHandler(updateOrderStatus));

// POST /v1/orders/:id/pay      → start an M-Pesa STK push for this order (Week 29 Day 3)
// Only STARTS the payment. The callback (Task 3) finishes it.
router.post('/:id/pay', asyncHandler(payOrder));

// Hand the router to app.js.
export default router;