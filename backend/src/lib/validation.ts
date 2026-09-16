import { z } from 'zod'
import { ALLOWED_MODELS, topoWaves, CyclicGraphError } from './executor.js'

// These caps bound how much work a single request can buy. Without them a
// caller can hand us a 500-node graph or a 1MB system prompt and we will
// dutifully turn it into provider spend.
const MAX_NODES        = 20
const MAX_EDGES        = 60
const MAX_PROMPT_CHARS = 8_000

// Generous because the single-node retry path (NodeConfigPanel) packs the full
// text of every parent output into `goal`, which can run to several thousand
// characters. Still bounded — this rejects a megabyte-sized goal.
const MAX_EXECUTE_GOAL_CHARS = 20_000

// A planning goal is something a human typed into a box, so it can be tight.
const MAX_PLAN_GOAL_CHARS = 2_000

// nodeType and sourceHandle are deliberately bounded strings rather than
// enums: workflows already saved in Postgres may carry handle ids we haven't
// enumerated, and a strict enum would make those graphs un-runnable. Neither
// field reaches a provider — the executor only compares them to literals.
const nodeSchema = z
  .object({
    id:           z.string().min(1).max(64),
    label:        z.string().min(1).max(200),
    model:        z.string().max(100),
    systemPrompt: z.string().max(MAX_PROMPT_CHARS),
    nodeType:     z.string().max(40).optional(),
    condition:    z.string().max(200).optional(),
  })
  .superRefine((node, ctx) => {
    // Conditional nodes never call a provider (see the nodeType branch in
    // streamExecuteWorkflow), so they legitimately carry model: ''.
    if (node.nodeType === 'conditional') return

    if (!ALLOWED_MODELS.includes(node.model)) {
      ctx.addIssue({
        code:    'custom',
        path:    ['model'],
        message: `Unsupported model "${node.model}". Allowed: ${ALLOWED_MODELS.join(', ')}`,
      })
    }
  })

const edgeSchema = z.object({
  source:       z.string().min(1).max(64),
  target:       z.string().min(1).max(64),
  sourceHandle: z.string().max(64).optional(),
})

export const executeRequestSchema = z
  .object({
    nodes: z.array(nodeSchema).min(1).max(MAX_NODES),
    edges: z.array(edgeSchema).max(MAX_EDGES).default([]),
    goal:  z.string().max(MAX_EXECUTE_GOAL_CHARS).default(''),
  })
  .superRefine((body, ctx) => {
    const ids = new Set(body.nodes.map((n) => n.id))

    if (ids.size !== body.nodes.length) {
      ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'Duplicate node ids' })
    }

    // topoWaves() does nodeMap.get(childId)! — a non-null assertion. An edge
    // pointing at an id that isn't in nodes would push undefined into a wave
    // and crash mid-run, so reject the graph here instead.
    let hasDanglingEdge = false
    body.edges.forEach((edge, i) => {
      if (!ids.has(edge.source)) {
        hasDanglingEdge = true
        ctx.addIssue({ code: 'custom', path: ['edges', i, 'source'], message: `Edge source "${edge.source}" is not a node id` })
      }
      if (!ids.has(edge.target)) {
        hasDanglingEdge = true
        ctx.addIssue({ code: 'custom', path: ['edges', i, 'target'], message: `Edge target "${edge.target}" is not a node id` })
      }
    })

    // Cycle check runs the real scheduler rather than a second implementation
    // of Kahn's — one algorithm, so the two can never disagree. Cheap at a
    // 20-node cap, and it means a cyclic graph is refused before the SSE
    // stream opens, with no run row written and no provider call made.
    // Skipped when edges are already dangling: that error is the useful one.
    if (hasDanglingEdge) return
    try {
      topoWaves(body.nodes, body.edges)
    } catch (err) {
      if (!(err instanceof CyclicGraphError)) throw err
      ctx.addIssue({ code: 'custom', path: ['nodes'], message: err.message })
    }
  })

export const planRequestSchema = z.object({
  goal: z.string().trim().min(1).max(MAX_PLAN_GOAL_CHARS),
})

// Collapses a ZodError into one human-readable line for the API response.
// We surface which field failed and why — enough for the frontend to show
// something actionable, without echoing the caller's payload back at them.
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join('; ')
}
