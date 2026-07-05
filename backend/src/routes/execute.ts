import { Router } from 'express'
import { executeWorkflow, type NodeInput, type EdgeInput } from '../lib/executor.js'

const router = Router()

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

  // results = { nodeId: outputText, nodeId: outputText, ... }
  const results = await executeWorkflow(nodes, edges ?? [], goal ?? '')

  res.json({ results })
})

export default router
