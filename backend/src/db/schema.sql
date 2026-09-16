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

-- ── Run instrumentation ────────────────────────────────────────────────────
-- Cost and latency live here rather than in the browser's Zustand history,
-- which dies on refresh. Recorded server-side so the numbers can't be
-- client-forged and an abandoned run still leaves a row.

-- status: 'running' until the run finishes, so a crashed or abandoned run is
-- visibly stuck rather than silently absent. CHECK keeps typos out of a column
-- every aggregate query groups by.
CREATE TABLE IF NOT EXISTS runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal                TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'success', 'error')),
  -- Input and output are priced 4-5x apart, so a single total_tokens column
  -- would make per-run cost impossible to explain. Kept separate.
  total_input_tokens  INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  -- NUMERIC, never FLOAT: binary floating point can't represent 0.1 exactly,
  -- and these costs get summed across thousands of rows.
  total_cost          NUMERIC(14, 8) NOT NULL DEFAULT 0,
  duration_ms         INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS node_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  -- Not a foreign key: node ids are positions in a user's graph ("1", "2"),
  -- not rows in a table, and the graph can be edited after the run.
  node_id       TEXT NOT NULL,
  model         TEXT NOT NULL DEFAULT '',
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost          NUMERIC(14, 8) NOT NULL DEFAULT 0,
  -- Nullable: a node that errored before streaming anything never had a first
  -- token. 0 would be a lie that drags every TTFT average down.
  ttft_ms       INTEGER,
  duration_ms   INTEGER,
  status        TEXT NOT NULL CHECK (status IN ('success', 'error')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports the per-user history list (newest first).
CREATE INDEX IF NOT EXISTS runs_user_created_idx ON runs(user_id, created_at DESC);
-- Supports joining a run to its nodes, and per-model cost/latency aggregates.
CREATE INDEX IF NOT EXISTS node_runs_run_id_idx ON node_runs(run_id);
CREATE INDEX IF NOT EXISTS node_runs_model_idx  ON node_runs(model);
