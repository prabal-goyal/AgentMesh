import { Router } from 'express'
import {
  streamExecuteWorkflow,
  type StreamEvent,
} from '../lib/executor.js'
import { requireAuth } from '../middleware/auth.js'
import { runQuota } from '../middleware/runQuota.js'
import { executeRequestSchema, formatIssues } from '../lib/validation.js'
import { startRun, recordNodeRun, finalizeRun } from '../db/runs.js'

const router = Router()

// Every path below spends money on provider keys, so nothing here is public.
// Order matters: requireAuth sets req.userId, which runQuota needs to key on.
router.use(requireAuth, runQuota)

// Streaming version — sends SSE events as each node runs.
// The non-streaming POST / used to live here alongside it, kept "for reference"
// with no caller; it and its executeWorkflow() are gone. The sequential
// baseline it provided now lives in src/eval/parallel-benchmark.ts.
router.post('/stream', async (req, res) => {
  // Validation must happen BEFORE writeHead. Once the 200 is on the wire we
  // can no longer send a 400, and the client would get an error wrapped in a
  // successful stream.
  const parsed = executeRequestSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: formatIssues(parsed.error) })
    return
  }

  const { nodes, edges, goal } = parsed.data

  // These three headers turn a normal HTTP response into an SSE stream
  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',  // prevents nginx from buffering
  })

  // Instrumentation hangs off the event stream rather than living inside the
  // executor — that keeps lib/executor.ts free of any database import, which
  // matters because it's the part we most want to unit test.
  const runId = await startRun(req.userId!, goal)
  // Clock starts after the insert: duration_ms must measure the workflow, not
  // our own round-trip to Neon. Timing it the other way inflated a do-nothing
  // router run to 1.7s.
  const startedAt = Date.now()

  const totals = { inputTokens: 0, outputTokens: 0, cost: 0 }
  let failed = false

  // send() is synchronous (it writes to the socket) but the inserts are not,
  // so we collect their promises and settle them before the final UPDATE.
  const writes: Promise<void>[] = []

  // Helper that formats any object as an SSE data line
  function send(event: StreamEvent) {
    res.write(`data: ${JSON.stringify(event)}\n\n`)

    if (event.type === 'error') failed = true
    if (!runId) return

    if (event.type === 'run_usage') {
      totals.inputTokens  += event.inputTokens
      totals.outputTokens += event.outputTokens
      totals.cost         += event.cost
      writes.push(recordNodeRun(runId, {
        nodeId:     event.nodeId,
        model:      event.model,
        inputTokens:  event.inputTokens,
        outputTokens: event.outputTokens,
        cost:       event.cost,
        ttftMs:     event.ttftMs,
        durationMs: event.durationMs,
        status:     'success',
      }))
    } else if (event.type === 'error' && event.nodeId) {
      // A failed node has no token counts, but its latency is still real data.
      writes.push(recordNodeRun(runId, {
        nodeId:     event.nodeId,
        model:      '',
        inputTokens: 0,
        outputTokens: 0,
        cost:       0,
        ttftMs:     null,
        durationMs: event.durationMs ?? null,
        status:     'error',
      }))
    }
  }

  try {
    await streamExecuteWorkflow(nodes, edges, goal, send)
  } catch (err) {
    send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
  } finally {
    // Stop the clock before any bookkeeping, and close the stream before it
    // too — the client already has its 'done' event, so it shouldn't wait on
    // our inserts to render results. If the process dies in between, the row
    // stays 'running', which is exactly the abandoned-run state we want.
    const durationMs = Date.now() - startedAt
    res.end()

    if (runId) {
      // allSettled, not all: recordNodeRun already swallows its own errors, but
      // a rejection here must not stop the run row being finalized.
      await Promise.allSettled(writes)
      await finalizeRun(runId, failed ? 'error' : 'success', totals, durationMs)
    }
  }
})

export default router
