const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// /api/plan and /api/execute are auth-gated on the backend — they spend
// provider credits, so every call carries the caller's JWT. Same shape as
// the helper in workflows.ts.
function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function generatePlan(token: string, goal: string): Promise<{
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
    headers: authHeaders(token),
    body: JSON.stringify({ goal }),
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
  | { type: 'run_usage';    nodeId: string; model: string; inputTokens: number; outputTokens: number; cost: number; ttftMs: number | null; durationMs: number }
  | { type: 'done' }
  | { type: 'error'; message: string; nodeId?: string; durationMs?: number }

// Opens a streaming connection and calls onEvent for every SSE event.
// Uses fetch + ReadableStream instead of EventSource because we POST a body.
export async function streamExecuteWorkflow(
  token: string,
  payload: {
    nodes: Array<{ id: string; label: string; model: string; systemPrompt: string; nodeType?: string; condition?: string }>
    edges: Array<{ source: string; target: string; sourceHandle?: string }>
    goal: string
  },
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/execute/stream`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  // Auth, quota and validation all reject before the SSE stream opens, so a
  // failure here is a normal JSON body — surface its message rather than a
  // bare status code.
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `Server error ${res.status}`)
  }
  if (!res.body) throw new Error('Server returned an empty stream')

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
