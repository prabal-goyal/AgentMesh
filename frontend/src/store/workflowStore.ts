import { create } from 'zustand'
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData, NodeType, NodeStatus } from '../types/workflow'

// ── Screen navigation ──────────────────────────────────────────────────────
// The app is a screen-based SPA: each string maps to a full-page view
export type AppScreen = 'home' | 'chat' | 'generating' | 'builder' | 'running' | 'results'

// ── Cost tracking ──────────────────────────────────────────────────────────
export interface NodeUsage {
  nodeId:       string
  label:        string
  model:        string
  inputTokens:  number
  outputTokens: number
  cost:         number
}

export interface RunRecord {
  id:                string
  goal:              string
  timestamp:         number
  nodes:             NodeUsage[]
  totalCost:         number
  totalInputTokens:  number
  totalOutputTokens: number
}

// ── Sidebar messages (AI Director conversation) ────────────────────────────
export interface SidebarMessage {
  id: string
  role: 'user' | 'ai'
  content: string
}

// Default model per node type — matches our OpenRouter model strategy
const NODE_MODEL_DEFAULTS: Record<NodeType, string> = {
  research:    'google/gemini-2.5-flash',
  writer:      'anthropic/claude-haiku-4-5',
  critic:      'openai/gpt-4o-mini',
  custom:      'openai/gpt-4o-mini',
  conditional: '',  // no AI call — evaluates a condition string, not a model
}

const NODE_PROMPT_DEFAULTS: Record<NodeType, string> = {
  research:    'You are a research agent. Thoroughly research the given topic and return a structured summary with key findings.',
  writer:      'You are a writer agent. Using the provided context, write clear and engaging content.',
  critic:      'You are a critic agent. Review the provided content and give constructive feedback on clarity, accuracy, and quality.',
  custom:      'You are a helpful AI agent. Complete the task described in the user message.',
  conditional: '',
}

const NODE_LABEL_DEFAULTS: Record<NodeType, string> = {
  research:    'Research',
  writer:      'Writer',
  critic:      'Critic',
  custom:      'Custom',
  conditional: 'Router',
}

interface WorkflowState {
  // ── Canvas state ──
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNodeId: string | null
  goal: string
  executing: boolean

  // ── Screen navigation ──
  screen: AppScreen

  // ── AI Director sidebar messages ──
  sidebarMessages: SidebarMessage[]

  // ── Run timing (used by ResultsScreen to show elapsed seconds) ──
  runStartTime: number | null
  runEndTime:   number | null

  // ── Cost tracking ──
  currentRunUsage: Record<string, NodeUsage>  // keyed by nodeId, built during a run
  history:         RunRecord[]                 // completed runs this session (max 10)

  // ── React Flow handlers ──
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect:     (connection: Connection) => void

