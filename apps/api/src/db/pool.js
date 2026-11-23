// src/db/pool.js
// This file opens ONE connection to the database and shares it
// across the whole app. Think of it as one phone line to the
// filing cabinet — everyone uses the same line, nobody opens a new one.

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});


// -----------------------------------------------------------------------
// WEEK 29 WEEKEND FIX: do not crash when a connection drops.
//
// Real life: the phone line between the API and the filing cabinet goes
// dead for a moment (the database restarts, the laptop sleeps, the network
// blips). A line that was sitting UNUSED in the pool reports the problem.
// If nobody is listening for that report, Node treats it as a fatal
// "unhandled error" and the whole API stops. Found by the chaos test on
// 23 November 2026: one cut connection took the API down.
//
// With this listener, the problem is written to the log and the API keeps
// running. The pool throws the dead connection away and opens a fresh one
// for the next customer.
//
// We log only err.message, never the whole error object: the whole object
// contains connection details we do not want in a log.
// -----------------------------------------------------------------------
pool.on('error', (err) => {
  console.error('Database connection dropped (the pool will reconnect):', err.message);
});
