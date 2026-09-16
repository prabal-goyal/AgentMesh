import { resolveModel } from './openrouter.js'
import { searchWeb } from './tavily.js'
import { withStallTimeout } from './stream.js'

// A provider that opens a stream and goes quiet would otherwise hold the SSE
// connection open forever. See lib/stream.ts for why these two budgets differ.
const FIRST_CHUNK_TIMEOUT_MS = 90_000
const BETWEEN_CHUNKS_TIMEOUT_MS = 20_000

export interface NodeInput {
  id: string
  label: string
  model: string
  systemPrompt: string
  nodeType?: string   // used to decide whether to offer the search tool
  condition?: string  // only used when nodeType === 'conditional'
}

export interface EdgeInput {
  source: string
  target: string
  sourceHandle?: string  // 'yes' or 'no' for edges leaving a conditional node
}

// Thrown when the graph contains a cycle. Typed (rather than a bare Error) so
// callers can tell "this workflow is malformed" apart from "a provider failed".
export class CyclicGraphError extends Error {
  constructor(public readonly nodeIds: string[]) {
    // A single trapped node can only be waiting on itself — every other node it
    // could depend on was scheduled — so that case is always a self-loop.
    const detail = nodeIds.length === 1
      ? `node ${nodeIds[0]} depends on itself`
      : `nodes ${nodeIds.join(', ')} depend on each other`
    super(`Workflow has a cycle: ${detail} and can never run`)
    this.name = 'CyclicGraphError'
  }
}

// Wave-based Kahn's algorithm — groups nodes into waves where every node
// in a wave can run in parallel (they only depend on nodes from earlier waves)
export function topoWaves(nodes: NodeInput[], edges: EdgeInput[]): NodeInput[][] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]))

  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const waves: NodeInput[][] = []
  let wave = nodes.filter((n) => inDegree.get(n.id) === 0)

  while (wave.length > 0) {
    waves.push(wave)
    const next: NodeInput[] = []

    for (const node of wave) {
      for (const childId of adj.get(node.id) ?? []) {
        const remaining = (inDegree.get(childId) ?? 0) - 1
        inDegree.set(childId, remaining)
        if (remaining === 0) next.push(nodeMap.get(childId)!)
      }
    }

    wave = next
  }

  // Kahn's terminal check. Every node in a cycle is waiting on another node in
  // that same cycle, so none of them ever reaches in-degree 0 and the loop
  // above just runs out of work. Without this the cyclic nodes are silently
  // dropped and the run reports success with their outputs missing.
  const scheduled = new Set(waves.flat().map((n) => n.id))
  if (scheduled.size < nodes.length) {
    throw new CyclicGraphError(nodes.filter((n) => !scheduled.has(n.id)).map((n) => n.id))
  }

  return waves
}

export function getParentIds(nodeId: string, edges: EdgeInput[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source)
}

// Evaluates a simple condition string against the prior node's text output.
// Format: "contains:keyword" or "not-contains:keyword". Empty = always true.
export function evaluateCondition(condition: string, output: string): boolean {
  const lower = output.toLowerCase()
  if (condition.startsWith('contains:')) {
    return lower.includes(condition.slice('contains:'.length).toLowerCase().trim())
  }
  if (condition.startsWith('not-contains:')) {
    return !lower.includes(condition.slice('not-contains:'.length).toLowerCase().trim())
  }
  return true  // empty or unknown condition defaults to YES branch
}

// A node is skipped if it was explicitly pruned OR all of its parents are skipped.
// The "all parents" rule cascades the skip down a chain: A → B → C, skip A → skip B → skip C.
//
// "All" rather than "any" is deliberate, and it is what makes branching work.
// In the canonical Router pattern — Router →(yes) A, Router →(no) B, A → C, B → C —
// taking the yes branch prunes B, so the join node C has one live parent and one
// skipped one. Under an "any parent skipped" rule C would also be pruned and every
// branching workflow would die at its join. Under "all", C runs on A's output,
// which is the whole point of converging after a branch.
// The cost is that C runs on partial context; buildUserMessage drops the parents
// that contributed nothing and warns, rather than feeding the model empty stanzas.
export function shouldSkip(nodeId: string, edges: EdgeInput[], skipped: Set<string>): boolean {
  if (skipped.has(nodeId)) return true
  const parentIds = edges.filter((e) => e.target === nodeId).map((e) => e.source)
  return parentIds.length > 0 && parentIds.every((id) => skipped.has(id))
}

