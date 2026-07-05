import { resolveModel } from './openrouter.js'

export interface NodeInput {
  id: string
  label: string
  model: string
  systemPrompt: string
}

export interface EdgeInput {
  source: string
  target: string
}

// Kahn's algorithm — returns nodes in an order where every node
// appears AFTER all the nodes that point to it
function topoSort(nodes: NodeInput[], edges: EdgeInput[]): NodeInput[] {
  // Quick lookup: id → node object
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // How many incoming edges does each node have?
  // Start at 0 for everyone, then count up as we scan edges
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))

  // Adjacency list: for each node, which nodes does it point TO?
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]))

  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  // Queue starts with every node that has no dependencies (inDegree = 0)
  // These are the "entry points" of the workflow
  const queue = nodes.filter((n) => inDegree.get(n.id) === 0)
  const sorted: NodeInput[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)

    // For every node this one points to, remove one incoming edge.
    // If that node now has 0 incoming edges, it's ready to run — add it to queue.
    for (const childId of adj.get(node.id) ?? []) {
      const remaining = (inDegree.get(childId) ?? 0) - 1
      inDegree.set(childId, remaining)
      if (remaining === 0) {
        queue.push(nodeMap.get(childId)!)
      }
    }
  }

  return sorted
}

// Returns the ids of nodes that connect directly INTO the given node
function getParentIds(nodeId: string, edges: EdgeInput[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source)
}

// Runs all nodes in topological order, chains outputs as inputs
export async function executeWorkflow(
  nodes: NodeInput[],
  edges: EdgeInput[],
  goal: string
): Promise<Record<string, string>> {
  const sorted = topoSort(nodes, edges)

  // Accumulates outputs as nodes complete — { nodeId: outputText }
  const outputs: Record<string, string> = {}

  for (const node of sorted) {
    const parentIds = getParentIds(node.id, edges)

    // Build what the user "says" to this agent.
    // First node gets the original goal.
    // Later nodes get the output from their parent(s) as context.
    let userMessage: string

    if (parentIds.length === 0) {
      userMessage = `The workflow goal is: ${goal}\n\nComplete your task based on your role.`
    } else {
      // Combine all parent outputs (handles the case of multiple parents)
      const context = parentIds
        .map((id) => {
          const parentLabel = nodes.find((n) => n.id === id)?.label ?? id
          return `[${parentLabel}]:\n${outputs[id]}`
        })
        .join('\n\n---\n\n')

      userMessage = `Here is the output from the previous step:\n\n${context}\n\nNow complete your task based on the above.`
    }

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
