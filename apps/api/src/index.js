// =============================================================================
// index.js — Server entry point
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - This is the ONLY place app.listen() is called
// - It imports the configured app from app.js and starts the server
// - Keeping listen() here means tests can import app.js without
//   accidentally starting a real server on port 3000
//
// RULE: Never import this file in tests. Always import app.js instead.
// =============================================================================

import app  from './app.js';
import dotenv from 'dotenv';
// Week 30 Day 3 (Batch 3b-2a): the notification sender's alarm clock and the
// database pool it uses. Started below ONLY when NOTIFICATIONS_WORKER=on.
import { pool } from './db/pool.js';
import { startNotificationLoop } from './jobs/notificationLoop.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// Week 30 Day 3 (Batch 3b-2a): empty the notifications outbox in the background.
// OFF unless NOTIFICATIONS_WORKER=on. Tests import app.js, never this file, so
// they never start this timer.
if (process.env.NOTIFICATIONS_WORKER === 'on') {
  startNotificationLoop({ db: pool });
  console.log('Notification sender is ON (checks the outbox regularly)');
}


// WHY THIS CHANGE:
// - index.js now does ONE thing only: start the server
// - All app configuration (middleware, routes) lives in app.js
// - This completes the app.js / index.js split pattern

// RULE TO REMEMBER:
// - Never import index.js in tests
// - Always import app.js in tests
// - index.js is only run by: npm start / node index.js