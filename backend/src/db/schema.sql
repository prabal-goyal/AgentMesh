-- IF NOT EXISTS makes this safe to re-run — no separate migration framework
-- needed for a schema this small.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- graph is the React Flow store shape ({ nodes, edges }) stored as-is —
-- no relational modeling of nodes/edges needed since it's always read
-- and written whole, never queried node-by-node.
CREATE TABLE IF NOT EXISTS workflows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  graph      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflows_user_id_idx ON workflows(user_id);
