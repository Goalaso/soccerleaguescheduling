const { Pool, types } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
}

// pg's default DATE (OID 1082) parser builds a JS Date using the *server
// process's own local timezone* — so the same stored value comes out
// differently depending on where the code happens to run (a real bug we
// hit: local dev and AWS Lambda disagree on which calendar day a match
// falls on, since Lambda defaults to UTC and a dev machine usually
// doesn't). match_date has no time-of-day meaning at all, so skip Date
// parsing entirely and hand back the raw 'YYYY-MM-DD' string — the
// frontend parses it explicitly in a timezone-safe way (see
// parseMatchDate in src/utils/season.js).
types.setTypeParser(1082, (val) => val);

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