export type StreamEvent =
  | { type: 'node_start';   nodeId: string; label: string }
  | { type: 'node_token';   nodeId: string; token: string }
  | { type: 'node_done';    nodeId: string; output: string }
  | { type: 'node_skipped'; nodeId: string }
  // ttftMs is null when a node produced no tokens at all — see node_runs.ttft_ms
  | { type: 'run_usage';    nodeId: string; model: string; inputTokens: number; outputTokens: number; cost: number; ttftMs: number | null; durationMs: number }
  | { type: 'done' }
  // nodeId is absent only for failures outside any node (e.g. a thrown wave)
  | { type: 'error'; message: string; nodeId?: string; durationMs?: number }

// Prices in USD per 1 million tokens (input / output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'google/gemini-2.5-flash':     { input: 0.15, output: 0.60 },
  'anthropic/claude-haiku-4-5':  { input: 0.80, output: 4.00 },
  'anthropic/claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'openai/gpt-4o-mini':          { input: 0.15, output: 0.60 },
  'openai/gpt-4o':               { input: 2.50, output: 10.00 },
}

// The pricing table doubles as the model allowlist: a model we can't price is a
// model we won't run. This is what stops a caller from POSTing an arbitrary
// (expensive) model name and having it billed to our keys at a reported $0.
export const ALLOWED_MODELS = Object.keys(MODEL_PRICING)

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model] ?? { input: 0, output: 0 }
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export function buildUserMessage(
  node: NodeInput,
  nodes: NodeInput[],
  edges: EdgeInput[],
  outputs: Record<string, string>,
  goal: string
): string {
  const parentIds = getParentIds(node.id, edges)
  const rootMessage = `The workflow goal is: ${goal}\n\nComplete your task based on your role.`

  if (parentIds.length === 0) return rootMessage

  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id

  // A parent contributes nothing when it was pruned by a router or when it
  // errored — neither leaves an entry in outputs. Including it anyway would emit
  // an empty "[Label]:" stanza: paid-for input tokens carrying no information,
  // and an invitation for the model to invent what belonged there.
  const contributing = parentIds.filter((id) => (outputs[id] ?? '').trim().length > 0)

  if (contributing.length < parentIds.length) {
    const missing = parentIds.filter((id) => !contributing.includes(id)).map(label)
    console.warn(
      `⚠️  [${node.label}] ran without input from ${missing.length} of ${parentIds.length} parents (${missing.join(', ')})`
    )
  }

  // Every upstream branch was pruned or failed. Falling back to the goal beats
  // sending "Here is the output from the previous step:" followed by nothing.
  if (contributing.length === 0) return rootMessage

  const context = contributing
    .map((id) => {
      const output = outputs[id] ?? ''
      // Truncate long parent outputs to keep downstream input tokens manageable
      const truncated = output.length > 2000 ? output.slice(0, 2000) + '\n\n[truncated]' : output
      return `[${label(id)}]:\n${truncated}`
    })
    .join('\n\n---\n\n')

  return `Here is the output from the previous step:\n\n${context}\n\nNow complete your task based on the above.`
}

// The tool definition we pass to the model.
// This is what tells the model "you have a search_web function available."
// The model reads the description to decide when to use it — so it needs to be specific.
const SEARCH_WEB_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_web',
    description: 'Search the web for current or recent information not in your training data.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A concise search query — treat it like a Google search',
        },
      },
      required: ['query'],
    },
  },
}

interface NodeResult {
  output: string
  inputTokens: number
  outputTokens: number
  ttftMs: number | null
  durationMs: number
}

// A model may need several rounds of searching to answer — "search, read the
// result, search again for the gap". Bounded so a model that keeps calling the
// tool cannot spend money forever; on the last round tools are withheld, which
// forces a text answer rather than truncating mid-decision.
const MAX_TOOL_ROUNDS = 3

// One in-progress tool call, assembled from streaming deltas.
export interface PendingToolCall {
  id: string
  name: string
  arguments: string
}

