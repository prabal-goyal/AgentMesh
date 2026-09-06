import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.post('/', async (req, res) => {
  const { name, graph } = req.body as { name?: string; graph?: unknown }

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  if (!graph || typeof graph !== 'object') {
    res.status(400).json({ error: 'graph is required' })
    return
  }

  const result = await pool.query(
    'INSERT INTO workflows (user_id, name, graph) VALUES ($1, $2, $3) RETURNING id, name, created_at, updated_at',
    [req.userId, name.trim(), graph]
  )
  res.status(201).json({ workflow: result.rows[0] })
})

// Graph omitted here on purpose — a list view only needs enough to show and
// pick a workflow, not the full nodes/edges payload of every one.
router.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, created_at, updated_at FROM workflows WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.userId]
  )
  res.json({ workflows: result.rows })
})

router.get('/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, graph, created_at, updated_at FROM workflows WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  )
  const workflow = result.rows[0]

  // 404 whether the row doesn't exist or belongs to someone else — same
  // reasoning as login's generic error, so a caller can't probe which ids
  // exist by comparing 404 vs 403.
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' })
    return
  }
  res.json({ workflow })
})

router.delete('/:id', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.userId]
  )

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Workflow not found' })
    return
  }
  res.status(204).send()
})

export default router
