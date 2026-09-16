import 'dotenv/config'
import { resolveModel } from '../lib/openrouter.js'
import { ALLOWED_MODELS, topoWaves, CyclicGraphError, type NodeInput, type EdgeInput } from '../lib/executor.js'
import { PLANNER_SYSTEM_PROMPT, normalizePlan } from '../routes/plan.js'

// Deliberately NOT a vitest suite. This calls a real model, so it costs money
// and its result is a pass *rate*, not a pass/fail gate — wiring it into CI
// would make the build flaky, occasionally expensive, and would need secrets.
// Run it on purpose with `pnpm eval:planner` when the planner prompt changes.

const GOALS = [
  'Write a blog post about renewable energy',
  'Research the latest AI regulations and summarise them',
  'Review this TypeScript code for bugs',
  'Draft a cold outreach email to a potential client',
  'Compare React and Vue for a new project',
  'Summarise a long research paper into bullet points',
  'Write release notes from a list of changes',
  'Plan a 3-day itinerary for Tokyo',
  'Analyse customer feedback and identify the top complaints',
  'Write a product description, then critique and improve it',
  'Check whether a claim is true, and only write a rebuttal if it is false',
  'Turn meeting notes into action items assigned to owners',
  'Explain quantum computing to a 10-year-old',
  'Generate SEO keywords for a coffee shop website',
  'Write a tweet thread summarising a news article',
]

const VALID_NODE_TYPES = ['research', 'writer', 'critic', 'custom', 'conditional']
const MAX_PLANNED_NODES = 4

interface Check {
  name: string
  ok: boolean
  detail?: string
}

interface PlannedNode {
  id?: unknown
  type?: unknown
  label?: unknown
  systemPrompt?: unknown
  model?: unknown
  condition?: unknown
}

interface PlannedEdge {
  source?: unknown
  target?: unknown
  sourceHandle?: unknown
}

// Counts nodes the planner left without a usable model, before we fill it in.
// Reported separately from pass/fail: the API repairs these, so they are not a
// user-visible failure, but a rising number means the prompt is drifting.
let modelsAutoFilled = 0

function evaluatePlan(raw: string): Check[] {
  const checks: Check[] = []

  let plan: { nodes?: PlannedNode[]; edges?: PlannedEdge[] }
  try {
    plan = JSON.parse(raw)
    checks.push({ name: 'parse', ok: true })
  } catch (err) {
    return [{ name: 'parse', ok: false, detail: err instanceof Error ? err.message : 'bad JSON' }]
  }

  // Measure what /api/plan actually returns, not the raw completion — the route
  // normalizes before responding, so evaluating the raw output would report
  // failures users never see.
  const before = (plan.nodes ?? []).filter(
    (n) => typeof n.model !== 'string' || (!n.model && String(n.type) !== 'conditional')
  ).length
  modelsAutoFilled += before
  normalizePlan(plan as { nodes?: { type?: unknown; model?: unknown }[] })

  const nodes = Array.isArray(plan.nodes) ? plan.nodes : []
  const edges = Array.isArray(plan.edges) ? plan.edges : []

  const badTypes = nodes.filter((n) => !VALID_NODE_TYPES.includes(String(n.type)))
  checks.push({
    name: 'types',
    ok: nodes.length > 0 && badTypes.length === 0,
    detail: badTypes.length ? `bad: ${badTypes.map((n) => String(n.type)).join(', ')}` : undefined,
  })

  // Conditional nodes legitimately carry model:'' — they make no provider call.
  const badModels = nodes.filter(
    (n) => String(n.type) !== 'conditional' && !ALLOWED_MODELS.includes(String(n.model))
  )
  checks.push({
    name: 'models',
    ok: badModels.length === 0,
    detail: badModels.length ? `bad: ${badModels.map((n) => String(n.model)).join(', ')}` : undefined,
  })

  // Reuse the real scheduler so this asserts exactly what execution requires.
  const asNodes: NodeInput[] = nodes.map((n) => ({
    id: String(n.id), label: String(n.label ?? ''), model: String(n.model ?? ''),
    systemPrompt: String(n.systemPrompt ?? ''), nodeType: String(n.type ?? ''),
  }))
  const asEdges: EdgeInput[] = edges.map((e) => ({ source: String(e.source), target: String(e.target) }))

  const ids = new Set(asNodes.map((n) => n.id))
  const dangling = asEdges.filter((e) => !ids.has(e.source) || !ids.has(e.target))

  let dagOk = false
  let dagDetail: string | undefined
  if (dangling.length > 0) {
    dagDetail = `${dangling.length} edge(s) reference missing nodes`
  } else {
    try {
      topoWaves(asNodes, asEdges)
      dagOk = true
    } catch (err) {
      dagDetail = err instanceof CyclicGraphError ? 'cycle' : 'topo failed'
    }
  }
  checks.push({ name: 'dag', ok: dagOk, detail: dagDetail })

  checks.push({
    name: `n<=${MAX_PLANNED_NODES}`,
    ok: nodes.length > 0 && nodes.length <= MAX_PLANNED_NODES,
    detail: nodes.length > MAX_PLANNED_NODES ? `${nodes.length} nodes` : undefined,
  })

  // Every prompt must be usable on its own — an empty one produces a node that
  // does nothing but burn a call.
  const emptyPrompts = nodes.filter((n) => String(n.type) !== 'conditional' && !String(n.systemPrompt ?? '').trim())
  checks.push({
    name: 'prompts',
    ok: emptyPrompts.length === 0,
    detail: emptyPrompts.length ? `${emptyPrompts.length} empty` : undefined,
  })

  return checks
}

