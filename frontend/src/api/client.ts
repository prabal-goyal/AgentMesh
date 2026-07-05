const API_BASE = 'http://localhost:3001'

// Sends the user's goal to the backend and returns the generated workflow plan.
// Throws an error if the server responds with a non-2xx status.
export async function generatePlan(goal: string): Promise<{
  nodes: Array<{
    id: string
    type: string
    label: string
    systemPrompt: string
    model: string
  }>
  edges: Array<{ source: string; target: string }>
}> {
  const res = await fetch(`${API_BASE}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `Server error ${res.status}`)
  }

  return res.json()
}

// Sends the workflow to the backend for sequential execution.
// Returns a map of nodeId → output text for every node.
export async function executeWorkflow(payload: {
  nodes: Array<{ id: string; label: string; model: string; systemPrompt: string }>
  edges: Array<{ source: string; target: string }>
  goal: string
}): Promise<{ results: Record<string, string> }> {
  const res = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `Server error ${res.status}`)
  }

  return res.json()
}
