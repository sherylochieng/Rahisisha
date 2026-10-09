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
});