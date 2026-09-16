import { Router } from 'express'
import { resolveModel } from '../lib/openrouter.js'
import { requireAuth } from '../middleware/auth.js'
import { planQuota } from '../middleware/runQuota.js'
import { planRequestSchema, formatIssues } from '../lib/validation.js'

const router = Router()

// Planning is a paid gpt-4o-mini call, so it needs the same gate as execute.
// requireAuth runs first because planQuota keys on the userId it attaches.
router.use(requireAuth, planQuota)

// Keyed on the trimmed goal string — resets on server restart, which is fine
const planCache = new Map<string, object>()

// The system prompt is the contract we give the model.
// It must be extremely precise — the frontend depends on this exact JSON shape.
// Exported so the eval harness (src/eval/planner-eval.ts) tests the prompt we
// actually ship, rather than a copy that silently drifts out of sync.
export const PLANNER_SYSTEM_PROMPT = `You are an AI workflow planner. Return ONLY a raw JSON object — no markdown, no explanation.

JSON shape:
{"nodes":[{"id":"1","type":"research","label":"Short Name","systemPrompt":"...","model":"google/gemini-2.5-flash"}],"edges":[{"source":"1","target":"2"}]}

Node types and models:
- "research"    → google/gemini-2.5-flash
- "writer"      → anthropic/claude-haiku-4-5
- "critic"      → openai/gpt-4o-mini
- "custom"      → openai/gpt-4o-mini
- "conditional" → model:"" (no AI call — routes on text condition)

Conditional nodes: add "condition":"contains:keyword" or "not-contains:keyword". Edges from them need "sourceHandle":"yes" or "no". Ask the prior node to end with the keyword so matching is reliable.

Rules:
- 2 to 4 nodes max
- Sequential string ids: "1","2","3"
- Forward-only edges, no cycles
- Each systemPrompt must be role-specific and end with: "Be concise. Maximum 200 words."
- Only use conditional when branching genuinely helps`

export interface PlannedNode {
  type?: unknown
  model?: unknown
}

// The prompt above tells the model which model string each node type takes, but
// it still omits the field outright on a good fraction of goals — the eval
// harness measured it failing on 7 of 15. A node with no model reaches the
// canvas as model: undefined and then fails execute-time validation with an
// opaque error, so fill it in here rather than shipping an unusable plan.
const MODEL_BY_NODE_TYPE: Record<string, string> = {
  research:    'google/gemini-2.5-flash',
  writer:      'anthropic/claude-haiku-4-5',
  critic:      'openai/gpt-4o-mini',
  custom:      'openai/gpt-4o-mini',
  conditional: '',  // no AI call — evaluates a condition string, not a model
}

export function normalizePlan(plan: { nodes?: PlannedNode[] }) {
  if (!Array.isArray(plan.nodes)) return

  for (const node of plan.nodes) {
    const nodeType = String(node.type ?? '')
    const fallback = MODEL_BY_NODE_TYPE[nodeType]
    if (fallback === undefined) continue          // unknown type — leave it for the client to reject

    if (typeof node.model !== 'string' || (!node.model && nodeType !== 'conditional')) {
      node.model = fallback
    }
  }
}

router.post('/', async (req, res) => {
  const parsed = planRequestSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: formatIssues(parsed.error) })
    return
  }

  const { goal } = parsed.data

  const cacheKey = goal.trim().toLowerCase()
  const cached = planCache.get(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }

  const { client, model } = resolveModel('openai/gpt-4o-mini')

  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    // cap at 1024 — a workflow JSON with 5 nodes needs ~400 tokens at most
    max_tokens: 1024,
    messages: [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user',   content: goal },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'

  // Never assume the model returned what we asked for. response_format:
  // json_object makes this unlikely, not impossible, and an unhandled throw
  // here would surface as an opaque 500.
  let plan: { nodes?: PlannedNode[] }
  try {
    plan = JSON.parse(raw)
  } catch {
    res.status(502).json({ error: 'The planner returned malformed JSON. Please try again.' })
    return
  }

  normalizePlan(plan)

  planCache.set(cacheKey, plan)
  res.json(plan)
})

export default router