// Executes one accumulated tool call and returns its result as text.
export async function runTool(call: PendingToolCall): Promise<string> {
  if (call.name !== 'search_web') return `Unknown tool "${call.name}".`

  // Some models append stray characters after the closing } — trim before parsing
  let query: string
  try {
    query = (JSON.parse(call.arguments.trim()) as { query: string }).query
  } catch {
    return 'Tool arguments were malformed; no search was performed.'
  }

  return searchWeb(query)
}

// Runs a single node with streaming, offering the search_web tool for research nodes.
// Returns output text plus token counts for cost tracking.
async function runNode(
  node: NodeInput,
  userMessage: string,
  onEvent: (event: StreamEvent) => void
): Promise<NodeResult> {
  const { client, model } = resolveModel(node.model)
  const isResearch = node.nodeType === 'research'

  // Timing starts before the provider call so setup and connection time count
  // — that latency is real to the user even though no tokens have moved yet.
  const startedAt = Date.now()
  let ttftMs: number | null = null

  // Anthropic models support cache_control on system prompts — cuts repeat cost to 10%
  // Other models (OpenAI, Google) don't support this extension so we send a plain string
  const systemContent = node.model.startsWith('anthropic/')
    ? ([{ type: 'text', text: node.systemPrompt, cache_control: { type: 'ephemeral' } }] as any)
    : node.systemPrompt

  type Messages = Parameters<typeof client.chat.completions.create>[0]['messages']
  const messages: Messages = [
    { role: 'system', content: systemContent },
    { role: 'user',   content: userMessage },
  ]

  let fullOutput   = ''
  let inputTokens  = 0
  let outputTokens = 0

  // One controller per node. Aborting it cancels whichever provider request is
  // in flight, so a stalled stream releases its socket instead of lingering.
  const controller = new AbortController()
  const guard = <T>(source: AsyncIterable<T>) =>
    withStallTimeout(source, {
      firstChunkMs: FIRST_CHUNK_TIMEOUT_MS,
      betweenChunksMs: BETWEEN_CHUNKS_TIMEOUT_MS,
      abort: () => controller.abort(),
    })

  // Every visible token goes through here so time-to-first-token is captured
  // once, at the first thing the user actually sees. For a research node that
  // is the "🔍 Searching" line, not the post-search prose — which is correct:
  // TTFT measures how long the pane sat empty.
  function emitToken(token: string) {
    ttftMs ??= Date.now() - startedAt
    onEvent({ type: 'node_token', nodeId: node.id, token })
  }

  const finish = (): NodeResult => ({
    output: fullOutput,
    inputTokens,
    outputTokens,
    ttftMs,
    durationMs: Date.now() - startedAt,
  })

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Tools are offered on every round except the last, so the budget ends with
    // the model writing an answer instead of requesting a search we won't run.
    const offerTools = isResearch && round < MAX_TOOL_ROUNDS - 1

    const stream = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      stream: true,
      stream_options: { include_usage: true },  // ask provider to return token counts in last chunk
      ...(offerTools ? { tools: [SEARCH_WEB_TOOL], tool_choice: 'auto' as const } : {}),
      messages,
    }, { signal: controller.signal })

    let finishReason = ''
    // Keyed by the delta's index: a model can open several tool calls at once
    // and their argument fragments arrive interleaved, so [0] is not enough.
    const pending = new Map<number, PendingToolCall>()

    for await (const chunk of guard(stream)) {
      // Usage arrives in a final chunk with choices:[] — capture then skip normal processing
      if (chunk.usage) {
        inputTokens  += chunk.usage.prompt_tokens
        outputTokens += chunk.usage.completion_tokens
      }

      const choice = chunk.choices[0]
      if (!choice) continue

      if (choice.finish_reason) finishReason = choice.finish_reason

      // Path A: model is writing a normal answer — emit the token
      const token = choice.delta?.content ?? ''
      if (token) {
        fullOutput += token
        emitToken(token)
      }

      // Path B: model is building tool calls — accumulate each one's arguments
      for (const td of choice.delta?.tool_calls ?? []) {
        const call = pending.get(td.index) ?? { id: '', name: '', arguments: '' }
        if (td.id)                  call.id        = td.id
        if (td.function?.name)      call.name      = td.function.name
        if (td.function?.arguments) call.arguments += td.function.arguments
        pending.set(td.index, call)
      }
    }

    // Model wrote an answer rather than asking for a tool — we're done.
    if (finishReason !== 'tool_calls' || pending.size === 0) return finish()

    const calls = [...pending.values()]

    for (const call of calls) {
      // Show the query before running it, so a multi-round search reads as a
      // narrative on the canvas rather than a long unexplained pause.
      let label = `🔍 Searching…\n\n`
      try {
        const { query } = JSON.parse(call.arguments.trim()) as { query: string }
        label = `🔍 Searching: "${query}"\n\n`
      } catch {
        // fall through to the generic label; runTool reports the parse failure
      }
      fullOutput += label
      emitToken(label)
    }

    // Independent searches, so run them together rather than end to end.
    const results = await Promise.all(calls.map(runTool))

    // The API requires the full conversation history: the assistant's tool_call
    // decision, then one tool message per call. The assistant message must have
    // content: null (not '') when it made a tool call, and every tool_call_id
    // must be answered or the next request is rejected.
    messages.push({
      role: 'assistant' as const,
      content: null,
      tool_calls: calls.map((call) => ({
        id:       call.id,
        type:     'function' as const,
        function: { name: call.name, arguments: call.arguments },
      })),
    })

    calls.forEach((call, i) => {
      messages.push({
        role:         'tool' as const,
        tool_call_id: call.id,
        content:      results[i],
      })
    })
  }

  // Budget exhausted. Tools were withheld on the final round, so this is only
  // reached if that round still ended in a tool_calls finish_reason.
  return finish()
}

