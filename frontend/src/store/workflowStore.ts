import { create } from 'zustand'
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData, NodeType } from '../types/workflow'

// Default model per node type — matches our OpenRouter model strategy
const NODE_MODEL_DEFAULTS: Record<NodeType, string> = {
  research: 'google/gemini-flash-2.5',
  writer:   'anthropic/claude-haiku-4-5',
  critic:   'openai/gpt-4o-mini',
  custom:   'openai/gpt-4o-mini',
}

const NODE_PROMPT_DEFAULTS: Record<NodeType, string> = {
  research: 'You are a research agent. Thoroughly research the given topic and return a structured summary with key findings.',
  writer:   'You are a writer agent. Using the provided context, write clear and engaging content.',
  critic:   'You are a critic agent. Review the provided content and give constructive feedback on clarity, accuracy, and quality.',
  custom:   'You are a helpful AI agent. Complete the task described in the user message.',
}

// Label shown on the node by default
const NODE_LABEL_DEFAULTS: Record<NodeType, string> = {
  research: 'Research',
  writer:   'Writer',
  critic:   'Critic',
  custom:   'Custom',
}

interface WorkflowState {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNodeId: string | null

  // React Flow calls these when the user drags, deletes, or resizes nodes/edges
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void

  // React Flow calls this when the user draws a connection between two nodes
  onConnect: (connection: Connection) => void

  // Our own actions
  addNode: (type: NodeType) => void
  updateNodeData: (id: string, data: Partial<WorkflowNodeData>) => void
  deleteNode: (id: string) => void
  selectNode: (id: string | null) => void
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Two starter nodes so the canvas isn't empty on first load
  nodes: [
    {
      id: '1',
      type: 'research',
      position: { x: 100, y: 180 },
      data: {
        label: 'Research',
        nodeType: 'research',
        model: NODE_MODEL_DEFAULTS.research,
        systemPrompt: NODE_PROMPT_DEFAULTS.research,
        status: 'idle',
      },
    },
    {
      id: '2',
      type: 'writer',
      position: { x: 420, y: 180 },
      data: {
        label: 'Writer',
        nodeType: 'writer',
        model: NODE_MODEL_DEFAULTS.writer,
        systemPrompt: NODE_PROMPT_DEFAULTS.writer,
        status: 'idle',
      },
    },
  ],
  edges: [],
  selectedNodeId: null,

  // React Flow gives us a list of changes (move, remove, select)
  // applyNodeChanges applies them to our array and returns the updated array
  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  // addEdge merges the new connection into the existing edges array
  onConnect: (connection) =>
    set({ edges: addEdge(connection, get().edges) }),

  addNode: (type) => {
    const id = crypto.randomUUID()
    // Offset each new node slightly so they don't stack
    const count = get().nodes.length
    const newNode: WorkflowNode = {
      id,
      type,
      position: { x: 100 + count * 40, y: 100 + count * 40 },
      data: {
        label: NODE_LABEL_DEFAULTS[type],
        nodeType: type,
        model: NODE_MODEL_DEFAULTS[type],
        systemPrompt: NODE_PROMPT_DEFAULTS[type],
        status: 'idle',
      },
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  updateNodeData: (id, data) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }),

  deleteNode: (id) =>
    set({
      // Remove the node itself
      nodes: get().nodes.filter((n) => n.id !== id),
      // Remove any edges that were connected to this node
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      // Clear selection if the deleted node was selected
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    }),

  selectNode: (id) => set({ selectedNodeId: id }),
}))
