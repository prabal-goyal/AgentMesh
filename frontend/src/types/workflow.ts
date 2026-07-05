import type { Node, Edge } from '@xyflow/react'

// The four agent types a node can be
export type NodeType = 'research' | 'writer' | 'critic' | 'custom'

// Lifecycle status of a node during workflow execution
export type NodeStatus = 'idle' | 'running' | 'done' | 'error'

// Data stored inside each node — this is what your components read
// extends Record<string, unknown> because React Flow v12 requires it
export interface WorkflowNodeData extends Record<string, unknown> {
  label: string
  nodeType: NodeType
  model: string
  systemPrompt: string
  status: NodeStatus
  output?: string
}

// Full React Flow node = position + id + our data above
export type WorkflowNode = Node<WorkflowNodeData>

// Edge is just React Flow's built-in edge — no custom data needed yet
export type WorkflowEdge = Edge
