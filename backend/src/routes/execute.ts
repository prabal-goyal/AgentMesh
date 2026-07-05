import { Router } from 'express'
import {
  executeWorkflow,
  streamExecuteWorkflow,
  type NodeInput,
  type EdgeInput,
  type StreamEvent,
} from '../lib/executor.js'

const router = Router()

// Synchronous version — waits for all nodes, returns results map (kept for reference)
router.post('/', async (req, res) => {
  const { nodes, edges, goal } = req.body as {
    nodes: NodeInput[]
    edges: EdgeInput[]
    goal: string
  }

  if (!nodes?.length) {
    res.status(400).json({ error: 'No nodes to execute' })
    return
  }

  const results = await executeWorkflow(nodes, edges ?? [], goal ?? '')
  res.json({ results })
})

// Streaming version — sends SSE events as each node runs
router.post('/stream', async (req, res) => {
  const { nodes, edges, goal } = req.body as {
    nodes: NodeInput[]
    edges: EdgeInput[]
    goal: string
  }

  if (!nodes?.length) {
    res.status(400).json({ error: 'No nodes to execute' })
    return
  }

  // These three headers turn a normal HTTP response into an SSE stream
  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',  // prevents nginx from buffering
  })

  // Helper that formats any object as an SSE data line
  function send(event: StreamEvent) {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  try {
    await streamExecuteWorkflow(nodes, edges ?? [], goal ?? '', send)
  } catch (err) {
    send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
  } finally {
    res.end()
  }
})

export default router
