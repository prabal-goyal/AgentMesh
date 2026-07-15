const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export async function generatePlan(goal: string): Promise<{
  nodes: Array<{
    id: string
    type: string
    label: string
    systemPrompt: string
    model: string
    condition?: string   // only present on conditional nodes
  }>
  edges: Array<{
    source: string
    target: string
    sourceHandle?: string  // 'yes' or 'no' for edges from conditional nodes
  }>
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

// Mirror of the backend StreamEvent type
export type StreamEvent =
  | { type: 'node_start';   nodeId: string; label: string }
  | { type: 'node_token';   nodeId: string; token: string }
  | { type: 'node_done';    nodeId: string; output: string }
  | { type: 'node_skipped'; nodeId: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

// Opens a streaming connection and calls onEvent for every SSE event.
// Uses fetch + ReadableStream instead of EventSource because we POST a body.
export async function streamExecuteWorkflow(
  payload: {
    nodes: Array<{ id: string; label: string; model: string; systemPrompt: string; nodeType?: string; condition?: string }>
    edges: Array<{ source: string; target: string; sourceHandle?: string }>
    goal: string
  },
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/execute/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // { stream: true } handles multi-byte characters split across chunks
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by \n\n — keep incomplete last part in buffer
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const dataLine = part.split('\n').find((l) => l.startsWith('data: '))
      if (!dataLine) continue
      try {
        onEvent(JSON.parse(dataLine.slice(6)) as StreamEvent)
      } catch {
        // skip malformed events
      }
    }
  }
}