  // ── Canvas actions ──
  addNode:        (type: NodeType) => void
  updateNodeData: (id: string, data: Partial<WorkflowNodeData>) => void
  deleteNode:     (id: string) => void
  selectNode:     (id: string | null) => void
  setWorkflow:    (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void
  setGoal:        (goal: string) => void

  // ── Execution actions ──
  setExecuting:      (executing: boolean) => void
  setNodeStatus:     (id: string, status: NodeStatus) => void
  setNodeOutput:     (id: string, output: string) => void
  appendNodeOutput:  (id: string, token: string) => void
  resetExecution:    () => void

  // ── Navigation actions ──
  setScreen: (screen: AppScreen) => void

  // ── Sidebar actions ──
  addSidebarMessage:   (msg: Omit<SidebarMessage, 'id'>) => void
  clearSidebarMessages: () => void

  // ── Timing actions ──
  setRunTiming: (start: number | null, end: number | null) => void

  // ── Cost tracking actions ──
  recordNodeUsage:  (usage: NodeUsage) => void
  pushRunToHistory: () => void
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Canvas starts empty — the Home screen drives workflow creation
  nodes: [],
  edges: [],
  selectedNodeId: null,
  goal: '',
  executing: false,

  screen: 'home',
  sidebarMessages: [],
  runStartTime: null,
  runEndTime:   null,
  currentRunUsage: {},
  history:         [],

  // React Flow calls these when the user drags, deletes, or resizes nodes/edges
  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  // addEdge merges the new connection into the existing edges array.
  // For edges leaving a Router node, we attach a visible label and color
  // so the user can see which handle is "yes" and which is "no" on the canvas.
  onConnect: (connection) => {
    const sourceNode = get().nodes.find((n) => n.id === connection.source)
    const isRouter   = sourceNode?.data.nodeType === 'conditional'

    const enriched = isRouter
      ? {
          ...connection,
          label: connection.sourceHandle === 'yes' ? 'Yes' : 'No',
          style:        { stroke: connection.sourceHandle === 'yes' ? '#16a34a' : '#dc2626' },
          labelStyle:   { fill: connection.sourceHandle === 'yes' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 1 },
        }
      : connection

    set({ edges: addEdge(enriched, get().edges) })
  },

  addNode: (type) => {
    const id    = crypto.randomUUID()
    const count = get().nodes.length
    const newNode: WorkflowNode = {
      id,
      type,
      position: { x: 100 + count * 40, y: 100 + count * 40 },
      data: {
        label:        NODE_LABEL_DEFAULTS[type],
        nodeType:     type,
        model:        NODE_MODEL_DEFAULTS[type],
        systemPrompt: NODE_PROMPT_DEFAULTS[type],
        status:       'idle',
        ...(type === 'conditional' ? { condition: '' } : {}),
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
      nodes:          get().nodes.filter((n) => n.id !== id),
      edges:          get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    }),

  selectNode: (id) => set({ selectedNodeId: id }),

  // Replaces the entire canvas with a new set of nodes and edges
  setWorkflow: (nodes, edges) => set({ nodes, edges, selectedNodeId: null }),

  setGoal:      (goal)      => set({ goal }),
  setExecuting: (executing) => set({ executing }),

  setNodeStatus: (id, status) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, status } } : n
      ),
    }),

  setNodeOutput: (id, output) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, output } } : n
      ),
    }),

  appendNodeOutput: (id, token) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, output: (n.data.output ?? '') + token } }
          : n
      ),
    }),

  resetExecution: () =>
    set({
      currentRunUsage: {},
      nodes: get().nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: 'idle', output: undefined },
      })),
    }),

  // ── Navigation ──
  setScreen: (screen) => set({ screen }),

  // ── Sidebar ──
  addSidebarMessage: (msg) =>
    set({
      sidebarMessages: [
        ...get().sidebarMessages,
        { id: crypto.randomUUID(), ...msg },
      ],
    }),

  clearSidebarMessages: () => set({ sidebarMessages: [] }),

  // ── Timing ──
  setRunTiming: (start, end) => set({ runStartTime: start, runEndTime: end }),

  // ── Cost tracking ──
  recordNodeUsage: (usage) =>
    set({ currentRunUsage: { ...get().currentRunUsage, [usage.nodeId]: usage } }),

  pushRunToHistory: () => {
    const { goal, currentRunUsage, nodes, history } = get()
    const usageList = Object.values(currentRunUsage)
    // Attach labels from canvas nodes to each usage entry
    const enriched = usageList.map((u) => ({
      ...u,
      label: nodes.find((n) => n.id === u.nodeId)?.data.label ?? u.label,
    }))
    const record: RunRecord = {
      id:                crypto.randomUUID(),
      goal:              goal || 'Untitled run',
      timestamp:         Date.now(),
      nodes:             enriched,
      totalCost:         enriched.reduce((s, u) => s + u.cost, 0),
      totalInputTokens:  enriched.reduce((s, u) => s + u.inputTokens, 0),
      totalOutputTokens: enriched.reduce((s, u) => s + u.outputTokens, 0),
    }
    // Keep last 10 runs — oldest drops off the front
    set({ history: [record, ...history].slice(0, 10) })
  },
}))
