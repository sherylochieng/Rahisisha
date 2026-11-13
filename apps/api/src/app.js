// =============================================================================
// app.js — The Express application (NO server start here)
// =============================================================================
//
// WHY THIS FILE EXISTS (System Design: Separation of Concerns)
// ------------------------------------------------------------
// In a production backend, the app (what it does) and the server
// (the thing that listens on a port) are TWO different things.
//
// app.js  = the kitchen   → builds the food (middleware, routes, logic)
// index.js = the dining room → opens the restaurant (starts listening)
// tests    = the taste test  → tests food in the kitchen, no customers needed
//
// If app.listen() were in this file, every test that imports this file
// would start a real server on port 3000 — causing port conflicts and crashes.
// By exporting app WITHOUT calling listen(), tests can import it safely.
//
// WILL YOU USE THIS PATTERN IN FUTURE PROJECTS?
// Yes — always. Every professional Node.js/Express project separates
// app creation from server startup. It is a standard industry pattern.
// =============================================================================

import express      from 'express';
import cors         from 'cors';
import helmet       from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv       from 'dotenv';

import authRouter     from './routes/auth/auth.js';
import productsRouter from './routes/products.routes.js';
import ordersRouter   from './routes/orders.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import tenantsRouter from './routes/tenants.routes.js';
import { requireAuth } from './middleware/requireAuth.js';
import { withTenant }  from './middleware/withTenant.js';
import { isDatabaseDown } from './utils/dbDown.js';
import { corsOrigin } from './utils/allowedOrigin.js';
import { resolveUssdTenant } from './middleware/resolveUssdTenant.js';
import ussdRouter from './routes/ussd.routes.js';


// Load .env variables (DATABASE_URL, JWT_SECRET, etc.) into process.env
// Must be called before any code that reads process.env
dotenv.config();

const app = express();

// ── Security & Parsing Middleware ─────────────────────────────────────────────
// helmet()      → sets secure HTTP headers (prevents common web attacks)
// express.json()→ parses incoming JSON request bodies into req.body
// cookieParser()→ parses cookies so we can read the JWT auth cookie
app.use(helmet());
app.use(express.json());
app.use(cookieParser());


// cors() → decides which websites may call this API with the login cookie.
// credentials: true is required when the frontend sends cookies with requests
//
// BEFORE (Task 8): origin was ONE fixed address:
//   origin: process.env.WEB_ORIGIN || 'http://localhost:3001',
//   Online, every shop has its own address (mama-mboga.rahisishabiashara.com),
//   so the browser blocked every shop's calls.
//
// AFTER (Task 8): a RULE decides. It allows WEB_ORIGIN (as before) and the
//   main domain plus every address under ROOT_DOMAIN. See utils/allowedOrigin.js.
//   On a laptop with no ROOT_DOMAIN, only WEB_ORIGIN works, exactly like before.
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

// Africa's Talking sends USSD requests as FORM data (not JSON).
// Without this line, req.body is empty and every call says "Service unavailable".
app.use(express.urlencoded({ extended: false }));


// ── Routes ────────────────────────────────────────────────────────────────────

// Auth routes (login, register) — PUBLIC, no authentication needed
app.use('/v1', authRouter);

// Product routes — PROTECTED
// requireAuth: checks the JWT cookie, sets req.userId, req.tenantId, req.role
// withTenant:  opens a scoped DB connection with RLS set to this tenant
// This double guard means a request with no token or wrong tenant NEVER
// reaches the controller — it is rejected before any business logic runs
app.use('/v1/products', requireAuth, withTenant, productsRouter);

// Order routes — same double guard as products
app.use('/v1/orders', requireAuth, withTenant, ordersRouter);

// Dashboard route: same double guard as products and orders.
// requireAuth checks the login cookie, withTenant gives us the shop-scoped
// database connection (req.db). The controller never sees a request that
// skipped either one
app.use('/v1/dashboard', requireAuth, withTenant, dashboardRouter);

// Tenants lookup: PUBLIC on purpose. No requireAuth, no withTenant.
// The website's gate guard (proxy.js) calls this BEFORE anyone is logged in,
// to turn an address word (skirt-shirt) into a shop. It only returns the
// shop's id, name and slug. Never add private routes to this router
app.use('/v1/tenants', tenantsRouter);


// USSD: PUBLIC on purpose. No requireAuth, because a phone has no login cookie.
// Instead the guard resolveUssdTenant finds the shop from the service code,
// then withTenant locks the database to that shop (same "stamp, then lock"
// pattern as /v1/products). Order matters: guard first, then lock.
app.use('/ussd', resolveUssdTenant, withTenant, ussdRouter);

