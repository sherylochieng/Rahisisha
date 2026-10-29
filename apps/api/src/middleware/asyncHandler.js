// =============================================================================
// asyncHandler.js — Makes async controller errors reach the error handler
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Express 4 does NOT catch errors thrown inside async functions. The error
//   disappears, the request never gets a response, and the database connection
//   is never released
//
// DANGER — WHAT HAPPENS WITHOUT IT:
// - Someone sends GET /v1/orders/not-a-uuid. Postgres throws. Nobody answers.
//   The request hangs forever and holds a pool connection. Enough of these
//   and the whole API freezes for every shop (the same freeze that caused the
//   test timeouts earlier)
//
// SYSTEM DESIGN PRINCIPLE: Fail loudly and in one place
// - Every error travels to ONE error handler, instead of each controller
//   handling (or forgetting) errors on its own
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any Express 4 app with async/await controllers
// - (Express 5 does this for you, so you won't need it there)
//
// HOW TO USE:
//   router.get('/', asyncHandler(listOrders));
//
// TRADEOFFS:
// + Controllers stay clean (no try/catch in every function)
// + One consistent error response for the whole API
// - You must remember to wrap every async route (a forgotten one still hangs)
// =============================================================================

// asyncHandler takes a controller function and returns a NEW function that
// Express can call. The new function runs your controller, and if the
// controller throws or rejects, it passes the error to next(err)
export function asyncHandler(controller) {
  return function (req, res, next) {
    // Promise.resolve(...) turns the controller's result into a promise, so
    // .catch(next) works for both async and normal functions.
    // .catch(next) means: on any error, call next(err), which hands the error
    // to Express's error handler
    Promise.resolve(controller(req, res, next)).catch(next);
  };
}