async function plan(goal: string): Promise<string> {
  const { client, model } = resolveModel('openai/gpt-4o-mini')
  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    max_tokens: 1024,
    messages: [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user',   content: goal },
    ],
  })
  return response.choices[0].message.content ?? '{}'
}

async function main() {
  if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.error('No provider key set — this harness calls a real model.')
    process.exit(1)
  }

  console.log(`\nPlanner eval — ${GOALS.length} goals against openai/gpt-4o-mini\n`)

  const columns = ['parse', 'types', 'models', 'dag', `n<=${MAX_PLANNED_NODES}`, 'prompts']
  console.log(`${'goal'.padEnd(52)}${columns.map((c) => c.padEnd(9)).join('')}`)
  console.log('─'.repeat(52 + columns.length * 9))

  const failures: string[] = []
  let fullyPassing = 0

  for (const goal of GOALS) {
    let checks: Check[]
    try {
      checks = evaluatePlan(await plan(goal))
    } catch (err) {
      checks = [{ name: 'parse', ok: false, detail: err instanceof Error ? err.message : 'request failed' }]
    }

    const byName = new Map(checks.map((c) => [c.name, c]))
    const cells = columns.map((name) => {
      const check = byName.get(name)
      if (!check) return '–'.padEnd(9)          // not reached (earlier check failed)
      return (check.ok ? '✓' : '✗').padEnd(9)
    })

    const short = goal.length > 50 ? goal.slice(0, 49) + '…' : goal
    console.log(`${short.padEnd(52)}${cells.join('')}`)

    const failed = checks.filter((c) => !c.ok)
    if (failed.length === 0) fullyPassing++
    else failures.push(`  ${short} → ${failed.map((f) => `${f.name}${f.detail ? ` (${f.detail})` : ''}`).join(', ')}`)
  }

  const rate = Math.round((fullyPassing / GOALS.length) * 100)
  console.log(`\npass rate: ${fullyPassing}/${GOALS.length} (${rate}%)`)

  if (modelsAutoFilled > 0) {
    console.log(
      `note: ${modelsAutoFilled} node(s) arrived without a model and were auto-filled by ` +
      `normalizePlan(). Not counted as failures — /api/plan repairs them — but a rising ` +
      `count means the planner prompt is drifting.`
    )
  }

  if (failures.length) {
    console.log('\nfailures:')
    failures.forEach((f) => console.log(f))
  }
  console.log()
}

main().catch((err) => {
  console.error('Eval failed:', err)
  process.exit(1)
})
