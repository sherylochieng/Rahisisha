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
import { requireAuth } from './middleware/requireAuth.js';
import { withTenant }  from './middleware/withTenant.js';

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

// cors() → allows our frontend (port 3001) to talk to this API (port 3000)
// credentials: true is required when the frontend sends cookies with requests
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));

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