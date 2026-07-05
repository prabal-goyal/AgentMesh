import { Router } from 'express'
import { resolveModel } from '../lib/openrouter.js'

const router = Router()

// The system prompt is the contract we give the model.
// It must be extremely precise — the frontend depends on this exact JSON shape.
const PLANNER_SYSTEM_PROMPT = `You are an AI workflow planner. Given a user's goal, design a workflow of AI agents to accomplish it.

Return ONLY a JSON object — no explanation, no markdown, just raw JSON — with this exact structure:
{
  "nodes": [
    {
      "id": "1",
      "type": "research",
      "label": "Short Agent Name",
      "systemPrompt": "Detailed instruction for this agent's specific role",
      "model": "google/gemini-2.5-flash"
    }
  ],
  "edges": [
    { "source": "1", "target": "2" }
  ]
}

Available node types and their default models:
- "research" → use model: google/gemini-2.5-flash  (gathers and summarizes information)
- "writer"   → use model: anthropic/claude-haiku-4-5 (creates written content)
- "critic"   → use model: openai/gpt-4o-mini        (reviews and critiques output)
- "custom"   → use model: openai/gpt-4o-mini        (general purpose agent)

Rules:
- Use between 2 and 5 nodes
- Node ids must be sequential strings: "1", "2", "3"...
- Edges must form a forward-only flow — no cycles allowed
- Edge source and target must exactly match node ids
- Each systemPrompt must be specific to that agent's role in this workflow
- The first node has no incoming edges; the last node has no outgoing edges`

router.post('/', async (req, res) => {
  const { goal } = req.body as { goal: string }

  if (!goal || goal.trim().length === 0) {
    res.status(400).json({ error: 'goal is required' })
    return
  }

  // Planner uses gpt-4o — resolveModel routes it to the OpenAI API directly
  const { client, model } = resolveModel('openai/gpt-4o')

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

  res.json(plan)
})

export default router
