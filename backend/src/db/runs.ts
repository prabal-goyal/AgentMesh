import { pool } from './pool.js'

// Every function here swallows its own errors and returns instead of throwing.
// That is deliberate and it is the one place in this codebase where we do it:
// telemetry is not worth failing a user's workflow over. If Postgres is down,
// the run should still stream normally and we lose a row. Failures are logged
// loudly so they can't pass unnoticed — silent is not the same as swallowed.
function logFailure(what: string, err: unknown) {
  console.error(`⚠️  run instrumentation: ${what} failed —`, err instanceof Error ? err.message : err)
}

export interface NodeRunRecord {
  nodeId:       string
  model:        string
  inputTokens:  number
  outputTokens: number
  cost:         number
  ttftMs:       number | null
  durationMs:   number | null
  status:       'success' | 'error'
}

export interface RunTotals {
  inputTokens:  number
  outputTokens: number
  cost:         number
}

// The goal is a label for a history list, not the payload. The single-node
// retry path packs whole parent outputs into it, which would otherwise put
// kilobytes of duplicated prose in every row.
const MAX_STORED_GOAL_CHARS = 1_000

// Returns the new run's id, or null if the insert failed — callers treat null
// as "instrumentation is off for this run" and carry on.
export async function startRun(userId: string, goal: string): Promise<string | null> {
  try {
    const result = await pool.query(
      `INSERT INTO runs (user_id, goal, status) VALUES ($1, $2, 'running') RETURNING id`,
      [userId, goal.slice(0, MAX_STORED_GOAL_CHARS)]
    )
    return result.rows[0].id as string
  } catch (err) {
    logFailure('startRun', err)
    return null
  }
}

export async function recordNodeRun(runId: string, node: NodeRunRecord): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO node_runs
         (run_id, node_id, model, input_tokens, output_tokens, cost, ttft_ms, duration_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [runId, node.nodeId, node.model, node.inputTokens, node.outputTokens,
       node.cost, node.ttftMs, node.durationMs, node.status]
    )
  } catch (err) {
    logFailure(`recordNodeRun(${node.nodeId})`, err)
  }
}

export async function finalizeRun(
  runId: string,
  status: 'success' | 'error',
  totals: RunTotals,
  durationMs: number
): Promise<void> {
  try {
    await pool.query(
      `UPDATE runs
          SET status = $2, total_input_tokens = $3, total_output_tokens = $4,
              total_cost = $5, duration_ms = $6
        WHERE id = $1`,
      [runId, status, totals.inputTokens, totals.outputTokens, totals.cost, durationMs]
    )
  } catch (err) {
    logFailure('finalizeRun', err)
  }
}
