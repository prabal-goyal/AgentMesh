import { Pool } from 'pg'

// A pool, not a single Client — Express handles many requests concurrently.
// The pool keeps a small set of open connections to Neon and hands one out
// per query, instead of paying a fresh TLS handshake on every request or
// serializing all queries through a single connection.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
