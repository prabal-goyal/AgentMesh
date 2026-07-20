import { resolveModel } from './openrouter.js'
import { searchWeb } from './tavily.js'

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

// Wave-based Kahn's algorithm — groups nodes into waves where every node
// in a wave can run in parallel (they only depend on nodes from earlier waves)
function topoWaves(nodes: NodeInput[], edges: EdgeInput[]): NodeInput[][] {
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

  return waves
}

function getParentIds(nodeId: string, edges: EdgeInput[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source)
}

// Evaluates a simple condition string against the prior node's text output.
// Format: "contains:keyword" or "not-contains:keyword". Empty = always true.
function evaluateCondition(condition: string, output: string): boolean {
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
function shouldSkip(nodeId: string, edges: EdgeInput[], skipped: Set<string>): boolean {
  if (skipped.has(nodeId)) return true
  const parentIds = edges.filter((e) => e.target === nodeId).map((e) => e.source)
  return parentIds.length > 0 && parentIds.every((id) => skipped.has(id))
}

export type StreamEvent =
  | { type: 'node_start';   nodeId: string; label: string }
  | { type: 'node_token';   nodeId: string; token: string }
  | { type: 'node_done';    nodeId: string; output: string }
  | { type: 'node_skipped'; nodeId: string }
  | { type: 'run_usage';    nodeId: string; model: string; inputTokens: number; outputTokens: number; cost: number }
  | { type: 'done' }
  | { type: 'error'; message: string }

// Prices in USD per 1 million tokens (input / output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'google/gemini-2.5-flash':    { input: 0.15, output: 0.60 },
  'anthropic/claude-haiku-4-5': { input: 0.80, output: 4.00 },
  'openai/gpt-4o-mini':         { input: 0.15, output: 0.60 },
  'openai/gpt-4o':              { input: 2.50, output: 10.00 },
}

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model] ?? { input: 0, output: 0 }
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

function buildUserMessage(
  node: NodeInput,
  nodes: NodeInput[],
  edges: EdgeInput[],
  outputs: Record<string, string>,
  goal: string
): string {
  const parentIds = getParentIds(node.id, edges)

  if (parentIds.length === 0) {
    return `The workflow goal is: ${goal}\n\nComplete your task based on your role.`
  }

  const context = parentIds
    .map((id) => {
      const parentLabel = nodes.find((n) => n.id === id)?.label ?? id
      const output = outputs[id] ?? ''
      // Truncate long parent outputs to keep downstream input tokens manageable
      const truncated = output.length > 2000 ? output.slice(0, 2000) + '\n\n[truncated]' : output
      return `[${parentLabel}]:\n${truncated}`
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

  // Anthropic models support cache_control on system prompts — cuts repeat cost to 10%
  // Other models (OpenAI, Google) don't support this extension so we send a plain string
  const systemContent = node.model.startsWith('anthropic/')
    ? ([{ type: 'text', text: node.systemPrompt, cache_control: { type: 'ephemeral' } }] as any)
    : node.systemPrompt

  const messages: Parameters<typeof client.chat.completions.create>[0]['messages'] = [
    { role: 'system', content: systemContent },
    { role: 'user',   content: userMessage },
  ]

  // ── Phase 1: streaming call, with search tool offered to research nodes ──
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    stream: true,
    stream_options: { include_usage: true },  // ask provider to return token counts in last chunk
    ...(isResearch ? { tools: [SEARCH_WEB_TOOL], tool_choice: 'auto' } : {}),
    messages,
  })

  let fullOutput   = ''
  let finishReason = ''
  let inputTokens  = 0
  let outputTokens = 0

  // Tool call arguments arrive as tiny deltas — we accumulate them here
  const toolCall = { id: '', name: '', arguments: '' }

  for await (const chunk of stream) {
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
      onEvent({ type: 'node_token', nodeId: node.id, token })
    }

    // Path B: model is building a tool call — accumulate the arguments
    // tool_calls is an array (models can call multiple tools), but we only handle [0] here
    const td = choice.delta?.tool_calls?.[0]
    if (td) {
      if (td.id)                  toolCall.id        = td.id
      if (td.function?.name)      toolCall.name      = td.function.name
      if (td.function?.arguments) toolCall.arguments += td.function.arguments
    }
  }

  // ── Did the model decide to search? ──
  if (finishReason !== 'tool_calls') {
    return { output: fullOutput, inputTokens, outputTokens }
  }

  // ── Phase 2: execute the tool, then stream the final answer ──

  // Some models append stray characters after the closing } — trim before parsing
  let parsedArgs: { query: string }
  try {
    parsedArgs = JSON.parse(toolCall.arguments.trim()) as { query: string }
  } catch {
    return { output: fullOutput, inputTokens, outputTokens }  // arguments malformed — return whatever text the model generated
  }
  const { query } = parsedArgs
  const searchingLabel = `🔍 Searching: "${query}"\n\n`
  fullOutput += searchingLabel
  onEvent({ type: 'node_token', nodeId: node.id, token: searchingLabel })

  const searchResults = await searchWeb(query)

  // The API requires the full conversation history:
  // original messages → assistant's tool_call decision → our tool result
  // The assistant message must have content: null (not '') when it made a tool call
  const messagesWithResult: Parameters<typeof client.chat.completions.create>[0]['messages'] = [
    ...messages,
    {
      role: 'assistant' as const,
      content: null,
      tool_calls: [{
        id:       toolCall.id,
        type:     'function' as const,
        function: { name: toolCall.name, arguments: toolCall.arguments },
      }],
    },
    {
      role:         'tool' as const,
      tool_call_id: toolCall.id, // must match the id above so the API ties them together
      content:      searchResults,
    },
  ]

  // Stream the final answer — model now has the search results as context
  const finalStream = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    stream: true,
    stream_options: { include_usage: true },
    messages: messagesWithResult,
  })

  for await (const chunk of finalStream) {
    if (chunk.usage) {
      inputTokens  += chunk.usage.prompt_tokens
      outputTokens += chunk.usage.completion_tokens
    }

    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) {
      fullOutput += token
      onEvent({ type: 'node_token', nodeId: node.id, token })
    }
  }

  return { output: fullOutput, inputTokens, outputTokens }
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

        try {
          const { output, inputTokens, outputTokens } = await runNode(node, userMessage, onEvent)
          const cost = calcCost(node.model, inputTokens, outputTokens)
          outputs[node.id] = output.replace(/🔍 Searching: ".*?"\n\n/g, '')
          onEvent({ type: 'node_done',  nodeId: node.id, output })
          onEvent({ type: 'run_usage',  nodeId: node.id, model: node.model, inputTokens, outputTokens, cost })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          onEvent({ type: 'error', message: `[${node.label}] ${message}` })
        }
      })
    )
  }

  onEvent({ type: 'done' })
}

// Sync version — kept for reference, used by the non-streaming /api/execute route
export async function executeWorkflow(
  nodes: NodeInput[],
  edges: EdgeInput[],
  goal: string
): Promise<Record<string, string>> {
  const sorted  = topoWaves(nodes, edges).flat()
  const outputs: Record<string, string> = {}

  for (const node of sorted) {
    const userMessage = buildUserMessage(node, nodes, edges, outputs, goal)
    const { client, model } = resolveModel(node.model)

    const response = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: node.systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    })

    outputs[node.id] = response.choices[0].message.content ?? ''
  }

  return outputs
}
