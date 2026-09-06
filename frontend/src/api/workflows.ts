import type { WorkflowNode, WorkflowEdge } from '../types/workflow'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export interface WorkflowSummary {
  id:         string
  name:       string
  created_at: string
  updated_at: string
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowDetail extends WorkflowSummary {
  graph: WorkflowGraph
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function throwIfNotOk(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `Server error ${res.status}`)
  }
}

export async function saveWorkflow(token: string, name: string, graph: WorkflowGraph): Promise<WorkflowSummary> {
  const res = await fetch(`${API_BASE}/api/workflows`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, graph }),
  })
  await throwIfNotOk(res)
  return (await res.json()).workflow
}

export async function listWorkflows(token: string): Promise<WorkflowSummary[]> {
  const res = await fetch(`${API_BASE}/api/workflows`, {
    headers: authHeaders(token),
  })
  await throwIfNotOk(res)
  return (await res.json()).workflows
}

export async function getWorkflow(token: string, id: string): Promise<WorkflowDetail> {
  const res = await fetch(`${API_BASE}/api/workflows/${id}`, {
    headers: authHeaders(token),
  })
  await throwIfNotOk(res)
  return (await res.json()).workflow
}

export async function deleteWorkflow(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workflows/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  await throwIfNotOk(res)
}
