import { resolveModel } from './openrouter.js'
import { searchWeb } from './tavily.js'

export interface NodeInput {
  id: string
  label: string
  model: string
  systemPrompt: string
  nodeType?: string  // used to decide whether to offer the search tool
}

export interface EdgeInput {
  source: string
  target: string
}

// Kahn's algorithm — returns nodes in an order where every node
// appears AFTER all the nodes that point to it
function topoSort(nodes: NodeInput[], edges: EdgeInput[]): NodeInput[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]))

  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const queue = nodes.filter((n) => inDegree.get(n.id) === 0)
  const sorted: NodeInput[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)

    for (const childId of adj.get(node.id) ?? []) {
      const remaining = (inDegree.get(childId) ?? 0) - 1
      inDegree.set(childId, remaining)
      if (remaining === 0) queue.push(nodeMap.get(childId)!)
    }
  }

  return sorted
}

function getParentIds(nodeId: string, edges: EdgeInput[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source)
}

export type StreamEvent =
  | { type: 'node_start'; nodeId: string; label: string }
  | { type: 'node_token'; nodeId: string; token: string }
  | { type: 'node_done';  nodeId: string; output: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

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
      return `[${parentLabel}]:\n${outputs[id]}`
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
    description:
      'Search the web for current information. Use this when the query requires up-to-date data, ' +
      'recent events, current prices, live statistics, or anything that may have changed after your training cutoff. ' +
      'Do NOT use this for timeless facts, historical information, or conceptual questions.',
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

// Runs a single node with streaming, offering the search_web tool for research nodes.
// Returns the full output text. Calls onEvent for every token so the SSE layer can
// push updates to the frontend in real time.
async function runNode(
  node: NodeInput,
  userMessage: string,
  onEvent: (event: StreamEvent) => void
): Promise<string> {
  const { client, model } = resolveModel(node.model)
  const isResearch = node.nodeType === 'research'

  const messages: Parameters<typeof client.chat.completions.create>[0]['messages'] = [
    { role: 'system', content: node.systemPrompt },
    { role: 'user',   content: userMessage },
  ]

  // ── Phase 1: streaming call, with search tool offered to research nodes ──
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 2048,
    stream: true,
    // Only research nodes get the tool — other node types (writer, critic) don't need search
    ...(isResearch ? { tools: [SEARCH_WEB_TOOL], tool_choice: 'auto' } : {}),
    messages,
  })

  let fullOutput = ''
  let finishReason = ''

  // Tool call arguments arrive as tiny deltas — we accumulate them here
  const toolCall = { id: '', name: '', arguments: '' }

  for await (const chunk of stream) {
    const choice = chunk.choices[0]
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
    // No tool use — stream finished normally, we're done
    return fullOutput
  }

  // ── Phase 2: execute the tool, then stream the final answer ──

  // Tell the user what's being searched — shows up live in the output panel
  const { query } = JSON.parse(toolCall.arguments) as { query: string }
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
    max_tokens: 2048,
    stream: true,
    messages: messagesWithResult,
  })

  for await (const chunk of finalStream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) {
      fullOutput += token
      onEvent({ type: 'node_token', nodeId: node.id, token })
    }
  }

  return fullOutput
}

// Streaming version — calls onEvent for each token as it arrives.
// The route layer formats these events as SSE and writes them to the response.
export async function streamExecuteWorkflow(
  nodes: NodeInput[],
  edges: EdgeInput[],
  goal: string,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const sorted  = topoSort(nodes, edges)
  const outputs: Record<string, string> = {}

  for (const node of sorted) {
    onEvent({ type: 'node_start', nodeId: node.id, label: node.label })

    const userMessage = buildUserMessage(node, nodes, edges, outputs, goal)
    const output = await runNode(node, userMessage, onEvent)

    outputs[node.id] = output
    onEvent({ type: 'node_done', nodeId: node.id, output })
  }

  onEvent({ type: 'done' })
}

// Sync version — kept for reference, used by the non-streaming /api/execute route
export async function executeWorkflow(
  nodes: NodeInput[],
  edges: EdgeInput[],
  goal: string
): Promise<Record<string, string>> {
  const sorted  = topoSort(nodes, edges)
  const outputs: Record<string, string> = {}

  for (const node of sorted) {
    const userMessage = buildUserMessage(node, nodes, edges, outputs, goal)
    const { client, model } = resolveModel(node.model)

    const response = await client.chat.completions.create({
      model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: node.systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    })

    outputs[node.id] = response.choices[0].message.content ?? ''
  }

  return outputs
}
