const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
  // Recycle idle connections ourselves before a serverless host (e.g. Neon's
  // free tier, which auto-suspends idle compute) closes them first.
  idleTimeoutMillis: 25000,
});

// pg emits 'error' on the pool when an *idle* client's connection is
// dropped by the server (exactly what happens when Neon auto-suspends).
// Without this listener, that's an unhandled EventEmitter error, which
// crashes the entire Node process — not just the one query. Log it and let
// the pool evict/replace the dead client instead.
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
