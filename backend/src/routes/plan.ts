import { Router } from 'express'
import { resolveModel } from '../lib/openrouter.js'

const router = Router()

// Keyed on the trimmed goal string — resets on server restart, which is fine
const planCache = new Map<string, object>()

// The system prompt is the contract we give the model.
// It must be extremely precise — the frontend depends on this exact JSON shape.
const PLANNER_SYSTEM_PROMPT = `You are an AI workflow planner. Return ONLY a raw JSON object — no markdown, no explanation.

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

router.post('/', async (req, res) => {
  const { goal } = req.body as { goal: string }

  if (!goal || goal.trim().length === 0) {
    res.status(400).json({ error: 'goal is required' })
    return
  }

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
  const plan = JSON.parse(raw)

  planCache.set(cacheKey, plan)
  res.json(plan)
})

export default router