// Streaming version — runs nodes in parallel waves.
// All nodes in a wave have no dependencies on each other, only on previous waves,
// so they can safely fire at the same time via Promise.allSettled.
export async function streamExecuteWorkflow(
  nodes: NodeInput[],
  edges: EdgeInput[],
  goal: string,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const waves   = topoWaves(nodes, edges)
  const outputs: Record<string, string> = {}
  const skipped = new Set<string>()

  for (const wave of waves) {
    // Promise.allSettled — waits for every node in the wave, even if some fail.
    // Unlike Promise.all, a single node crash does not cancel the others.
    await Promise.allSettled(
      wave.map(async (node) => {
        if (shouldSkip(node.id, edges, skipped)) {
          skipped.add(node.id)
          onEvent({ type: 'node_skipped', nodeId: node.id })
          return
        }

        if (node.nodeType === 'conditional') {
          onEvent({ type: 'node_start', nodeId: node.id, label: node.label })

          const parentIds    = getParentIds(node.id, edges)
          const parentOutput = parentIds.map((id) => outputs[id] ?? '').join('\n')
          const conditionMet = evaluateCondition(node.condition ?? '', parentOutput)
          const result       = conditionMet ? 'yes' : 'no'
          const prunedHandle = conditionMet ? 'no'  : 'yes'

          edges
            .filter((e) => e.source === node.id && e.sourceHandle === prunedHandle)
            .forEach((e) => skipped.add(e.target))

          outputs[node.id] = result
          onEvent({ type: 'node_done', nodeId: node.id, output: `Branch taken: ${result.toUpperCase()}` })
          return
        }

        // Regular AI node
        onEvent({ type: 'node_start', nodeId: node.id, label: node.label })
        const userMessage = buildUserMessage(node, nodes, edges, outputs, goal)

        // Measured out here too, so a node that throws still reports how long
        // it burned before failing — otherwise failures vanish from latency data.
        const nodeStartedAt = Date.now()

        try {
          const { output, inputTokens, outputTokens, ttftMs, durationMs } = await runNode(node, userMessage, onEvent)
          const cost = calcCost(node.model, inputTokens, outputTokens)
          outputs[node.id] = output.replace(/🔍 Searching: ".*?"\n\n/g, '')
          onEvent({ type: 'node_done',  nodeId: node.id, output })
          onEvent({ type: 'run_usage',  nodeId: node.id, model: node.model, inputTokens, outputTokens, cost, ttftMs, durationMs })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          onEvent({ type: 'error', message: `[${node.label}] ${message}`, nodeId: node.id, durationMs: Date.now() - nodeStartedAt })
        }
      })
    )
  }

  onEvent({ type: 'done' })
}