// ── Health Check ──────────────────────────────────────────────────────────────
// Used by monitoring tools (and your tests) to confirm the server is alive
// Returns: { status: 'ok' }
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Export the configured app — no listen() call here.
// index.js calls listen() for the real server.
// Test files import this directly and use supertest to send fake requests.

// ── Error Handler ─────────────────────────────────────────────────────────────
// WHAT: the "manager". Every error passed with next(err) ends up here
// WHY:  without it, errors in async controllers vanish, the request hangs, and
//       the database connection is never released
// RULE: it must come AFTER all routes, because Express runs middleware in order
//       and an error handler only catches errors from things above it.
//       It must have exactly 4 parameters, or Express won't treat it as one



// ── Not Found Handler (catch-all) ─────────────────────────────────────────────
// FILE: apps/api/src/app.js
//
// WHY THIS EXISTS:
// - Every error our API sends is JSON in the same shape:
//     { data: null, error: { code, message } }
//   But when a URL matches NO route (a typo like /v1/prodcuts), Express answers
//   by itself with a plain HTML page: "Cannot GET /v1/prodcuts".
// - The website calls res.json() on every reply. HTML makes it crash with a
//   confusing "Unexpected token <" instead of showing a clean message.
//
// REAL LIFE: a restaurant that always answers in one language. A guest asks for
//   a table that does not exist. Without this handler, a stranger answers in
//   another language. With it, the same waiter says "no such table" politely.
//
// RULES:
// - It MUST come AFTER every route (Express runs middleware top to bottom, so
//   if it were above them it would swallow real requests)
// - It MUST come BEFORE the error handler below
// - Use app.use with NO path: it matches every method and every URL that no
//   route above has answered
//
// DECISIONS:
// - Status 404 and code 'not_found': same style as our other error codes
//   (validation, service_unavailable, internal)
// - The message does NOT repeat the URL back. Echoing user input in an error
//   is a small security smell (it can be abused to show fake text)
//
// EXAMPLE:
//   GET /v1/anything  ->  404  { "data": null,
//                                "error": { "code": "not_found",
//                                           "message": "Route not found" } }
app.use((_req, res) => {
  res.status(404).json({
    data: null,
    error: { code: 'not_found', message: 'Route not found' },
  });
});

app.use((err, req, res, next) => {
  // If a response was already started, we can't send another. Let Express
  // close the connection
  if (res.headersSent) return next(err);

  // Postgres error 22P02 = "invalid text representation".
  // It happens when someone sends a malformed ID like /v1/orders/not-a-uuid.
  // That is the caller's mistake, so we answer 400, not 500
  if (err.code === '22P02') {
    return res.status(400).json({
      data: null,
      error: { 
         code: 'validation',
         message: 'Request validation failed',
         details: { id: 'must be a valid UUID' },
        },
    });
  }

    // DATABASE DOWN (503).
  // WHAT: Postgres is off, restarting, full, or unreachable.
  // WHY 503, not 500: 500 means "our code has a bug". 503 means
  //   "the service is temporarily unavailable, try again". Browsers,
  //   monitors and load balancers treat the two very differently.
  // WHY a friendly message: the user should not see a vague
  //   "Something went wrong" or a raw database error.
  // Retry-After: 10 tells the caller "try again in about 10 seconds".
  // We log ONLY the short code or message, not the whole error, so a
  //   long outage does not flood the log with giant stack traces.
  if (isDatabaseDown(err)) {
    console.error('Database unavailable:', err.code || err.message);
    res.set('Retry-After', '10');
    return res.status(503).json({
      data: null,
      error: {
        code: 'service_unavailable',
        message: "We're having trouble right now. Please try again in a moment.",
      },
    });
  }

  // Anything else is our fault. Log the real error for us, but send the caller
  // a generic message (never leak database details to the outside)
  console.error(err);
  res.status(500).json({
    data: null,
    error: { code: 'internal', message: 'Something went wrong' },
  });
});

export default app;


//NOTES


// =============================================================================
// app.js — Express app setup, exported for both server and tests
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Splits Express app creation from server startup (app.listen)
// - app.js = kitchen (builds the app), index.js = dining room (starts server)
// - Tests import app.js directly without triggering a port conflict
//
// SYSTEM DESIGN PRINCIPLE: Separation of Concerns
// - One file does ONE thing
// - app.js configures middleware and routes, nothing else
// - This is standard in every professional Node.js/Express codebase
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every Express API you ever build — always separate app from listen
// - Serverless deployments (AWS Lambda, Vercel) import app without listen
// - Integration testing with supertest always needs this pattern
// - Microservices — each service exports its app the same way
//
// TRADEOFFS:
// + Tests can run without port conflicts
// + App logic is reusable and importable
// + Easier to test middleware and routes in isolation
// - One extra file to maintain (very small tradeoff)
// - Developers new to the pattern may look for listen() in app.js and not find it
//
// =============================================================================